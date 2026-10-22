/**
 * Search and open DSH session logs. Chat text is not copied into the work graph.
 * @module dsh-semantic-os/session-corpus
 */

import { adaptSessionPersistence, eventText, eventTime, headerCwd, headerId } from './session-ingest.js'
import { clipSnippet, hitCoversQuery, parseSessionNodeId, queryTokens, rankHit, sortHits, topicQuery } from './session-find.js'
import { listBridgePeers } from './bridge.js'

const SEARCH_LIMIT = 12
const OPEN_CAP = 4000

function pad(n) {
  return String(n).padStart(2, '0')
}

function localStamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function localDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseClock(raw) {
  const text = String(raw || '').trim()
  if (!text) return { day: '', minute: '' }
  const dayMin = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/)
  if (dayMin) {
    return { day: dayMin[1], minute: `${dayMin[1]} ${pad(Number(dayMin[2]))}:${dayMin[3]}` }
  }
  const day = text.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (day) return { day: day[1], minute: '' }
  const hm = text.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) {
    const now = new Date()
    const minute = `${localDay(now)} ${pad(Number(hm[1]))}:${hm[2]}`
    return { day: '', minute }
  }
  return { day: '', minute: '' }
}

export function coversQueryWindow(iso, args = {}) {
  const date = String(args.date || args.at || args.when || '').trim()
  const from = String(args.date_from || args.from || '').trim()
  const to = String(args.date_to || args.to || '').trim()
  if (!date && !from && !to) return true
  if (!iso) return false
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) return false
  const stamp = localStamp(instant)
  const day = localDay(instant)
  const wanted = parseClock(date)
  if (wanted.minute) return stamp === wanted.minute
  if (wanted.day) return day === wanted.day
  if (from) {
    const start = parseClock(from)
    const startKey = start.minute || `${start.day} 00:00`
    if (startKey && stamp < startKey) return false
  }
  if (to) {
    const end = parseClock(to)
    const endKey = end.minute || `${end.day} 23:59`
    if (endKey && stamp > endKey) return false
  }
  return true
}

export function thenFromIso(iso) {
  if (!iso) {
    return { now: false, label: '当时 · 没有日期 · 不是现在', status: '', valid_from: '', undated: true }
  }
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) {
    return { now: false, label: '当时 · 没有日期 · 不是现在', status: '', valid_from: String(iso), undated: true }
  }
  return {
    now: false,
    label: `当时 · ${localStamp(instant)} · 不是现在`,
    status: '',
    valid_from: iso,
    undated: false,
  }
}

export function packHit(id, text, iso, query, cwd, via) {
  const snippet = clipSnippet(text, query, 360)
  const covers = hitCoversQuery(`${id}\n${text}`, query, via)
  const packed = {
    node: {
      id,
      type: 'Document',
      content: snippet,
      properties: { content: snippet, cwd: cwd || '', path: id },
      valid_from: iso || null,
      valid_until: null,
    },
    score: covers ? 150 : 70,
    hop_distance: null,
    semantic_similarity: null,
    then: thenFromIso(iso),
    cwd: cwd || '',
    via: via || 'local',
  }
  packed.score = rankHit(packed, query)
  return packed
}

function headerTime(header) {
  const n = Number(header && (header.updatedAt || header.mtime || header.time || header.updated))
  return Number.isFinite(n) ? n : 0
}

async function searchOneCwd(persistence, cwd, query, args, via) {
  const q = String(query || '').trim()
  if (!q) return []
  const headers = await persistence.list()
  const list = Array.isArray(headers) ? headers : []
  let cap = Number(args && args.maxSessions)
  if (!Number.isFinite(cap) || cap <= 0) cap = 24
  cap = Math.max(1, Math.min(cap, 80))
  let want = Number(args && args.limit)
  if (!Number.isFinite(want) || want <= 0) want = SEARCH_LIMIT
  want = Math.max(1, Math.min(want, 50))
  const mine = list.filter((header) => {
    const id = headerId(header)
    const headerPath = String(headerCwd(header) || '').replace(/[\r\n\t]/g, '')
    return id && headerPath === cwd
  }).sort((a, b) => headerTime(b) - headerTime(a)).slice(0, cap)
  const hits = []
  let budget = Number(args && args.maxMs)
  if (!Number.isFinite(budget) || budget <= 0) budget = 2500
  budget = Math.max(200, Math.min(budget, 8000))
  const started = Date.now()
  for (const header of mine) {
    if (Date.now() - started > budget) break
    const id = headerId(header)
    let packed
    try {
      packed = await persistence.readFrom(id, 0)
    } catch {
      continue
    }
    const events = (packed && packed.events) || []
    for (const event of events) {
      const seq = event && Number.isFinite(event.seq) ? event.seq : -1
      if (seq < 0) continue
      const text = eventText(event).trim()
      if (!text) continue
      const iso = eventTime(event)
      if (!coversQueryWindow(iso, args)) continue
      if (!text.includes(q) && !`session:${id}:${seq}`.includes(q)) continue
      hits.push(packHit(`session:${id}:${seq}`, text, iso, q, cwd, via))
      if (hits.length >= want) return hits
    }
  }
  return hits
}

