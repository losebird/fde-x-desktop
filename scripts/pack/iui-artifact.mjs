import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { execFile as execFileCb } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { PLUGIN_PIN_FILE } from '../../runtime/plugin-vendor.mjs'

const execFile = promisify(execFileCb)

export function iuiArtifactName(commit) {
  return `iui-${commit}.tar.gz`
}

export function defaultIuiArtifactPath(repoRoot, commit) {
  return join(repoRoot, 'scripts', 'pack', '.cache', iuiArtifactName(commit))
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function childExit(child, label) {
  return new Promise((resolve, reject) => {
    const chunks = []
    if (child.stderr) child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited ${code}: ${Buffer.concat(chunks).toString()}`))
    })
  })
}

export async function packDeterministicTarGz(tree, artifactPath) {
  await mkdir(dirname(artifactPath), { recursive: true })
  const tar = spawn('tar', [
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-cf', '-',
    '-C', tree,
    '.',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  const gzip = spawn('gzip', ['-n'], { stdio: ['pipe', 'pipe', 'pipe'] })
  tar.stdout.pipe(gzip.stdin)
  try {
    await Promise.all([
      childExit(tar, 'tar'),
      childExit(gzip, 'gzip'),
      pipeline(gzip.stdout, createWriteStream(artifactPath)),
    ])
  } catch (error) {
    tar.kill()
    gzip.kill()
    throw error
  }
}

export function bundledPluginVersions(plugins, pluginsRoot) {
  const versions = {}
  for (const plugin of plugins) {
    const present = existsSync(join(pluginsRoot, plugin.dir, 'package.json'))
    if (plugin.source.kind === 'pinned') {
      versions[plugin.dir] = {
        staged: present,
        version: plugin.source.version,
        commit: plugin.source.commit,
      }
    } else {
      versions[plugin.dir] = present
    }
  }
  return versions
}

async function artifactBytes(pin, artifactPath) {
  const url = String(pin.artifact?.url || '')
  if (url) {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok) throw new Error(`IUI artifact GET ${url} → ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  if (!artifactPath || !existsSync(artifactPath)) {
    const error = new Error('IUI artifact missing. Run scripts/pack/build-iui.mjs or set artifact.url.')
    error.code = 'FDE_IUI_ARTIFACT_MISSING'
    throw error
  }
  return await readFile(artifactPath)
}

export async function assertIuiTree(dir, pin) {
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  if (pkg.version !== pin.version) {
    throw new Error(`IUI package.json version ${pkg.version} != pin ${pin.version}`)
  }
  if (!pkg.dsh?.bundle?.patch || !pkg.dsh?.client) {
    throw new Error('IUI package.json is missing dsh.bundle or dsh.client')
  }
  const pinFile = JSON.parse(await readFile(join(dir, PLUGIN_PIN_FILE), 'utf8'))
  if (pinFile.commit !== pin.commit) {
    throw new Error(`IUI pin commit ${pinFile.commit} != ${pin.commit}`)
  }
  if (!existsSync(join(dir, 'lib', 'index.js'))) throw new Error('IUI lib/index.js missing')
  if (!existsSync(join(dir, 'node_modules'))) throw new Error('IUI node_modules missing')
}

export async function stageIuiArtifact({ dest, pin, artifactPath }) {
  const expected = String(pin.artifact?.sha256 || '')
  if (!/^[a-f0-9]{64}$/u.test(expected)) {
    throw new Error('IUI pin artifact.sha256 is empty. Build the artifact and record the hash before staging.')
  }
  const bytes = await artifactBytes(pin, artifactPath)
  const actual = sha256Hex(bytes)
  if (actual !== expected) {
    throw new Error(`IUI artifact sha256 mismatch: expected ${expected}, got ${actual}`)
  }
  const staging = `${dest}.staging-${process.pid}`
  const bak = `${dest}.bak-${process.pid}`
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  const archive = join(staging, 'artifact.tar.gz')
  await writeFile(archive, bytes)
  await execFile('tar', ['-xzf', archive, '-C', staging])
  await rm(archive)
  try {
    await assertIuiTree(staging, pin)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
  await rm(bak, { recursive: true, force: true })
  if (existsSync(dest)) await rename(dest, bak)
  try {
    await rename(staging, dest)
  } catch (error) {
    if (existsSync(bak)) await rename(bak, dest)
    throw error
  }
  await rm(bak, { recursive: true, force: true })
  return { ok: true, version: pin.version, commit: pin.commit }
}

export function retargetPrimitivePaths(tsconfigText, typesDir) {
  const index = JSON.stringify(join(typesDir, 'index.d.ts'))
  const star = JSON.stringify(join(typesDir, '*'))
  let next = String(tsconfigText)
  const block = /"@deepseek-ai\/dsh-client-ui-primitives":\s*\[[\s\S]*?\]/u
  const starBlock = /"@deepseek-ai\/dsh-client-ui-primitives\/\*":\s*\[[\s\S]*?\]/u
  if (!block.test(next) || !starBlock.test(next)) {
    throw new Error('IUI tsconfig is missing @deepseek-ai/dsh-client-ui-primitives paths')
  }
  next = next.replace(block, `"@deepseek-ai/dsh-client-ui-primitives": [\n        ${index}\n      ]`)
  next = next.replace(starBlock, `"@deepseek-ai/dsh-client-ui-primitives/*": [\n        ${star}\n      ]`)
  if (next.includes('/opt/homebrew/') || next.includes('/home/box/')) {
    throw new Error('IUI tsconfig still points at a machine path')
  }
  return next
}
