export const PUBLIC_SHARE_JSON_MAX = 1024 * 1024
const WINDOW_MS = 60_000
const MAX_WRITES = 60

const buckets = new Map()

export function shareWriteLimited(key, now = Date.now()) {
  const id = String(key || '')
  if (!id) return true
  const row = buckets.get(id) || { start: now, n: 0 }
  if (now - row.start >= WINDOW_MS) {
    row.start = now
    row.n = 0
  }
  row.n += 1
  buckets.set(id, row)
  return row.n > MAX_WRITES
}

export function resetShareWriteLimits() {
  buckets.clear()
}
