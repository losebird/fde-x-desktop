/**
 * Hall shell and opened thread. Hall is last line + unread, not the letter.
 * @module dsh-lan-assist/view
 */

import { hallRequests, inThread, isDirectChat, sameDirectTalk } from './hall.js'
import { publicAttach } from './attach.js'
import { isHandoffItem } from './handoff.js'
import { randomHex } from './crypto.js'
import { CODE_MAX_GUESSES, ONLINE_AFTER_MS } from './home.js'
import { speakObserve, speakWho } from './miss.js'
import { buildCatalog } from './catalog.js'
import { livePendingWrite, livePendingWriteFor, livePendingSheet } from './gate.js'
import { publicNudges, inboxOf as inboxItems, dockFor as dockCard } from './dock.js'
import { dropReplyDraft } from './draft-state.js'
import { relayCredsPath, relayUrl } from './nats-relay.js'
import { conversationOf, messagesOf, requestIdOf } from './conversation.js'

export function publicCode(pairCode, t) {
  if (!pairCode) return null
  if (pairCode.expiresAt <= t) return { expired: true }
  return {
    code: pairCode.code,
    remainMs: pairCode.expiresAt - t,
    guesses: pairCode.guesses || 0,
    maxGuesses: CODE_MAX_GUESSES,
  }
}

export function publicAsk(ask) {
  return ask && ask.from ? {
    from: ask.from,
    fromName: ask.fromName || '同事',
    door: ask.door || '',
    ready: !!ask.ready,
    session: ask.session || '',
  } : null
}

export function publicWait(wait) {
  return wait && wait.id ? {
    id: wait.id,
    displayName: wait.displayName || '同事',
    door: wait.door || '',
  } : null
}

export function isOnline(peer, t) {
  if (!peer || peer.unpaired) return false
  const heard = Number(peer.lastHeard || 0)
  return !!(heard && t - heard <= ONLINE_AFTER_MS)
}

export function todayKey(t) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayObserve(state, t = Date.now()) {
  const row = (state && state.observe) || {}
  return row.day !== todayKey(t)
    ? { day: todayKey(t), sends: 0, lookups: 0 }
    : { day: row.day, sends: Number(row.sends || 0), lookups: Number(row.lookups || 0) }
}

export function bumpObserve(state, field, t) {
  const next = todayObserve(state, t)
  next[field] = Number(next[field] || 0) + 1
  state.observe = next
}

export function publicObserve(state, t = Date.now()) {
  const row = todayObserve(state, t)
  return { ...row, speak: speakObserve(row) }
}

export function publicGroups(state) {
  return (Array.isArray(state && state.groups) ? state.groups : []).map((g) => ({
    id: g.id,
    name: g.name,
    members: Array.isArray(g.members) ? g.members.slice() : [],
    pin: !!g.pin,
    mute: !!g.mute,
    origin: g.origin === 'roster' ? 'roster' : 'local',
  }))
}

export function note(state, text, t) {
  state.ledger = state.ledger || []
  state.ledger.push({ at: t || Date.now(), text })
}

export function publicPeer(peer, t) {
  return peer && {
    id: peer.id,
    displayName: peer.displayName,
    avatar: peer.avatar || '',
    note: peer.note || '',
    door: peer.door,
    lastHeard: peer.lastHeard || 0,
    unpaired: !!peer.unpaired,
    online: isOnline(peer, t),
    staffId: peer.staffId || '',
    pin: !!peer.pin,
    mute: !!peer.mute,
  }
}

function sentBodiesOf(req) {
  const bodies = [...((req && req.versions) || []), ...((req && req.replies) || [])]
    .map((row) => String((row && row.body) || '').trim())
    .filter(Boolean)
  const excerpt = String((req && (req.body || req.excerpt)) || '').trim()
  excerpt && bodies.push(excerpt)
  return bodies
}

function threadRoot(req) {
  return String((req && (req.threadId || req.id)) || '')
}

function sameThread(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.id && a.id === b.id) return true
  const left = threadRoot(a)
  const right = threadRoot(b)
  return !!(left && left === right)
}

