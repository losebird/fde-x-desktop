import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { PLUGIN_VERSION } from './version.js'

const SCHEMA_VERSION = 1
const DEFAULT_INSTALL_TIMEOUT_MS = 15 * 60 * 1000
const LOCK_STALE_MS = 20 * 60 * 1000

function home() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function installStatePath() {
  return join(home(), 'semantic-os', 'install-state.json')
}

function installLockPath() {
  return join(home(), 'semantic-os', 'install.lock')
}

function nowState(patch = {}) {
  return {
    phase: 'idle',
    step: '',
    current: 0,
    total: 0,
    detail: '',
    error: '',
    startedAt: 0,
    updatedAt: Date.now(),
    completedAt: 0,
    ...patch,
  }
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temp, path)
}

async function readJson(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

async function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error && error.code === 'EPERM'
  }
}

async function acquireLock(timeoutMs, onWait) {
  const path = installLockPath()
  await mkdir(dirname(path), { recursive: true })
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const handle = await open(path, 'wx', 0o600)
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: Date.now(), pluginVersion: PLUGIN_VERSION })}\n`)
      await handle.close()
      return async () => { await rm(path, { force: true }) }
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error
      const lock = await readJson(path)
      let stale = false
      try {
        const info = await stat(path)
        stale = Date.now() - info.mtimeMs > LOCK_STALE_MS
      } catch {
        stale = true
      }
      if (lock && !(await processExists(Number(lock.pid)))) stale = true
      if (stale) {
        await rm(path, { force: true })
        continue
      }
      onWait(lock)
      await new Promise((resolve) => setTimeout(resolve, 750))
    }
  }
  const error = new Error('another Semantic OS installer did not finish before timeout')
  error.code = 'INSTALL_LOCK_TIMEOUT'
  throw error
}

function installReady(status) {
  return Boolean(status && status.semantica && status.semantica.ok)
}

export function createInstaller({ probe, install, getConfig = () => ({}) }) {
  let state = nowState()
  let inflight = null

  const publish = (patch) => {
    state = nowState({ ...state, ...patch, updatedAt: Date.now() })
    return state
  }

  async function ensure(force = false) {
    if (inflight) return inflight
    inflight = run(force).finally(() => { inflight = null })
    return inflight
  }

  async function run(force) {
    const cfg = getConfig() || {}
    const timeoutMs = Number.isFinite(Number(cfg.installTimeoutMs)) && Number(cfg.installTimeoutMs) > 0
      ? Math.floor(Number(cfg.installTimeoutMs))
      : DEFAULT_INSTALL_TIMEOUT_MS
    const startedAt = Date.now()
    publish({ phase: 'checking', step: 'checking', current: 0, total: 6, detail: 'Checking installed components', error: '', startedAt, completedAt: 0 })

    if (!force) {
      const previous = await readJson(installStatePath())
      const trustedRuntimeDigest = previous && previous.pluginVersion === PLUGIN_VERSION
        && previous.status && previous.status.runtime && previous.status.runtime.manifestDigest
        ? previous.status.runtime.manifestDigest
        : ''
      const status = await probe({ fresh: true, trustedRuntimeDigest })
      if (installReady(status)) {
        const manifest = {
          schemaVersion: SCHEMA_VERSION,
          pluginVersion: PLUGIN_VERSION,
          completedAt: Date.now(),
          status,
        }
        await atomicJson(installStatePath(), manifest)
        publish({ phase: status.graph && status.graph.ok ? 'ready' : 'ready_degraded', step: 'complete', current: 6, total: 6, detail: status.graph && status.graph.ok ? 'Environment ready' : 'Environment ready with file graph fallback', completedAt: Date.now() })
        return { ok: true, degraded: !(status.graph && status.graph.ok), status, state: snapshot() }
      }
    }

    let release
    try {
      release = await acquireLock(timeoutMs, () => {
        publish({ phase: 'waiting', step: 'install_lock', detail: 'Waiting for another Semantic OS installer' })
      })
      publish({ phase: 'installing', step: 'preparing', current: 1, total: 6, detail: 'Preparing private runtime' })
      const controller = new AbortController()
      const remaining = Math.max(1, startedAt + timeoutMs - Date.now())
      const installTimer = setTimeout(() => controller.abort(), remaining)
      let status
      try {
        status = await install({
          signal: controller.signal,
          timeoutMs: remaining,
          onProgress(progress) {
            publish({ phase: 'installing', ...progress })
          },
        })
      } finally {
        clearTimeout(installTimer)
      }
      if (controller.signal.aborted) {
        const error = new Error(`dependency installation exceeded ${timeoutMs}ms`)
        error.code = 'INSTALL_TIMEOUT'
        throw error
      }
      if (!installReady(status)) {
        const error = new Error((status && status.semantica && status.semantica.detail) || 'Semantica installation verification failed')
        error.code = 'REQUIRED_DEPENDENCY_MISSING'
        throw error
      }
      const manifest = {
        schemaVersion: SCHEMA_VERSION,
        pluginVersion: PLUGIN_VERSION,
        completedAt: Date.now(),
        status,
      }
      await atomicJson(installStatePath(), manifest)
      const degraded = !(status.graph && status.graph.ok)
      publish({ phase: degraded ? 'ready_degraded' : 'ready', step: 'complete', current: 6, total: 6, detail: degraded ? 'Required engine ready; graph store uses fallback' : 'All components ready', completedAt: Date.now() })
      return { ok: true, degraded, status, state: snapshot() }
    } catch (error) {
      publish({ phase: 'install_failed', step: state.step || 'install', detail: error instanceof Error ? error.message : String(error), error: String(error && error.code || 'INSTALL_FAILED'), completedAt: Date.now() })
      return { ok: false, error: state.error, detail: state.detail, state: snapshot() }
    } finally {
      if (release) await release()
    }
  }

  function snapshot() {
    return { ...state, installing: Boolean(inflight) }
  }

  return { ensure, snapshot }
}
