/**
 * Machine envelope vs model-facing 摘录 for graph search hits.
 * @module dsh-semantic-os/search-excerpt
 */

function clipSnippet(raw, q, cap) {
  const text = String(raw || '')
  const limit = Number(cap) || 360
  if (text.length <= limit) return text
  const needle = String(q || '').trim()
  if (!needle) return `${text.slice(0, Math.max(0, limit - 1))}…`
  const at = text.toLowerCase().indexOf(needle.toLowerCase())
  if (at < 0) return `${text.slice(0, Math.max(0, limit - 1))}…`
  const start = Math.max(0, at - Math.floor(limit / 4))
  const chunk = text.slice(start, start + limit)
  return `${start > 0 ? '…' : ''}${chunk}${start + limit < text.length ? '…' : ''}`
}

export const SEARCH_SNIPPET = 360
export const SEARCH_PAGE = 4

export const CANVAS_TOOL_NAMES = new Set([
  'extract_entities',
  'extract_relations',
  'run_reasoning',
  'get_graph_analytics',
  'get_graph_summary',
  'export_graph',
  'export_ledger',
  'backup_graph',
  'restore_graph',
  'erase_ledger',
])

function worldSourceType(nid, ntype, via) {
  const id = String(nid || '')
  const kind = String(ntype || '')
  const path = String(via || '')
  if (id.startsWith('session:')) return 'session'
  if (id.startsWith('file:')) return 'file'
  if (id.startsWith('mail:')) return 'mail'
  if (id.startsWith('memory:') || kind === '记忆卡片' || path === 'agent-memory') return 'memory'
  if (kind.toLowerCase() === 'decision') return 'decision'
  if (kind.startsWith('skos:')) return 'vocab'
  if (path === 'faiss') return 'passage'
  return 'graph'
}

function worldGrade(nid, ntype, via, props) {
  const meta = props && typeof props === 'object' ? props : {}
  const id = String(nid || '')
  const kind = String(ntype || '')
  const path = String(via || '')
  if (id.startsWith('memory:') || kind === '记忆卡片' || path === 'agent-memory') return 'user_memory'
  if (meta.auto === true || String(meta.source || '') === 'session_ingest') return 'inferred'
  if (kind.toLowerCase() === 'decision') {
    const status = String(meta.status || meta.board_status || '')
    const receipt = String(meta.receipt_id || meta.receiptId || meta.receipt || '')
    const nod = String(meta.nod_kind || meta.nodKind || '')
    if (status === '已生效' && receipt && nod === '业务过账') return 'verified_receipt'
    return 'observation'
  }
  return 'observation'
}

export function stampWorldHit(row, cwd = '') {
  if (!row || typeof row !== 'object') return row
  const node = row.node && typeof row.node === 'object' ? row.node : {}
  const props = node.properties && typeof node.properties === 'object' ? node.properties : {}
  const nid = String(node.id || row.id || '')
  const ntype = String(node.type || row.kind || '')
  const via = String(row.via || props.via || '')
  const snippet = String(node.content || props.content || row.snippet || '')
  const observed = String(node.valid_from || props.valid_from || props.timestamp || row.observed_at || '')
  const until = String(node.valid_until || props.valid_until || row.valid_until || '')
  let confidence = Number(row.score || row.confidence || 0)
  if (!Number.isFinite(confidence) || confidence < 0) confidence = 0
  else if (confidence > 1) confidence = Math.min(1, confidence / 200)
  return {
    ...row,
    id: nid,
    kind: ntype,
    title: snippet.slice(0, 40) || nid,
    snippet,
    source_uri: nid,
    source_type: worldSourceType(nid, ntype, via),
    observed_at: observed,
    valid_from: observed,
    valid_until: until || null,
    confidence,
    knowledge_grade: worldGrade(nid, ntype, via, props),
    is_live: false,
    expires_at: until || null,
    workspace: String(props.cwd || row.workspace || cwd || ''),
  }
}

export function clipSearchPayload(body, args = {}) {
  if (body == null) return body
  let data = body
  if (typeof body === 'string') {
    try { data = JSON.parse(body) } catch { return body }
  }
  if (!data || typeof data !== 'object' || data.error || !Array.isArray(data.results)) return data
  const q = String(args.query || args.q || data.query || '')
  const cwd = String(args.cwd || data.cwd || '')
  let limit = Number(args.limit)
  if (!Number.isFinite(limit) || limit <= 0) limit = SEARCH_PAGE
  limit = Math.max(1, Math.min(limit, 50))
  const rows = data.results.slice(0, limit).map((row) => {
    if (!row || typeof row !== 'object') return row
    const node = row.node
    if (!node || typeof node !== 'object') return stampWorldHit(row, cwd)
    const raw = node.content || (node.properties && node.properties.content) || ''
    const snippet = clipSnippet(raw, q, SEARCH_SNIPPET)
    const props = node.properties && typeof node.properties === 'object'
      ? { ...node.properties, content: snippet }
      : { content: snippet }
    return stampWorldHit({ ...row, node: { ...node, content: snippet, properties: props } }, cwd)
  })
  const packed = { ...data, results: rows }
  const clock = String(args.date || data.date || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(clock) && !rows.length) {
    packed.empty = true
    packed.detail = packed.detail || '这一分钟没有'
  }
  return packed
}

function thenLabel(row) {
  const then = row && row.then
  if (then && typeof then === 'object') return String(then.label || '')
  return then == null ? '' : String(then)
}

export function toModelExcerpt(data, args = {}) {
  if (data == null) return data
  let body = data
  if (typeof data === 'string') {
    try { body = JSON.parse(data) } catch { return data }
  }
  if (!body || typeof body !== 'object' || body.error || !Array.isArray(body.results)) return body
  const rows = body.results
  let limit = Number(args.limit)
  if (!Number.isFinite(limit) || limit <= 0) limit = SEARCH_PAGE
  limit = Math.max(1, Math.min(limit, 50))
  const results = rows.slice(0, limit).map((row) => {
    const id = String((row && (row.id || (row.node && row.node.id))) || '')
    const snippet = String((row && (row.snippet || (row.node && row.node.content))) || '').slice(0, SEARCH_SNIPPET)
    return {
      id,
      then: thenLabel(row),
      snippet,
      knowledge_grade: String((row && row.knowledge_grade) || ''),
    }
  })
  const total = Number(body.total)
  const packed = {
    query: String(args.query || args.q || body.query || ''),
    total: Number.isFinite(total) ? total : rows.length,
    results,
  }
  if (body.empty) packed.empty = true
  if (body.detail) packed.detail = body.detail
  return packed
}
