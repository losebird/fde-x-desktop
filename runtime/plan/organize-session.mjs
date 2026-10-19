import { sameWorkspaceCwd } from '../cwd.mjs'

export function organizeSessionTitle(now = new Date()) {
  const month = now.getMonth() + 1
  const day = now.getDate()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `整理待办 · ${month}/${day} ${hours}:${minutes}`
}

export function pickOrganizeSession(sessions, cwd, prefix = '整理待办') {
  const rows = Array.isArray(sessions) ? sessions : []
  const matches = rows.filter((row) => {
    if (!row || row.archived) return false
    if (row.agentPreset !== 'standard') return false
    if (typeof row.title !== 'string') return false
    if (row.title !== prefix && !row.title.startsWith(`${prefix} · `)) return false
    if (!row.cwd || !sameWorkspaceCwd(row.cwd, cwd)) return false
    return true
  })
  matches.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
  return matches[0] || null
}
