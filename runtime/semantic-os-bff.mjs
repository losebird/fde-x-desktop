/**
 * FDE BFF owns the semantic-os HTTP + sidecar. DSH iframe does not load client.js.
 */
import { realpathSync } from 'node:fs'
import { createExtract } from './plugins/dsh-semantic-os/extract-llm.js'
import { createExtractQueue } from './plugins/dsh-semantic-os/extract-queue.js'
import { createHandler, createUpgradeHandler } from './plugins/dsh-semantic-os/http.js'
import { createIngest, postPython } from './plugins/dsh-semantic-os/ingest.js'
import { mergeConfig } from './plugins/dsh-semantic-os/persist.js'
import { createWriteLog } from './plugins/dsh-semantic-os/product.js'
import { createSessionIngest } from './plugins/dsh-semantic-os/session-ingest.js'
import { createSidecar } from './plugins/dsh-semantic-os/sidecar.js'
import { createWorkspaceAuthority } from './plugins/dsh-semantic-os/workspace-authority.js'
import { ensureProjectMemorySkill } from './plugins/dsh-semantic-os/skill-install.js'
import { FDE_AI_WORKSPACE, FDE_DSH_HOME, FDE_RUNTIME_PORT } from './config.mjs'
import { createDiskSessionPersistence } from './semantic-os-session-persist.mjs'

let runtime = null

export function semanticOsBffReady() {
  return Boolean(runtime && runtime.handler)
}

function withHomeCwd(authority, getHomeCwd) {
  return {
    setSessions: authority.setSessions.bind(authority),
    setPersistence: authority.setPersistence.bind(authority),
    async allows(cwd) {
      if (await authority.allows(cwd)) return true
      let home = ''
      try { home = realpathSync(String(typeof getHomeCwd === 'function' ? getHomeCwd() : FDE_AI_WORKSPACE || '').trim()) } catch { home = '' }
      if (!home) return false
      try { return realpathSync(String(cwd || '').trim()) === home } catch { return false }
    },
  }
}

