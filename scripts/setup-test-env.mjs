#!/usr/bin/env node
import { execFile as execFileCb } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, lstatSync, readFileSync, readlinkSync, symlinkSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { IUI_PIN } from '../runtime/iui-pin.mjs'
import { buildIuiArtifact } from './pack/build-iui.mjs'
import {
  assertMergedPlugins,
  loadPins,
  missingRequired,
  sourceEnvName,
} from './test-env/plugin-tree.mjs'

const execFile = promisify(execFileCb)
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const pinsPath = join(repoRoot, 'scripts', 'test-env', 'vendor-pins.json')
const envPath = join(repoRoot, '.test-env')
const logPath = join(repoRoot, '.test-env.log')

const logStream = createWriteStream(logPath, { flags: 'w' })

function log(line) {
  const text = String(line)
  console.log(text)
  logStream.write(`${text}\n`)
}

function redact(text) {
  return String(text)
    .replace(/bearer\s+\S+/giu, 'bearer [REDACTED]')
    .replace(/ghs_[A-Za-z0-9_]+/gu, 'ghs_[REDACTED]')
    .replace(/github_pat_[A-Za-z0-9_]+/gu, 'github_pat_[REDACTED]')
    .replace(/ghp_[A-Za-z0-9_]+/gu, 'ghp_[REDACTED]')
}

function finishLog() {
  return new Promise((resolve) => {
    logStream.end(resolve)
  })
}

async function run(command, args, options = {}) {
  try {
    const result = await execFile(command, args, {
      maxBuffer: 64 * 1024 * 1024,
      ...options,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        npm_config_update_notifier: 'false',
        ...options.env,
      },
    })
    return { stdout: result.stdout || '', stderr: result.stderr || '' }
  } catch (error) {
    const stderr = error && error.stderr ? error.stderr : ''
    const stdout = error && error.stdout ? error.stdout : ''
    const message = error instanceof Error ? error.message : String(error)
    const wrapped = new Error(redact(`${command} failed\n${stderr}\n${stdout}\n${message}`))
    throw wrapped
  }
}

function commandExists(name) {
  const paths = String(process.env.PATH || '').split(':').filter(Boolean)
  return paths.some((dir) => existsSync(join(dir, name)))
}

function preflight() {
  const [major, minor] = process.versions.node.split('.').map((part) => Number(part))
  if (!(major > 22 || (major === 22 && minor >= 19))) {
    throw new Error(`Node >= 22.19 is required (IUI build). Current is ${process.versions.node}`)
  }
  const missing = ['git', 'lsof', 'python3', 'pnpm', 'npm', 'tar'].filter((name) => !commandExists(name))
  if (missing.length > 0) {
    throw new Error(`missing system tools: ${missing.join(', ')}. Refusing to skip.`)
  }
}

function readToken() {
  const token = String(process.env.FDE_PLUGIN_READ_TOKEN || '').trim()
  return token
}

function githubRefusal(plugin, detail) {
  return [
    `Cannot fetch ${plugin.repo}@${plugin.commit}.`,
    detail ? redact(detail).trim() : '',
    'The cloud credential and the Actions GITHUB_TOKEN cannot read this private repository.',
    'Refusing to skip.',
    `Set ${sourceEnvName(plugin.dir)} to a git bundle or a local checkout that contains that commit,`,
    'or set FDE_PLUGIN_SOURCES to a directory of those bundles.',
    'CI may set secret FDE_PLUGIN_READ_TOKEN: a read-only token with Contents: Read',
    'on losebird/dsh-lan-assist and losebird/dsh-semantic-os. Do not use a write token.',
  ].filter(Boolean).join('\n')
}

