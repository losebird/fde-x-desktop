export function sheetBelongsToSession(
  sheet: Record<string, unknown> | null | undefined,
  sessionId?: string | null,
): boolean {
  const sid = String(sessionId || '').trim()
  if (!sid) return true
  if (!sheet || typeof sheet !== 'object') return false
  return String(sheet.sessionId || '').trim() === sid
}

export function sheetForLiveSession(
  sheet: Record<string, unknown> | null | undefined,
  liveSid?: string | null,
  newAuthority = false,
): Record<string, unknown> | null {
  if (!sheet || typeof sheet !== 'object') return null
  const sid = String(liveSid || '').trim()
  if (!sid) return sheet
  if (sheetBelongsToSession(sheet, sid)) return sheet
  if (!newAuthority) return null
  return { ...sheet, sessionId: sid }
}