export function liveReplyDraft(req, thread) {
  const draft = String((req && req.replyDraft) || '').trim()
  if (!draft) return ''
  const rows = Array.isArray(thread) && thread.length ? thread : [req]
  return rows.some((row) => (sameThread(row, req) || sameDirectTalk(row, req)) && sentBodiesOf(row).includes(draft)) ? '' : draft
}

function publicThread(reqs) {
  const rows = (reqs || []).filter(Boolean)
  return rows.map((req) => requestPublic(req, rows)).filter(Boolean)
}

function packThread(reqs) {
  const rows = (reqs || []).filter(Boolean)
  return {
    ok: true,
    requests: publicThread(rows),
    conversations: rows.map(conversationOf),
  }
}

export function requestPublic(req, thread) {
  return req && !req.roster && {
    id: req.id,
    kind: req.kind,
    status: req.status,
    sessionId: req.sessionId || '',
    workspace: req.workspace || '',
    ref: req.ref && req.ref.no ? { kind: req.ref.kind || '单据', no: req.ref.no } : null,
    excerpt: req.excerpt || '',
    body: req.body || '',
    from: req.from || '',
    fromName: req.fromName || '',
    to: req.to || [],
    visible: req.visible || [],
    holder: req.holder || '',
    versions: req.versions || [],
    reads: req.reads || {},
    replies: req.replies || [],
    messages: messagesOf(req),
    seenReplies: Number(req.seenReplies || 0),
    withdrawn: req.withdrawn || [],
    cosign: req.cosign || { on: false, nods: [] },
    slots: req.slots || [],
    pickedSlot: req.pickedSlot ?? -1,
    calendarWritten: !!req.calendarWritten,
    calendarNoted: !!req.calendarNoted,
    adopted: !!req.adopted,
    held: !!req.held,
    preview: req.preview || null,
    receiptId: req.receiptId || '',
    signed: req.signed || '',
    sourceQuote: req.sourceQuote || '',
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    failReason: req.failReason || '',
    delivered: req.delivered || {},
    relayed: req.relayed || {},
    via: req.via || {},
    attempts: req.attempts || 0,
    lastError: req.lastError || '',
    attachments: publicAttach(req.attachments),
    handoff: (req.attachments || []).some(isHandoffItem),
    replyDraft: liveReplyDraft(req, thread),
    seen: req.seen || null,
    groupId: req.groupId || '',
    groupName: req.groupName || '',
    topic: !!req.topic,
    threadId: req.threadId || '',
  }
}

/**
 * @param {object} bag
 */