function locateSource(plugin) {
  const envName = sourceEnvName(plugin.dir)
  const explicit = String(process.env[envName] || '').trim()
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`${envName} does not exist: ${explicit}`)
    return explicit
  }
  const root = String(process.env.FDE_PLUGIN_SOURCES || '').trim()
  if (!root) return ''
  if (!existsSync(root)) throw new Error(`FDE_PLUGIN_SOURCES does not exist: ${root}`)
  const short = plugin.commit.slice(0, 8)
  const candidates = [
    join(root, `${plugin.dir}-${short}.bundle`),
    join(root, `${plugin.dir}.bundle`),
    join(root, plugin.dir),
  ]
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

async function headOf(dest) {
  if (!existsSync(join(dest, '.git'))) return ''
  try {
    const { stdout } = await run('git', ['-C', dest, 'rev-parse', 'HEAD'])
    return stdout.trim()
  } catch {
    return ''
  }
}

async function fetchCommit(dest, plugin, remote) {
  await rm(dest, { recursive: true, force: true })
  await mkdir(dest, { recursive: true })
  await run('git', ['init', '-q'], { cwd: dest })
  const args = ['-c', 'credential.helper=', 'fetch', '-q', remote, plugin.commit]
  await run('git', args, { cwd: dest })
  await run('git', ['checkout', '-q', '--detach', 'FETCH_HEAD'], { cwd: dest })
  const head = await headOf(dest)
  if (head !== plugin.commit) {
    throw new Error(`${plugin.dir} resolved to ${head || '(empty)'} but vendor-pins.json requires ${plugin.commit}`)
  }
}

async function fetchGitHub(dest, plugin) {
  const token = readToken()
  const url = `https://github.com/${plugin.repo}.git`
  await rm(dest, { recursive: true, force: true })
  await mkdir(dest, { recursive: true })
  await run('git', ['init', '-q'], { cwd: dest })
  await run('git', ['remote', 'add', 'origin', url], { cwd: dest })
  const args = ['-c', 'credential.helper=']
  if (token) {
    args.push('-c', `http.extraheader=AUTHORIZATION: bearer ${token}`)
  } else if (commandExists('gh')) {
    args.push('-c', `credential.https://github.com.helper=!${join(process.env.PATH.split(':').find((dir) => existsSync(join(dir, 'gh'))) || '', 'gh')} auth git-credential`)
  } else {
    throw new Error(githubRefusal(plugin, 'No FDE_PLUGIN_READ_TOKEN and no gh binary.'))
  }
  args.push('fetch', '--depth', '1', 'origin', plugin.commit)
  try {
    await run('git', args, { cwd: dest })
  } catch (error) {
    await rm(dest, { recursive: true, force: true })
    throw new Error(githubRefusal(plugin, error instanceof Error ? error.message : String(error)))
  }
  await run('git', ['checkout', '-q', '--detach', 'FETCH_HEAD'], { cwd: dest })
  const head = await headOf(dest)
  if (head !== plugin.commit) {
    throw new Error(githubRefusal(plugin, `${plugin.dir} resolved to ${head || '(empty)'} instead of ${plugin.commit}`))
  }
}

async function ensureCheckout(dest, plugin) {
  const current = await headOf(dest)
  if (current === plugin.commit) {
    log(`keep ${plugin.dir} at ${plugin.commit}`)
  } else {
    const source = locateSource(plugin)
    if (source) {
      log(`fetch ${plugin.dir} from ${source}`)
      try {
        await fetchCommit(dest, plugin, source)
      } catch (error) {
        throw new Error(`local source for ${plugin.dir} does not contain ${plugin.commit}\n${source}\n${error instanceof Error ? error.message : error}`)
      }
    } else {
      log(`fetch ${plugin.dir} from github ${plugin.repo}@${plugin.commit}`)
      await fetchGitHub(dest, plugin)
    }
  }
  const missing = missingRequired(dest, plugin.requiredFiles)
  if (missing.length > 0) {
    throw new Error(`${plugin.dir}@${plugin.commit} is missing required files: ${missing.join(', ')}`)
  }
  const head = await headOf(dest)
  if (head !== plugin.commit) {
    throw new Error(`${plugin.dir} HEAD ${head || '(empty)'} != ${plugin.commit}`)
  }
}

