/** Semantic engine probe. Separate from BFF /live. */

export const ENGINE_PROBE_MS = 2000
export const ENGINE_WATCH_MS = 4000
export const SEMANTIC_AUTO_RESTART_LIMIT = 2

export function shouldAutoRestartSemantic(snapshot) {
  if (!snapshot || snapshot.ready) return false
  const reason = String(snapshot.reason || '')
  if (reason === 'start_timeout' || reason === 'start_failed' || reason === 'spawn_failed') return false
  return reason === 'exited' || String(snapshot.detail || '').includes('exited')
}

export function engineProbeKind(row, failed = false) {
  if (failed || !row || typeof row !== 'object') return 'probe-failed'
  if (row.ready === true) return 'ready'
  if (row.ready === false) return 'unready'
  return 'probe-failed'
}

export function engineOccupancyFp(kind, row) {
  if (kind === 'ready') return 'ready'
  if (kind === 'unready') {
    return `unready:${String((row && (row.reason || row.detail || row.error)) || 'not_ready')}`
  }
  return ''
}
