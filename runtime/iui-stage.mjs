import { createHash } from 'node:crypto'
import { execFile as execFileCb } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { PLUGIN_PIN_FILE } from './plugin-vendor.mjs'

const execFile = promisify(execFileCb)

export const IUI_REBUILD_COMMAND = 'node scripts/pack/build-iui.mjs --out ~/.dsh/vendor/iui'

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function shaMismatch(artifactPath, expected, actual) {
  const error = new Error(`IUI artifact sha256 mismatch at ${artifactPath}: expected ${expected}, got ${actual}`)
  error.code = 'FDE_IUI_SHA_MISMATCH'
  error.artifactPath = artifactPath
  error.expected = expected
  error.actual = actual
  return error
}

async function artifactBytes(pin, artifactPath) {
  const url = String(pin.artifact?.url || '')
  if (url) {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok) throw new Error(`IUI artifact GET ${url} → ${response.status}`)
    return { bytes: Buffer.from(await response.arrayBuffer()), label: artifactPath || url }
  }
  if (!artifactPath || !existsSync(artifactPath)) {
    const error = new Error('IUI artifact missing. Run scripts/pack/build-iui.mjs or set artifact.url.')
    error.code = 'FDE_IUI_ARTIFACT_MISSING'
    throw error
  }
  return { bytes: await readFile(artifactPath), label: artifactPath }
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

export async function verifyIuiArtifact(pin, artifactPath) {
  const expected = String(pin.artifact?.sha256 || '')
  if (!/^[a-f0-9]{64}$/u.test(expected)) {
    throw new Error('IUI pin artifact.sha256 is empty. Build the artifact and record the hash before staging.')
  }
  const loaded = await artifactBytes(pin, artifactPath)
  const actual = sha256Hex(loaded.bytes)
  if (actual !== expected) {
    return {
      state: 'verify_failed',
      artifactPath: loaded.label,
      expected,
      actual,
      command: IUI_REBUILD_COMMAND,
    }
  }
  return { state: 'verified', bytes: loaded.bytes, artifactPath: loaded.label, expected, actual }
}

export async function stageIuiArtifact({ dest, pin, artifactPath }) {
  const checked = await verifyIuiArtifact(pin, artifactPath)
  if (checked.state === 'verify_failed') throw shaMismatch(checked.artifactPath, checked.expected, checked.actual)
  const staging = `${dest}.staging-${process.pid}`
  const bak = `${dest}.bak-${process.pid}`
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  const archive = join(staging, 'artifact.tar.gz')
  await writeFile(archive, checked.bytes)
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

export async function stageIuiArtifactIfAbsent({ dest, pin, artifactPath }) {
  if (existsSync(join(dest, 'package.json'))) return { ok: true, action: 'profile-kept', state: 'kept' }
  if (!artifactPath || !existsSync(artifactPath)) return { ok: false, action: 'missing-artifact', state: 'absent' }
  const checked = await verifyIuiArtifact(pin, artifactPath)
  if (checked.state === 'verify_failed') return { ok: false, action: 'verify-failed', ...checked }
  await stageIuiArtifact({ dest, pin, artifactPath })
  return { ok: true, action: 'installed', state: 'installed' }
}