export async function bootSemanticOsBff(adapters = {}) {
  if (runtime) return runtime
  if (!process.env.DSH_HOME && FDE_DSH_HOME) process.env.DSH_HOME = FDE_DSH_HOME
  const sidecar = adapters.sidecar || createSidecar(() => mergeConfig({}))
  const writes = createWriteLog()
  const persistence = adapters.persistence || createDiskSessionPersistence()
  const extract = adapters.extract || createExtract({})
  const extractQueue = createExtractQueue({
    getExtract: () => extract,
    postPython: (payload) => postPython(sidecar, payload),
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const workspaceAuthority = withHomeCwd(createWorkspaceAuthority(), () => adapters.workspaceCwd || FDE_AI_WORKSPACE)
  workspaceAuthority.setPersistence(persistence)
  const ingest = createIngest({
    sidecar,
    getEyes: () => null,
    getExtract: () => extract,
    getExtractQueue: () => extractQueue,
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const sessionIngest = createSessionIngest({
    sidecar,
    getPersistence: () => persistence,
    getEyes: () => null,
    getExtract: () => extract,
    extractQueue,
    getConfig: () => mergeConfig({}),
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const handler = createHandler({
    sidecar,
    getConfig: () => mergeConfig({}),
    ingest,
    writes,
    sessionIngest,
    peopleSync: { onRoster() {} },
    workspaceAuthority,
    extractQueue,
    getPersistence: () => persistence,
    getExtract: () => extract,
  })
  const upgrade = createUpgradeHandler(sidecar, workspaceAuthority)
  runtime = { sidecar, handler, upgrade, writes, sessionIngest, extractQueue, persistence, extract }
  void ensureProjectMemorySkill(FDE_DSH_HOME).catch(() => undefined)
  if (adapters.start === false) {
    void extractQueue.stop()
  } else {
    void sidecar.start().catch((error) => {
      console.error('semantic_os_bff_start_failed', error)
    })
    sessionIngest.start()
  }
  return runtime
}

export async function stopSemanticOsBff() {
  const current = runtime
  runtime = null
  if (!current) return
  try { await current.extractQueue?.stop?.() } catch { /* ignore */ }
  try { current.sessionIngest?.stop?.() } catch { /* ignore */ }
  try { await current.sidecar?.dispose?.() } catch { /* ignore */ }
}

export function handleSemanticOsUpgrade(request, socket, head) {
  if (!runtime || typeof runtime.upgrade !== 'function') return false
  let pathname = ''
  try {
    pathname = new URL(request.url || '/', 'http://dsh.local').pathname
  } catch {
    return false
  }
  if (pathname !== '/semantic-os/ws/graph-updates' && pathname !== '/ws/graph-updates') return false
  void runtime.upgrade(request, socket, head)
  return true
}

export function handleSemanticOsHttp(request, response) {
  if (!runtime || typeof runtime.handler !== 'function') return false
  const host = String(request.headers.host || `127.0.0.1:${FDE_RUNTIME_PORT}`)
  const headers = {
    ...request.headers,
    origin: request.headers.origin || `http://${host}`,
  }
  const wrapped = new Proxy(request, {
    get(target, prop) {
      if (prop === 'headers') return headers
      const value = target[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  void runtime.handler(wrapped, response)
  return true
}

function jsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? {}))
  } catch {
    return { ok: true, started: true }
  }
}

export async function setBackgroundPaused(paused) {
  const on = Boolean(paused)
  if (!runtime) return { ok: false, error: 'NOT_READY', paused: on }
  try {
    if (on) runtime.sessionIngest?.pause?.()
    else runtime.sessionIngest?.resume?.()
  } catch { /* ingest surface may be mid-tick */ }
  try {
    runtime.extractQueue?.setPaused?.(on)
  } catch { /* extract queue optional */ }
  let vectors = null
  try {
    vectors = await postPython(runtime.sidecar, {
      op: 'pause_vectors',
      cwd: FDE_AI_WORKSPACE || '',
      args: { paused: on },
    })
  } catch (error) {
    vectors = { error: error instanceof Error ? error.message : String(error) }
  }
  return { ok: true, paused: on, vectors }
}

function sessionIngestLocal(path) {
  const ingest = runtime?.sessionIngest
  if (path === '/session-ingest/now') {
    if (!ingest) {
      const error = new Error('NO_SESSION_INGEST')
      error.code = 'NO_SESSION_INGEST'
      throw error
    }
    const kick = typeof ingest.kick === 'function' ? ingest.kick : ingest.tick
    return Promise.resolve(kick.call(ingest)).then((result) => {
      const packed = result && typeof result === 'object' ? result : {}
      return jsonClone({ ...packed, ok: true, started: packed.started !== false })
    })
  }
  if (path === '/session-ingest') {
    const snap = ingest && typeof ingest.snapshot === 'function' ? ingest.snapshot() : { error: 'NO_SESSION_INGEST' }
    return jsonClone({ ok: true, ...snap })
  }
  return null
}

export async function invokeSemanticOs(path, options = {}) {
  if (!runtime) throw new Error('semantic-os BFF 未启动')
  const local = sessionIngestLocal(path)
  if (local) return local
  const port = Number(process.env.FDE_RUNTIME_PORT || FDE_RUNTIME_PORT || 4318)
  const origin = `http://127.0.0.1:${port}`
  let url
  if (path === '/python') {
    url = new URL('/semantic-os/python', origin)
    if (options.cwd) url.searchParams.set('cwd', String(options.cwd))
  } else {
    url = new URL(`/semantic-os${path}`, origin)
    if (options.cwd) url.searchParams.set('cwd', String(options.cwd))
  }
  const method = String(options.method || (path === '/python' || path === '/find' ? 'POST' : 'GET')).toUpperCase()
  const headers = {
    origin,
    host: `127.0.0.1:${port}`,
    'content-type': 'application/json',
  }
  const body = path === '/python'
    ? JSON.stringify({ op: options.op, cwd: options.cwd, args: options.args ?? {} })
    : path === '/find'
      ? JSON.stringify({
        query: options.query,
        q: options.query,
        cwd: options.cwd,
        ...(options.body && typeof options.body === 'object' ? options.body : {}),
      })
      : (options.body != null ? JSON.stringify(options.body) : undefined)
  const response = await fetch(url, { method, headers, body })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.hint || payload.error || `记忆调用失败：HTTP ${response.status}`)
    error.code = payload.error || 'ai/memory-error'
    throw error
  }
  return payload
}