export function mergeSearchHits(graph, logs, query, args = {}) {
  const graphHits = Array.isArray(graph && graph.results) ? graph.results : []
  const logHits = Array.isArray(logs && logs.results) ? logs.results : []
  const seen = new Set()
  const results = []
  for (const row of graphHits.concat(logHits)) {
    const id = String((row && row.node && row.node.id) || '')
    if (!id || seen.has(id)) continue
    const iso = (row && row.then && row.then.valid_from) || (row && row.node && row.node.valid_from) || ''
    if (!coversQueryWindow(iso, args)) continue
    seen.add(id)
    results.push(row)
  }
  const ranked = sortHits(results, query)
  return {
    ...(graph && typeof graph === 'object' ? graph : {}),
    ok: true,
    query: String(query || (graph && graph.query) || (logs && logs.query) || ''),
    results: ranked,
    total: ranked.length,
    via: (logs && logs.via) || (graph && graph.via) || 'local',
    bridge_hits: Number((logs && logs.bridge_hits) || (graph && graph.bridge_hits) || 0),
  }
}

export function passageQueries(query) {
  const q = String(query || '').trim()
  if (!q) return []
  const out = []
  const push = (item) => {
    const text = String(item || '').trim()
    if (text && !out.includes(text)) out.push(text)
  }
  for (const token of queryTokens(q)) push(token)
  if (/人类记忆/.test(q) || out.includes('人类记忆')) {
    push('人类对记忆')
    push('语义助手还差哪些')
  }
  push(topicQuery(q))
  push(q)
  return out.slice(0, 5)
}

export async function mergePassageHits(merged, opts) {
  const rows = Array.isArray(opts && opts.rows) ? opts.rows : []
  const query = String((opts && opts.query) || '')
  const cwd = String((opts && opts.cwd) || '')
  const args = (opts && opts.args) || {}
  const getPersistence = opts && opts.getPersistence
  if (!rows.length || typeof getPersistence !== 'function') return merged
  const extra = { results: [] }
  const seen = new Set((merged && merged.results || []).map((row) => String(row && row.node && row.node.id || '')))
  for (const row of rows) {
    const id = String((row && row.id) || '')
    if (!id || seen.has(id) || !id.startsWith('session:')) continue
    const opened = await openCorpus({ getPersistence, id })
    if (!opened || !opened.ok) continue
    const iso = (opened.then && opened.then.valid_from) || String(row.time || row.timestamp || '')
    if (!coversQueryWindow(iso, args)) continue
    extra.results.push(packHit(opened.id, opened.text, iso, query, cwd, 'faiss'))
    seen.add(id)
  }
  return mergeSearchHits(merged, extra, query, args)
}

export async function searchCorpus(opts) {
  const persistence = adaptSessionPersistence(opts && typeof opts.getPersistence === 'function' ? opts.getPersistence() : null)
  const cwd = String((opts && opts.cwd) || '')
  const args = (opts && opts.args) || {}
  const q = String(args.query || args.q || '').trim()
  if (!q) return { ok: true, results: [], total: 0, query: q, error: '' }
  if (!cwd) return { ok: false, results: [], total: 0, query: q, error: 'NO_CWD' }
  if (!persistence || typeof persistence.list !== 'function' || typeof persistence.readFrom !== 'function') {
    return { ok: false, results: [], total: 0, query: q, error: 'NO_PERSISTENCE' }
  }
  let limit = Number(args.limit)
  if (!Number.isFinite(limit) || limit <= 0) limit = SEARCH_LIMIT
  limit = Math.max(1, Math.min(limit, 50))
  const across = args.across_bridges === undefined ? true : Boolean(args.across_bridges)
  const local = await searchOneCwd(persistence, cwd, q, args, 'local')
  const hits = local.slice()
  if (across) {
    const peers = await listBridgePeers(cwd)
    for (const peer of peers) {
      const extra = await searchOneCwd(persistence, peer, q, args, 'bridge')
      for (const row of extra) hits.push(row)
    }
  }
  hits.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
  return {
    ok: true,
    query: q,
    results: hits.slice(0, limit),
    total: hits.length,
    error: '',
    via: 'corpus',
    bridged: across ? (await listBridgePeers(cwd)) : [],
    bridge_hits: hits.filter((row) => row.via === 'bridge').length,
  }
}

export async function openCorpus(opts) {
  const persistence = adaptSessionPersistence(opts && typeof opts.getPersistence === 'function' ? opts.getPersistence() : null)
  const rawId = String((opts && (opts.id || (opts.args && (opts.args.id || opts.args.path)))) || '')
  const parsed = parseSessionNodeId(rawId)
  if (!parsed || !parsed.sessionId) {
    return { ok: false, error: 'NOT_SESSION', id: rawId, text: '' }
  }
  if (!persistence || typeof persistence.readFrom !== 'function') {
    return { ok: false, error: 'NO_PERSISTENCE', id: rawId, text: '' }
  }
  let cap = Number(opts && opts.limit)
  if (!Number.isFinite(cap) || cap <= 0) cap = OPEN_CAP
  cap = Math.max(200, Math.min(cap, 8000))
  let packed
  try {
    packed = await persistence.readFrom(parsed.sessionId, 0)
  } catch {
    return { ok: false, error: 'NOT_FOUND', id: rawId, text: '' }
  }
  const events = (packed && packed.events) || []
  for (const event of events) {
    const seq = event && Number.isFinite(event.seq) ? event.seq : -1
    if (seq < 0) continue
    if (parsed.seq != null && seq !== parsed.seq) continue
    const text = eventText(event)
    if (!text) continue
    const iso = eventTime(event)
    const shown = text.length <= cap ? text : `${text.slice(0, cap - 1)}…`
    return {
      ok: true,
      id: `session:${parsed.sessionId}:${seq}`,
      type: 'Document',
      text: shown,
      length: text.length,
      truncated: text.length > cap,
      then: thenFromIso(iso),
    }
  }
  return { ok: false, error: 'NOT_FOUND', id: rawId, text: '' }
}
