/** In-memory pending preview sheet for the current browser session (not persisted). */
let lastPending: { sheet: Record<string, unknown>; at: number } | null = null

export function rememberBizPendingSheet(sheet: Record<string, unknown>) {
  if (!sheet || typeof sheet !== 'object') return
  lastPending = { sheet, at: Date.now() }
}

export function peekBizPendingSheet(): Record<string, unknown> | null {
  return lastPending?.sheet ?? null
}

export function clearBizPendingSheet() {
  lastPending = null
}
