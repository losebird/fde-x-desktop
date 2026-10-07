export function terminalFollowStopped(frame: unknown, seenLive = false): boolean {
  if (!frame || typeof frame !== 'object') return false
  const row = frame as Record<string, unknown>
  const type = String(row.type || '').trim().toLowerCase()
  if (type === 'exit' || type === 'close' || type === 'end' || type === 'stopped') return true
  const code = String(row.code || row.reason || '').trim().toLowerCase()
  if (code === 'exit' || code === 'exited' || code === 'close' || code === 'closed' || code === 'end' || code === 'stopped' || code === 'not_running') {
    return true
  }
  const info = row.info && typeof row.info === 'object' ? row.info as Record<string, unknown> : null
  if (!info) return false
  const infoCode = String(info.code || info.reason || '').trim().toLowerCase()
  if (infoCode === 'exit' || infoCode === 'exited' || infoCode === 'close' || infoCode === 'closed' || infoCode === 'end' || infoCode === 'stopped' || infoCode === 'not_running') {
    return true
  }
  if (seenLive && String(info.error || '').trim()) return true
  return false
}

export function terminalCloseAction(actions: string[]): string {
  const rows = Array.isArray(actions) ? actions : []
  return rows.find((item) => item === 'close' || item === 'destroy' || item === 'kill') || ''
}
