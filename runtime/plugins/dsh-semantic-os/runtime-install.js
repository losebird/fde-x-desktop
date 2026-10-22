import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { resolveBundledRuntime, runtimeKey } from './runtime-bundle.js'
import { RUNTIME_VERSION } from './version.js'

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function runtimeStoreRoot() {
  return join(dshHome(), 'semantic-os', 'runtime')
}

export function runtimeCurrentPath() {
  return join(runtimeStoreRoot(), 'current.json')
}

export function installedRuntimeRoot(platform = process.platform, arch = process.arch, version = RUNTIME_VERSION) {
  return join(runtimeStoreRoot(), version, runtimeKey(platform, arch))
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temp, path)
}

export async function resolveInstalledRuntime(options = {}) {
  const platform = options.platform || process.platform
  const arch = options.arch || process.arch
  let current
  try { current = JSON.parse(await readFile(runtimeCurrentPath(), 'utf8')) } catch { return { ok: false, error: 'INSTALLED_RUNTIME_MISSING' } }
  if (!current || current.runtimeVersion !== RUNTIME_VERSION || current.key !== runtimeKey(platform, arch)) {
    return { ok: false, error: 'INSTALLED_RUNTIME_VERSION_MISMATCH' }
  }
  return resolveBundledRuntime({ platform, arch, runtimeRoot: installedRuntimeRoot(platform, arch, current.runtimeVersion), verifyFiles: options.verifyFiles })
}

export async function installRuntimeFromDirectory(source, options = {}) {
  const platform = options.platform || process.platform
  const arch = options.arch || process.arch
  const verifiedSource = await resolveBundledRuntime({ platform, arch, runtimeRoot: source, verifyFiles: false })
  if (!verifiedSource.ok) return verifiedSource
  const finalRoot = installedRuntimeRoot(platform, arch, verifiedSource.manifest.runtimeVersion)
  const staging = `${finalRoot}.staging-${process.pid}-${Date.now()}`
  await mkdir(dirname(finalRoot), { recursive: true })
  try {
    await rm(staging, { recursive: true, force: true })
    await cp(source, staging, { recursive: true, dereference: false, force: false })
    const staged = await resolveBundledRuntime({ platform, arch, runtimeRoot: staging, verifyFiles: true })
    if (!staged.ok) return staged
    const previous = `${finalRoot}.previous-${Date.now()}`
    let hadPrevious = false
    try {
      await rename(finalRoot, previous)
      hadPrevious = true
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error
    }
    try {
      await rename(staging, finalRoot)
      if (typeof options.activate === 'function') await options.activate({ root: finalRoot, runtime: staged })
      await atomicJson(runtimeCurrentPath(), {
        schemaVersion: 1,
        runtimeVersion: staged.manifest.runtimeVersion,
        key: staged.key,
        manifestDigest: staged.manifestDigest,
        installedAt: new Date().toISOString(),
      })
      if (hadPrevious) await rm(previous, { recursive: true, force: true })
    } catch (error) {
      await rm(finalRoot, { recursive: true, force: true }).catch(() => undefined)
      if (hadPrevious) await rename(previous, finalRoot).catch(() => undefined)
      throw error
    }
    return { ok: true, root: finalRoot, runtime: staged }
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function removeInstalledRuntime(options = {}) {
  const platform = options.platform || process.platform
  const arch = options.arch || process.arch
  await rm(installedRuntimeRoot(platform, arch), { recursive: true, force: true })
  await rm(runtimeCurrentPath(), { force: true })
  return { ok: true }
}
