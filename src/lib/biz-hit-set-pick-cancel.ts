/** Write preview on this utterance: leftover AskUserQuestion / thinking must not block the next speech. */
export function shouldCancelDshAfterWritePreview(action: string, previewId: string): boolean {
  return Boolean(String(previewId || '').trim()) && String(action || '').trim() !== '现查'
}

/** Skip records-panel cancel when the write preview is only speech-bound noise (no row changes, not a pick). */
export function shouldAbortLeftoverAskForWritePreview(sheet: Record<string, unknown>): boolean {
  const previewId = String(sheet.preview_id || sheet.previewId || '').trim()
  const action = String(sheet.action || '').trim()
  if (!shouldCancelDshAfterWritePreview(action, previewId)) return false
  if (sheet.picked === true) return true
  const changes = sheet.changes
  if (Array.isArray(changes) && changes.length > 0) return true
  return false
}

/** After a hit-set row pick yields a write preview, abort the pending DSH AskUserQuestion turn. */
export function shouldCancelDshAfterHitSetPick(
  waitingPick: boolean,
  action: string,
  previewId: string,
): boolean {
  return waitingPick && shouldCancelDshAfterWritePreview(action, previewId)
}

export function resolveHitSetPickCancelSessionId(input: {
  bindSheet?: Record<string, unknown> | null
  pendingSheet?: Record<string, unknown> | null
  activeAiSessionId?: string | null
  historySessionId?: string | null
}): string {
  const bindSid = input.bindSheet?.sessionId
  const pendingSid = input.pendingSheet?.sessionId
  return String(
    bindSid ||
    pendingSid ||
    input.activeAiSessionId ||
    input.historySessionId ||
    '',
  ).trim()
}
