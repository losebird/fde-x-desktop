#!/usr/bin/env node
import { execFile as execFileCb } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { IUI_PIN } from './pins.mjs'
import { PLUGIN_PIN_FILE } from '../../runtime/plugin-vendor.mjs'
import { defaultIuiArtifactPath, explainPinDrift, iuiArtifactName, packDeterministicTarGz, retargetPrimitivePaths, sha256Hex } from './iui-artifact.mjs'
import { resolvePnpmRunner } from './pnpm-runner.mjs'

const execFile = promisify(execFileCb)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PRIMITIVES_VERSION = '0.2.0-rc.2'
const PNPM = '11.7.0'

function nodeSatisfiesIui(version) {
  const [major, minor] = String(version).split('.').map((part) => Number(part))
  if (major > 22) return true
  if (major < 22) return false
  return minor >= 19
}

async function run(command, args, options) {
  await execFile(command, args, { ...options, maxBuffer: 64 * 1024 * 1024 })
}

export async function buildIuiArtifact(options = {}) {
  if (!nodeSatisfiesIui(process.versions.node)) {
    throw new Error(`IUI build needs Node >= 22.19, got ${process.versions.node}`)
  }
  const env = {
    ...process.env,
    COREPACK_HOME: process.env.COREPACK_HOME || '/tmp/corepack-home',
  }
  const runner = await resolvePnpmRunner(env, PNPM)
  const pnpmLabel = [runner.command, ...runner.argsPrefix].join(' ')
  const pin = options.pin || IUI_PIN
  const work = options.workDir || join('/tmp', `fde-iui-build-${pin.commit.slice(0, 12)}`)
  const checkout = join(work, 'src')
  const typesRoot = join(work, 'primitives')
  const slim = join(work, 'slim')
  const tree = join(work, 'tree')
  console.log(`[build-iui] checkout ${pin.commit}`)
  await rm(work, { recursive: true, force: true })
  await mkdir(checkout, { recursive: true })
  await mkdir(typesRoot, { recursive: true })
  await run('git', ['init'], { cwd: checkout })
  await run('git', ['remote', 'add', 'origin', pin.repo], { cwd: checkout })
  await run('git', ['fetch', '--depth', '1', 'origin', pin.commit], { cwd: checkout })
  await run('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: checkout })

  await run('npm', [
    'install',
    '--prefix', typesRoot,
    `--omit=dev`,
    '--no-audit',
    '--no-fund',
    `@deepseek-ai/dsh-client-ui-primitives@${PRIMITIVES_VERSION}`,
  ], { cwd: work })
  const typesDir = join(
    typesRoot,
    'node_modules',
    '@deepseek-ai',
    'dsh-client-ui-primitives',
    'lib',
    'types',
  )
  if (!existsSync(join(typesDir, 'index.d.ts'))) {
    throw new Error(`primitives types missing under ${typesDir}`)
  }
  const tsconfigPath = join(checkout, 'tsconfig.json')
  const retargeted = retargetPrimitivePaths(await readFile(tsconfigPath, 'utf8'), typesDir)
  await writeFile(tsconfigPath, retargeted)

  console.log(`[build-iui] ${pnpmLabel} install --frozen-lockfile`)
  await run(runner.command, [...runner.argsPrefix, 'install', '--frozen-lockfile'], { cwd: checkout, env })
  console.log(`[build-iui] ${pnpmLabel} run build`)
  await run(runner.command, [...runner.argsPrefix, 'run', 'build'], { cwd: checkout, env })
  if (!existsSync(join(checkout, 'lib', 'index.js')) || !existsSync(join(checkout, 'lib', 'client.js'))) {
    throw new Error('IUI build did not emit lib/index.js and lib/client.js')
  }

  const sourcePkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'))
  const exact = {}
  for (const name of Object.keys(sourcePkg.dependencies || {})) {
    const installed = JSON.parse(await readFile(join(checkout, 'node_modules', ...name.split('/'), 'package.json'), 'utf8'))
    exact[name] = installed.version
  }
  await mkdir(slim, { recursive: true })
  await writeFile(join(slim, 'package.json'), `${JSON.stringify({
    name: 'iui-prod-deps',
    private: true,
    dependencies: exact,
  }, null, 2)}\n`)
  await run('npm', [
    'install',
    '--omit=dev',
    '--install-strategy=nested',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ], { cwd: slim })

  await rm(tree, { recursive: true, force: true })
  await mkdir(tree, { recursive: true })
  await cp(join(checkout, 'package.json'), join(tree, 'package.json'))
  await cp(join(checkout, 'lib'), join(tree, 'lib'), { recursive: true, dereference: true })
  await cp(join(checkout, 'cordis.patch.yml'), join(tree, 'cordis.patch.yml'))
  await cp(join(checkout, 'SKILL.md'), join(tree, 'SKILL.md'))
  await cp(join(slim, 'node_modules'), join(tree, 'node_modules'), { recursive: true, dereference: true })
  await writeFile(join(tree, PLUGIN_PIN_FILE), `${JSON.stringify({ commit: pin.commit }, null, 2)}\n`)

  const loaded = await import(pathToFileURL(join(tree, 'lib', 'index.js')).href)
  if (typeof loaded.apply !== 'function' || loaded.name !== '@losebird/iui') {
    throw new Error('built IUI tree did not load apply()')
  }

  const artifactPath = options.artifactPath || defaultIuiArtifactPath(repoRoot, pin.commit)
  await mkdir(dirname(artifactPath), { recursive: true })
  const sha256 = await finishIuiArtifact(tree, artifactPath, pin, options.manifestFiles)
  return { artifactPath, sha256, version: sourcePkg.version, commit: pin.commit }
}

export async function finishIuiArtifact(tree, artifactPath, pin = IUI_PIN, manifestFiles) {
  const tempPath = `${artifactPath}.${process.pid}.${randomBytes(4).toString('hex')}.partial`
  try {
    await packDeterministicTarGz(tree, tempPath)
    const sha256 = sha256Hex(await readFile(tempPath))
    if (sha256 !== pin.artifact.sha256) {
      const files = manifestFiles || JSON.parse(await readFile(new URL('./iui-pin-manifest.json', import.meta.url), 'utf8')).files
      const detail = explainPinDrift(tree, files)
      throw new Error(`IUI artifact sha256 mismatch\nexpected ${pin.artifact.sha256}\nactual ${sha256}\n${detail}`)
    }
    await rename(tempPath, artifactPath)
    return sha256
  } finally {
    await rm(tempPath, { force: true })
  }
}

export function iuiArtifactPathFromArgv(argv, { repoRoot: root, commit }) {
  let outDir = ''
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--out') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('build-iui --out needs a directory')
      }
      outDir = value
      index += 1
      continue
    }
    if (arg.startsWith('--out=')) {
      outDir = arg.slice('--out='.length)
      if (!outDir) throw new Error('build-iui --out needs a directory')
      continue
    }
    throw new Error(`build-iui: unknown argument ${arg}`)
  }
  if (!outDir) return defaultIuiArtifactPath(root, commit)
  return join(outDir, iuiArtifactName(commit))
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let artifactPath
  try {
    artifactPath = iuiArtifactPathFromArgv(process.argv.slice(2), {
      repoRoot,
      commit: IUI_PIN.commit,
    })
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  buildIuiArtifact({ artifactPath }).then((result) => {
    console.log(`[build-iui] ${result.version} ${result.commit}`)
    console.log(`[build-iui] artifact ${result.artifactPath}`)
    console.log(`[build-iui] sha256 ${result.sha256}`)
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
