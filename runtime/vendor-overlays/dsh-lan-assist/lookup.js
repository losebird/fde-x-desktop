/**
 * Read-only ticket probe for the secretary.
 * Never calls create / update / destroy / approve / post.
 * Ticket stays on this machine (assist page or env), not in the mailbox.
 * Clue resolution is dialect-agnostic: names and codes count, not just tickets.
 * @module dsh-lan-assist/lookup
 */

import { enumMap, groupClueTerms, looksLikeRef, looksLikeTicket, listRows, pickNo, resolveRows, rowMatches, rowMatchesAll } from './resolve.js'
import { PAGE_SIZE, cluesFromWhere } from './plan.js'
import { expandNegatedClosedValues } from './enum-clues.js'
import {
  bindWhereKeys,
  fieldLabelsFromRawCollection,
  listLimitForWhere,
  resolveShapeKey,
  termFilterPart as whereTermFilterPart,
  vocabRow,
} from './where-pass.js'

const WRITE = /(?:^|\/|:)(?:create|update|destroy|remove|delete|approve|reject|post|submit|publish|execute|resource_create|resource_update|resource_destroy)(?:$|[/?])/i

/**
 * @param {unknown} path
 */
export function isWritePath(path) {
  return WRITE.test(String(path || ''))
}

/**
 * Type → collection + ticket columns.
 * Vocab / connector / live collections first. Builtin catalog is only a fallback.
 */
export function mapKind(kind, extra = {}) {
  const name = String(kind || '').trim()
  if (!name) return null
  const fromVocab = mapFromRows(name, extra.vocab)
  if (fromVocab) return fromVocab
  const fromConn = mapFromRows(name, extra.kinds || extra.maps)
  if (fromConn) return fromConn
  const fromLive = mapFromCollections(name, extra.collections)
  if (fromLive) return fromLive
  return null
}

function rowKindName(row) {
  if (typeof row === 'string') return row.trim()
  if (!row || typeof row !== 'object') return ''
  return String(row.kind || row.label || row.title || row.name || '').trim()
}

function rowResource(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.resource || row.collection || row.name || '').trim()
}

function oralAndGraphAliasTokens(row) {
  const out = []
  if (!row || typeof row !== 'object') return out
  const aliases = row.aliases
  if (Array.isArray(aliases)) {
    for (const item of aliases) {
      const name = String(item || '').trim()
      if (name) out.push(name)
    }
  } else if (typeof aliases === 'string') {
    for (const item of aliases.split(/[,，、\s]+/)) {
      const name = item.trim()
      if (name) out.push(name)
    }
  }
  const clues = Array.isArray(row.clues) ? row.clues : []
  for (const clue of clues) {
    if (!clue || typeof clue !== 'object') continue
    if (String(clue.role || '').trim() !== '型') continue
    const says = clue.say || clue.says
    const list = Array.isArray(says) ? says : (typeof says === 'string' ? says.split(/[,，、\s]+/) : [])
    for (const item of list) {
      const name = String(item || '').trim()
      if (name) out.push(name)
    }
  }
  return out
}

function canonicalKindForResource(resource, extra, fallback) {
  const stem = String(resource || '').trim()
  if (!stem) return String(fallback || '').trim()
  const ranked = []
  for (const row of listKindRows(extra)) {
    if (rowResource(row) !== stem) continue
    const kind = rowKindName(row)
    if (!kind) continue
    ranked.push({
      kind,
      catalog: String((row && row.catalogVersion) || '').trim() ? 1 : 0,
      fields: Array.isArray(row && row.fields) ? row.fields.length : 0,
      can: Array.isArray(row && row.can) ? row.can.length : 0,
    })
  }
  if (!ranked.length) return String(fallback || '').trim()
  ranked.sort((a, b) => {
    if (b.catalog !== a.catalog) return b.catalog - a.catalog
    if (b.fields !== a.fields) return b.fields - a.fields
    return b.can - a.can
  })
  return ranked[0].kind
}

/**
 * Structured kind → connected table. Spoken shorts alias via 型槽 + graph aliases.
 * Empty-resource names that do not map to a collection are not preview targets.
 * Does not parse speech and does not leftover-suffix across unrelated kinds.
 */
export function resolveConnectedKindName(spoken, extra = {}) {
  const name = String(spoken || '').trim()
  if (!name) return ''
  const mapped = mapKind(name, extra)
  if (mapped && isCollectionStem(mapped.resource)) {
    return canonicalKindForResource(mapped.resource, extra, name)
  }
  for (const row of listKindRows(extra)) {
    const kind = rowKindName(row)
    if (!kind || kind === name) continue
    if (!oralAndGraphAliasTokens(row).includes(name)) continue
    const hit = mapKind(kind, extra)
    if (!hit || !isCollectionStem(hit.resource)) continue
    return canonicalKindForResource(hit.resource, extra, kind)
  }
  return ''
}

export function isCollectionStem(resource) {
  return /^[A-Za-z][A-Za-z0-9._-]*$/.test(String(resource || '').trim())
}

function catalogVersionOf(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.catalogVersion || '').trim()
}

function fieldCount(row) {
  return Array.isArray(row && row.fields) ? row.fields.length : 0
}

function canCount(row) {
  return Array.isArray(row && row.can) ? row.can.length : 0
}

function pickCanonicalKindRow(rows) {
  const ranked = [...rows].sort((a, b) => {
    const va = catalogVersionOf(a) ? 1 : 0
    const vb = catalogVersionOf(b) ? 1 : 0
    if (vb !== va) return vb - va
    if (fieldCount(b) !== fieldCount(a)) return fieldCount(b) - fieldCount(a)
    return canCount(b) - canCount(a)
  })
  return ranked[0]
}

function connectorResourcesFromKinds(rows, explicit) {
  if (explicit && typeof explicit === 'object') {
    const listed = explicit instanceof Set ? [...explicit] : (Array.isArray(explicit) ? explicit : [])
    const packed = new Set(listed.map((item) => String(item || '').trim()).filter(Boolean))
    if (packed.size) return packed
  }
  const fromCatalog = new Set()
  for (const row of rows) {
    const resource = rowResource(row)
    if (resource && (catalogVersionOf(row) || isCollectionStem(resource))) {
      fromCatalog.add(resource)
    }
  }
  return fromCatalog
}

function isConnectedResource(resource, connectorResources) {
  if (!resource) return false
  if (connectorResources.size) return connectorResources.has(resource)
  return isCollectionStem(resource)
}

