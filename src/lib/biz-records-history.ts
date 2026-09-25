/** Session history selection — this tab's cached surfaces only, never a workspace dump. */

export type HistorySurfaceRow = {
  id: string
  sessionId?: string | null
  createdAt?: number
  kind?: string
  action?: string
}

function sheetCarriesLookupIdentity(sheet: Record<string, unknown>) {
  if (String(sheet.lookupNo || '').trim()) return true
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return true
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return true
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from)) {
    if (String((from as { kind?: string }).kind || '').trim()) return true
  }
  return Array.isArray(sheet.steps) && sheet.steps.length > 0
}

/** A real 现查: action, identity, and rows or a settled empty. Not a catalog dump. */
export function incomingSheetIsIdentifiedLookup(sheet?: Record<string, unknown> | null) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() !== '现查') return false
  if (String(sheet.preview_id || sheet.previewId || '').trim()) return false
  const rows = Array.isArray(sheet.rows) ? sheet.rows.length : 0
  if (rows <= 0 && sheet.querySettled !== true) return false
  return sheetCarriesLookupIdentity(sheet)
}

export function shouldBlockIncomingSheetForHistoryPin(
  pinnedSurfaceId: string,
  incomingSurfaceId?: string,
  sheet?: Record<string, unknown> | null,
) {
  const pinned = String(pinnedSurfaceId || '').trim()
  if (!pinned) return false
  const incoming = String(incomingSurfaceId || '').trim()
  if (incoming && incoming === pinned) return false
  if (incomingSheetIsIdentifiedLookup(sheet)) return false
  if (!incoming) return true
  return incoming !== pinned
}

export function selectSessionHistorySurfaces<T extends HistorySurfaceRow>(
  surfaces: T[],
  opts: { sessionId?: string; cachedIds: Set<string> },
): T[] {
  const cachedIds = opts.cachedIds
  const sessionKey = String(opts.sessionId || '').trim()
  if (!sessionKey) return []
  const scoped = surfaces.filter((row) => (
    cachedIds.has(row.id)
    && String(row.sessionId || '').trim() === sessionKey
  ))
  return [...scoped].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function historyMissHint(surface: {
  kind?: string
  action?: string
  scope?: string
}) {
  const kind = String(surface.kind || '').trim()
  const action = String(surface.action || '').trim()
  const scope = String(surface.scope || '').trim()
  const who = [kind, action, scope].filter(Boolean).join(' · ')
  if (!who) {
    return '该条浮现的行已不在待确认区；请在 AI 会话里重新浮现这一次，不要在此整表浏览。'
  }
  return `「${who}」的行已不在待确认区；请在 AI 会话里重新浮现这一次，不要在此整表浏览。`
}

export function historyIdForSheet(
  sheet: Record<string, unknown>,
  surfaceId?: string,
  fingerprint = '',
) {
  const known = String(surfaceId || '').trim()
  if (known) return known
  const fp = String(fingerprint || '').trim()
  return fp ? `q:${fp}` : ''
}

export function isQueryHistoryId(id: string) {
  return String(id || '').startsWith('q:')
}

export function mergeHistorySurfaces<T extends HistorySurfaceRow>(
  sqlite: T[],
  memory: T[],
): T[] {
  const merged = new Map<string, T>()
  for (const row of memory) {
    if (row.id) merged.set(row.id, row)
  }
  for (const row of sqlite) {
    if (!row.id) continue
    const prev = merged.get(row.id)
    const sessionId = String(row.sessionId || '').trim() || prev?.sessionId || null
    merged.set(row.id, { ...row, sessionId })
  }
  return [...merged.values()]
}