export function createView(bag) {
  const {
    store, now, port, opts, spillOnce, ensureSelf,
    loadLookupToken, loadConnToken, publicLookups, publicLookup, lookupReady,
  } = bag

  function peerList(state) {
    return Object.values(state.peers || {}).map((peer) => publicPeer(peer, now()))
  }

  function relayPublic(state) {
    const row = opts && typeof opts.relayStatus === 'function' ? opts.relayStatus() : null
    const envUrl = String(process.env.DSH_LAN_ASSIST_NATS || '').trim()
    const url = envUrl || relayUrl() || String((state && state.relayUrl) || '').trim()
    const configured = row && typeof row === 'object' ? !!row.configured : !!url
    const connected = row && typeof row === 'object' ? !!row.connected : false
    return {
      configured,
      connected,
      url,
      credsSet: !!relayCredsPath(),
      env: !!envUrl,
    }
  }

  function capabilitiesOf(state) {
    return {
      connector: typeof opts.lookupTodo === 'function' && lookupReady(state),
      semantic: typeof opts.brief === 'function',
      eyes: typeof opts.hasEyes === 'function' ? !!opts.hasEyes() : typeof opts.see === 'function',
    }
  }

  function catalogOf(state) {
    if (typeof opts.catalog === 'function') return opts.catalog() || []
    if (Array.isArray(opts.catalog)) return opts.catalog
    const caps = capabilitiesOf(state)
    const rows = publicLookups(state)
    const extras = rows.filter((row) => row.configured).map((row) => ({
      name: `lookup_todo:${row.id}`,
      speak: '',
      system: row.system || row.id,
      env: row.env,
    }))
    opts.gate && extras.push(
      { name: 'biz_describe', speak: '先读目录再填槽', write: false, nod: false },
      { name: 'biz_traces', speak: '打开账本回执', write: false, nod: false },
      { name: 'biz_preview', speak: '先预览再写', write: false, nod: false },
      { name: 'biz_write', speak: '带同一张令牌才写', write: true, nod: true },
    )
    return buildCatalog({
      semantic: caps.semantic,
      connector: caps.connector,
      connectorSystem: (rows[0] && rows[0].system) || '',
      connectorEnv: (rows[0] && rows[0].env) || '',
      extras,
    })
  }

  function dockCtx() {
    return { gate: opts.gate, livePendingWrite, capabilitiesOf, requestPublic, liveReplyDraft }
  }

  function inboxOf(state) {
    return inboxItems(state, now(), dockCtx())
  }

  function dockFor(state, sessionId) {
    return dockCard(state, sessionId, now(), dockCtx())
  }

  function selfOf(safe) {
    return safe.self ? {
      id: safe.self.id,
      displayName: safe.self.displayName,
      avatar: safe.self.avatar || '',
      staffId: safe.self.staffId || '',
      who: speakWho(safe.self),
    } : null
  }

  function hallOf(state, sessionId) {
    const safe = state && typeof state === 'object' ? state : {}
    const inbox = inboxOf(safe)
    return {
      self: selfOf(safe),
      doorPort: port,
      pairCode: publicCode(safe.pairCode, now()),
      pairAsk: publicAsk(safe.pairAsk),
      pairWait: publicWait(safe.pairWait),
      peers: peerList(safe),
      requests: hallRequests(safe, safe.self && safe.self.id),
      inbox,
      pendingCount: inbox.filter((item) => item.counts).length,
      listenGranted: !!safe.listenGranted,
      asleep: !!safe.asleep,
      briefOff: !!safe.briefOff,
      advice: safe.advice || null,
      capabilities: capabilitiesOf(safe),
      writeStopped: !!safe.writeStopped,
      lookup: publicLookup(safe),
      lookups: publicLookups(safe),
      sinkCommand: safe.sinkCommand || '',
      publicDoors: (opts.publicDoors && opts.publicDoors()) || [],
      nudges: publicNudges(safe),
      pendingWrite: livePendingWriteFor(safe, opts.gate, now(), sessionId),
      pendingSheet: livePendingSheet(safe, opts.gate, now(), sessionId),
      groups: publicGroups(safe),
      relayConfigured: relayPublic(safe).configured,
      relayConnected: relayPublic(safe).connected,
      relayUrl: relayPublic(safe).url,
      relayCredsSet: relayPublic(safe).credsSet,
      relayEnv: relayPublic(safe).env,
    }
  }

  function viewOf(state, sessionId) {
    const safe = state && typeof state === 'object' ? state : {}
    const inbox = inboxOf(safe)
    return {
      self: selfOf(safe),
      doorPort: port,
      pairCode: publicCode(safe.pairCode, now()),
      pairAsk: publicAsk(safe.pairAsk),
      pairWait: publicWait(safe.pairWait),
      peers: peerList(safe),
      requests: publicThread(Object.values(safe.requests || {})),
      inbox,
      pendingCount: inbox.filter((item) => item.counts).length,
      ledger: (safe.ledger || []).slice(-80),
      listenGranted: !!safe.listenGranted,
      asleep: !!safe.asleep,
      briefOff: !!safe.briefOff,
      advice: safe.advice || null,
      capabilities: capabilitiesOf(safe),
      catalog: catalogOf(safe),
      writeStopped: !!safe.writeStopped,
      drafts: (safe.drafts || []).slice(-20),
      lookup: publicLookup(safe),
      lookups: publicLookups(safe),
      sinkCommand: safe.sinkCommand || '',
      sightings: Object.values(safe.sightings || {}),
      publicDoors: (opts.publicDoors && opts.publicDoors()) || [],
      observe: publicObserve(safe, now()),
      nudges: publicNudges(safe),
      pendingWrite: livePendingWriteFor(safe, opts.gate, now(), sessionId),
      pendingSheet: livePendingSheet(safe, opts.gate, now(), sessionId),
      groups: publicGroups(safe),
      relayConfigured: relayPublic(safe).configured,
      relayConnected: relayPublic(safe).connected,
      relayUrl: relayPublic(safe).url,
      relayCredsSet: relayPublic(safe).credsSet,
      relayEnv: relayPublic(safe).env,
    }
  }

  async function readyState() {
    await spillOnce()
    await loadLookupToken()
    let state = await store.get()
    for (const row of publicLookups(state)) await loadConnToken(row.id)
    if (!(state && state.self && state.self.id && state.self.keySeed)) {
      await store.update((s) => ensureSelf(s || {}))
      state = await store.get()
    }
    return state
  }

  async function snapshot(sessionId) {
    return viewOf(await readyState(), sessionId)
  }

  async function hall(sessionId) {
    return hallOf(await readyState(), sessionId)
  }

  async function spillStackedFollows() {
    const t = now()
    await store.update((state) => {
      const selfId = state.self && state.self.id
      const live = Object.values(state.requests || {})
      for (const root of live) {
        if (!root || root.threadId) continue
        if (live.some((row) => row && row.threadId === root.id)) continue
        const extra = (root.versions || []).slice(1)
        const replies = Array.isArray(root.replies) ? root.replies : []
        if (!extra.length && !replies.length) continue
        const spilled = []
        const push = (from, fromName, body, at) => {
          const text = String(body || '').trim()
          if (!text) return
          spilled.push(text)
          const id = `req_${randomHex(5)}`
          const incoming = from !== selfId
          state.requests[id] = {
            id,
            kind: incoming ? 'incoming' : 'outgoing',
            status: incoming ? 'open' : 'sent',
            sessionId: root.sessionId || '',
            workspace: root.workspace || '',
            excerpt: text,
            body: text,
            from: from || '',
            fromName: fromName || '',
            to: incoming ? [selfId].filter(Boolean) : (root.to || []).slice(),
            visible: (root.visible || []).slice(),
            groupId: root.groupId || '',
            groupName: root.groupName || '',
            topic: false,
            threadId: root.id,
            versions: [{ n: 1, from, fromName, body: text, at: at || t }],
            reads: {},
            replies: [],
            withdrawn: [],
            attachments: [],
            createdAt: at || t,
            updatedAt: at || t,
          }
        }
        extra.forEach((v) => push(v.from, v.fromName, v.body, v.at))
        replies.forEach((rep) => push(rep.from, rep.fromName, rep.body, rep.at))
        root.versions = (root.versions || []).slice(0, 1)
        root.replies = []
        const draft = String(root.replyDraft || '').trim()
        draft && spilled.includes(draft) && dropReplyDraft(root)
        root.updatedAt = t
      }
    })
  }

  async function threadOf({ peerId, requestId, groupId }) {
    await spillOnce()
    await spillStackedFollows()
    const state = await store.get()
    const selfId = state && state.self && state.self.id
    const rid = requestIdOf(requestId)
    if (rid) {
      const seed = state.requests && state.requests[rid]
      const rootId = String((seed && seed.threadId) || rid)
      return packThread(Object.values(state.requests || {}).filter((req) => inThread(req, rootId)))
    }
    const gid = String(groupId || '').trim()
    if (gid) {
      return packThread(Object.values(state.requests || {}).filter((req) => req && req.groupId === gid && req.status !== 'closed'))
    }
    const pid = String(peerId || '').trim()
    if (!pid) return { ok: false, error: 'NO_THREAD', requests: [], conversations: [] }
    return packThread(Object.values(state.requests || {}).filter((req) => {
      if (!req || req.status === 'closed' || !isDirectChat(req)) return false
      const mine = req.from === selfId
      const theirs = req.from === pid
      const toThem = (req.to || []).indexOf(pid) >= 0
      return theirs || (mine && toThem)
    }))
  }

  function dock(sessionId) {
    return store.get().then((state) => dockFor(state, sessionId))
  }

  function ledger() {
    return store.get().then((state) => (state.ledger || []).slice(-80).map((row) => ({
      at: Number(row && row.at) || 0,
      text: String((row && row.text) || ''),
    })))
  }

  return {
    snapshot, hall, threadOf, viewOf, hallOf, catalogOf, capabilitiesOf,
    requestPublic, dockFor, inboxOf, dock, ledger, peerList,
  }
}
