/** Same pack occupancy as runtime/im-handoff.mjs. */

export const HANDOFF_MIME = 'application/vnd.dsh.handoff+json'
export const HANDOFF_NAME = 'dsh-handoff.json'

export type HandoffAppBag = {
  slug: string
  name: string
  spec: Record<string, unknown>
  status: string
}

export type HandoffBriefingBag = {
  sections: unknown[]
  schedule: Record<string, unknown>
}

export function isHandoffAttach(item: Record<string, unknown>) {
  return String(item.mime || '') === HANDOFF_MIME || String(item.name || '') === HANDOFF_NAME
}

export function parseHandoffPack(raw: string) {
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
    const obj = JSON.parse(text) as Record<string, unknown>
    if (!obj || obj.kind !== 'handoff') return null
    return obj
  } catch {
    return null
  }
}

export function specForPack(spec: unknown) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  const next = { ...(spec as Record<string, unknown>) }
  delete next._workspaceCwd
  const slug = String(next.slug || '').trim()
  if (!slug) return null
  return next
}

export function appsForPack(rows: unknown): HandoffAppBag[] {
  const out: HandoffAppBag[] = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const spec = specForPack(rec.spec)
    const slug = String(rec.slug || spec?.slug || '').trim()
    if (!slug || !spec) continue
    out.push({
      slug,
      name: String(rec.name || spec.name || slug),
      spec,
      status: String(rec.status || 'draft'),
    })
  }
  return out
}

export function briefingForPack(definition: unknown): HandoffBriefingBag | null {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return null
  const rec = definition as Record<string, unknown>
  const sections = Array.isArray(rec.sections) ? rec.sections : null
  const schedule = rec.schedule && typeof rec.schedule === 'object' && !Array.isArray(rec.schedule)
    ? rec.schedule as Record<string, unknown>
    : null
  if (!sections || !schedule) return null
  return { sections, schedule }
}

export function briefingFromPack(parsed: Record<string, unknown> | null) {
  return briefingForPack(parsed?.briefing)
}

export function appsFromPack(parsed: Record<string, unknown> | null) {
  return appsForPack(Array.isArray(parsed?.apps) ? parsed.apps : [])
}

export function sessionsFromPack(parsed: Record<string, unknown> | null) {
  if (!parsed || !Array.isArray(parsed.sessions)) return []
  return parsed.sessions
}

export function sessionIdsFromPack(parsed: Record<string, unknown> | null) {
  if (!parsed || !Array.isArray(parsed.sessionIds)) return []
  return parsed.sessionIds.map((item) => String(item || '')).filter(Boolean)
}

export function fileIdsFromPack(parsed: Record<string, unknown> | null) {
  if (!parsed || !Array.isArray(parsed.fileIds)) return []
  return parsed.fileIds.map((item) => String(item || '')).filter(Boolean)
}

export function handoffHasWork(parsed: Record<string, unknown> | null) {
  if (!parsed) return false
  if (sessionsFromPack(parsed).length) return true
  if (sessionIdsFromPack(parsed).length) return true
  if (fileIdsFromPack(parsed).length) return true
  if (appsFromPack(parsed).length) return true
  if (briefingFromPack(parsed)) return true
  return false
}

export function buildHandoffPack(input: {
  title?: string
  workspace?: string
  sessionIds?: string[]
  sessions?: unknown[]
  fileIds?: string[]
  apps?: unknown[]
  briefing?: unknown
  turns?: unknown[]
  excerpt?: string
} = {}) {
  const packedApps = appsForPack(input.apps)
  const packedBriefing = briefingForPack(input.briefing)
  return {
    v: 2,
    kind: 'handoff',
    title: String(input.title || '工作交接'),
    workspace: String(input.workspace || ''),
    at: Date.now(),
    sessionIds: Array.isArray(input.sessionIds) ? input.sessionIds.map((id) => String(id || '')).filter(Boolean) : [],
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    fileIds: Array.isArray(input.fileIds) ? input.fileIds.map((id) => String(id || '')).filter(Boolean) : [],
    ...(packedApps.length ? { apps: packedApps } : {}),
    ...(packedBriefing ? { briefing: packedBriefing } : {}),
    turns: Array.isArray(input.turns) ? input.turns : [],
    excerpt: String(input.excerpt || '').slice(0, 240),
    truncated: false,
  }
}

export function handoffPackLine(pkg: {
  sessions?: Array<{ files?: unknown[]; members?: Array<{ files?: unknown[] }> }>
  fileIds?: string[]
  apps?: unknown[]
  briefing?: unknown
  sessionsLoading?: boolean
} = {}) {
  const bits: string[] = []
  const sessionRows = Array.isArray(pkg.sessions) ? pkg.sessions : []
  if (pkg.sessionsLoading && !sessionRows.length) bits.push('正在读取会话文件…')
  else if (sessionRows.length) {
    const files = sessionRows.flatMap((row) => [
      ...(Array.isArray(row.files) ? row.files : []),
      ...(Array.isArray(row.members) ? row.members.flatMap((member) => Array.isArray(member.files) ? member.files : []) : []),
    ])
    const kb = files.reduce((sum, file) => {
      const rec = file && typeof file === 'object' ? file as { size?: number } : {}
      return sum + Number(rec.size || 0)
    }, 0)
    bits.push(`${files.length} 个会话文件 · ${Math.max(1, Math.round(kb / 1024) || 1)} KB`)
  }
  const filesCount = Array.isArray(pkg.fileIds) ? pkg.fileIds.filter(Boolean).length : 0
  if (filesCount) bits.push(`${filesCount} 个工作区文件`)
  const appCount = Array.isArray(pkg.apps) ? pkg.apps.length : 0
  if (appCount) bits.push(`${appCount} 个应用`)
  if (pkg.briefing) bits.push('早报定义')
  return bits.join(' · ')
}
