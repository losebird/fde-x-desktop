/**
 * FDE BFF owns the lan-assist gate. DSH iframe does not load the plugin face.
 */
import { createLanAssistCore, createLocalHandler, dispatch } from './lan-assist-engine.mjs'
import { collapseKindsToConnectedTables } from './plugins/dsh-lan-assist/lookup.js'
import { DEFAULT_LAN_PORT } from './plugins/dsh-lan-assist/home.js'

let runtime = null
let followupFn = async () => ({ ok: false, error: 'NO_FOLLOWUP' })

export function lanAssistBffReady() {
  return Boolean(runtime && runtime.secretary)
}

export async function bootLanAssistBff(adapters = {}) {
  if (runtime) return runtime
  followupFn = adapters.followup || followupFn
  runtime = await createLanAssistCore({
    store: adapters.store,
    port: Number(process.env.DSH_LAN_ASSIST_PORT || DEFAULT_LAN_PORT),
    send: adapters.send || (async () => ({ ok: false, error: 'NO_LAN' })),
    loadVocab: adapters.loadVocab || (async () => []),
    saveVocab: adapters.saveVocab || (async () => ({ ok: true })),
    looksLikeChoice: adapters.looksLikeChoice,
    ingestPaths: adapters.ingestPaths,
  })
  runtime.handler = createLocalHandler({
    secretary: runtime.secretary,
    lan: { doors: () => [], port: Number(process.env.DSH_LAN_ASSIST_PORT || DEFAULT_LAN_PORT) },
    sse: runtime.sse,
    followup: (spec) => followupFn(spec),
    translate: adapters.translate,
  })
  return runtime
}

export async function invokeLanAssist(path, options = {}) {
  if (!runtime) throw new Error('lan-assist BFF 未启动')
  const method = String(options.method || (options.body ? 'POST' : 'GET')).toUpperCase()
  const search = options.search && typeof options.search === 'object' ? options.search : {}
  const sessionId = String(search.sessionId || '')
  const secretary = runtime.secretary
  if (method === 'GET' && path === '/state') {
    const view = typeof secretary.hall === 'function'
      ? await secretary.hall(sessionId)
      : await secretary.snapshot(sessionId)
    const dock = typeof secretary.dock === 'function' ? await secretary.dock(sessionId) : null
    const ledger = typeof secretary.ledger === 'function' ? await secretary.ledger() : []
    return { ok: true, ...view, dock, doors: [], ledger }
  }
  if (method === 'GET' && path === '/catalog') {
    return secretary.describeBiz({
      workspace: String(search.workspace || ''),
      kind: String(search.kind || ''),
    })
  }
  if (method === 'GET' && path === '/traces') {
    return secretary.openTrace({
      workspace: String(search.workspace || ''),
      id: String(search.id || ''),
      no: String(search.no || ''),
    })
  }
  const result = await dispatch(secretary, path, options.body || {}, followupFn, {})
  if (runtime.sse && path !== '/sleep') runtime.sse.emit('mailbox', { type: path.slice(1) || 'post' })
  return result
}

export function handleLanAssistHttp(request, response) {
  if (!runtime || typeof runtime.handler !== 'function') return false
  void runtime.handler(request, response)
  return true
}

export function kindsFromVocabRows(rows) {
  return collapseKindsToConnectedTables(Array.isArray(rows) ? rows : []).kinds
}
