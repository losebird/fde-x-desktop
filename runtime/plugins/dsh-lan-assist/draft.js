/**
 * Reply drafts ride the live session. Never invent a local draft without a session.
 * @module dsh-lan-assist/draft
 */

import { extractReplyDraft } from './catalog.js'
import { mergeDraft } from './draft-state.js'
import { letterIds } from './conversation.js'

export function takeAssistantText(event) {
  if (!event || event.type !== 'assistant/message') return ''
  const message = event.data && event.data.message
  const blocks = (message && message.content) || (event.data && event.data.content) || []
  return Array.isArray(blocks)
    ? blocks.filter((block) => block && block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('').trim()
    : ''
}

/**
 * @param {object} bag
 */
export function createDrafts(bag) {
  const { store, now, snapshot, note } = bag

  async function acceptDraftFromSession(sessionId, text) {
    const incoming = String(text || '').trim()
    if (!incoming || !sessionId) return { ok: false }
    const state = await store.get()
    const pending = Object.values(state.requests || {}).find((req) => (
      req.kind === 'incoming' && req.replyDraftPending && req.sessionId === sessionId
    ))
    if (!pending) return { ok: false, skipped: 'none' }
    const waited = now() - Number(pending.replyDraftWait || 0)
    if (waited > 10 * 60 * 1000) return { ok: false, skipped: 'stale' }
    await store.update((s) => {
      const row = s.requests[pending.id]
      if (!row || !row.replyDraftPending) return
      const kept = String(row.replyDraft || '').trim()
      const prevRaw = String(row.replyDraftRaw || '').trim()
      if (prevRaw === incoming || prevRaw.endsWith(incoming)) {
        const extracted = extractReplyDraft(prevRaw)
        extracted && (row.replyDraft = mergeDraft(kept, extracted))
        row.updatedAt = now()
        return
      }
      const raw = prevRaw ? `${prevRaw}\n\n${incoming}` : incoming
      row.replyDraftRaw = raw
      const extracted = extractReplyDraft(raw)
      extracted && (row.replyDraft = mergeDraft(kept, extracted))
      row.updatedAt = now()
      note(s, `秘书拟回 · 回信框只留正文 · ${pending.id}`, now())
    })
    return { ok: true, ...letterIds(pending.id), draft: extractReplyDraft(incoming), pending: true, ...(await snapshot()) }
  }

  async function finalizeDraftFromSession(sessionId) {
    if (!sessionId) return { ok: false }
    const state = await store.get()
    const pending = Object.values(state.requests || {}).find((req) => (
      req.kind === 'incoming' && req.replyDraftPending && req.sessionId === sessionId
    ))
    if (!pending) return { ok: false, skipped: 'none' }
    await store.update((s) => {
      const row = s.requests[pending.id]
      if (!row) return
      const kept = String(row.replyDraft || '').trim()
      const extra = extractReplyDraft(row.replyDraftRaw || '')
      row.replyDraft = kept || extra
      row.replyDraftRaw = ''
      row.replyDraftPending = false
      row.replyDraftWait = 0
      row.updatedAt = now()
      note(s, row.replyDraft
        ? `秘书拟回 · 回信框只留正文 · ${pending.id}`
        : `秘书拟回 · 本轮没有正文 · ${pending.id}`, now())
    })
    return { ok: true, ...letterIds(pending.id), draft: pending.replyDraft || '', ...(await snapshot()) }
  }

  async function reopenReplyDraft(sessionId, seed) {
    const sid = String(sessionId || '').trim()
    if (!sid) return { ok: false, error: 'NO_SESSION' }
    const incoming = String(seed || '').trim()
    const extra = incoming ? extractReplyDraft(incoming) : ''
    const state = await store.get()
    const row = Object.values(state.requests || {}).find((req) => (
      req && req.kind === 'incoming' && req.sessionId === sid && req.replyDraftPending
    )) || Object.values(state.requests || {}).find((req) => (
      req && req.kind === 'incoming' && req.sessionId === sid && !req.repliedAt && !req.held && !req.adopted
    ))
    if (!row) return { ok: false, skipped: 'none' }
    await store.update((s) => {
      const req = s.requests[row.id]
      if (!req) return
      const kept = String(req.replyDraft || '').trim()
      req.replyDraftVia = 'session'
      req.replyDraftPending = true
      req.replyDraftWait = now()
      req.replyDraftRaw = extra && kept && extra !== kept ? `${kept}\n\n${extra}` : (extra || kept)
      req.replyDraft = extra && kept && !kept.includes(extra) ? `${kept}\n\n${extra}` : (extra || kept)
      req.updatedAt = now()
      note(s, extra ? `写回后回信接上 · ${row.id}` : `写回后等新回信 · ${row.id}`, now())
    })
    return { ok: true, ...letterIds(row.id), ...(await snapshot()) }
  }

  return { takeAssistantText, acceptDraftFromSession, finalizeDraftFromSession, reopenReplyDraft }
}
