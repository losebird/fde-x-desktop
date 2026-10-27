/**
 * FDE BFF owns the lan-assist gate. DSH iframe does not load the plugin face.
 */
import { keyFromHex, verifyFrame } from './plugins/dsh-lan-assist/crypto.js'
import { DEFAULT_LAN_PORT } from './plugins/dsh-lan-assist/home.js'
import { createLanServer, guessPeerDoor, publicDoors } from './plugins/dsh-lan-assist/lan.js'
import { collapseKindsToConnectedTables } from './plugins/dsh-lan-assist/lookup.js'
import { createNatsTransport, relayCredsPath, relayUrl, setRelayStore } from './plugins/dsh-lan-assist/nats-relay.js'
import { createLanFirstTransport, createLanTransport } from './plugins/dsh-lan-assist/transport.js'
import { createLanAssistCore, createLocalHandler, createStore, dispatch } from './lan-assist-engine.mjs'

let runtime = null
let followupFn = async () => ({ ok: false, error: 'NO_FOLLOWUP' })
let loadVocabFn = async () => []
let saveVocabFn = async () => ({ ok: false, error: 'NO_SEMANTIC', hint: '词表写回还没接到记忆图。' })

export function lanAssistBffReady() {
  return Boolean(runtime && runtime.secretary)
}

export function setLanAssistFollowup(fn) {
  if (typeof fn === 'function') followupFn = fn
}

export function setLanAssistVocabLoader(fn) {
  if (typeof fn === 'function') loadVocabFn = fn
}

export function setLanAssistVocabSaver(fn) {
  if (typeof fn === 'function') saveVocabFn = fn
}

async function onLanFrame(secretary, sse, port, frame, meta) {
  const type = frame && frame.type
  if (type && String(type).startsWith('pair.')) {
    const result = typeof secretary.acceptPairFrame === 'function'
      ? await secretary.acceptPairFrame(frame)
      : { ok: false, error: 'NO_PAIR' }
    sse.emit('mailbox', { type })
    return result
  }
  if (type === 'hello') {
    const remote = guessPeerDoor(meta.remote, frame.door, port)
    const accepted = await secretary.acceptHello(frame, remote)
    if (accepted && accepted.ok === false && frame.from) {
      await secretary.noteSighting({
        id: frame.from,
        displayName: frame.fromName,
        door: remote,
      })
    }
    sse.emit('mailbox', { type: 'hello' })
    return accepted
  }
  if (type === 'shout') {
    const claimed = String((frame && frame.door) || '')
    const remote = claimed ? guessPeerDoor(meta.remote, claimed, port) : ''
    const from = String((frame && frame.from) || '')
    const peer = from ? await secretary.peerFor(from) : null
    if (peer && peer.keyHex && !peer.unpaired) {
      try {
        if (!verifyFrame(keyFromHex(peer.keyHex), frame)) return { ok: false, error: 'BAD_MAC' }
      } catch {
        return { ok: false, error: 'BAD_MAC' }
      }
      await secretary.hear(from, remote, frame.fromName, frame.avatar)
      sse.emit('mailbox', { type: 'shout' })
      return { ok: true }
    }
    await secretary.noteSighting({ id: from, displayName: frame.fromName, door: remote })
    return { ok: true, trusted: false }
  }
  const from = String((frame && frame.from) || '')
  const peer = await secretary.peerFor(from)
  if (!peer || peer.unpaired || !peer.keyHex) {
    if (from) {
      await secretary.noteSighting({
        id: from,
        displayName: frame.fromName,
        door: guessPeerDoor(meta.remote, frame.door, port),
      })
    }
    return { ok: false, error: 'KEY_REJECT' }
  }
  const fresh = await secretary.noteSeen(from, frame.nonce)
  if (!fresh) return { ok: false, error: 'REPLAY' }
  if (frame.door) await secretary.hear(from, frame.door, frame.fromName, frame.avatar)
  let result = { ok: false, error: 'UNKNOWN' }
  if (type === 'envelope') result = await secretary.receiveEnvelope(frame, peer)
  else if (type === 'reply') result = await secretary.receiveReply(frame, peer)
  else if (type === 'ack') result = await secretary.receiveAck(frame, peer)
  sse.emit('mailbox', { type })
  return result
}

export async function bootLanAssistBff(adapters = {}) {
  if (runtime) return runtime
  followupFn = adapters.followup || followupFn
  if (typeof adapters.loadVocab === 'function') loadVocabFn = adapters.loadVocab
  if (typeof adapters.saveVocab === 'function') saveVocabFn = adapters.saveVocab
  const port = Number(process.env.DSH_LAN_ASSIST_PORT || DEFAULT_LAN_PORT)
  const host = String(adapters.lanHost || '0.0.0.0')
  const store = adapters.store || createStore()
  try {
    const boot = await store.get()
    setRelayStore({
      url: boot.relayUrl,
      credsPath: typeof store.getSecret === 'function' ? await store.getSecret('natsCredsPath') : '',
    })
  } catch { /* store optional in tests */ }
  const relay = createNatsTransport({ lazy: true })
  const transport = createLanFirstTransport({ lan: createLanTransport(), relay })
  runtime = await createLanAssistCore({
    store,
    port,
    send: adapters.send || ((door, frame, opts) => transport.send(door, frame, opts)),
    relayStatus: () => (relay && typeof relay.status === 'function'
      ? relay.status()
      : { configured: false, connected: false, error: '' }),
    publicDoors: () => publicDoors(port),
    loadVocab: (workspace) => loadVocabFn(workspace),
    saveVocab: (workspace, concept) => saveVocabFn(workspace, concept),
    looksLikeChoice: adapters.looksLikeChoice,
    ingestPaths: adapters.ingestPaths,
  })
  const { secretary, sse } = runtime
  const lan = createLanServer({
    port,
    host,
    onFrame: (frame, meta) => onLanFrame(secretary, sse, port, frame, meta),
  })
  runtime.lan = lan
  runtime.handler = createLocalHandler({
    secretary,
    lan,
    sse,
    followup: (spec) => followupFn(spec),
    translate: adapters.translate,
  })
  if (adapters.lan !== false) {
    void lan.start().catch((error) => {
      console.error('lan_assist_bff_listen_failed', error)
    })
    let ticking = false
    const timer = setInterval(() => {
      if (ticking) return
      ticking = true
      void secretary.tick()
        .then((view) => secretary.shout().then(() => view))
        .then(() => { sse.emit('mailbox', { type: 'tick' }) })
        .catch(() => undefined)
        .finally(() => { ticking = false })
    }, 15_000)
    if (typeof timer.unref === 'function') timer.unref()
    runtime.tickTimer = timer
  }
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