function installedNats(dir) {
  const pkgPath = join(dir, 'node_modules', 'nats', 'package.json')
  const lockPath = join(dir, 'node_modules', '.package-lock.json')
  if (!existsSync(pkgPath) || !existsSync(lockPath)) return null
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  const entry = lock.packages && lock.packages['node_modules/nats']
  return {
    version: pkg.version,
    integrity: entry && entry.integrity,
  }
}

async function ensureNats(dir, nats) {
  const found = installedNats(dir)
  if (found && found.version === nats.version && found.integrity === nats.integrity) {
    log(`keep nats@${nats.version} in ${dir}`)
    return
  }
  log(`install nats@${nats.version} into ${dir}`)
  await run('npm', [
    'install',
    `nats@${nats.version}`,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-save',
  ], { cwd: dir })
  const after = installedNats(dir)
  if (!after || after.version !== nats.version || after.integrity !== nats.integrity) {
    throw new Error(
      `nats install in ${dir} is ${after ? `${after.version} ${after.integrity}` : 'missing'}, `
      + `expected ${nats.version} ${nats.integrity}`,
    )
  }
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function ensureIuiTar() {
  // iui-retry and iui-core-failure read this path from os.homedir(), not FDE_VENDOR_DIR.
  const tarPath = join(homedir(), '.dsh', 'vendor', 'iui', `iui-${IUI_PIN.commit}.tar.gz`)
  if (existsSync(tarPath) && sha256File(tarPath) === IUI_PIN.artifact.sha256) {
    log(`keep IUI artifact ${tarPath}`)
    return tarPath
  }
  log(`build IUI artifact ${IUI_PIN.commit} -> ${tarPath}`)
  await mkdir(dirname(tarPath), { recursive: true })
  const built = await buildIuiArtifact({ artifactPath: tarPath })
  if (built.sha256 !== IUI_PIN.artifact.sha256) {
    throw new Error(`IUI artifact sha256 ${built.sha256} != pin ${IUI_PIN.artifact.sha256}`)
  }
  return tarPath
}

async function linkPlugins(dshHome, iuiTar) {
  process.env.FDE_DSH_HOME = dshHome
  process.env.FDE_REFRESH_PLUGINS = '1'
  process.env.FDE_IUI_ARTIFACT = iuiTar
  const { DshCoreConnector } = await import(pathToFileURL(join(repoRoot, 'runtime', 'dsh-core.mjs')).href)
  const { BUILTIN_PLUGINS } = await import(pathToFileURL(join(repoRoot, 'runtime', 'builtin-plugins.mjs')).href)
  const connector = new DshCoreConnector({ dshHome })
  const modules = await mkdtemp(join(tmpdir(), 'fde-link-modules-'))
  for (const plugin of BUILTIN_PLUGINS) {
    const ok = await connector.linkBuiltinPlugin(plugin, modules)
    const dest = join(dshHome, 'vendor', plugin.dir)
    const pinnedMissing = plugin.source.kind === 'pinned' && !existsSync(join(dest, 'package.json'))
    if (!ok || pinnedMissing) {
      const detail = Array.isArray(connector.pluginLinkFailures) ? connector.pluginLinkFailures.join('; ') : ''
      throw new Error(`linkBuiltinPlugin failed for ${plugin.dir}. ${detail}`.trim())
    }
    if (!existsSync(dest)) {
      throw new Error(`linkBuiltinPlugin did not create ${dest}`)
    }
    log(`linked ${plugin.dir} -> ${dest}`)
  }
}

function ensureDefaultHomeLink(dshHome) {
  const link = join(homedir(), '.dsh-fde-x')
  let info = null
  try {
    info = lstatSync(link)
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error
  }
  if (!info) {
    symlinkSync(dshHome, link)
    log(`symlink ${link} -> ${dshHome}`)
    return
  }
  const current = info.isSymbolicLink() ? resolve(dirname(link), readlinkSync(link)) : ''
  if (current === dshHome) {
    log(`keep symlink ${link}`)
    return
  }
  throw new Error(
    `${link} already exists and is not a symlink to ${dshHome}. `
    + 'Refusing to replace a real DSH home. Move it aside and run setup again.',
  )
}

async function writeEnvFile(values) {
  const lines = [
    ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
    '',
  ]
  await writeFile(envPath, lines.join('\n'))
}

async function main() {
  process.env.COREPACK_HOME = process.env.COREPACK_HOME || join(homedir(), '.cache', 'corepack')
  process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
  const vendorDir = join(repoRoot, '.vendor')
  const dshHome = join(repoRoot, '.dsh-fde-x-test')
  process.env.FDE_VENDOR_DIR = vendorDir
  process.env.FDE_DSH_HOME = dshHome
  log(`repo ${repoRoot}`)
  log(`COREPACK_HOME ${process.env.COREPACK_HOME}`)
  preflight()
  const pins = loadPins(pinsPath)
  log('pnpm install --frozen-lockfile')
  await run('pnpm', ['install', '--frozen-lockfile'], { cwd: repoRoot })
  const { ensureGenerationHost } = await import(pathToFileURL(join(repoRoot, 'runtime', 'generation.mjs')).href)
  const hostBin = await ensureGenerationHost()
  if (!hostBin) throw new Error('ensureGenerationHost returned an empty dsh path')
  log(`generation host ${hostBin}`)
  await mkdir(vendorDir, { recursive: true })
  for (const plugin of pins.plugins) {
    const dest = join(vendorDir, plugin.dir)
    await ensureCheckout(dest, plugin)
    if (plugin.dir === pins.nats.plugin) await ensureNats(dest, pins.nats)
  }
  // semantic-os ships a separate ~1.8GB CPython runtime. This setup does not download it.
  const iuiTar = await ensureIuiTar()
  await linkPlugins(dshHome, iuiTar)
  const linkedNats = installedNats(join(dshHome, 'vendor', pins.nats.plugin))
  if (!linkedNats || linkedNats.version !== pins.nats.version || linkedNats.integrity !== pins.nats.integrity) {
    throw new Error(`linked ${pins.nats.plugin} does not contain nats@${pins.nats.version} with the pinned integrity`)
  }
  assertMergedPlugins({ repoRoot, dshHome, plugins: pins.plugins })
  const iuiTree = join(dshHome, 'vendor', 'iui')
  const iuiPkg = JSON.parse(await readFile(join(iuiTree, 'package.json'), 'utf8'))
  const iuiPin = JSON.parse(await readFile(join(iuiTree, 'fde-plugin-pin.json'), 'utf8'))
  if (iuiPkg.version !== IUI_PIN.version || iuiPin.commit !== IUI_PIN.commit) {
    throw new Error(`linked IUI is ${iuiPkg.version} ${iuiPin.commit}, pin is ${IUI_PIN.version} ${IUI_PIN.commit}`)
  }
  ensureDefaultHomeLink(dshHome)
  const semanticSource = join(vendorDir, 'dsh-semantic-os')
  await writeEnvFile({
    FDE_TEST_DSH_HOME: dshHome,
    FDE_VENDOR_DIR: vendorDir,
    FDE_PLUGIN_DSH_SEMANTIC_OS: semanticSource,
    FDE_PLUGIN_IUI: iuiTree,
    COREPACK_HOME: process.env.COREPACK_HOME,
  })
  log(`wrote ${envPath}`)
  log('setup-test-env ok')
}

main().catch(async (error) => {
  log(error instanceof Error ? error.stack || error.message : String(error))
  await finishLog()
  process.exit(1)
}).then(async () => {
  await finishLog()
})