function mergeRelationLists(list) {
  const out = []
  const seen = new Set()
  for (const row of list) {
    for (const rel of Array.isArray(row && row.relations) ? row.relations : []) {
      if (!rel || typeof rel !== 'object') continue
      const from = String(rel.from || rel.fromKind || '').trim()
      const to = String(rel.to || rel.toKind || '').trim()
      const field = String(rel.field || '').trim()
      if (!from || !to) continue
      const key = `${from}\0${to}\0${field}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(field ? { from, to, field } : { from, to })
    }
  }
  return out
}

/**
 * Graph skos rows fold onto connector tables; orphans drop. Overlay copy of BFF collapse.
 * @param {unknown} kinds
 * @param {{ connectorResources?: Iterable<string> }} [opts]
 */
export function collapseKindsToConnectedTables(kinds, opts = {}) {
  const rows = []
  for (const raw of Array.isArray(kinds) ? kinds : []) {
    const row = typeof raw === 'string'
      ? { kind: raw.trim() }
      : { ...(raw && typeof raw === 'object' ? raw : {}), kind: rowKindName(raw) }
    if (!row.kind) continue
    rows.push(row)
  }
  const connectorResources = connectorResourcesFromKinds(rows, opts.connectorResources)
  const byResource = new Map()
  for (const row of rows) {
    const resource = rowResource(row)
    if (!isConnectedResource(resource, connectorResources)) continue
    const list = byResource.get(resource) || []
    list.push({ ...row, resource })
    byResource.set(resource, list)
  }
  const collapsed = []
  const aliases = {}
  for (const [, list] of byResource) {
    const canonical = pickCanonicalKindRow(list)
    const inherited = list.flatMap((row) => oralAndGraphAliasTokens(row))
    const aliasNames = [...new Set([
      ...list.map((row) => rowKindName(row)).filter((name) => name !== canonical.kind),
      ...inherited,
    ])].filter((name) => name && name !== canonical.kind)
    const relations = mergeRelationLists(list)
    collapsed.push({
      ...canonical,
      label: canonical.label || canonical.kind,
      aliases: aliasNames,
      ...(relations.length ? { relations } : {}),
    })
    aliases[canonical.kind] = canonical.kind
    for (const name of aliasNames) aliases[name] = canonical.kind
  }
  return { kinds: collapsed, aliases }
}

/**
 * Kind may enter preview/catalog when it maps to a live connector table.
 */
export function kindPreviewableInCatalog(name, extra = {}) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return false
  const viaConnector = mapKind(trimmed, {
    collections: extra.collections,
    kinds: extra.kinds,
    maps: extra.maps,
  })
  if (viaConnector && isCollectionStem(viaConnector.resource)) return true
  if (!connectorCatalogPresent(extra)) {
    const mapped = mapKind(trimmed, extra)
    return !!(mapped && isCollectionStem(mapped.resource))
  }
  const mapped = mapKind(trimmed, extra)
  if (!mapped || !isCollectionStem(mapped.resource)) return false
  const cols = extra.collections
  if (Array.isArray(cols) && cols.length) {
    const stem = String(mapped.resource || '').trim()
    if (cols.some((row) => String((row && (row.name || row.resource)) || '').trim() === stem)) return true
    for (const row of listKindRows(extra)) {
      if (rowKindName(row) !== trimmed) continue
      if (catalogVersionOf(row)) return true
    }
    return false
  }
  return true
}

export function connectorCatalogPresent(extra = {}) {
  if (Array.isArray(extra.collections) && extra.collections.length) return true
  for (const row of [...(Array.isArray(extra.kinds) ? extra.kinds : []), ...(Array.isArray(extra.maps) ? extra.maps : [])]) {
    if (isCollectionStem(rowResource(row))) return true
  }
  return false
}

/**
 * Registered kinds, longest first so 销售订单 wins over 订单.
 */
export function registeredKinds(extra) {
  const listed = []
  for (const row of listKindRows(extra)) {
    const name = typeof row === 'string'
      ? row.trim()
      : String((row && (row.kind || row.label || row.title || row.name)) || '').trim()
    if (name && name !== '口语' && !(row && row.spoken) && !listed.includes(name)) listed.push(name)
  }
  const names = connectorCatalogPresent(extra)
    ? listed.filter((name) => kindPreviewableInCatalog(name, extra))
    : listed
  return names.sort((a, b) => b.length - a.length)
}

function listKindRows(extra) {
  if (!extra) return []
  if (Array.isArray(extra)) return extra
  return [
    ...(Array.isArray(extra.vocab) ? extra.vocab : []),
    ...(Array.isArray(extra.kinds) ? extra.kinds : []),
    ...(Array.isArray(extra.maps) ? extra.maps : []),
    ...(Array.isArray(extra.collections) ? extra.collections : []),
  ]
}

function mapFromRows(name, rows) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue
    const label = String(row.kind || row.label || row.title || '').trim()
    if (label !== name) continue
    const resource = String(row.resource || row.collection || row.name || '').trim()
    if (!isCollectionStem(resource)) continue
    const fields = ticketFieldsOf(row)
    return { resource, fields: fields.length ? fields : guessTicketFields(resource) }
  }
  return null
}

function mapFromCollections(name, collections) {
  for (const row of Array.isArray(collections) ? collections : []) {
    if (!row) continue
    const title = String(row.title || row.label || '').trim()
    const resource = String(row.name || row.resource || '').trim()
    if (!resource) continue
    if (title !== name && resource !== name) continue
    const fields = ticketFieldsOf(row)
    return { resource, fields: fields.length ? fields : guessTicketFields(resource, row.fields) }
  }
  return null
}

const SHAPE_FIELDS = new Set(['单号', '状态', '行号', '系统', '环境', '型'])

function resourceStem(resource) {
  const raw = String(resource || '').trim()
  if (!raw) return ''
  const last = raw.split('/').pop() || raw
  const parts = last.replace(/^(biz|crm|erp|oa)_/i, '').split(/[_-]/).filter(Boolean)
  if (!parts.length) return ''
  if (/^(records|items|logs|movements)$/i.test(parts[parts.length - 1])) parts.pop()
  if (!parts.length) return ''
  const end = String(parts.pop() || '').replace(/ies$/i, 'y').replace(/ses$/i, 's').replace(/s$/i, '')
  parts.push(end)
  return parts.map((part, i) => {
    const w = String(part || '').toLowerCase()
    return i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
  }).join('')
}

function guessTicketFields(resource, liveFields) {
  const names = []
  if (Array.isArray(liveFields)) {
    for (const item of liveFields) {
      const name = typeof item === 'string' ? item : (item && item.name)
      if (name && /No$|code|^no$|^id$/i.test(String(name)) && !SHAPE_FIELDS.has(String(name).trim())) names.push(String(name).trim())
    }
  }
  if (names.length) return [...new Set(names)]
  const raw = String(resource || '')
  if (/(_items|_logs|_records)$/i.test(raw)) return ['code', 'no', 'name', 'title', 'id']
  const stem = resourceStem(resource)
  const last = ((stem.match(/[A-Z]?[a-z]+$/) || [])[0] || stem)
  const guessed = /^(order|ticket|contract|voucher|request|invoice|receipt)$/i.test(last) ? [`${last}No`] : []
  return [...new Set([...guessed, 'code', 'no', 'name', 'title', 'id'])]
}

export function ticketColumns(mapped, kind) {
  const fields = Array.isArray(mapped && mapped.fields) ? mapped.fields : []
  const named = fields.map((item) => String(item || '').trim()).filter((item) => item && !SHAPE_FIELDS.has(item))
  if (named.length) return named
  return guessTicketFields(mapped && mapped.resource)
}

export function ticketColumn(mapped, kind) {
  return ticketColumns(mapped, kind)[0]
}

function ticketFieldsOf(row) {
  const raw = []
  if (row.ticketField) raw.push(row.ticketField)
  if (Array.isArray(row.fields)) {
    for (const item of row.fields) {
      const name = typeof item === 'string' ? item : (item && item.name)
      if (!name || SHAPE_FIELDS.has(String(name).trim())) continue
      raw.push(name)
    }
  }
  return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))]
}

/**
 * @param {{
 *   baseUrl?: string,
 *   token?: string,
 *   staffId?: string,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 */
export function createLookup(opts = {}) {
  const env = typeof process !== 'undefined' ? process.env : {}
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null)

  async function resolved() {
    const extra = typeof opts.resolve === 'function' ? await opts.resolve() : {}
    const packed = extra && typeof extra === 'object' ? extra : {}
    const vocab = Array.isArray(packed.vocab) ? packed.vocab : (Array.isArray(opts.vocab) ? opts.vocab : [])
    return { ...packed, vocab }
  }

  async function connections() {
    const extra = await resolved()
    const staffId = String(extra.staffId || opts.staffId || env.DSH_LAN_ASSIST_STAFF_ID || '')
    const listed = Array.isArray(extra.connections) ? extra.connections : []
    const rows = listed.map((row) => publicConn(row, staffId)).filter((row) => row.baseUrl)
    if (rows.length) return rows
    const one = publicConn({
      id: extra.id || 'default',
      dialect: extra.dialect || opts.dialect || '',
      baseUrl: extra.baseUrl || opts.baseUrl || env.DSH_LAN_ASSIST_LOOKUP_URL || '',
      token: extra.token || opts.token || env.DSH_LAN_ASSIST_LOOKUP_TOKEN || '',
      system: extra.system || '',
      env: extra.env || '',
      listPath: extra.listPath || opts.listPath || '',
      ticketField: extra.ticketField || opts.ticketField || '',
      statusField: extra.statusField || opts.statusField || '',
      ownerField: extra.ownerField || opts.ownerField || '',
      vocab: extra.vocab || opts.vocab || [],
      kinds: extra.kinds || opts.kinds || [],
      collections: extra.collections || opts.collections || [],
      staffId,
    }, staffId)
    return one.baseUrl ? [one] : []
  }

  async function config() {
    const rows = await connections()
    const first = rows[0] || {}
    return {
      baseUrl: first.baseUrl || '',
      token: first.token || '',
      staffId: first.staffId || '',
    }
  }

  async function get(path, conn) {
    if (isWritePath(path)) return { ok: false, error: 'WRITE_FORBIDDEN' }
    const baseUrl = String((conn && conn.baseUrl) || '').replace(/\/+$/, '')
    const token = String((conn && conn.token) || '')
    if (!baseUrl) return { ok: false, error: 'NO_CONNECTOR' }
    if (!fetchImpl) return { ok: false, error: 'NO_FETCH' }
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const init = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }
    if (String(init.method || '').toUpperCase() !== 'GET') return { ok: false, error: 'WRITE_FORBIDDEN' }
    let res
    try {
      res = await fetchImpl(url, init)
    } catch {
      return { ok: false, error: 'UNREACHABLE' }
    }
    if (res.status === 401 || res.status === 403) {
      const body = await readJson(res)
      if (res.status === 401 || /expired|auth required|unauthorized/i.test(JSON.stringify(body))) {
        return { ok: false, error: 'EXPIRED' }
      }
      return { ok: false, error: 'FORBIDDEN' }
    }
    if (!res.ok) return { ok: false, error: 'LOOKUP' }
    return { ok: true, body: await readJson(res) }
  }

  function pageCount(body) {
    const meta = body && (body.meta || body.pageMeta || {})
    const total = Number(meta.totalPage || meta.totalPages || meta.pages || 0)
    if (Number.isFinite(total) && total > 0) return total
    const count = Number(meta.count || meta.total || 0)
    const size = Number(meta.pageSize || meta.limit || 50)
    if (Number.isFinite(count) && count > 0 && Number.isFinite(size) && size > 0) return Math.ceil(count / size)
    return 1
  }

  function rowKey(row) {
    if (!row || typeof row !== 'object') return ''
    if (row.id != null) return `id:${row.id}`
    const no = row.orderNo || row.ticketNo || row.contractNo || row.paymentNo
      || row.requestNo || row.code || row.no
    return no ? `no:${no}` : ''
  }

  async function listAll(path, conn, opts = {}) {
    const keep = typeof opts.keep === 'function' ? opts.keep : () => true
    const limit = Number(opts.limit)
    const cap = Number.isFinite(limit) && limit > 0 ? limit : PAGE_SIZE
    const first = await get(path, conn)
    if (!first.ok) return first
    const seen = new Set()
    const rows = []
    function take(chunk) {
      let fresh = 0
      for (const row of Array.isArray(chunk) ? chunk : []) {
        const key = rowKey(row)
        if (key && seen.has(key)) continue
        if (!keep(row)) continue
        if (key) seen.add(key)
        rows.push(row)
        fresh += 1
        if (rows.length >= cap) return true
      }
      return fresh
    }
    if (take(listRows(first.body)) === true) return { ok: true, body: first.body, rows }
    const known = pageCount(first.body)
    if (known <= 1) return { ok: true, body: first.body, rows }
    const joiner = path.includes('?') ? '&' : '?'
    const hard = Math.min(known, 500)
    for (let page = 2; page <= hard; page += 1) {
      if (rows.length >= cap) break
      const next = await get(`${path}${joiner}page=${page}`, conn)
      if (!next.ok) break
      const chunk = listRows(next.body)
      if (!chunk.length) break
      if (take(chunk) === true) break
    }
    return { ok: true, body: first.body, rows }
  }

  let collectionsCache = []
  async function collectionsOf(conn, { needEnums } = {}) {
    const local = Array.isArray(conn.collections) ? conn.collections : []
    const cached = local.length ? local : collectionsCache
    if (cached.length && (!needEnums || collectionsCarryEnums(cached))) {
      if (!local.length) conn.collections = cached
      return cached
    }
    if (conn.dialect === 'rest') return cached
    const found = await get('/api/collections:list?paginate=false&fields=name,title,fields', conn)
    if (!found.ok) return cached
    const loaded = listRows(found.body).map((row) => ({
      name: String((row && (row.name || row.key)) || '').trim(),
      title: String((row && (row.title || row.label)) || '').trim(),
      fields: Array.isArray(row && row.fields) ? row.fields : [],
    })).filter((row) => row.name)
    if (loaded.length) {
      collectionsCache = loaded
      conn.collections = loaded
    }
    return loaded.length ? loaded : cached
  }

  async function probeOne(conn, { kind, no, workspace, staffId: seat, vocab, mapped, speech, related, asAsk, where, join } = {}) {
    const ticket = String(no || '').trim()
    const staffId = String(seat || conn.staffId || '')
    const extra = {
      vocab: vocab || conn.vocab,
      collections: conn.collections,
      kind,
      where,
    }
    const collections = await collectionsOf(conn, { needEnums: true })
    extra.collections = collections
    const known = (mapped && mapped.resource ? mapped : null) || mapKind(kind, {
      vocab: vocab || conn.vocab,
      kinds: conn.kinds,
      collections,
    })
    const ticketNameRest = ticket && !looksLikeRef(ticket) ? ticket : ''
    const clues = Array.isArray(where) && where.length
      ? { ...cluesFromWhere(where, join), rest: ticketNameRest }
      : mergeClues(ticket)
    const spec = known || mapKind(kind, {
      vocab: vocab || conn.vocab,
      kinds: conn.kinds,
      collections,
    })
    if (!spec && conn.dialect !== 'rest') return { ok: false, error: 'UNKNOWN_KIND' }
    const schemaFields = collectionFields(spec && spec.resource, collections)
    const vocabRows = [
      ...(Array.isArray(vocab) ? vocab : []),
      ...(Array.isArray(conn.vocab) ? conn.vocab : []),
      ...(Array.isArray(conn.kinds) ? conn.kinds : []),
    ]
    const vocabHit = vocabRow(kind, vocabRows)
    const rawFieldLabels = fieldLabelsFromRawCollection(spec && spec.resource, collections)
    clues.terms = bindWhereKeys(clues.terms || [], kind, vocabRows, schemaFields, rawFieldLabels)
    clues.terms = bindClueEnums(clues.terms, schemaFields)
    clues.terms = expandNegatedClosedValues(clues.terms, schemaFields, kind, vocabRows)
    clues.terms = clues.terms.filter((term) => termFitsCollection(term, schemaFields, vocabHit, rawFieldLabels))
    if (Array.isArray(where) && where.length && !clues.terms.length && !looksLikeRef(ticket)) {
      return {
        ok: false,
        error: 'WHERE_UNBOUND',
        status: '没有',
        matches: [],
        hint: '筛选条件没对上词表列名，不能整表现查。',
      }
    }
    const whereLimit = listLimitForWhere(clues.terms.length ? where : [])
    const fields = clueFields(conn, spec)
    const ids = ticketColumns(spec)
    const relatedIds = relatedIdsOf(related)
    if (related && related.kind && conn.dialect !== 'rest') {
      if (!relatedIds.length) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [] }
      const resource = spec && spec.resource
      if (!resource) return { ok: false, error: 'UNKNOWN_KIND' }
      const path = withRelationAppends(relatedListPath(resource, related, kind, clues, extra), extra.collections, resource)
      if (!path) return { ok: false, error: 'UNKNOWN_KIND' }
      const fk = (related && related.field) || relatedFilterField(related.kind, kind, {}, extra) || relatedField(related.kind, kind, extra)
      if (!fk) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [] }
      const listed = await listAll(path, conn, {
        limit: whereLimit,
        keep: (row) => {
          if (!relatedIds.includes(relatedIdOf(row, fk))) return false
          if (clues.terms.length && !rowMatchesAll(row, clues.terms, clues.join || 'and')) return false
          if (clues.rest && !looksLikeRef(clues.rest) && !rowMatches(row, clues.rest, identityNameKeys(fields, schemaFields))) return false
          return true
        },
      })
      if (!listed.ok) return listed
      const hit = listed.rows
      const matches = hit.map((row) => ({
        no: pickNo(row, ids, extra),
        status: pickStatus(row, conn.statusField),
        fields: packMatchFields(row, fields),
      })).filter((item) => item.no || (item.fields && Object.keys(item.fields).length))
      if (!matches.length) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [] }
      return {
        ok: true,
        ambiguous: matches.length > 1,
        listed: true,
        matches,
        status: matches.length > 1 ? '多条' : matches[0].status,
        no: matches.length === 1 ? matches[0].no : '',
        fields: matches.length === 1 ? matches[0].fields : {},
        fingerprint: `${kind || ''}:related:${matches.map((item) => item.no).join(',')}`,
        workspace: workspace || '',
        system: conn.system || '',
        env: conn.env || '',
        connectionId: conn.id || '',
        dialect: conn.dialect || 'nocobase',
      }
    }
    const nameRest = String(clues.rest || '').trim()
    const hasNameRest = !!(nameRest && !looksLikeRef(nameRest))
    const nameKeys = identityNameKeys(fields, schemaFields)
    if ((clues.terms.length || hasNameRest) && conn.dialect !== 'rest') {
      const resource = spec && spec.resource
      if (!resource) return { ok: false, error: 'UNKNOWN_KIND' }
      const listPath = withRelationAppends(`/api/${resource}:list?pageSize=${PAGE_SIZE}&sort=-updatedAt`, extra.collections, resource)
      const filteredPath = withRelationAppends(nameCluePath(resource, ticket, nameKeys, clues), extra.collections, resource)
      const dateClue = (clues.terms || []).some((term) => (
        (Array.isArray(term.dateBefore) && term.dateBefore.length)
        || (Array.isArray(term.dateAfter) && term.dateAfter.length)
      ))
      const firstPath = dateClue ? listPath : filteredPath
      const matchRow = (row) => {
        if (looksLikeRef(ticket)) {
          const no = pickNo(row, ids, extra)
          if (String(no || '') !== String(ticket) && !rowMatches(row, ticket, ids)) return false
        }
        if (clues.terms.length && !rowMatchesAll(row, clues.terms, clues.join || 'and')) return false
        if (clues.rest && !looksLikeRef(clues.rest) && !rowMatches(row, clues.rest, nameKeys)) return false
        if (!clues.terms.length && nameRest) return rowMatches(row, nameRest, nameKeys)
        return clues.terms.length || hasNameRest || !!clues.rest || looksLikeRef(ticket)
      }
      let listed = await listAll(firstPath, conn, { limit: whereLimit, keep: matchRow })
      if (!listed.ok && listed.error === 'LOOKUP') {
        listed = await listAll(listPath, conn, { limit: whereLimit, keep: matchRow })
      }
      if (!listed.ok) return listed
      let hit = listed.rows
      if (!hit.length && clues.terms.length && firstPath !== listPath) {
        const again = await listAll(listPath, conn, { limit: whereLimit, keep: matchRow })
        if (again.ok) hit = again.rows
      }
      const matches = hit.map((row) => ({
        no: pickNo(row, ids, extra),
        status: pickStatus(row, conn.statusField),
        fields: packMatchFields(row, fields),
      })).filter((item) => item.no || (item.fields && Object.keys(item.fields).length))
      if (!matches.length) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [], rest: nameRest }
      if (matches.length > 1) {
        return {
          ok: true,
          ambiguous: true,
          matches,
          status: '多条',
          fingerprint: `${ticket}:ambiguous:${matches.map((item) => item.no).join(',')}`,
          workspace: workspace || '',
          system: conn.system || '',
          env: conn.env || '',
          connectionId: conn.id || '',
          dialect: conn.dialect || 'nocobase',
        }
      }
      const row = hit[0]
      const status = pickStatus(row, conn.statusField)
      const owner = pickOwner(row, conn.ownerField)
      const mine = !staffId ? undefined : owner ? owner === staffId : true
      const resolvedNo = matches[0].no
      return {
        ok: true,
        status,
        no: resolvedNo,
        matches,
        fields: matches[0].fields,
        fingerprint: `${resolvedNo}:${status}:${row.updatedAt || row.updated_at || ''}`,
        mine,
        workspace: workspace || '',
        system: conn.system || '',
        env: conn.env || '',
        connectionId: conn.id || '',
        dialect: conn.dialect || 'nocobase',
      }
    }
    if (conn.dialect === 'rest' && (hasNameRest || clues.terms.length)) {
      const look = nameRest
      const restLook = restPath(conn, look, kind)
      if (!restLook) return { ok: false, error: 'UNKNOWN_KIND' }
      const foundRest = await get(restLook, conn)
      if (!foundRest.ok) return foundRest
      const hit = listRows(foundRest.body).filter((row) => {
        if (clues.terms.length && !rowMatchesAll(row, clues.terms, clues.join || 'and')) return false
        if (look) return rowMatches(row, look, fields.length ? fields : Object.keys(row || {}))
        return !!clues.terms.length
      })
      const matches = hit.map((row) => ({
        no: pickNo(row, ids, extra),
        status: pickStatus(row, conn.statusField),
        fields: packMatchFields(row, fields),
      })).filter((item) => item.no || (item.fields && Object.keys(item.fields).length))
      if (!matches.length) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [], rest: nameRest }
      return {
        ok: true,
        ...(matches.length > 1 ? { ambiguous: true } : {}),
        matches,
        status: matches.length > 1 ? '多条' : matches[0].status,
        no: matches.length === 1 ? matches[0].no : '',
        fields: matches.length === 1 ? matches[0].fields : {},
        fingerprint: `${kind || ''}:rest-name:${matches.map((item) => item.no).join(',')}`,
        workspace: workspace || '',
        system: conn.system || '',
        env: conn.env || '',
        connectionId: conn.id || '',
        dialect: 'rest',
      }
    }
    const exactNo = looksLikeRef(ticket) ? ticket : ''
    const path = conn.dialect === 'rest' ? restPath(conn, exactNo, kind) : withRelationAppends(nocobasePath(spec, exactNo, kind), extra.collections, spec && spec.resource)
    if (!path) return { ok: false, error: 'UNKNOWN_KIND' }
    const found = await get(path, conn)
    if (!found.ok) return found
    if (!exactNo) {
      const listed = listRows(found.body).slice(0, 50)
      const matches = listed.map((row) => ({
        no: pickNo(row, ids, extra),
        status: pickStatus(row, conn.statusField),
        fields: packMatchFields(row, fields),
      })).filter((item) => item.no)
      if (!matches.length) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [] }
      return {
        ok: true,
        ambiguous: matches.length > 1,
        listed: true,
        matches,
        status: matches.length > 1 ? '多条' : matches[0].status,
        no: matches.length === 1 ? matches[0].no : '',
        fields: matches.length === 1 ? matches[0].fields : {},
        fingerprint: `${kind || ''}:list:${matches.map((item) => item.no).join(',')}`,
        workspace: workspace || '',
        system: conn.system || '',
        env: conn.env || '',
        connectionId: conn.id || '',
        dialect: conn.dialect || 'nocobase',
      }
    }
    const resolved = resolveRows(listRows(found.body), ticket, ids, {
      statusField: conn.statusField,
      ownerField: conn.ownerField,
      vocab: extra.vocab,
    })
    if (!resolved.ok) return { ok: false, error: 'NOT_FOUND', status: '没有', matches: [] }
    const matches = resolved.matches.map((item) => ({
      no: item.no,
      status: pickStatus(item.row, conn.statusField),
      fields: packMatchFields(item.row, fields),
    }))
    if (resolved.ambiguous) {
      return {
        ok: true,
        ambiguous: true,
        matches,
        status: '多条',
        fingerprint: `${ticket}:ambiguous:${matches.map((item) => item.no).join(',')}`,
        workspace: workspace || '',
        system: conn.system || '',
        env: conn.env || '',
        connectionId: conn.id || '',
        dialect: conn.dialect || 'nocobase',
      }
    }
    const row = resolved.row
    const status = pickStatus(row, conn.statusField)
    const owner = pickOwner(row, conn.ownerField)
    const mine = !staffId ? undefined : owner ? owner === staffId : true
    const resolvedNo = resolved.no || pickNo(row, ids, extra)
    return {
      ok: true,
      status,
      no: resolvedNo,
      matches,
      fields: packMatchFields(row, fields),
      fingerprint: `${resolvedNo}:${status}:${row.updatedAt || row.updated_at || ''}`,
      mine,
      workspace: workspace || '',
      system: conn.system || '',
      env: conn.env || '',
      connectionId: conn.id || '',
      dialect: conn.dialect || 'nocobase',
    }
  }

  async function lookupTodo({ kind, no, workspace, staffId: seat, vocab, mapped, speech, related, asAsk, where, join } = {}) {
    const ticket = String(no || '').trim()
    if (!ticket && !String(kind || '').trim()) return { ok: false, error: 'NO_REF' }
    const extra = await resolved()
    const rows = await connections()
    if (!rows.length) return { ok: false, error: 'NO_CONNECTOR' }
    let last = { ok: false, error: 'LOOKUP' }
    for (const conn of rows) {
      const found = await probeOne(conn, {
        kind,
        no: ticket,
        workspace,
        staffId: seat,
        vocab: vocab || extra.vocab || conn.vocab,
        mapped,
        speech,
        related,
        asAsk,
        where,
        join,
      })
      if (found.ok) return found
      last = found
      if (found.error === 'EXPIRED' || found.error === 'WRITE_FORBIDDEN') return found
    }
    return last
  }

  async function fieldsOf(kind, vocab) {
    const extra = await resolved()
    const rows = await connections()
    const conn = rows[0]
    if (!conn) return []
    const collections = await collectionsOf(conn, { needEnums: true })
    const mapped = mapKind(kind, {
      vocab: vocab || extra.vocab || conn.vocab,
      kinds: conn.kinds,
      collections,
    })
    if (!mapped || !mapped.resource) return []
    return collectionFields(mapped.resource, collections)
  }

  async function collectionsFor() {
    const rows = await connections()
    const conn = rows[0]
    if (!conn) return []
    return collectionsOf(conn, { needEnums: true })
  }

  return {
    lookupTodo,
    fieldsOf,
    collectionsFor,
    isWritePath,
    async configured() {
      const rows = await connections()
      return rows.length > 0
    },
  }
}

export function collectionsCarryEnums(rows) {
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const item of [].concat((row && row.fields) || [])) {
      if (!item || typeof item !== 'object') continue
      if (Object.keys(enumMap(item)).length) return true
      if (/^(m2o|o2o|belongsTo|select)$/i.test(String(item.interface || item.type || ''))) return true
    }
  }
  return false
}

export function collectionFields(resource, collections) {
  const want = String(resource || '').trim()
  if (!want) return []
  for (const row of Array.isArray(collections) ? collections : []) {
    const name = String((row && (row.name || row.resource)) || '').trim()
    if (name !== want) continue
    const out = []
    for (const item of [].concat((row && row.fields) || [])) {
      if (!item) continue
      if (typeof item === 'string') {
        if (item.trim()) out.push({ name: item.trim(), title: '' })
        continue
      }
      const field = String(item.name || '').trim()
      if (!field) continue
      const ui = item.uiSchema && typeof item.uiSchema === 'object' ? item.uiSchema : {}
      const title = String(ui.title || item.title || item.label || '').trim()
      const packed = { name: field, title }
      const iface = String(item.interface || item.type || '').trim()
      if (iface) packed.interface = iface
      const target = String(item.target || '').trim()
      if (target) packed.target = target
      const enums = enumMap(item)
      if (Object.keys(enums).length) packed.enums = enums
      out.push(packed)
    }
    return out
  }
  return []
}

export function bindClueEnums(terms, schemaFields) {
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  return (Array.isArray(terms) ? terms : []).map((term) => {
    if (!term || typeof term !== 'object') return term
    const values = (term.values || []).map((raw) => {
      const want = String(raw || '').trim()
      for (const key of term.keys || []) {
        const hit = fields.find((row) => row && row.name === key)
        const enums = hit && ((hit.enums && Object.keys(hit.enums).length && hit.enums) || enumMap(hit))
        if (!enums || typeof enums !== 'object') continue
        for (const [code, label] of Object.entries(enums)) {
          if (String(code) === want || String(label || '') === want) return code
        }
      }
      return want
    })
    return { ...term, values }
  })
}

export function termFitsCollection(term, schemaFields, vocabHit, extraLabels) {
  const keys = Array.isArray(term && term.keys) ? term.keys : []
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const hasDate = (Array.isArray(term.dateBefore) && term.dateBefore.length)
    || (Array.isArray(term.dateAfter) && term.dateAfter.length)
  if (hasDate) return true
  if (!keys.length) return true
  const hit = fields.find((row) => row && keys.some((key) => {
    const resolved = resolveShapeKey(key, fields, vocabHit, extraLabels)
    return row.name === resolved || row.name === key
  }))
  if (!hit) {
    if (keys.some((key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key || '')))) return true
    return !fields.length
  }
  return true
}

export function relationAppends(collections, resource) {
  return collectionFields(resource, collections)
    .filter((row) => row && /^(m2o|o2o|belongsTo)$/i.test(String(row.interface || '')) && !/^(createdBy|updatedBy)$/i.test(String(row.name || '')))
    .map((row) => row.name)
}

export function withRelationAppends(path, collections, resource) {
  const base = String(path || '')
  if (!base || /appends/.test(base)) return base
  const names = relationAppends(collections, resource)
  if (!names.length) return base
  const join = base.includes('?') ? '&' : '?'
  return base + join + names.map((name) => `appends[]=${encodeURIComponent(name)}`).join('&')
}

const FIELD_ALIASES = {
  remark: ['remark', 'remarks', 'notes', 'note', '备注'],
  remarks: ['remarks', 'remark', 'notes', 'note', '备注'],
  notes: ['notes', 'note', 'remarks', 'remark', '备注'],
  备注: ['备注', 'remarks', 'remark', 'notes', 'note'],
  phone: ['phone', 'mobile', 'tel', 'telephone', '电话', '手机'],
  mobile: ['mobile', 'phone', 'tel', '电话', '手机'],
  address: ['address', 'addr', '地址'],
  地址: ['地址', 'address', 'addr'],
}

export function schemaHasField(names, key) {
  const listed = new Set((Array.isArray(names) ? names : []).map((item) => {
    if (!item) return ''
    if (typeof item === 'string') return item.trim()
    return String(item.name || '').trim()
  }).filter(Boolean))
  if (!listed.size) return false
  const want = String(key || '').trim()
  if (!want) return false
  if (listed.has(want)) return true
  return (FIELD_ALIASES[want] || []).some((name) => listed.has(name))
}

export function writableFieldChoices(fields) {
  return (Array.isArray(fields) ? fields : []).map((item) => {
    if (!item) return null
    const row = typeof item === 'string' ? { name: item, title: '' } : { name: String(item.name || '').trim(), title: String(item.title || '').trim() }
    if (!row.name) return null
    if (/^(id|createdAt|updatedAt|createdBy|updatedBy|createdById|updatedById)$/i.test(row.name)) return null
    if (/Id$|_id$/.test(row.name)) return null
    return { name: row.name, title: row.title || row.name }
  }).filter(Boolean)
}

function publicConn(row, staffId) {
  const item = row && typeof row === 'object' ? row : {}
  const dialect = String(item.dialect || 'nocobase').trim() || 'nocobase'
  return {
    id: String(item.id || 'default'),
    dialect: dialect === 'rest' ? 'rest' : 'nocobase',
    baseUrl: String(item.baseUrl || '').replace(/\/+$/, ''),
    token: String(item.token || ''),
    system: String(item.system || '').trim(),
    env: String(item.env || '').trim(),
    listPath: String(item.listPath || '').trim(),
    ticketField: String(item.ticketField || '').trim(),
    statusField: String(item.statusField || '').trim(),
    ownerField: String(item.ownerField || '').trim(),
    writePath: String(item.writePath || item.updatePath || '').trim(),
    writeMethod: String(item.writeMethod || '').trim(),
    kinds: Array.isArray(item.kinds) ? item.kinds : [],
    collections: Array.isArray(item.collections) ? item.collections : [],
    vocab: Array.isArray(item.vocab) ? item.vocab : [],
    staffId: String(item.staffId || staffId || ''),
  }
}

export function mergeClues(ticket) {
  const raw = String(ticket || '').trim()
  return { terms: [], rest: raw, join: 'and' }
}

export function selfFk(kind, extra) {
  const mapped = mapKind(kind, extra || {})
  const stem = resourceStem(mapped && mapped.resource)
  if (stem) return `${stem}Id`
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(String(kind || ''))) {
    return `${String(kind).replace(/s$/i, '')}Id`
  }
  return ''
}

/** Schema/collection FK only — never the selfFk fallback used by relatedField. */
export function schemaRelatedField(fromKind, toKind, extra) {
  return relationFieldFromCollections(fromKind, toKind, extra)
}

function relationFieldFromCollections(fromKind, toKind, extra) {
  const from = String(fromKind || '').trim()
  const to = String(toKind || '').trim()
  if (!from || !to || from === to) return ''
  const child = mapKind(to, extra || {})
  const parent = mapKind(from, extra || {})
  const childResource = child && child.resource
  const parentResource = parent && parent.resource
  if (!childResource || !parentResource) return ''
  for (const row of collectionFields(childResource, extra && extra.collections)) {
    if (!row) continue
    const target = String(row.target || '').trim()
    if (target !== parentResource) continue
    const iface = String(row.interface || row.type || '').trim()
    if (!/^(m2o|o2o|belongsTo|select)$/i.test(iface)) continue
    const name = String(row.name || '').trim()
    if (name && !/^(createdBy|updatedBy)$/i.test(name)) {
      const fields = collectionFields(childResource, extra && extra.collections)
      const idName = name.endsWith('Id') ? name : `${name}Id`
      if (fields.some((f) => String(f && f.name || '') === idName)) return idName
      return name
    }
  }
  return ''
}

export function relatedField(fromKind, toKind, extra) {
  const from = String(fromKind || '').trim()
  const to = String(toKind || '').trim()
  if (!from || !to || from === to) return ''
  const fromSchema = relationFieldFromCollections(from, to, extra)
  if (fromSchema) return fromSchema
  for (const row of Array.isArray(extra && extra.vocab) ? extra.vocab : []) {
    const rels = Array.isArray(row && row.relations) ? row.relations : []
    for (const rel of rels) {
      if (!rel || typeof rel !== 'object') continue
      const frm = String(rel.from || rel.fromKind || '').trim()
      const dest = String(rel.to || rel.toKind || '').trim()
      const field = String(rel.field || '').trim()
      if (frm !== from || dest !== to || !field) continue
      const child = mapKind(to, extra || {})
      const fields = collectionFields(child && child.resource, extra && extra.collections)
      const idName = field.endsWith('Id') ? field : `${field}Id`
      if (fields.some((item) => String(item && item.name || '') === idName)) return idName
      if (fields.some((item) => String(item && item.name || '') === field)) return field
      return idName
    }
  }
  return selfFk(from, extra)
}

/**
 * Id to filter the child table with. A carried xxxId counts only when it
 * is the self-FK of a registered kind (合同.customerId → 客户). Owner /
 * assignee ids are people, not kinds, so they never hop.
 */
function registeredFkNames(extra) {
  const names = new Set()
  for (const kind of registeredKinds(extra)) {
    const fk = selfFk(kind, extra)
    if (fk) names.add(fk)
  }
  return names
}

function carriedFk(own, self, extra) {
  const allowed = registeredFkNames(extra)
  const keys = Object.keys(own || {})
  const named = keys.find((key) => (
    /Id$|_id$/.test(key)
    && key !== self
    && allowed.has(key)
    && relatedIdOf(own, key)
  ))
  if (named) return named
  const nested = keys.find((key) => {
    if (key === 'id' || /Id$|_id$/.test(key)) return false
    if (!allowed.has(`${key}Id`)) return false
    const value = own[key]
    return value && typeof value === 'object' && (value.id != null || value.code != null)
  })
  return nested ? `${nested}Id` : ''
}

export function relatedFilterField(fromKind, toKind, fields, extra) {
  const own = fields && typeof fields === 'object' ? fields : {}
  const self = selfFk(fromKind, extra)
  const carried = carriedFk(own, self, extra)
  if (carried) return carried
  return relatedField(fromKind, toKind, extra) || self
}

export function relatedHopId(fromKind, toKind, fields, extra) {
  const own = fields && typeof fields === 'object' ? fields : {}
  const fk = relatedField(fromKind, toKind, extra)
  const self = selfFk(fromKind, extra)
  if (fk && fk !== self) {
    const carried = relatedIdOf(own, fk)
    if (carried) return carried
  }
  if (own.id != null && String(own.id).trim()) return String(own.id).trim()
  const carried = carriedFk(own, self, extra)
  if (carried) return relatedIdOf(own, carried)
  return ''
}

export function relatedChildId(fromKind, toKind, fields, extra) {
  const own = fields && typeof fields === 'object' ? fields : {}
  const hop = relatedField(fromKind, toKind, extra)
  if (hop && relatedIdOf(own, hop)) return relatedIdOf(own, hop)
  const fk = relatedFilterField(fromKind, toKind, own, extra)
  return fk ? relatedIdOf(own, fk) : ''
}

function packMatchFields(row, fields) {
  const packed = visibleFields(row, fields)
  if (row && row.id != null && packed.id == null) packed.id = String(row.id)
  if (!row || typeof row !== 'object') return packed
  for (const key of Object.keys(row)) {
    if (/Id$|_id$/.test(key)) {
      const id = relatedIdOf(row, key)
      if (id) packed[key] = id
      continue
    }
    const value = row[key]
    if (value && typeof value === 'object' && (value.id != null || value.code != null)) {
      const id = unwrapRelatedId(value)
      if (id) packed[`${key}Id`] = id
    }
  }
  return packed
}

function relatedSpeak(raw) {
  if (!raw || typeof raw !== 'object') return ''
  if (Array.isArray(raw)) return raw.map((item) => relatedSpeak(item) || unwrapRelatedId(item)).filter(Boolean).join('、')
  const noKey = Object.keys(raw).find((key) => /(?:No|_no)$/.test(key) && raw[key] != null && String(raw[key]).trim())
  if (noKey) return String(raw[noKey]).trim()
  return String(raw.name || raw.nickname || raw.username || raw.code || raw.title || raw.email || '').trim()
}

function unwrapRelatedId(raw) {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'object') return String(raw.id || raw.code || '').trim()
  return String(raw).trim()
}

function relatedIdOf(row, field) {
  if (!row || !field) return ''
  const direct = unwrapRelatedId(row[field])
  if (direct) return direct
  if (/Id$/.test(field)) return unwrapRelatedId(row[field.slice(0, -2)])
  const idField = `${field}Id`
  const viaId = unwrapRelatedId(row[idField])
  if (viaId) return viaId
  return ''
}

function relatedIdsOf(related) {
  if (!related || typeof related !== 'object') return []
  const listed = Array.isArray(related.ids) ? related.ids : [related.id]
  return [...new Set(listed.map((item) => String(item == null ? '' : item).trim()).filter(Boolean))]
}

function relatedListPath(resource, related, toKind, clues, extra) {
  const ids = relatedIdsOf(related)
  if (!ids.length) return ''
  const field = (related && related.field)
    || relatedFilterField(related && related.kind, toKind, { [(related && related.field) || '']: related && related.id }, extra)
    || relatedField(related && related.kind, toKind, extra)
    || selfFk(related && related.kind, extra)
  if (!field) return ''
  const parts = [ids.length === 1 ? { [field]: ids[0] } : { [field]: { $in: ids } }]
  const terms = clues && Array.isArray(clues.terms) ? clues.terms : []
  const schemaFields = collectionFields(resource, extra && extra.collections)
  const vocabHit = vocabRow(toKind, extra && extra.vocab)
  const rawFieldLabels = fieldLabelsFromRawCollection(resource, extra && extra.collections)
  for (const term of terms) {
    const key = (term.keys || [])
      .map((item) => resolveShapeKey(item, schemaFields, vocabHit, rawFieldLabels))
      .find((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
    const vals = (term.values || []).map((item) => String(item || '').trim()).filter(Boolean)
    if (!key || !vals.length) continue
    parts.push(term.not
      ? (vals.length === 1 ? { [key]: { $ne: vals[0] } } : { [key]: { $notIn: vals } })
      : (vals.length === 1 ? { [key]: vals[0] } : { [key]: { $in: vals } }))
  }
  const clause = parts.length === 1 ? parts[0] : { $and: parts }
  const filter = encodeURIComponent(JSON.stringify(clause))
  return `/api/${resource}:list?pageSize=${PAGE_SIZE}&sort=-updatedAt&filter=${filter}`
}

function clueFields(conn, spec) {
  const extras = [
    conn && conn.ticketField,
    spec && spec.fields,
    'orderNo', 'code', 'no', 'name', 'title', 'category', 'priority', 'remark', 'address',
  ].flat().map((item) => String(item || '').trim()).filter(Boolean)
  return [...new Set(extras)]
}

function termFilterPart(term, today) {
  const packed = whereTermFilterPart(term, today)
  if (packed) return packed
  const dateParts = (Array.isArray(term.dateBefore) ? term.dateBefore : [])
    .map((item) => String(item || '').trim())
    .filter((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
    .map((item) => ({ [item]: { $lt: today } }))
  if (!dateParts.length) return null
  return dateParts.length === 1 ? dateParts[0] : { $or: dateParts }
}

function identityNameKeys(fields, schemaFields) {
  const named = []
  for (const field of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((field && field.name) || '').trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue
    const title = String((field && (field.title || (field.uiSchema && field.uiSchema.title))) || '')
    if (/^(name|title)$/i.test(name) || /名称/.test(title)) named.push(name)
  }
  if (named.length) return [...new Set(named)]
  const fallback = (Array.isArray(fields) ? fields : [])
    .map((item) => String(item || '').trim())
    .filter((item) => /^(name|title)$/i.test(item))
  return fallback.length ? fallback : ['name', 'title']
}

function nameCluePath(resource, ticket, fields, clues) {
  const terms = clues && Array.isArray(clues.terms) ? clues.terms : []
  const today = new Date().toISOString().slice(0, 10)
  const packed = groupClueTerms(terms, (clues && clues.join) || 'and')
  const parts = packed.groups.map((group) => {
    const slice = group.map((term) => termFilterPart(term, today)).filter(Boolean)
    if (!slice.length) return null
    return slice.length === 1 ? slice[0] : { $or: slice }
  }).filter(Boolean)
  const rest = String((clues && clues.rest) || '').trim()
  if (rest && !looksLikeRef(rest)) {
    const keys = identityNameKeys(fields, [])
      .map((item) => String(item || '').trim())
      .filter((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
    const ors = keys.map((field) => ({ [field]: { $includes: rest } }))
    if (ors.length === 1) parts.push(ors[0])
    else if (ors.length) parts.push({ $or: ors })
  }
  if (!parts.length) return `/api/${resource}:list?pageSize=${PAGE_SIZE}&sort=-updatedAt`
  const join = packed.join === 'or' ? '$or' : '$and'
  const clause = parts.length === 1 ? parts[0] : { [join]: parts }
  const filter = encodeURIComponent(JSON.stringify(clause))
  return `/api/${resource}:list?pageSize=${PAGE_SIZE}&sort=-updatedAt&filter=${filter}`
}

export function nocobasePath(kindOrSpec, ticket, kind) {
  const spec = kindOrSpec && typeof kindOrSpec === 'object' && kindOrSpec.resource
    ? kindOrSpec
    : mapKind(kindOrSpec || kind)
  if (!spec) return ''
  const resource = spec.resource
  const fields = ticketColumns(spec, kind || spec.kind)
  const parent = ticket.includes(':') ? ticket.split(':')[0] : ticket
  const look = /(_items|_logs|_records)$/i.test(String(spec.resource || '')) ? parent : ticket
  if (!String(ticket || '').trim()) {
    return `/api/${resource}:list?pageSize=${PAGE_SIZE}&sort=-updatedAt`
  }
  if (!looksLikeRef(look)) {
    return `/api/${resource}:list?pageSize=${PAGE_SIZE}&sort=-updatedAt`
  }
  const ident = /^\d{6,}$/.test(look) ? ['id', ...fields] : fields
  const keys = [...new Set(ident.filter(Boolean))]
  const clause = keys.length === 1
    ? { [keys[0]]: look }
    : { $or: keys.map((field) => ({ [field]: look })) }
  const filter = encodeURIComponent(JSON.stringify(clause))
  return `/api/${resource}:list?pageSize=1&filter=${filter}`
}

function restPath(conn, ticket, kind) {
  const raw = String(conn.listPath || '').trim() || '/{no}'
  const field = String(conn.ticketField || 'no').trim() || 'no'
  const q = encodeURIComponent(ticket)
  let path = raw
    .replace(/\{no\}|\{ticket\}/g, q)
    .replace(/\{q\}|\{query\}/g, q)
    .replace(/\{kind\}/g, encodeURIComponent(kind || ''))
    .replace(/\{field\}/g, encodeURIComponent(field))
  if (!/\{no\}|\{ticket\}|\{q\}|\{query\}/.test(raw) && !path.includes(q)) {
    const key = looksLikeTicket(ticket) ? field : 'q'
    path += (path.includes('?') ? '&' : '?') + `${encodeURIComponent(key)}=${q}`
  }
  return path.startsWith('/') ? path : `/${path}`
}

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const STATUS_SPEAK = new Map([
  ['pending', '待审'], ['open', '待审'], ['submitted', '待审'],
  ['approved', '已过'], ['posted', '已过'],
  ['rejected', '已驳回'],
])

function pickStatus(row, field) {
  const raw = (field && row[field]) || row.status || row.stage || row.state || row.workflowStatus || ''
  if (raw && typeof raw === 'object') {
    const label = raw.label || raw.title || raw.name || raw.value
    if (label != null && String(label).trim()) return String(label).trim()
  }
  const s = String(raw == null ? '' : raw).trim()
  if (!s) return '未知'
  if (/[\u4e00-\u9fff]/.test(s)) return s
  const hit = STATUS_SPEAK.get(s) || STATUS_SPEAK.get(s.toLowerCase())
  if (hit) return hit
  if (/pending|open|submitted/i.test(s)) return '待审'
  if (/approved|posted/i.test(s)) return '已过'
  if (/rejected/i.test(s)) return '已驳回'
  return s
}

function visibleFields(row, known) {
  if (!row || typeof row !== 'object') return {}
  const skip = new Set(['createdAt', 'createdById', 'updatedById', 'created_at', 'updated_at'])
  const out = {}
  const keys = [...new Set([...(known || []), ...Object.keys(row)])]
  for (const key of keys) {
    if (!key || skip.has(key) || ((key.endsWith('Id') || key.endsWith('_id')) && key !== 'id')) continue
    const value = row[key]
    if (value == null || value === '') continue
    if (typeof value === 'object') {
      const label = relatedSpeak(value)
      if (label) out[key] = label
      continue
    }
    out[key] = String(value)
  }
  return out
}

function pickOwner(row, field) {
  const owner = (field && row[field]) || row.owner || row.assignee || row.staffId || row.employeeId || row.ownerId || row.assigneeId
  if (!owner) return ''
  if (typeof owner === 'object') return String(owner.id || owner.staffId || owner.nickname || '')
  return String(owner)
}
