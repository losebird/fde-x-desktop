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

export async function invokeSemanticOs(path, options = {}) {
  if (!runtime) throw new Error('semantic-os BFF 未启动')
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
  const method = String(options.method || (path === '/python' ? 'POST' : 'GET')).toUpperCase()
  const headers = {
    origin,
    host: `127.0.0.1:${port}`,
    'content-type': 'application/json',
  }
  const body = path === '/python'
    ? JSON.stringify({ op: options.op, cwd: options.cwd, args: options.args ?? {} })
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
