/**
 * Duty / miss / observe / receipt speak. Never a send. Sleep queues.
 * @module dsh-lan-assist/hint
 */

import { randomHex } from './crypto.js'
import { parseBusinessRef, speakBusinessEvent } from './ref.js'
import { speakReceipt } from './write.js'
import { speakDuty } from './duty.js'
import { speakForbidden, speakMiss, speakObserve } from './miss.js'
import { speakDelegate, speakSla } from './probe.js'
import { speakCatalogLine } from './catalog.js'

function matchPeersByName(state, name) {
  const q = String(name || '').trim()
  if (!q) return []
  const live = Object.values(state.peers || {}).filter((p) => p && !p.unpaired)
  const exact = live.filter((p) => p.displayName === q || p.id === q || p.staffId === q)
  return exact.length ? exact : live.filter((p) => (p.displayName && p.displayName.includes(q)) || p.id.startsWith(q))
}

/**
 * @param {object} bag
 */
export function createHints(bag) {
  const { store, now, snapshot, note, ensureSelf, catalogOf, todayObserve } = bag

  async function hearBusinessEvent({ kind, no, workspace, speak, requestId, receiptId, failed, sessionId }) {
    const state = await store.get()
    const linked = requestId ? state.requests[requestId] : null
    const ref = (linked && linked.ref)
      || parseBusinessRef(no)
      || (no ? { kind: '单据', no: String(no).trim() } : parseBusinessRef(speak))
    let line = String(speak || '').trim()
    let eventKind = kind || 'mine'
    const asleep = !!(await store.get()).asleep
    if (kind === 'receipt' || kind === 'compensate' || receiptId || failed) {
      const spoken = speakReceipt(ref, { receiptId, failed: failed || kind === 'compensate', ok: !!receiptId })
      !line && (line = spoken.speak)
      eventKind = spoken.kind
      linked && await store.update((s) => {
        const row = s.requests[requestId]
        row && spoken.receiptId && (row.receiptId = spoken.receiptId, row.updatedAt = now())
      })
    }
    !line && (line = speakBusinessEvent(eventKind, ref))
    const id = `biz_${randomHex(4)}`
    await store.update((s) => {
      ensureSelf(s)
      s.events = s.events || []
      const key = `${eventKind}:${(ref && ref.no) || line}:${requestId || ''}`
      if (s.events.some((ev) => ev.key === key && !ev.held)) return
      s.events.push({
        id,
        key,
        kind: eventKind,
        ref,
        requestId: requestId || '',
        sessionId: String(sessionId || (linked && linked.sessionId) || '').trim(),
        workspace: String(workspace || (linked && linked.workspace) || '').trim(),
        speak: line,
        held: false,
        silent: asleep,
        at: now(),
      })
      note(s, asleep ? `关机队列 · ${line}` : `业务事件开口 · ${line}`, now())
    })
    return { ok: true, eventId: id, ...(await snapshot()) }
  }

  async function speakDutyHint({ who, reason, no, requestId, workspace }) {
    const state = await store.get()
    const linked = requestId ? state.requests[requestId] : null
    const ref = (linked && linked.ref) || parseBusinessRef(no) || (no ? { kind: '单据', no: String(no).trim() } : null)
    const peer = who
      ? Object.values(state.peers || {}).find((row) => row && !row.unpaired && (row.displayName === who || row.id === who || row.staffId === who))
      : null
    const paired = !!(peer && peer.keyHex && !peer.unpaired)
    return hearBusinessEvent({
      kind: 'duty',
      no: ref && ref.no,
      requestId,
      workspace: workspace || (linked && linked.workspace) || '',
      speak: speakDuty({
        who: (peer && peer.displayName) || who,
        reason,
        paired: who ? paired : undefined,
        ref,
      }),
    })
  }

  async function speakObserveHint() {
    const state = await store.get()
    return hearBusinessEvent({ kind: 'observe', speak: speakObserve(todayObserve(state)) })
  }

  async function speakForbiddenHint(name) {
    const state = await store.get()
    const catalog = catalogOf(state)
    const asked = String(name || '').trim()
    const hit = catalog.find((row) => row && (row.name === asked || speakCatalogLine(row).includes(asked)))
    return hearBusinessEvent({
      kind: 'forbid',
      speak: hit ? `目录里有${speakCatalogLine(hit)}。` : speakForbidden(asked || '这笔'),
    })
  }

  async function speakFindMiss({ name, requestId, listen, withdrawn, ticket }) {
    const state = await store.get()
    const matches = matchPeersByName(state, name)
    const linked = requestId ? state.requests[requestId] : null
    return hearBusinessEvent({
      kind: 'miss',
      requestId,
      no: ticket || (linked && linked.ref && linked.ref.no),
      speak: speakMiss({
        name,
        matches: matches.length,
        listen,
        withdrawn: withdrawn || !!(linked && (linked.withdrawn || []).length && linked.ref),
        ticket: ticket || (linked && linked.ref && linked.ref.no) || '',
      }),
    })
  }

  async function speakSlaHint({ who, no, requestId }) {
    const state = await store.get()
    const linked = requestId ? state.requests[requestId] : null
    const ref = (linked && linked.ref) || parseBusinessRef(no) || (no ? { kind: '单据', no: String(no).trim() } : null)
    return hearBusinessEvent({
      kind: 'biz',
      requestId,
      no: ref && ref.no,
      speak: speakSla(ref, { who, overtime: true }),
    })
  }

  async function speakDelegateHint(borrowed) {
    const state = await store.get()
    return hearBusinessEvent({
      kind: 'miss',
      speak: speakDelegate(state.self && state.self.staffId, borrowed),
    })
  }

  return {
    hearBusinessEvent,
    speakDutyHint,
    speakObserveHint,
    speakForbiddenHint,
    speakFindMiss,
    speakSlaHint,
    speakDelegateHint,
  }
}
