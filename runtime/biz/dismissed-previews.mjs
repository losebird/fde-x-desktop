/** Write-preview ids the user dismissed in this BFF process (survives until restart). */
const dismissedPreviewIds = new Set()

export function sheetPreviewIdFromRecord(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.preview_id || sheet.previewId || '').trim()
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
