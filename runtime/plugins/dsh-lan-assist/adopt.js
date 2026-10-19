/**
 * Draft / hold / adopt. Followup is a caller adapter — never wakes a model here.
 * Cosign blocks adopt until every named peer nods.
 * @module dsh-lan-assist/adopt
 */

import { join } from 'node:path'
import { PLUGIN } from './home.js'
import { briefFollowup, detectPoison } from './catalog.js'
import { writeAdoptSlip } from './slips.js'
import { previewStillHolds, speakAlreadyWritten, speakPreview } from './write.js'
import { speakExpired } from './miss.js'
import { speakCostStop } from './probe.js'
import { canAdopt, folderName, latestIncoming } from './dock.js'
import { requestIdOf } from './conversation.js'

export function followRows(req, children) {
  const rows = []
  ;(Array.isArray(req && req.replies) ? req.replies : []).forEach((item, i) => {
    rows.push({ key: String(i), from: item.from, fromName: item.fromName, body: item.body })
  })
  ;(Array.isArray(children) ? children : []).forEach((row) => {
    if (!row || row.status === 'closed' || row.status === 'withdrawn') return
    const body = String((row.versions && row.versions[0] && row.versions[0].body) || row.excerpt || row.body || '')
    body && rows.push({ key: row.id, from: row.from, fromName: row.fromName, body })
  })
  if (!rows.length && req && req.kind === 'incoming') {
    const body = String(latestIncoming(req) || req.excerpt || req.body || '')
    body && rows.push({ key: req.id, from: req.from, fromName: req.fromName, body })
  }
  return rows
}

export function pickReplies(req, replyIds, children) {
  const rows = followRows(req, children)
  if (!replyIds || !replyIds.length) return rows.slice(-1)
  return rows.filter((item, i) => replyIds.includes(item.key) || replyIds.includes(item.from) || replyIds.includes(String(i)))
}

/**
 * @param {object} bag
 */
