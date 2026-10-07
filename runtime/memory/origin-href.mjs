/** One land table for instance origins. Corpus and search share this mouth. */

import { getBizWriteAuditByTraceId } from '../db.mjs'
import { filePathOf, sessionIdOf } from './identity.mjs'

export function bizTraceIdOf(origin) {
  const raw = String(origin || '').trim()
  if (!raw.startsWith('biz:')) return ''
  const rest = raw.slice(4)
  return rest.startsWith('trace_') ? rest : ''
}

export function letterPeerOf(req, selfId) {
  if (!req || typeof req !== 'object') return ''
  if (req.groupId) return ''
  const self = String(selfId || '')
  const from = String(req.from || req.fromId || '')
  if (from && from !== self) return from
  const to = Array.isArray(req.to) ? req.to.map(String) : []
  return to.find((id) => id && id !== self) || to[0] || ''
}

/**
 * @param {string} id
 * @param {{ db?: unknown, audit?: { kind?: string, recordNo?: string }, kind?: string, rowId?: string, peerId?: string, groupId?: string, sessionId?: string, mailbox?: Record<string, unknown> }} [ctx]
 */
export function originHref(id, ctx = {}) {
  const raw = String(id || '').trim()
  if (raw.startsWith('biz:')) {
    const traceId = bizTraceIdOf(raw)
    if (!traceId) return null
    const audit = ctx.audit
      || (ctx.db ? getBizWriteAuditByTraceId(ctx.db, traceId) : null)
    const kind = String(ctx.kind || audit?.kind || '').trim()
    const rowId = String(ctx.rowId || audit?.recordNo || '').trim()
    const href = { panel: 'data', tab: 'records', traceId }
    if (kind) href.kind = kind
    if (rowId) href.rowId = rowId
    return href
  }
  if (raw.startsWith('im:')) {
    const requestId = raw.slice(3)
    if (!requestId) return null
    const mailbox = ctx.mailbox && typeof ctx.mailbox === 'object' ? ctx.mailbox : null
    const selfId = mailbox?.self && mailbox.self.id ? String(mailbox.self.id) : ''
    const requests = Array.isArray(mailbox?.requests)
      ? mailbox.requests
      : Object.values(mailbox?.requests || {})
    const row = requests.find((item) => String(item?.id || item?.requestId || '') === requestId)
    const groupId = String(ctx.groupId || row?.groupId || '').trim()
    const peerId = String(ctx.peerId || letterPeerOf(row, selfId) || '').trim()
    const href = { panel: 'im', requestId }
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
    const href = { panel: 'briefing' }
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

export function imHrefFromRequest(req, selfId) {
  const requestId = String(req?.id || req?.requestId || '').trim()
  if (!requestId) return null
  return originHref(`im:${requestId}`, {
    peerId: letterPeerOf(req, selfId),
    groupId: String(req?.groupId || '').trim(),
  })
}

export function mentionRowsFromSheets(sheets) {
  const rows = []
  for (const sheet of Array.isArray(sheets) ? sheets : []) {
    if (!sheet || typeof sheet !== 'object') continue
    const kind = String(sheet.kind || '').trim()
    if (!kind) continue
    const list = Array.isArray(sheet.rows) ? sheet.rows : []
    for (const row of list) {
      if (!row || typeof row !== 'object') continue
      const no = String(row.no ?? row.orderId ?? row.id ?? '').trim()
      if (no) rows.push({ kind, no })
    }
  }
  return rows
}

export function uniqueMentions(rows) {
  const byNo = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const no = String(row?.no || row?.recordNo || '').trim()
    const kind = String(row?.kind || '').trim()
    if (!no || !kind) continue
    const set = byNo.get(no) || new Set()
    set.add(kind)
    byNo.set(no, set)
  }
  const unique = []
  for (const [no, kinds] of byNo) {
    if (kinds.size !== 1) continue
    unique.push({ kind: [...kinds][0], no })
  }
  return unique
}

export function mentionsInText(text, evidence) {
  const body = String(text || '')
  const items = uniqueMentions(evidence)
    .filter((row) => row.no && body.includes(row.no))
    .sort((a, b) => b.no.length - a.no.length)
  if (!body || !items.length) return [{ text: body }]
  const taken = []
  const hits = []
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
  const parts = []
  let cursor = 0
  for (const hit of hits) {
    if (hit.start > cursor) parts.push({ text: body.slice(cursor, hit.start) })
    parts.push({ text: body.slice(hit.start, hit.end), mention: hit.mention })
    cursor = hit.end
  }
  if (cursor < body.length) parts.push({ text: body.slice(cursor) })
  return parts
}
