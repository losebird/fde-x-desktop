/**
 * Compose, flush, receive, reply. Point-send only; empty body is refused.
 * @module dsh-lan-assist/envelope
 */

import { ATTACH_MAX_BYTES, ATTACH_TOTAL_BYTES, FAIL_AFTER_MS, LAN_PROBE_MS, RETRY_STEPS_MS, WITHDRAW_GRACE_MS } from './home.js'
import { encryptJson, decryptJson, keyFromHex, randomHex, signFrame, verifyFrame } from './crypto.js'
import { sameLanSegment } from './lan.js'
import { envelopePointer, parseBusinessRef, redactEnvelopeText } from './ref.js'
import { sanitizeAttach } from './attach.js'
import { namesOf } from './dock.js'
import { consumeDraftsOnSend, dropReplyDraft } from './draft-state.js'
import { rememberMail } from './mail-proj.js'
import { letterIds, requestIdOf } from './conversation.js'
import { homeForIncoming, homeForOutgoing, normalizeCwd, placeEmptyHomes } from './letter-home.js'
import {
  applyPeerResult,
  clearPendingWait,
  deriveLetterStatus,
  nextRetryWait as waitForAttempts,
  pendingPeers,
  shouldAttemptPeer,
} from './delivery.js'
import { destOf, isRoster, upsertGroup } from './roster.js'

export function nextRetryWait(attempts) {
  return waitForAttempts(attempts, RETRY_STEPS_MS)
}

export function sameSet(a, b) {
  const left = a && [...a].sort().join('\0')
  const right = b && [...b].sort().join('\0')
  return !!(a && b && a.length === b.length && left === right)
}

export function similarText(a, b) {
  return String(a || '').trim() === String(b || '').trim()
}

function refuseAttach(attach) {
  const over = attach.some((item) => item.over || item.size > ATTACH_MAX_BYTES)
  const total = attach.reduce((sum, item) => sum + (item.size || 0), 0)
  return over
    ? { ok: false, error: 'ATTACH_OVER', hint: '有附件超过单件 200MB，不能发出。禁止截断当成功。' }
    : (total > ATTACH_TOTAL_BYTES
      ? { ok: false, error: 'ATTACH_TOTAL', hint: '附件合计超过 500MB，不能发出。' }
      : null)
}

/**
 * @param {object} bag
 */
