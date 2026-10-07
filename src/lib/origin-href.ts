/** Same land table as runtime/memory/origin-href.mjs. */

import { filePathOf, sessionIdOf } from '@/lib/memory-identity'

export function bizTraceIdOf(origin: string) {
  const raw = String(origin || '').trim()
  if (!raw.startsWith('biz:')) return ''
  const rest = raw.slice(4)
  return rest.startsWith('trace_') ? rest : ''
}

export function letterPeerOf(req: Record<string, unknown> | null | undefined, selfId?: string) {
  if (!req || typeof req !== 'object') return ''
  if (req.groupId) return ''
  const self = String(selfId || '')
  const from = String(req.from || req.fromId || '')
  if (from && from !== self) return from
  const to = Array.isArray(req.to) ? req.to.map(String) : []
  return to.find((id) => id && id !== self) || to[0] || ''
}

export type OriginHref = {
  panel: string
  tab?: string
  traceId?: string
  kind?: string
  rowId?: string
  requestId?: string
  peerId?: string
  groupId?: string
  taskId?: string
  slug?: string
  entity?: string
  sessionId?: string
  path?: string
  pane?: string
  cardId?: string
}

export function originHref(id: string, ctx: {
  kind?: string
  rowId?: string
  peerId?: string
  groupId?: string
  sessionId?: string
} = {}): OriginHref | null {
  const raw = String(id || '').trim()
  if (raw.startsWith('biz:')) {
    const traceId = bizTraceIdOf(raw)
    if (!traceId) return null
    const kind = String(ctx.kind || '').trim()
    const rowId = String(ctx.rowId || '').trim()
    const href: OriginHref = { panel: 'data', tab: 'records', traceId }
    if (kind) href.kind = kind
    if (rowId) href.rowId = rowId
    return href
  }
  if (raw.startsWith('im:')) {
    const requestId = raw.slice(3)
    if (!requestId) return null
    const href: OriginHref = { panel: 'im', requestId }
    const groupId = String(ctx.groupId || '').trim()
    const peerId = String(ctx.peerId || '').trim()
    if (groupId) href.groupId = groupId
    if (peerId) href.peerId = peerId
    return href
  }
  if (raw.startsWith('task:')) {
    const taskId = raw.slice(5)
    return taskId ? { panel: 'plan', tab: 'todo', taskId } : null
  }
  if (raw.startsWith('briefing:')) {
    if (!raw.slice(9)) return null
    const href: OriginHref = { panel: 'briefing' }
    if (ctx.sessionId) href.sessionId = ctx.sessionId
    return href
  }
  if (raw.startsWith('app:')) {
    const parts = raw.slice(4).split(':')
    if (parts.length >= 3 && parts[0] && parts[1] && parts.slice(2).join(':')) {
      return {
        panel: 'data',
        tab: 'records',
        slug: parts[0],
        entity: parts[1],
        rowId: parts.slice(2).join(':'),
      }
    }
    if (parts[0]) return { panel: 'data', slug: parts[0] }
    return null
  }
  if (raw.startsWith('session:')) {
    const sessionId = sessionIdOf(raw)
    return sessionId ? { panel: 'ai', sessionId } : null
  }
  if (raw.startsWith('file:')) {
    const path = filePathOf(raw)
    return path ? { panel: 'files', path } : null
  }
  if (raw.startsWith('memory:')) {
    return raw.slice(7) ? { panel: 'memory', pane: 'cards', cardId: raw } : null
  }
  return null
}

export type MentionRow = { kind: string; no: string }

export function mentionRowsFromSheets(sheets: Array<Record<string, unknown> | null | undefined>): MentionRow[] {
  const rows: MentionRow[] = []
  for (const sheet of sheets) {
    if (!sheet || typeof sheet !== 'object') continue
    const kind = String(sheet.kind || '').trim()
    if (!kind) continue
    const list = Array.isArray(sheet.rows) ? sheet.rows : []
    for (const row of list) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const no = String(rec.no ?? rec.orderId ?? rec.id ?? '').trim()
      if (no) rows.push({ kind, no })
    }
  }
  return rows
}

export function uniqueMentions(rows: Array<{ kind?: string; no?: string; recordNo?: string }>): MentionRow[] {
  const byNo = new Map<string, Set<string>>()
  for (const row of rows) {
    const no = String(row?.no || row?.recordNo || '').trim()
    const kind = String(row?.kind || '').trim()
    if (!no || !kind) continue
    const set = byNo.get(no) || new Set<string>()
    set.add(kind)
    byNo.set(no, set)
  }
  const unique: MentionRow[] = []
  for (const [no, kinds] of byNo) {
    if (kinds.size !== 1) continue
    unique.push({ kind: [...kinds][0], no })
  }
  return unique
}

export type MentionPart = { text: string; mention?: MentionRow }

export function mentionsInText(text: string, evidence: MentionRow[]): MentionPart[] {
  const body = String(text || '')
  const items = uniqueMentions(evidence)
    .filter((row) => row.no && body.includes(row.no))
    .sort((a, b) => b.no.length - a.no.length)
  if (!body || !items.length) return [{ text: body }]
  const taken: Array<{ start: number; end: number }> = []
  const hits: Array<{ start: number; end: number; mention: MentionRow }> = []
  for (const row of items) {
    let from = 0
    while (from <= body.length) {
      const start = body.indexOf(row.no, from)
      if (start < 0) break
      const end = start + row.no.length
      const overlap = taken.some((span) => start < span.end && end > span.start)
      if (!overlap) {
        taken.push({ start, end })
        hits.push({ start, end, mention: row })
      }
      from = start + 1
    }
  }
  hits.sort((a, b) => a.start - b.start)
  const parts: MentionPart[] = []
  let cursor = 0
  for (const hit of hits) {
    if (hit.start > cursor) parts.push({ text: body.slice(cursor, hit.start) })
    parts.push({ text: body.slice(hit.start, hit.end), mention: hit.mention })
    cursor = hit.end
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor) })
  return parts
}
