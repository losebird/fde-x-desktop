/** Write-preview ids the user dismissed in this BFF process (survives until restart). */
const dismissedPreviewIds = new Set()

export function sheetPreviewIdFromRecord(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.preview_id || sheet.previewId || '').trim()
}

export function hallPreviewIdFromState(state) {
  if (!state || typeof state !== 'object') return ''
  const fromSheet = sheetPreviewIdFromRecord(state.pendingSheet)
  if (fromSheet) return fromSheet
  const pending = state.pendingWrite
  if (!pending || typeof pending !== 'object') return ''
  const fromWrite = sheetPreviewIdFromRecord(pending)
  if (fromWrite) return fromWrite
  const lines = Array.isArray(pending.lines) ? pending.lines : []
  for (const row of lines) {
    const id = sheetPreviewIdFromRecord(row)
    if (id) return id
  }
  return ''
}

/** Cancel must not wipe a newer hop write preview that already replaced this token. */
export function dismissShouldClearHall(livePreviewId, dismissedPreviewId) {
  const wanted = String(dismissedPreviewId || '').trim()
  const live = String(livePreviewId || '').trim()
  if (!wanted) return true
  if (!live) return true
  return live === wanted
}

export function isBizPreviewDismissed(previewId) {
  const id = String(previewId || '').trim()
  return Boolean(id && dismissedPreviewIds.has(id))
}

export function rememberBizPreviewDismissed(previewId) {
  const id = String(previewId || '').trim()
  if (!id) return false
  dismissedPreviewIds.add(id)
  return true
}

export function clearBizPreviewDismissed(previewId) {
  const id = String(previewId || '').trim()
  if (!id) return
  dismissedPreviewIds.delete(id)
}