export function createMailbox(bag) {
  const {
    store, now, send, files, persistList, hydrateList,
    ensureSelf, note, snapshot, selfDoor, bumpObserve, refreshLookup, loadVocab,
    writeArchive,
  } = bag

  async function archiveTurn(row) {
    if (typeof writeArchive !== 'function') return
    try { await writeArchive(row) } catch { /* archive never blocks send */ }
  }

  async function compose({ excerpt, to, sessionId, workspace, evidence, attachments, cosign, groupId, threadId }) {
    const text = String(excerpt || '').trim()
    const ids = Array.isArray(to) ? to.filter(Boolean) : []
    if (!text) return { ok: false, error: 'EMPTY_BODY' }
    const attach = sanitizeAttach(attachments)
    const refused = refuseAttach(attach)
    if (refused) return refused
    const state = await store.get()
    const gid = String(groupId || '').trim()
    const group = gid ? ((state.groups || []).find((row) => row && row.id === gid) || null) : null
    if (gid && !group) return { ok: false, error: 'NO_GROUP', hint: '没有这个话题群。' }
    const thread = String(threadId || '').trim()
    if (thread) {
      const root = state.requests[thread]
      if (!root || root.status === 'closed') return { ok: false, error: 'NO_THREAD', hint: '没有这条话题。' }
    }
    const dest = destOf(group && group.members, ids, state.self && state.self.id)
    if (!dest.length) return { ok: false, error: 'NO_RECIPIENT' }
    const existing = group && !thread && Object.values(state.requests).find((req) => (
      req.kind === 'outgoing'
      && req.status !== 'closed'
      && req.status !== 'failed'
      && req.groupId === group.id
      && !req.threadId
      && sameSet(req.to, dest)
      && similarText(req.excerpt, text)
    ))
    if (existing) {
      return { ok: false, error: 'DUP', ...letterIds(existing.id), hint: `已经在问${namesOf(state, dest)}` }
    }
    const id = `req_${randomHex(5)}`
    const cwd = homeForOutgoing(state, { threadId: thread, groupId: gid, workspace, to: dest })
    const cleaned = redactEnvelopeText(text)
    const extraKinds = typeof loadVocab === 'function'
      ? await loadVocab(cwd).catch(() => [])
      : []
    const ref = parseBusinessRef(cleaned, extraKinds)
    const storedAttach = await persistList(id, attach)
    await store.update((s) => {
      ensureSelf(s)
      s.requests[id] = {
        id,
        kind: 'outgoing',
        status: 'presend',
        sessionId: sessionId || '',
        workspace: cwd,
        ref,
        excerpt: cleaned,
        body: cleaned,
        from: s.self.id,
        fromName: s.self.displayName,
        to: dest,
        visible: [s.self.id, ...dest],
        holder: s.self.id,
        versions: [{ n: 1, from: s.self.id, fromName: s.self.displayName, body: text, at: now() }],
        reads: {},
        replies: [],
        withdrawn: [],
        attachments: storedAttach,
        evidence: Array.isArray(evidence) ? evidence.slice(0, 8) : [],
        cosign: { on: !!cosign, nods: [] },
        slots: [],
        pickedSlot: -1,
        calendarWritten: false,
        adopted: false,
        held: false,
        signed: `${s.self.displayName}的秘书代送，${s.self.displayName}点了才发`,
        sourceQuote: text,
        createdAt: now(),
        updatedAt: now(),
        groupId: group ? group.id : '',
        groupName: group ? group.name : '',
        topic: !!(group && !thread),
        threadId: thread,
      }
      if (thread && s.requests[thread]) s.requests[thread].updatedAt = now()
      if (cwd) placeEmptyHomes(s.requests, [id], cwd, now())
    })
    if (cwd) {
      const live = await store.get()
      rememberMail(cwd, {
        id,
        kind: 'outgoing',
        fromName: String((live.self && live.self.displayName) || '').trim(),
        excerpt: cleaned,
        ref,
        sessionId,
        messageId: letterIds(id).messageId,
        at: now(),
      }).catch(() => undefined)
    }
    return { ok: true, ...(await snapshot()), ...letterIds(id) }
  }

  async function confirmSend(requestId) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req || req.kind !== 'outgoing') return { ok: false, error: 'NO_REQUEST' }
    if (req.status === 'presend') {
      if (!req.to.length) return { ok: false, error: 'NO_RECIPIENT' }
      await store.update((s) => {
        const row = s.requests[requestId]
        row.status = 'queued'
        row.updatedAt = now()
        consumeDraftsOnSend(s, row)
        note(s, `待送 · ${row.id} · ${namesOf(s, row.to)}`)
      })
      await flushOutbox()
      return { ok: true, ...(await snapshot()) }
    }
    if (req.status === 'queued' || req.status === 'retry' || req.status === 'failed') {
      if (!pendingPeers(req).length) return { ok: true, ...(await snapshot()) }
      await store.update((s) => {
        const row = s.requests[requestId]
        if (!row) return
        clearPendingWait(row)
        row.status = 'queued'
        row.failReason = ''
        row.updatedAt = now()
        note(s, `再送 · ${row.id} · ${namesOf(s, pendingPeers(row))}`)
      })
      await flushOutbox()
      return { ok: true, ...(await snapshot()) }
    }
    if (req.status === 'sent') return { ok: true, ...(await snapshot()) }
    return { ok: false, error: 'NO_PRESEND' }
  }

  async function cancelPresend(requestId) {
    requestId = requestIdOf(requestId)
    let drop = false
    await store.update((state) => {
      const req = state.requests[requestId]
      req && req.status === 'presend' && (delete state.requests[requestId], drop = true)
    })
    drop && await files.dropPrefix(requestId)
    return snapshot()
  }

  async function flushOutbox() {
    const state = await store.get()
    const queued = Object.values(state.requests || {}).some((req) => (
      req && req.kind === 'outgoing' && (req.status === 'queued' || req.status === 'retry') && pendingPeers(req).length
    ))
    if (state.asleep || !queued) return false
    let flushed = false
    const mailed = new Set()
    const ids = Object.keys(state.requests || {})
    for (const id of ids) {
      const liveState = await store.get()
      const req = liveState.requests[id]
      if (!req || req.kind !== 'outgoing') continue
      if (req.status !== 'queued' && req.status !== 'retry') continue
      for (const peerId of pendingPeers(req)) {
        const current = (await store.get()).requests[id]
        if (!current || !shouldAttemptPeer(current, peerId, now(), RETRY_STEPS_MS)) continue
        const peer = (await store.get()).peers[peerId]
        if (!peer || peer.unpaired || !peer.keyHex) {
          await store.update((s) => {
            const row = s.requests[id]
            if (!row) return
            applyPeerResult(row, peerId, { ok: false, error: 'NOT_PAIRED' }, now(), FAIL_AFTER_MS)
            flushed = true
          })
          continue
        }
        const key = keyFromHex(peer.keyHex)
        const packed = Object.assign({}, current, { attachments: await hydrateList(current.attachments) })
        const box = encryptJson(key, envelopePointer(packed))
        const me = (await store.get()).self
        const frame = signFrame(key, {
          type: 'envelope',
          from: me.id,
          fromName: me.displayName,
          avatar: me.avatar || '',
          to: peerId,
          nonce: randomHex(8),
          ts: now(),
          requestId: current.id,
          box,
        })
        const sent = await send(peer.door, frame, { timeoutMs: LAN_PROBE_MS })
        await store.update((s) => {
          const row = s.requests[id]
          if (!row) return
          applyPeerResult(row, peerId, sent, now(), FAIL_AFTER_MS)
          if (sent.ok && sent.via === 'relay') note(s, `已中继 · ${peer.displayName || peerId} · ${row.id}`)
          else if (sent.ok) note(s, `已投出 · ${peer.displayName || peerId} · ${row.id}`)
          else {
            row.guestNet = !sameLanSegment(selfDoor(), peer.door)
            bumpObserve(s, 'sends', now())
          }
          flushed = true
        })
        if (sent.ok && !isRoster(current) && !mailed.has(id)) {
          mailed.add(id)
          await archiveTurn({
            requestId: id,
            turn: 'send',
            sessionId: current.sessionId,
            workspace: current.workspace,
            actor: me && me.id,
            fromName: me && me.displayName,
            quote: current.excerpt || current.body,
            toIds: current.to,
            at: new Date(now()).toISOString(),
          })
        }
      }
    }
    return flushed
  }

  async function sendRoster(group) {
    const members = [...new Set((Array.isArray(group && group.members) ? group.members : []).filter(Boolean))]
    if (!members.length) return { ok: false, error: 'NO_RECIPIENT' }
    const state = await store.get()
    for (const id of members) {
      const peer = state.peers[id]
      if (!peer || peer.unpaired || !peer.keyHex) return { ok: false, error: 'NOT_PAIRED', peerId: id }
    }
    const requestId = `req_${randomHex(5)}`
    const title = String((group && group.name) || '')
    const gid = String((group && group.id) || '')
    await store.update((s) => {
      ensureSelf(s)
      s.requests[requestId] = {
        id: requestId,
        kind: 'outgoing',
        status: 'queued',
        roster: true,
        sessionId: '',
        workspace: '',
        ref: null,
        excerpt: '',
        body: '',
        from: s.self.id,
        fromName: s.self.displayName,
        to: members,
        visible: [s.self.id, ...members],
        holder: s.self.id,
        versions: [],
        reads: {},
        replies: [],
        withdrawn: [],
        attachments: [],
        evidence: [],
        cosign: { on: false, nods: [] },
        slots: [],
        pickedSlot: -1,
        createdAt: now(),
        updatedAt: now(),
        groupId: gid,
        groupName: title,
        topic: false,
        threadId: '',
        delivered: {},
        relayed: {},
        via: {},
        attempts: {},
        lastAttempt: {},
        lastError: {},
      }
      note(s, `花名册 · ${title} · ${members.length} 人`, now())
    })
    await flushOutbox()
    return { ok: true, requestId, ...(await snapshot()) }
  }

  async function ackDelivery(key, peer, requestId) {
    const saved = await store.get()
    const me = saved.self
    me && peer.door && await send(peer.door, signFrame(key, {
      type: 'ack',
      event: 'delivery',
      from: me.id,
      fromName: me.displayName,
      to: peer.id,
      nonce: randomHex(8),
      ts: now(),
      requestId,
    }), { timeoutMs: LAN_PROBE_MS }).catch(() => undefined)
  }

  async function receiveEnvelope(frame, peer) {
    const key = keyFromHex(peer.keyHex)
    if (!verifyFrame(key, frame)) return { ok: false, error: 'BAD_MAC' }
    let inner
    try {
      inner = decryptJson(key, frame.box)
    } catch {
      return { ok: false, error: 'KEY_REJECT' }
    }
    const id = String(inner.requestId || frame.requestId || '')
    if (!id) return { ok: false, error: 'NO_ID' }
    if (isRoster(inner)) {
      await store.update((state) => {
        ensureSelf(state)
        upsertGroup(state, inner, peer, now, 'roster')
        peer.lastHeard = now()
        peer.online = true
        frame.fromName && (peer.displayName = frame.fromName)
        frame.avatar && (peer.avatar = String(frame.avatar).slice(0, 24))
        note(state, `收下花名册 · ${inner.groupName || inner.groupId} · ${peer.displayName || peer.id}`)
      })
      await ackDelivery(key, peer, id)
      return { ok: true, roster: true }
    }
    const storedAttach = await persistList(id, sanitizeAttach(inner.attachments))
    let created = false
    await store.update((state) => {
      ensureSelf(state)
      const live = state.requests[id]
      live && live.kind === 'incoming' && inner.withdraw
        && (live.status = 'withdrawn', live.updatedAt = now(), note(state, `对端撤回 · ${id}`))
      if (live && live.kind === 'incoming' && inner.withdraw) return
      if (!state.requests[id]) {
        created = true
        const excerpt = redactEnvelopeText(inner.excerpt || inner.body || '')
        const body = redactEnvelopeText(inner.body || inner.excerpt || '')
        const ref = (inner.ref && inner.ref.no)
          ? { kind: inner.ref.kind || '单据', no: String(inner.ref.no) }
          : parseBusinessRef(excerpt, [])
        const cwd = homeForIncoming(state, {
          ...inner,
          from: peer.id,
          to: [state.self.id],
          id,
        })
        state.requests[id] = {
          id,
          kind: 'incoming',
          status: 'open',
          sessionId: '',
          workspace: cwd,
          ref,
          excerpt,
          body,
          from: peer.id,
          fromName: frame.fromName || peer.displayName,
          to: [state.self.id],
          visible: inner.visible || [peer.id, state.self.id],
          groupId: inner.groupId || '',
          groupName: inner.groupName || '',
          threadId: String(inner.threadId || ''),
          topic: inner.threadId ? false : !!inner.topic,
          holder: state.self.id,
          versions: [{ n: 1, from: peer.id, fromName: frame.fromName, body, at: now() }],
          reads: {},
          replies: [],
          withdrawn: [],
          attachments: storedAttach,
          evidence: [],
          cosign: { on: false, nods: [] },
          signed: inner.signed || '',
          sourceQuote: excerpt,
          createdAt: now(),
          updatedAt: now(),
        }
        if (cwd) placeEmptyHomes(state.requests, [id], cwd, now())
        note(state, `收下信封 · ${id} · ${peer.displayName || peer.id}`)
        inner.threadId && state.requests[inner.threadId] && (state.requests[inner.threadId].updatedAt = now())
        inner.groupId && inner.groupName && upsertGroup(state, inner, peer, now, 'roster')
      }
      peer.lastHeard = now()
      peer.online = true
      frame.fromName && (peer.displayName = frame.fromName)
      frame.avatar && (peer.avatar = String(frame.avatar).slice(0, 24))
    })
    const saved = await store.get()
    const incoming = saved.requests[id]
    incoming && incoming.kind === 'incoming' && incoming.ref && incoming.ref.no && await refreshLookup(id)
    if (incoming && incoming.kind === 'incoming' && !inner.withdraw) {
      await ackDelivery(key, peer, id)
    }
    if (created && incoming && incoming.kind === 'incoming') {
      await archiveTurn({
        requestId: id,
        turn: 'recv',
        sessionId: incoming.sessionId,
        workspace: incoming.workspace,
        actor: peer.id,
        fromName: incoming.fromName || peer.displayName,
        quote: incoming.excerpt || incoming.body,
        toIds: incoming.to,
        at: new Date(now()).toISOString(),
      })
    }
    return { ok: true }
  }

  async function reply({ requestId, body, sessionId, attachments, cosign, messageId }) {
    requestId = requestIdOf(messageId || requestId)
    const text = String(body || '').trim()
    if (!text) return { ok: false, error: 'EMPTY_BODY' }
    const attach = sanitizeAttach(attachments)
    const refused = refuseAttach(attach)
    if (refused) return refused
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req || req.status === 'closed' || req.status === 'failed') return { ok: false, error: 'NO_INCOMING' }
    const peerId = req.kind === 'incoming' ? req.from : (req.to || [])[0]
    const peer = state.peers[peerId]
    if (!peer || !peer.keyHex) return { ok: false, error: 'NOT_PAIRED' }
    const key = keyFromHex(peer.keyHex)
    const storedAttach = await persistList(`${requestId}.reply`, attach)
    const frame = signFrame(key, {
      type: 'reply',
      from: state.self.id,
      fromName: state.self.displayName,
      avatar: state.self.avatar || '',
      to: peer.id,
      nonce: randomHex(8),
      ts: now(),
      requestId,
      box: encryptJson(key, { body: text, attachments: attach, cosign: !!cosign }),
    })
    const sent = await send(peer.door, frame)
    await store.update((s) => {
      const row = s.requests[requestId]
      if (!row) return
      sessionId && (row.sessionId = sessionId)
      row.repliedAt = now()
      row.held = false
      dropReplyDraft(row)
      row.status = sent.ok ? 'replied' : 'retry'
      storedAttach.length && (row.replyAttachments = storedAttach)
      cosign && (row.cosign = { on: true, nods: (row.cosign && row.cosign.nods) || [] })
      row.versions = [...(row.versions || []), {
        n: (row.versions || []).length + 1,
        from: s.self.id,
        fromName: s.self.displayName,
        body: text,
        at: now(),
      }]
      row.updatedAt = now()
      note(s, sent.ok ? `已回给 ${peer.displayName || peer.id}` : `回信还在发件箱 · ${peer.displayName || peer.id}`)
    })
    if (sent.ok) {
      await archiveTurn({
        requestId,
        turn: `out.${(req.versions || []).length}`,
        sessionId: sessionId || req.sessionId,
        workspace: req.workspace,
        actor: state.self.id,
        fromName: state.self.displayName,
        quote: text,
        toIds: [peer.id],
        at: new Date(now()).toISOString(),
      })
    }
    return { ok: sent.ok, error: sent.ok ? '' : (sent.error || 'UNREACHABLE'), ...(await snapshot()) }
  }

  async function receiveReply(frame, peer) {
    const key = keyFromHex(peer.keyHex)
    if (!verifyFrame(key, frame)) return { ok: false, error: 'BAD_MAC' }
    let inner = {}
    if (frame.box) {
      try { inner = decryptJson(key, frame.box) } catch { return { ok: false, error: 'KEY_REJECT' } }
    } else if (frame.body) {
      return { ok: false, error: 'PLAINTEXT' }
    }
    const body = String(inner.body || '')
    const rid = String(frame.requestId || '')
    const live = (await store.get()).requests[rid]
    const idx = ((live && live.replies) || []).length
    const storedReply = await persistList(`${rid}.r${idx}`, sanitizeAttach(inner.attachments))
    await store.update((state) => {
      const req = state.requests[frame.requestId]
      if (!req) return
      frame.avatar && (peer.avatar = String(frame.avatar).slice(0, 24))
      req.replies = [...(req.replies || []), {
        from: peer.id,
        fromName: frame.fromName || peer.displayName,
        body,
        at: now(),
        attachments: storedReply,
      }]
      req.versions = [...(req.versions || []), {
        n: (req.versions || []).length + 1,
        from: peer.id,
        fromName: frame.fromName || peer.displayName,
        body,
        at: now(),
      }]
      req.status = req.kind === 'incoming' ? 'open' : 'replied'
      req.repliedAt = req.kind === 'incoming' ? 0 : req.repliedAt
      req.held = false
      req.holder = peer.id
      dropReplyDraft(req)
      req.updatedAt = now()
      peer.lastHeard = now()
      note(state, `${peer.displayName || peer.id}回了 · ${req.id}`)
    })
    if (live && body.trim()) {
      await archiveTurn({
        requestId: rid,
        turn: `r${idx}`,
        sessionId: live.sessionId,
        workspace: live.workspace,
        actor: peer.id,
        fromName: frame.fromName || peer.displayName,
        quote: body,
        toIds: live.to,
        at: new Date(now()).toISOString(),
      })
    }
    return { ok: true }
  }

  async function receiveAck(frame, peer) {
    const key = keyFromHex(peer.keyHex)
    if (!verifyFrame(key, frame)) return { ok: false, error: 'BAD_MAC' }
    const event = String((frame && frame.event) || 'read')
    await store.update((state) => {
      const req = state.requests[frame.requestId]
      if (!req) return
      peer.lastHeard = now()
      req.updatedAt = now()
      if (event === 'delivery' || event === 'delivery_ack') {
        req.delivered = { ...(req.delivered || {}), [peer.id]: now() }
        req.status = deriveLetterStatus(req, now(), FAIL_AFTER_MS)
        note(state, `对端已落盘 · ${peer.displayName || peer.id} · ${req.id}`, now())
        return
      }
      req.reads = { ...(req.reads || {}), [peer.id]: now() }
    })
    return { ok: true }
  }

  async function withdraw(requestId, peerId) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    const sentAt = Number((Array.isArray(req.versions) && req.versions.length && req.versions[req.versions.length - 1].at) || req.createdAt || 0)
    const read = !!(req.reads && req.reads[peerId])
    if (read && now() - sentAt > WITHDRAW_GRACE_MS) return { ok: false, error: 'ALREADY_READ' }
    const peer = state.peers[peerId]
    await store.update((s) => {
      const row = s.requests[requestId]
      row.withdrawn = [...new Set([...(row.withdrawn || []), peerId])]
      row.updatedAt = now()
      note(s, `撤回未读 · ${peerId}`)
    })
    peer && peer.keyHex && await send(peer.door, signFrame(keyFromHex(peer.keyHex), {
      type: 'envelope',
      from: state.self.id,
      fromName: state.self.displayName,
      to: peerId,
      nonce: randomHex(8),
      ts: now(),
      requestId,
      box: encryptJson(keyFromHex(peer.keyHex), { requestId, withdraw: true }),
    }))
    return snapshot()
  }

  async function retrySend(requestId) {
    return confirmSend(requestId)
  }

  async function forward({ requestId, to, sessionId, messageId }) {
    requestId = requestIdOf(messageId || requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req || req.kind !== 'incoming') return { ok: false, error: 'NO_INCOMING' }
    const peerId = String(to || '')
    const peer = state.peers[peerId]
    if (!peer || peer.unpaired || !peer.keyHex) return { ok: false, error: 'NOT_PAIRED' }
    const excerpt = `转自 ${req.fromName || req.from}：${req.excerpt || req.body}`
    const composed = await compose({
      excerpt,
      to: [peerId],
      sessionId: sessionId || req.sessionId,
      workspace: req.workspace || '',
      evidence: req.evidence,
    })
    if (!composed.ok) return composed
    await confirmSend(composed.requestId)
    await store.update((s) => {
      const row = s.requests[requestId]
      row && (row.holder = peerId, row.updatedAt = now())
      note(s, `转给 ${peer.displayName || peerId} · ${requestId}`, now())
    })
    return { ok: true, forwardedTo: peerId, ...(await snapshot()) }
  }

  return {
    compose, confirmSend, cancelPresend, flushOutbox, sendRoster,
    receiveEnvelope, reply, receiveReply, receiveAck, withdraw, retrySend, forward,
  }
}
