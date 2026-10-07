/** Semantic engine probe. Separate from BFF /live. */

export const ENGINE_PROBE_MS = 2000
export const ENGINE_WATCH_MS = 4000

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
