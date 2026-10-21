/**
 * Magnifier grouping: titles, body excerpts, and semantic hits.
 * Does not search. Callers pass official searchSessions pages and search_text hits.
 * Bridge file nodes are dropped; local files and session: hits are kept.
 * @module dsh-semantic-os/session-find
 */

export const TITLE_LIMIT = 20
export const EXCERPT_LIMIT = 20
export const SEMANTIC_LIMIT = 20

const WRAPPER = /^(还记得|记得)?(我们)?(曾经)?(讨论过|聊过|说过|谈过)/
const TAIL = /[吗呢啊？?]+$/
const META_RE = /验收|总判|金例|帮不上忙|没测完|原话第一条|侧栏搜|human-acceptance|施工笔记|稀疏索引|稠密 FAISS|对照清单/
const AUDIT_RE = /审查仓库|只读审查|当前未提交改动|重点检查 index\.js|必须给文件和行号|避免泛泛建议/
const TOPIC_RE = /编码|召回|工作记忆|记忆生成|记忆检索|人类对记忆|语义助手还差|只发 darwin-arm64|发版收敛/
const TOPIC_TERMS = ['编码', '召回', '工作记忆', '记忆生成', '记忆检索', '人类对记忆', '语义助手还差', '只发 darwin-arm64', '发版收敛']
const VOCAB_TYPE = /^(skos:|owl:)/i
const STOP = new Set(['做成', '一样', '讨论', '记得', '我们'])

export function isAuditNoise(text) {
  return AUDIT_RE.test(String(text || ''))
}

export function isSessionTailQuery(query) {
  return /^[0-9a-f]{6,12}$/i.test(String(query || '').trim())
}

export function topicQuery(query) {
  let text = String(query || '').trim()
  text = text.replace(WRAPPER, '').replace(TAIL, '').trim()
  text = text.replace(/^把/, '').trim()
  return text || String(query || '').trim()
}

export function queryTokens(query) {
  const topic = topicQuery(query)
  const tokens = []
  const parts = String(topic || '').split(/做成|一样|以及|或者|还是|和|与|把|的|了|是/)
  for (const part of parts) {
    const cjk = part.match(/[\u3400-\u9fff]{2,}/g) || []
    const latin = part.match(/[A-Za-z][A-Za-z0-9._-]{1,}/g) || []
    for (const token of cjk.concat(latin)) {
      if (STOP.has(token) || tokens.includes(token)) continue
      tokens.push(token)
    }
  }
  return tokens
}

