const STEP_TIMEOUT_MS = 15 * 60 * 1000

export function delayDurationMs(config) {
  const row = config && typeof config === 'object' && !Array.isArray(config) ? config : {}
  const seconds = Number(row.waitSeconds ?? row.seconds ?? 0)
  const minutes = Number(row.waitMinutes ?? row.minutes ?? 0)
  const ms = Number(row.waitMs ?? row.ms ?? 0)
  const total = (Number.isFinite(ms) ? ms : 0)
    + (Number.isFinite(seconds) ? seconds * 1000 : 0)
    + (Number.isFinite(minutes) ? minutes * 60 * 1000 : 0)
  if (total <= 0) return 0
  return Math.min(total, STEP_TIMEOUT_MS)
}
