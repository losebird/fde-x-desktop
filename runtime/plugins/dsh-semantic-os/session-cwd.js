/**
 * Resolve the workspace cwd for the Semantic tab.
 * Only the addressed session (or snap.current) counts. Never scan neighbors.
 * @module dsh-semantic-os/session-cwd
 */

export function cwdFromSnap(snap, sessionId) {
  const byId = (snap && snap.byId) || {}
  const wanted = sessionId || (snap && snap.current) || ''
  const row = wanted && byId[wanted]
  return row && row.cwd ? String(row.cwd) : ''
}

export function sessionList(sessions) {
  const list = sessions && sessions.list
  if (!list) return { byId: {} }
  if (typeof list.getSnapshot === 'function') return list.getSnapshot() || { byId: {} }
  return list
}

export function cwdOf(sessions, sessionId) {
  return cwdFromSnap(sessionList(sessions), sessionId)
}