function escapeRe(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function gapMatch(hay, phrase) {
  const chars = [...String(phrase || '')].filter((ch) => ch.trim())
  if (chars.length < 2) return false
  try {
    return new RegExp(chars.map(escapeRe).join('.{0,4}')).test(hay)
  } catch {
    return false
  }
}

export function hitCoversQuery(hay, query, via) {
  const blob = String(hay || '').toLowerCase()
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  if (blob.includes(q)) return true
  const chars = [...q].filter((ch) => ch.trim())
  if (chars.length <= 8 && /[\u3400-\u9fff]/.test(q) && gapMatch(blob, q)) return true
  const tokens = queryTokens(query).map((token) => token.toLowerCase())
  if (!tokens.length) return false
  const hits = tokens.filter((token) => blob.includes(token) || gapMatch(blob, token))
  if (tokens.length === 1) {
    if (hits.length === 1) return true
  } else if (hits.length >= Math.min(2, tokens.length)) {
    return true
  }
  if (via === 'faiss' || via === 'corpus' || via === 'bridge') {
    const topic = topicQuery(query)
    const grams = topic.match(/[\u3400-\u9fff]{2}/g) || []
    const overlap = grams.filter((gram) => blob.includes(gram)).length
    return overlap >= 2 || TOPIC_RE.test(blob)
  }
  return false
}

function hitHay(hit) {
  const node = (hit && hit.node) || hit || {}
  return `${node.id || hit.id || ''}\n${node.content || hit.snippet || ''}\n${node.type || ''}\n${(node.properties && node.properties.content) || ''}`
}

export function rankHit(hit, query) {
  let score = Number((hit && hit.score) || 0)
  const node = (hit && hit.node) || hit || {}
  const hay = hitHay(hit)
  const ntype = String(node.type || hit.type || '')
  const nid = String(node.id || hit.id || '')
  if (VOCAB_TYPE.test(ntype) || nid.includes('/vocab/')) score -= 250
  if (isAuditNoise(hay)) score -= 400
  if (nid.startsWith('file:') && /\.(js|mjs|cjs|ts|tsx|py)$/i.test(nid)) score -= 240
  if (nid.startsWith('session:')) score += 80
  const status = String((hit && hit.then && hit.then.status) || node.status || (node.properties && node.properties.status) || '')
  if (ntype === 'decision' && query && hay.includes(String(query))) {
    if (status === '已生效') score += 400
    else if (status === '起草') score -= 80
  }
  if (META_RE.test(hay)) score -= 140
  let topicHits = 0
  for (const term of TOPIC_TERMS) {
    if (hay.includes(term)) topicHits += 1
  }
  score += topicHits * 45
  for (const token of queryTokens(query)) {
    if (hay.toLowerCase().includes(token.toLowerCase()) || gapMatch(hay.toLowerCase(), token.toLowerCase())) score += 35
  }
  const q = String(query || '')
  if (q.length > 12 && hay.includes(q) && hay.length > q.length * 4) score -= 60
  const cited = hay.match(/session:session-[0-9a-f-]+(?::\d+)?/gi) || []
  for (const citedId of cited) {
    if (nid.indexOf(citedId) >= 0 || citedId.indexOf(nid) >= 0) continue
    score -= 80
  }
  const from = (hit && hit.then && hit.then.valid_from) || node.valid_from || ''
  if (from && nid.startsWith('session:') && !META_RE.test(hay)) {
    const at = Date.parse(from)
    if (Number.isFinite(at)) score += Math.min(80, Math.max(0, (Date.now() - at) / (1000 * 60 * 60 * 24)))
  }
  return score
}

export function sortHits(hits, query) {
  const rows = Array.isArray(hits) ? hits.slice() : []
  rows.sort((a, b) => {
    const delta = rankHit(b, query) - rankHit(a, query)
    if (delta) return delta
    const aid = String((a && a.node && a.node.id) || a.id || '')
    const bid = String((b && b.node && b.node.id) || b.id || '')
    return aid < bid ? -1 : aid > bid ? 1 : 0
  })
  return rows
}

export function workspaceLabel(cwd) {
  const text = String(cwd || '')
  if (!text) return ''
  const base = text.replace(/[/\\]+$/, '').split(/[/\\]/).pop()
  return base || text
}

export function sessionTitleOf(session) {
  if (!session || session.blank) return ''
  return String(session.displayTitle || session.title || '')
}

export function parseSessionNodeId(id) {
  const raw = String(id || '')
  if (!raw.startsWith('session:')) return null
  const rest = raw.slice('session:'.length)
  const cut = rest.match(/^(.*):(\d+)$/)
  if (!cut) return { sessionId: rest, seq: null }
  return { sessionId: cut[1], seq: Number(cut[2]) }
}

export function clipSnippet(text, query, limit = 96) {
  const blob = String(text || '').replace(/\s+/g, ' ').trim()
  if (!blob) return ''
  const q = String(query || '').trim()
  if (!q) return blob.length <= limit ? blob : `${blob.slice(0, limit)}…`
  const at = blob.toLowerCase().indexOf(q.toLowerCase())
  if (at < 0) return blob.length <= limit ? blob : `${blob.slice(0, limit)}…`
  const pad = Math.max(0, Math.floor((limit - q.length) / 2))
  const start = Math.max(0, at - pad)
  const slice = blob.slice(start, start + limit)
  return `${start > 0 ? '…' : ''}${slice}${start + limit < blob.length ? '…' : ''}`
}

export function thenStamp(hit) {
  const then = hit && hit.then
  if (then && then.label) return String(then.label)
  const node = hit && hit.node
  const from = (node && (node.valid_from || (node.properties && node.properties.valid_from))) || ''
  return from ? String(from) : ''
}

function sessionRow(session, workspaces) {
  const id = session && (session.id || session.sessionId)
  if (!id) return null
  const title = sessionTitleOf(session)
  let workspace = ''
  for (const ws of workspaces || []) {
    const ids = ws.sessionIds || []
    if (ids.indexOf(id) >= 0) {
      workspace = String(ws.title || workspaceLabel(ws.path || ws.cwd) || '')
      break
    }
  }
  if (!workspace) workspace = workspaceLabel(session.cwd)
  return {
    id,
    title: title || id,
    workspace,
    updatedAt: Number(session.updatedAt || 0),
  }
}

function visibleSession(session, current, archived) {
  if (!session) return false
  if (session.origin === 'subagent') return false
  const id = session.id || session.sessionId
  if (archived && archived.has && archived.has(id)) return false
  if (session.blank && id !== current) return false
  return true
}

/**
 * Split official magnifier inputs. Titles never pretend to be body hits.
 * excerptStatus is ready | empty | unavailable.
 */
export function groupOfficialSearch(input) {
  const query = String((input && input.query) || '').trim()
  const list = (input && input.list) || { ids: [], byId: {}, current: undefined }
  const workspaces = (input && input.workspaces) || []
  const archived = input && input.archivedSessionIds instanceof Set
    ? input.archivedSessionIds
    : new Set(input && input.archivedSessionIds || [])
  const content = (input && input.content) || { items: [], status: 'idle' }
  const titleLimit = Number(input && input.titleLimit) > 0 ? Number(input.titleLimit) : TITLE_LIMIT
  const excerptLimit = Number(input && input.excerptLimit) > 0 ? Number(input.excerptLimit) : EXCERPT_LIMIT

  if (!query) {
    return {
      query,
      titles: [],
      excerpts: [],
      excerptStatus: 'idle',
    }
  }

  const q = query.toLowerCase()
  const titles = []
  const ids = Array.isArray(list.ids) ? list.ids : Object.keys(list.byId || {})
  for (const id of ids) {
    const session = (list.byId || {})[id]
    if (!visibleSession(session, list.current, archived)) continue
    const row = sessionRow({ ...session, id: session.id || id }, workspaces)
    if (!row) continue
    const hay = `${row.title} ${row.workspace} ${row.id}`.toLowerCase()
    const tail = String(row.id).slice(-8).toLowerCase()
    if (hay.includes(q) || tail === q || String(row.id).toLowerCase().endsWith(q)) titles.push(row)
  }
  titles.sort((a, b) => (b.updatedAt - a.updatedAt) || (a.id < b.id ? -1 : 1))

  let excerptStatus = 'ready'
  const excerpts = []
  if (content.status === 'error' || content.status === 'unavailable') {
    excerptStatus = 'unavailable'
  } else if (content.status === 'loading') {
    excerptStatus = 'loading'
  } else {
    const items = Array.isArray(content.items) ? content.items : []
    for (const item of items) {
      const sessionId = item && item.sessionId
      if (!sessionId) continue
      const session = (list.byId || {})[sessionId] || { id: sessionId, title: sessionId, cwd: '' }
      if (session.origin === 'subagent') continue
      if (archived.has(sessionId)) continue
      const row = sessionRow({ ...session, id: sessionId }, workspaces)
      if (!row) continue
      excerpts.push({
        ...row,
        snippet: String(item.snippet || ''),
      })
      if (excerpts.length >= excerptLimit) break
    }
    if (content.status === 'ready' && excerpts.length === 0) excerptStatus = 'empty'
  }

  return {
    query,
    titles: titles.slice(0, titleLimit),
    excerpts,
    excerptStatus,
  }
}

/**
 * Sidebar body excerpts. Session-id tails never take unfiltered FAISS/bridge rows.
 */
export function excerptsFromFind(grouped, _merged, query) {
  if (isSessionTailQuery(query)) return []
  const excerpts = []
  const seen = new Set()
  for (const row of (grouped && grouped.items) || []) {
    const sessionId = row && row.sessionId
    const snippet = String((row && row.snippet) || '')
    if (!sessionId || seen.has(sessionId)) continue
    if (isAuditNoise(snippet) || isAuditNoise(String(row.id || ''))) continue
    seen.add(sessionId)
    excerpts.push({ sessionId, snippet })
    if (excerpts.length >= 12) break
  }
  return excerpts
}

function hitKind(id, via) {
  if (String(id).startsWith('session:')) return 'session'
  if (String(id).startsWith('file:')) return via === 'bridge' ? null : 'file'
  return null
}

/**
 * Map search_text hits into magnifier rows. Does not call search_text.
 * Drops bridged files. Keeps local files and session: (including via=bridge).
 */
export function groupSemanticHits(packed, input) {
  const query = String((packed && packed.query) || (input && input.query) || '').trim()
  const list = (input && input.list) || { ids: [], byId: {} }
  const workspaces = (input && input.workspaces) || []
  const limit = Number(input && input.limit) > 0 ? Number(input.limit) : SEMANTIC_LIMIT
  const status = packed && packed.error ? 'unavailable' : 'ready'
  if (!query) return { query, items: [], semanticStatus: 'idle' }
  if (status === 'unavailable') return { query, items: [], semanticStatus: 'unavailable' }

  const items = []
  const seen = new Set()
  for (const hit of (packed && packed.results) || []) {
    const node = hit && hit.node
    if (!node) continue
    const id = String(node.id || '')
    const via = hit.via || (node.properties && node.properties.via) || ''
    const kind = hitKind(id, via)
    if (!kind) continue
    if (isAuditNoise(`${id}\n${node.content || ''}`)) continue
    if (isSessionTailQuery(query)) {
      const parsed = parseSessionNodeId(id)
      const sid = String((parsed && parsed.sessionId) || '').toLowerCase()
      const q = query.toLowerCase()
      if (sid.slice(-8) !== q && !sid.replace(/-/g, '').includes(q) && !sid.includes(q)) continue
    } else {
      const hay = `${id}\n${node.content || ''}\n${(node.properties && node.properties.content) || ''}`
      if (query && !hitCoversQuery(hay, query, via)) continue
    }
    const cwd = hit.cwd || (node.properties && node.properties.cwd) || ''
    let sessionId = ''
    let title = ''
    let workspace = workspaceLabel(cwd)
    if (kind === 'session') {
      const parsed = parseSessionNodeId(id)
      sessionId = parsed && parsed.sessionId || ''
      if (seen.has(`s:${sessionId}:${clipSnippet(node.content, query, 48)}`)) continue
      seen.add(`s:${sessionId}:${clipSnippet(node.content, query, 48)}`)
      const session = (list.byId || {})[sessionId]
      const row = session ? sessionRow({ ...session, id: sessionId }, workspaces) : null
      title = (row && row.title) || sessionId || id
      workspace = (row && row.workspace) || workspace
    } else {
      if (seen.has(id)) continue
      seen.add(id)
      title = workspaceLabel(id.replace(/^file:/, '')) || id
    }
    items.push({
      id,
      kind,
      sessionId,
      title,
      workspace,
      snippet: clipSnippet(node.content, query),
      then: thenStamp(hit),
      via: via === 'bridge' ? 'bridge' : (via || 'local'),
      cwd,
      score: Number(hit.score || 0),
      node,
    })
    if (items.length >= limit * 3) break
  }

  const ranked = sortHits(items, query).slice(0, limit)
  return {
    query,
    items: ranked,
    semanticStatus: ranked.length ? 'ready' : 'empty',
  }
}

export function clockEmptyReason(date) {
  const text = String(date || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(text)) return '这一分钟没有'
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return '这一天没有'
  return ''
}

export function composeFindResults(official, semantic, extra) {
  const excerptStatus = official.excerptStatus
  const semanticStatus = semantic.semanticStatus
  const date = extra && extra.date
  const clock = clockEmptyReason(date)
  const excerptEmpty = excerptStatus === 'unavailable' || excerptStatus === 'empty'
  const semanticEmpty = semanticStatus === 'unavailable' || semanticStatus === 'empty'
  return {
    query: official.query || semantic.query || '',
    titles: official.titles || [],
    excerpts: official.excerpts || [],
    semantic: semantic.items || [],
    excerptStatus,
    semanticStatus,
    excerptEmptyReason: excerptEmpty ? (clock || '正文没搜到') : '',
    semanticEmptyReason: semanticEmpty ? (clock || '图里没有') : '',
    date: date || '',
  }
}
