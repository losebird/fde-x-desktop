/**
 * Ask this machine. Never a letter. Read ack is not a nod.
 * @module dsh-lan-assist/ask
 */

import { PLUGIN } from './home.js'
import { dayKey } from './dock.js'
import { briefFollowup } from './catalog.js'
import { remindKey, speakLookup } from './probe.js'
import { keyFromHex, randomHex, signFrame } from './crypto.js'

/**
 * @param {object} bag
 */
export function createAsk(bag) {
  const { store, now, send, snapshot, note, catalogOf, lookupRef, opts } = bag

  async function askLocal({ quote, sessionId, workspace, kind }) {
    const text = String(quote || '').trim()
    const sid = String(sessionId || '').trim()
    if (!text) return { ok: false, error: 'EMPTY_BODY', hint: '还没有要问的。' }
    if (!sid) return { ok: false, error: 'NO_SESSION', hint: '这条对话还没绑上，不能问本机。' }
    const letterCwd = String(workspace || '').trim()
    const mode = kind === 'translate' || kind === 'summary' ? kind : 'ask'
    let vocab = []
    if (typeof (opts && opts.loadVocab) === 'function') {
      try {
        const loaded = await opts.loadVocab(letterCwd)
        vocab = Array.isArray(loaded) ? loaded : []
      } catch { vocab = [] }
    }
    return {
      ok: true,
      followup: {
        sessionId: sid,
        text: briefFollowup({
          quote: text,
          catalog: catalogOf(),
          vocab,
          workspace: letterCwd,
          kind: mode,
        }),
        plugin: PLUGIN,
        workspace: letterCwd,
      },
    }
  }

  function gatedSpeak(state, kind, id, line) {
    const key = remindKey(kind, id, dayKey(now()))
    state.reminders = state.reminders || {}
    return state.asleep || state.reminders[key] ? '' : (state.reminders[key] = now(), line)
  }

  async function refreshLookup(requestId) {
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req || !req.ref || !req.ref.no) return { ok: false, error: 'NO_REF' }
    const found = await lookupRef(req.ref, req.workspace)
    const line = speakLookup(req.ref, found.ok ? found : found)
    await store.update((s) => {
      const row = s.requests[requestId]
      if (!row) return
      row.lookupSpeak = line
      row.updatedAt = now()
      const spoken = gatedSpeak(s, 'lookup', requestId, line)
      spoken && note(s, `收信侧现查 · ${spoken}`, now())
    })
    return { ok: true, speak: line, ...(await snapshot()) }
  }

  async function markRead(requestId, sessionId) {
    await store.update((state) => {
      const req = state.requests[requestId]
      if (!req) return
      sessionId && (req.sessionId = sessionId)
      req.updatedAt = now()
      req.kind === 'incoming' && state.self && state.self.id && (req.reads = { ...(req.reads || {}), [state.self.id]: now() })
      req.kind === 'outgoing' && (req.seenReplies = Array.isArray(req.replies) ? req.replies.length : Number(req.replies || 0))
    })
    const state = await store.get()
    const req = state.requests[requestId]
    const toId = req && req.kind === 'outgoing' && (req.to || [])[0]
    const peer = req && (req.kind === 'incoming' ? state.peers[req.from] : (toId && state.peers[toId]))
    peer && peer.keyHex && await send(peer.door, signFrame(keyFromHex(peer.keyHex), {
      type: 'ack',
      from: state.self.id,
      fromName: state.self.displayName,
      to: peer.id,
      nonce: randomHex(8),
      ts: now(),
      requestId,
      event: 'read',
    }))
    return snapshot()
  }

  return { askLocal, gatedSpeak, refreshLookup, markRead }
}
