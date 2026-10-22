/**
 * Reply-draft fields on a letter. Sending consumes them.
 * @module dsh-lan-assist/draft-state
 */

import { isDirectChat } from './hall.js'

export function mergeDraft(kept, extracted) {
  const a = String(kept || '').trim()
  const b = String(extracted || '').trim()
  if (!b) return a
  if (!a) return b
  if (a === b) return a
  if (a.includes(b)) return a
  if (b.includes(a)) return b
  return `${a}\n\n${b}`
}

export function dropReplyDraft(row) {
  if (!row) return
  row.replyDraft = ''
  row.replyDraftRaw = ''
  row.replyDraftPending = false
  row.replyDraftWait = 0
}

export function composerDraftOf(text, draft, skip, lastApplied) {
  const next = String(draft || '').trim()
  if (!next || next === String(skip || '').trim()) return null
  if (next === String(lastApplied || '').trim()) return null
  const cur = String(text || '').trim()
  if (cur && cur !== String(lastApplied || '').trim()) return null
  return next
}

export function consumeDraftsOnSend(state, outgoing) {
  if (!state || !outgoing) return
  const thread = String(outgoing.threadId || '')
  thread && dropReplyDraft(state.requests && state.requests[thread])
  if (outgoing.groupId) return
  const dest = new Set(outgoing.to || [])
  for (const row of Object.values(state.requests || {})) {
    if (!row || row.kind !== 'incoming' || !isDirectChat(row)) continue
    if (!dest.has(row.from)) continue
    dropReplyDraft(row)
  }
}