export function createAdopt(bag) {
  const {
    store, now, snapshot, note, catalogOf,
    lookupRef, hearBusinessEvent, maybeBoard, opts,
  } = bag

  async function vocabOf(workspace) {
    if (typeof opts.loadVocab !== 'function') return []
    try {
      const loaded = await opts.loadVocab(String(workspace || '').trim())
      return Array.isArray(loaded) ? loaded : []
    } catch {
      return []
    }
  }

  async function draftReply(requestId, sessionId, currentWorkspace) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req || req.kind !== 'incoming') return { ok: false, error: 'NO_INCOMING' }
    const quote = String(latestIncoming(req) || req.excerpt || req.body || '').trim()
    if (!quote) return { ok: false, error: 'EMPTY_BODY' }
    const sid = String(sessionId || req.sessionId || '').trim()
    if (!sid) {
      return { ok: false, error: 'NO_SESSION', hint: '这条对话还没绑上，不能用当前模型拟回。' }
    }
    const letterCwd = String(req.workspace || '').trim()
    const openCwd = String(currentWorkspace || '').trim()
    if (letterCwd && openCwd && letterCwd !== openCwd) {
      return {
        ok: false,
        error: 'WRONG_WORKSPACE',
        hint: `这封跟 ${folderName(letterCwd)}，不跟你碰巧打开的会话。开口和拟回跟信走。`,
        workspace: letterCwd,
      }
    }
    const openingId = `draft:${requestId}`
    await store.update((s) => {
      const row = s.requests[requestId]
      row && (row.replyDraftVia = 'session', row.replyDraftPending = true, row.replyDraftWait = now(), row.sessionId = sid, row.replyDraft = '', row.replyDraftRaw = '', !row.workspace && openCwd && (row.workspace = openCwd))
      s.liveOpening = { id: openingId, sessionId: sid, at: now() }
      note(s, detectPoison(quote)
        ? `秘书拟回 · 来信口令只当正文 · ${requestId}`
        : `秘书拟回 · 先判断是不是改单 · ${requestId}`, now())
      s.drafts = s.drafts || []
      s.drafts.push({
        at: now(),
        who: (s.self && (s.self.staffId || s.self.displayName)) || s.displayName || '本机',
        requestId,
        sessionId: sid,
        wroteBusiness: false,
      })
    })
    return {
      ok: true,
      via: 'session',
      heard: 'intent',
      sourceQuote: quote,
      workspace: letterCwd,
      poison: detectPoison(quote),
      followup: {
        sessionId: sid,
        text: briefFollowup({
          quote,
          catalog: catalogOf(),
          vocab: await vocabOf(letterCwd),
          workspace: letterCwd,
          kind: 'intent',
        }),
        plugin: PLUGIN,
        workspace: letterCwd,
      },
      ...(await snapshot()),
    }
  }

  async function hold(requestId) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    if (state.requests[requestId]) {
      await store.update((s) => {
        const req = s.requests[requestId]
        req && (req.held = true, req.updatedAt = now(), note(s, `只收下 · ${requestId} · 模型未跑`))
      })
      return snapshot()
    }
    return bag.holdBusinessEvent(requestId)
  }

  async function previewWriteInner(requestId) {
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    if (!req.ref || !req.ref.no) return { ok: false, error: 'NO_REF', hint: '这封没有业务引用，预览走不了。' }
    const found = await lookupRef(req.ref, req.workspace)
    if (found && found.expired) {
      await hearBusinessEvent({ kind: 'expired', requestId, speak: speakExpired() })
      return { ok: false, error: 'EXPIRED', hint: speakExpired(), ...(await snapshot()) }
    }
    const spoken = speakPreview(req.ref, found)
    await store.update((s) => {
      const row = s.requests[requestId]
      row && (row.preview = {
        speak: spoken.speak,
        status: spoken.status || '',
        fingerprint: spoken.fingerprint || '',
        fresh: !!spoken.fresh,
        at: now(),
      }, note(s, `预览 · ${requestId} · ${spoken.speak}`, now()))
    })
    return { ok: true, preview: spoken, ...(await snapshot()) }
  }

  async function adopt(requestId, replyIds) {
    requestId = requestIdOf(requestId)
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    if (state.writeStopped) {
      return { ok: false, error: 'COST', hint: speakCostStop(), ...(await snapshot()) }
    }
    if (req.adopted || req.receiptId) {
      return {
        ok: false,
        error: req.receiptId ? 'ALREADY_WRITTEN' : 'ALREADY_ADOPTED',
        hint: req.receiptId ? speakAlreadyWritten(req.ref) : '已经调度进会话。点过头不是过账。',
        ...(await snapshot()),
      }
    }
    const children = Object.values(state.requests || {}).filter((row) => row && row.threadId === requestId)
    if (!canAdopt(req, children.length)) return { ok: false, error: 'COSIGN' }
    const chosen = pickReplies(req, replyIds, children)
    if (!chosen.length) return { ok: false, error: 'NO_REPLY' }
    const quoteForWrite = String(req.excerpt || req.body || chosen.map((item) => item.body).join('\n')).trim()
    const poisoned = detectPoison(quoteForWrite) || chosen.some((item) => detectPoison(item && item.body))
    if (req.ref && req.ref.no && typeof opts.lookupTodo === 'function') {
      const found = await lookupRef(req.ref, req.workspace)
      if (found && found.expired) {
        await hearBusinessEvent({ kind: 'expired', requestId, speak: speakExpired() })
        return { ok: false, error: 'EXPIRED', hint: speakExpired(), ...(await snapshot()) }
      }
      if (found && found.ok) {
        const gate = previewStillHolds(req.preview, found)
        if (!gate.ok) {
          (gate.error === 'NEED_PREVIEW' || gate.error === 'STALE') && await previewWriteInner(requestId)
          return { ok: false, error: gate.error, hint: gate.hint, ...(await snapshot()) }
        }
      }
    }
    const openingId = `adopt:${requestId}`
    await store.update((s) => {
      const row = s.requests[requestId]
      row.adopted = true
      row.held = false
      row.updatedAt = now()
      s.liveOpening = { id: openingId, sessionId: req.sessionId || '', at: now() }
      note(s, `采纳 · ${requestId} · 将 followup`)
    })
    const quote = chosen.map((item) => item.body).join('\n')
    const who = chosen.map((item) => item.fromName).filter(Boolean).join('、') || '同事'
    const slipQuote = chosen.map((item) => `【同事 ${item.fromName} 回信】${item.body}`).join('\n')
    const text = briefFollowup({
      quote,
      who,
      catalog: catalogOf(),
      vocab: await vocabOf(req.workspace || ''),
      workspace: req.workspace || '',
      kind: 'adopt',
    })
    const actor = (state.self && state.self.id) || ''
    const writeSlip = typeof opts.writeSlip === 'function'
      ? opts.writeSlip
      : (args) => writeAdoptSlip(args, store.root ? join(store.root, 'slips') : undefined)
    const slip = await writeSlip({
      requestId,
      sessionId: req.sessionId || '',
      actor,
      quote: slipQuote,
      toIds: req.to || [],
      adoptedAt: new Date(now()).toISOString(),
    }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    await store.update((s) => {
      note(s, slip && slip.ok ? `已写采纳条子 · ${requestId}` : `采纳条子没写成 · ${requestId} · ${(slip && slip.error) || ''}`, now())
    })
    return {
      ok: true,
      followup: {
        sessionId: req.sessionId || '',
        text,
        plugin: PLUGIN,
        workspace: req.workspace || '',
      },
      slip: slip && slip.ok ? { ok: true, path: slip.path } : { ok: false, error: (slip && slip.error) || 'SLIP' },
      ...(await snapshot()),
    }
  }

  async function nod(requestId, peerId) {
    let complete = false
    let reqSnap = null
    await store.update((state) => {
      const req = state.requests[requestId]
      if (!req || !req.cosign) return
      req.cosign.nods = [...new Set([...(req.cosign.nods || []), peerId || state.self.id])]
      req.updatedAt = now()
      reqSnap = req
      complete = !!(req.cosign.on && canAdopt(req))
    })
    complete && reqSnap && await maybeBoard({
      sessionId: reqSnap.sessionId,
      requestId,
      scenario: reqSnap.excerpt || requestId,
      reasoning: '会签名单都点头了',
      outcome: 'cosigned',
      because: [requestId, ...(reqSnap.cosign.nods || [])],
      leadsTo: [reqSnap.sessionId || requestId],
    })
    return snapshot()
  }

  async function setCosign(requestId, on) {
    await store.update((state) => {
      const req = state.requests[requestId]
      req && (req.cosign = { on: !!on, nods: (req.cosign && req.cosign.nods) || [] })
    })
    return snapshot()
  }

  async function addVisible(requestId, peerId) {
    const state = await store.get()
    const req = state.requests[requestId]
    if (!req) return { ok: false, error: 'NO_REQUEST' }
    const id = String(peerId || '').trim()
    const peer = state.peers[id]
    if (!peer || peer.unpaired || !peer.keyHex) {
      return { ok: false, error: 'NOT_PAIRED', hint: '没配对，花名册不能代替配对。' }
    }
    await store.update((s) => {
      const row = s.requests[requestId]
      if (!row) return
      row.visible = [...new Set([...(row.visible || []), id])]
      !(row.to || []).includes(id) && (row.to = [...(row.to || []), id])
      row.cosign = { on: true, nods: (row.cosign && row.cosign.nods) || [] }
      row.updatedAt = now()
      note(s, `会签加上 ${peer.displayName || id} · ${requestId}`, now())
    })
    return { ok: true, ...(await snapshot()) }
  }

  return { draftReply, hold, previewWrite: previewWriteInner, adopt, nod, setCosign, addVisible }
}
