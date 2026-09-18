/** Session history selection — this tab's cached surfaces only, never a workspace dump. */

export type HistorySurfaceRow = {
  id: string
  sessionId?: string | null
  createdAt?: number
  kind?: string
  action?: string
}

export function shouldBlockIncomingSheetForHistoryPin(
  pinnedSurfaceId: string,
  incomingSurfaceId?: string,
) {
  const pinned = String(pinnedSurfaceId || '').trim()
  if (!pinned) return false
  const incoming = String(incomingSurfaceId || '').trim()
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

