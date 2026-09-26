/** Round-end pending: what may paint on RecordsPanel / enter session cache. */

export function isFailedRoundEndSheet(sheet: Record<string, unknown> | null | undefined): boolean {
  if (!sheet || typeof sheet !== 'object') return true
  if (sheet.ok === false) return true
  const err = String(sheet.error || '').trim()
  if (err === 'TOO_MANY') return true
  return false
}

/** Successful round-end list / write preview (not refuse/TOO_MANY tool sheets). */
export function shouldStageRoundEndPending(sheet: Record<string, unknown> | null | undefined): boolean {
  if (isFailedRoundEndSheet(sheet)) return false
  const action = String(sheet?.action || '').trim()
  const previewId = String(sheet?.preview_id ?? sheet?.previewId ?? '').trim()
  const rows = Array.isArray(sheet?.rows) ? sheet!.rows!.length : 0
  if (previewId && action !== '现查') return rows > 0
  if (action === '现查') return rows > 0 || sheet?.querySettled === true
  return rows > 0 && Boolean(action)
}
