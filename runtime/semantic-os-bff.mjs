/**
 * FDE BFF owns the semantic-os HTTP + sidecar. DSH iframe does not load client.js.
 */
import { createHandler } from './plugins/dsh-semantic-os/http.js'
import { createIngest } from './plugins/dsh-semantic-os/ingest.js'
import { mergeConfig } from './plugins/dsh-semantic-os/persist.js'
import { createWriteLog } from './plugins/dsh-semantic-os/product.js'
import { createSidecar } from './plugins/dsh-semantic-os/sidecar.js'
import { createWorkspaceAuthority } from './plugins/dsh-semantic-os/workspace-authority.js'
import { FDE_RUNTIME_PORT } from './config.mjs'

let runtime = null

export function semanticOsBffReady() {
  return Boolean(runtime && runtime.handler)
}

export async function bootSemanticOsBff(adapters = {}) {
  if (runtime) return runtime
  const sidecar = adapters.sidecar || createSidecar(() => mergeConfig({}))
  const writes = createWriteLog()
  const workspaceAuthority = createWorkspaceAuthority()
  const ingest = createIngest({
    sidecar,
    getEyes: () => null,
    getExtract: () => null,
    getExtractQueue: () => null,
    onGraphWrite: (cwd, op) => writes.mark(cwd, op),
  })
  const handler = createHandler({
    sidecar,
    getConfig: () => mergeConfig({}),
    ingest,
    writes,
    sessionIngest: { start() {}, ensure() {} },
    peopleSync: { onRoster() {} },
    workspaceAuthority,
    extractQueue: null,
    getPersistence: () => null,
    getExtract: () => null,
  })
  runtime = { sidecar, handler, writes }
  if (adapters.start !== false) {
    void sidecar.start().catch((error) => {
      console.error('semantic_os_bff_start_failed', error)
    })
  }
  return runtime
}

export function handleSemanticOsHttp(request, response) {
  if (!runtime || typeof runtime.handler !== 'function') return false
  const host = String(request.headers.host || `127.0.0.1:${FDE_RUNTIME_PORT}`)
  const headers = { ...request.headers, origin: `http://${host}` }
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
