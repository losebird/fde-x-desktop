/** One IM handoff pack: sessions, workspace files, apps, briefing. */

export const HANDOFF_MIME = 'application/vnd.dsh.handoff+json'
export const HANDOFF_NAME = 'dsh-handoff.json'

export function isHandoffAttach(item) {
  const row = item && typeof item === 'object' ? item : {}
  return String(row.mime || '') === HANDOFF_MIME || String(row.name || '') === HANDOFF_NAME
}

export function parseHandoffPack(raw) {
  let text = String(raw || '').trim()
  if (!text) return null
  if (text[0] !== '{') {
    try {
      const bin = atob(text.replace(/\s/g, ''))
      text = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))
    } catch {
      return null
    }
  }
  try {
    const obj = JSON.parse(text)
    if (!obj || obj.kind !== 'handoff') return null
    return obj
  } catch {
    return null
  }
}

export function specForPack(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  const next = { ...spec }
  delete next._workspaceCwd
  const slug = String(next.slug || '').trim()
  if (!slug) return null
  return next
}

export function appsForPack(rows) {
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue
    const spec = specForPack(row.spec)
    const slug = String(row.slug || spec?.slug || '').trim()
    if (!slug || !spec) continue
    out.push({
      slug,
      name: String(row.name || spec.name || slug),
      spec,
      status: String(row.status || 'draft'),
    })
  }
  return out
}

export function briefingForPack(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return null
  const sections = Array.isArray(definition.sections) ? definition.sections : null
  const schedule = definition.schedule && typeof definition.schedule === 'object' && !Array.isArray(definition.schedule)
    ? definition.schedule
    : null
  if (!sections || !schedule) return null
  return { sections, schedule }
}

export function briefingFromPack(parsed) {
  const raw = parsed && typeof parsed === 'object' ? parsed.briefing : null
  return briefingForPack(raw)
}

export function appsFromPack(parsed) {
  return appsForPack(parsed && Array.isArray(parsed.apps) ? parsed.apps : [])
}

export function sessionsFromPack(parsed) {
  if (!parsed || !Array.isArray(parsed.sessions)) return []
  return parsed.sessions
}

export function sessionIdsFromPack(parsed) {
  if (!parsed || !Array.isArray(parsed.sessionIds)) return []
  return parsed.sessionIds.map((item) => String(item || '')).filter(Boolean)
}

export function fileIdsFromPack(parsed) {
  if (!parsed || !Array.isArray(parsed.fileIds)) return []
  return parsed.fileIds.map((item) => String(item || '')).filter(Boolean)
}

export function handoffHasWork(parsed) {
  if (!parsed || typeof parsed !== 'object') return false
  if (sessionsFromPack(parsed).length) return true
  if (sessionIdsFromPack(parsed).length) return true
  if (fileIdsFromPack(parsed).length) return true
  if (appsFromPack(parsed).length) return true
  if (briefingFromPack(parsed)) return true
  return false
}

export function buildHandoffPack({
  title,
  workspace,
  sessionIds,
  sessions,
  fileIds,
  apps,
  briefing,
  turns,
  excerpt,
} = {}) {
  const packedApps = appsForPack(apps)
  const packedBriefing = briefingForPack(briefing)
  return {
    v: 2,
    kind: 'handoff',
    title: String(title || '工作交接'),
    workspace: String(workspace || ''),
    at: Date.now(),
    sessionIds: Array.isArray(sessionIds) ? sessionIds.map((id) => String(id || '')).filter(Boolean) : [],
    sessions: Array.isArray(sessions) ? sessions : [],
    fileIds: Array.isArray(fileIds) ? fileIds.map((id) => String(id || '')).filter(Boolean) : [],
    ...(packedApps.length ? { apps: packedApps } : {}),
    ...(packedBriefing ? { briefing: packedBriefing } : {}),
    turns: Array.isArray(turns) ? turns : [],
    excerpt: String(excerpt || '').slice(0, 240),
    truncated: false,
  }
}

export function handoffPackLine({ sessions, fileIds, apps, briefing, sessionsLoading } = {}) {
  const bits = []
  const sessionRows = Array.isArray(sessions) ? sessions : []
  if (sessionsLoading && !sessionRows.length) bits.push('正在读取会话文件…')
  else if (sessionRows.length) {
    const files = sessionRows.flatMap((row) => [
      ...(Array.isArray(row.files) ? row.files : []),
      ...(Array.isArray(row.members) ? row.members.flatMap((member) => Array.isArray(member.files) ? member.files : []) : []),
    ])
    const kb = files.reduce((sum, file) => sum + Number(file && file.size || 0), 0)
    bits.push(`${files.length} 个会话文件 · ${Math.max(1, Math.round(kb / 1024) || 1)} KB`)
  }
  const filesCount = Array.isArray(fileIds) ? fileIds.filter(Boolean).length : 0
  if (filesCount) bits.push(`${filesCount} 个工作区文件`)
  const appCount = Array.isArray(apps) ? apps.length : 0
  if (appCount) bits.push(`${appCount} 个应用`)
  if (briefing) bits.push('早报定义')
  return bits.join(' · ')
}
