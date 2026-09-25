/**
 * Schema-driven m2o resolution (patch + where). No spoken.json FK whitelist.
 * @module dsh-lan-assist/relation-bind
 */

import { enumMap, saysOf } from './resolve.js'
import { ensureSpoken } from './vocab/spoken.js'
import { resolveShapeKey, vocabRow } from './where-pass.js'

export function relationSchemaField(schemaFields, key) {
  const want = String(key || '').trim()
  if (!want) return null
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  let hit = fields.find((row) => row && String(row.name || '') === want)
  if (!hit && /Id$/i.test(want)) {
    const stem = want.replace(/Id$/i, '')
    hit = fields.find((row) => row && String(row.name || '') === stem)
  }
  if (!hit) return null
  const iface = String(hit.interface || hit.type || '').trim()
  if (!/^(m2o|o2o|belongsTo)$/i.test(iface)) return null
  if (/^(createdBy|updatedBy)$/i.test(String(hit.name || ''))) return null
  return hit
}

export function fkColumnForRelation(fieldRow, fallbackName) {
  const fk = String((fieldRow && fieldRow.foreignKey) || '').trim()
  if (fk) return fk
  const name = String((fieldRow && fieldRow.name) || fallbackName || '').trim()
  if (!name) return String(fallbackName || '').trim()
  return name.endsWith('Id') ? name : `${name}Id`
}

const SPOKEN_STRING = /^(input|textarea|text|string|varchar|char|email|phone|url|markdown|richText|uuid|sequence|link)$/i

/** Columns that exist on the target schema and can hold a spoken value. No collection-name branch. */
export function spokenMatchColumns(schemaFields) {
  const out = []
  for (const row of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((row && row.name) || '').trim()
    if (!name || name === 'id') continue
    const iface = String((row && (row.interface || row.type)) || '').trim()
    if (/^(m2o|o2o|o2m|m2m|belongsTo|hasMany|hasOne)$/i.test(iface)) continue
    if (iface && !SPOKEN_STRING.test(iface)) continue
    out.push(name)
  }
  return out
}

function targetFieldsOf(resource, ctx) {
  const want = String(resource || '').trim()
  if (!want) return []
  const extra = ctx && ctx.extra && typeof ctx.extra === 'object' ? ctx.extra : {}
  const conn = ctx && ctx.conn && typeof ctx.conn === 'object' ? ctx.conn : {}
  const collections = []
    .concat(Array.isArray(extra.collections) ? extra.collections : [])
    .concat(Array.isArray(conn.collections) ? conn.collections : [])
  for (const row of collections) {
    const name = String((row && (row.name || row.resource)) || '').trim()
    if (name !== want) continue
    return [].concat((row && row.fields) || []).filter((item) => item && typeof item === 'object')
  }
  return []
}

function rowIdentityLabel(row, columns, spoken) {
  const raw = String(spoken || '').trim()
  const lower = raw.toLowerCase()
  const values = []
  for (const col of columns) {
    const value = String(row && row[col] != null ? row[col] : '').trim()
    if (value) values.push(value)
  }
  if (!values.length) return String(row && row.id != null ? row.id : '')
  const exact = values.find((value) => value === raw)
  if (exact) return exact
  const folded = values.find((value) => lower && value.toLowerCase().includes(lower))
  if (folded) return folded
  return values.join(' · ')
}

async function listTarget(baseUrl, token, fetchImpl, resource, ors) {
  if (!ors.length) return { ok: true, rows: [], count: 0 }
  const filter = encodeURIComponent(JSON.stringify(ors.length === 1 ? ors[0] : { $or: ors }))
  try {
    const res = await fetchImpl(`${baseUrl}/api/${resource}:list?pageSize=20&filter=${filter}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res || res.ok === false) return { ok: false, rows: [], count: 0 }
    const body = await res.json().catch(() => ({}))
    const rawRows = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [])
    const rows = rawRows.filter((row) => row && row.id != null && /^\d+$/.test(String(row.id)))
    const count = body.meta && Number(body.meta.count)
    return { ok: true, rows, count: Number.isFinite(count) ? count : rows.length }
  } catch {
    return { ok: false, rows: [], count: 0 }
  }
}

function relateOutcome(status, raw, columns, listed) {
  const rows = listed && Array.isArray(listed.rows) ? listed.rows : []
  if (status === 'one') {
    const row = rows[0]
    return {
      status: 'one',
      id: String(row && row.id != null ? row.id : raw),
      label: row ? rowIdentityLabel(row, columns, raw) : String(raw || ''),
      rows: row ? [row] : [],
      columns,
    }
  }
  return { status, id: '', label: '', rows, columns }
}

export async function resolveRelated(name, value, spec, ctx) {
  const raw = String(value ?? '').trim()
  const none = { status: 'none', id: '', label: '', rows: [], columns: [] }
  if (!raw) return none
  const bag = ctx && typeof ctx === 'object' ? ctx : {}
  const extra = {
    vocab: spec && spec.vocab,
    kinds: (bag.conn && bag.conn.kinds),
    collections: (bag.conn && bag.conn.collections),
    ...(bag.extra || {}),
  }
  extra.vocab = ensureSpoken(extra.vocab)
  const conn = bag.conn || {}
  const fetchImpl = bag.fetchImpl
  const baseUrl = String(conn.baseUrl || '').replace(/\/+$/, '')
  const token = String(conn.token || extra.token || '')
  const fieldRow = bag.fieldRow && typeof bag.fieldRow === 'object' ? bag.fieldRow : null
  const targetResource = fieldRow && String(fieldRow.target || '').trim()
  const columns = spokenMatchColumns(targetFieldsOf(targetResource, { ...bag, extra }))
  if (!baseUrl || !fetchImpl || !targetResource) return { ...none, columns }
  if (/^\d+$/.test(raw)) {
    const listed = await listTarget(baseUrl, token, fetchImpl, targetResource, [{ id: raw }])
    if (listed.ok && listed.rows.length === 1) return relateOutcome('one', raw, columns, listed)
    return { status: 'one', id: raw, label: raw, rows: [], columns }
  }
  if (!columns.length) return { ...none, columns }
  const eq = await listTarget(baseUrl, token, fetchImpl, targetResource, columns.map((col) => ({ [col]: raw })))
  if (!eq.ok) return { status: 'error', id: '', label: '', rows: [], columns }
  if (eq.rows.length === 1 && eq.count === 1) return relateOutcome('one', raw, columns, eq)
  if (eq.rows.length > 1 || eq.count > 1) return relateOutcome('many', raw, columns, eq)
  const inc = await listTarget(
    baseUrl,
    token,
    fetchImpl,
    targetResource,
    columns.map((col) => ({ [col]: { $includes: raw } })),
  )
  if (!inc.ok) return { status: 'error', id: '', label: '', rows: [], columns }
  if (inc.rows.length === 1 && inc.count === 1) return relateOutcome('one', raw, columns, inc)
  if (inc.rows.length > 1 || inc.count > 1) return relateOutcome('many', raw, columns, inc)
  return { ...none, columns }
}

export async function resolveRelatedId(name, value, spec, ctx) {
  const found = await resolveRelated(name, value, spec, ctx)
  return found.status === 'one' ? found.id : ''
}

export function stripRelationKeys(patch, schemaFields) {
  if (!patch || typeof patch !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(patch)) {
    const name = String(key || '').trim()
    if (!name) continue
    if (relationSchemaField(schemaFields, name)) continue
    if (/Id$/i.test(name) && relationSchemaField(schemaFields, name.replace(/Id$/i, ''))) continue
    out[name] = value
  }
  return out
}

function approvedStatusHints(vocab) {
  const hints = new Set()
  const rows = ensureSpoken(vocab)
  for (const row of rows) {
    const clues = row && row.clues
    const list = Array.isArray(clues) ? clues : (clues && typeof clues === 'object' ? Object.values(clues) : [])
    for (const clue of list) {
      if (!clue || typeof clue !== 'object') continue
      const keys = (Array.isArray(clue.keys) ? clue.keys : []).map((k) => String(k || '').toLowerCase())
      if (!keys.some((k) => /^(status|stage|state|workflowstatus)$/.test(k))) continue
      const says = []
      if (Array.isArray(clue.say)) says.push(...clue.say)
      else if (clue.say) says.push(clue.say)
      const approvedSay = says.some((s) => /过审|已过账|已通过|approved|posted/i.test(String(s || '')))
      if (!approvedSay) continue
      const vals = Array.isArray(clue.values) ? clue.values : []
      for (const v of vals) hints.add(String(v ?? '').trim())
      for (const s of says) hints.add(String(s ?? '').trim())
    }
  }
  for (const bit of saysOf({ vocab }, '已过账')) hints.add(String(bit || '').trim())
  return [...hints].filter(Boolean)
}

export function statusFieldRow(schemaFields) {
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  return fields.find((row) => row && /^(status|stage|state|workflowStatus)$/i.test(String(row.name || ''))) || null
}

export function approveNextStatusCode(schemaFields, vocab, currentStatus) {
  const row = statusFieldRow(schemaFields)
  if (!row) return ''
  const enums = (row.enums && typeof row.enums === 'object' && Object.keys(row.enums).length)
    ? row.enums
    : enumMap(row)
  if (!enums || !Object.keys(enums).length) return ''
  const hints = new Set(approvedStatusHints(vocab))
  const cur = String(currentStatus ?? '').trim()
  for (const [code, label] of Object.entries(enums)) {
    const codeS = String(code)
    const labelS = String(label || '')
    if (!hints.has(codeS) && !hints.has(labelS)) continue
    if (codeS === cur || labelS === cur) continue
    return codeS
  }
  for (const hint of hints) {
    if (Object.prototype.hasOwnProperty.call(enums, hint)) {
      if (String(hint) !== cur) return String(hint)
    }
  }
  for (const [code, label] of Object.entries(enums)) {
    const codeS = String(code)
    const labelS = String(label || '')
    if (codeS === cur || labelS === cur) continue
    if (hints.has(codeS) || hints.has(labelS)) return codeS
  }
  return ''
}

export function statusLabelForCode(schemaFields, code) {
  const row = statusFieldRow(schemaFields)
  if (!row || !code) return String(code || '').trim()
  const enums = (row.enums && typeof row.enums === 'object' && Object.keys(row.enums).length)
    ? row.enums
    : enumMap(row)
  const want = String(code)
  if (enums && Object.prototype.hasOwnProperty.call(enums, want)) {
    return String(enums[want] || want)
  }
  return want
}

function list(vals) {
  return Array.isArray(vals) ? vals : (vals == null ? [] : [vals])
}

export async function bindWhereRelationTerms(terms, schemaFields, spec, ctx, vocabHit, extraLabels) {
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const out = []
  for (const term of Array.isArray(terms) ? terms : []) {
    if (!term || typeof term !== 'object') {
      out.push(term)
      continue
    }
    const keys = list(term.keys).map((key) => resolveShapeKey(key, fields, vocabHit, extraLabels))
    const field = keys.map((key) => fieldNamed(fields, key)).find(Boolean) || null
    const mode = schemaCellMode(field, fields)
    if (mode === 'relation') {
      const rel = relationSchemaField(fields, field.name)
      const values = []
      for (const raw of list(term.values)) {
        const spoken = String(raw ?? '').trim()
        if (!spoken) continue
        if (/^\d+$/.test(spoken)) {
          values.push(spoken)
          continue
        }
        const resolved = await resolveRelated(field.name, spoken, spec, { ...ctx, fieldRow: rel })
        let ids = []
        if (resolved.status === 'one' && resolved.id) ids = [resolved.id]
        else if (resolved.status === 'many' && resolved.rows.length) {
          ids = resolved.rows.map((row) => String(row.id))
        }
        if (ids.length === 1) values.push(ids[0])
        else if (ids.length > 1) values.push(...ids)
      }
      if (!values.length && list(term.values).length) continue
      out.push({ ...term, keys: [field.name], values })
      continue
    }
    if (mode === 'enum') {
      const values = []
      for (const raw of list(term.values)) {
        const spoken = String(raw ?? '').trim()
        if (!spoken) continue
        const hits = enumHits(field, spoken)
        if (hits.length === 1) values.push(hits[0].code)
      }
      if (!values.length && list(term.values).length) continue
      const next = { ...term, keys: [field.name], values }
      delete next.text
      out.push(next)
      continue
    }
    out.push(term)
  }
  return out
}

function cellTitle(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.title || (row.uiSchema && row.uiSchema.title) || row.name || '').trim()
}

function fieldRequired(row) {
  if (!row || typeof row !== 'object') return false
  if (row.required === true) return true
  if (row.allowNull === false) return true
  const ui = row.uiSchema
  return !!(ui && ui.required === true)
}

function fieldEnums(row) {
  if (!row || typeof row !== 'object') return null
  if (row.enums && typeof row.enums === 'object' && !Array.isArray(row.enums) && Object.keys(row.enums).length) {
    return row.enums
  }
  const mapped = enumMap(row)
  return mapped && Object.keys(mapped).length ? mapped : null
}

function isEnumField(row) {
  if (fieldEnums(row)) return true
  return /^(select|radio|multipleSelect)$/i.test(String((row && (row.interface || row.type)) || ''))
}

function fieldNamed(fields, name) {
  const want = String(name || '').trim()
  if (!want) return null
  return (Array.isArray(fields) ? fields : []).find((row) => row && String(row.name || '') === want) || null
}

/** Same cell classes as a spoken write: relation, enum, or literal. */
function schemaCellMode(field, fields) {
  if (!field) return ''
  if (relationSchemaField(fields, field.name)) return 'relation'
  if (isEnumField(field)) return 'enum'
  return 'literal'
}

function enumHits(row, spoken) {
  const enums = fieldEnums(row) || {}
  const hits = []
  for (const [code, label] of Object.entries(enums)) {
    if (String(code) === spoken || String(label || '') === spoken) {
      hits.push({ code: String(code), label: String(label || code) })
    }
  }
  return hits
}

function cellBlocks(cell) {
  if (!cell || cell.bound) return false
  if (cell.mode === 'relation' && !cell.required && !(cell.picks && cell.picks.length)) return false
  return true
}

const UNBOUND_HINT = '这一格对不上'

/**
 * Place each spoken patch value on its schema cell: literal, enum, or relation.
 * Confirmation reads `display`; the token reads `writePatch`.
 */
export async function bindSpokenCells(patch, schemaFields, spec, ctx) {
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const vocab = (spec && spec.vocab) || (ctx && ctx.extra && ctx.extra.vocab)
  const vocabHit = vocabRow(spec && spec.kind, vocab)
  const cells = []
  const input = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}
  if (!fields.length) {
    for (const [rawKey, rawValue] of Object.entries(input)) {
      const spoken = rawValue == null ? '' : String(rawValue).trim()
      const key = String(rawKey || '').trim()
      if (!key || !spoken) continue
      cells.push({
        key,
        writeKey: key,
        label: key,
        mode: 'literal',
        spoken,
        bound: true,
        required: false,
        display: spoken,
        write: spoken,
        hint: '',
      })
    }
  }
  for (const [rawKey, rawValue] of fields.length ? Object.entries(input) : []) {
    const spoken = rawValue == null ? '' : String(rawValue).trim()
    if (!spoken) continue
    const placed = resolveShapeKey(rawKey, fields, vocabHit)
    const field = fields.find((row) => row && String(row.name || '') === placed)
    if (!field) {
      cells.push({
        key: String(rawKey || '').trim(),
        label: String(rawKey || '').trim(),
        mode: 'unplaced',
        spoken,
        bound: false,
        required: true,
        display: '',
        hint: UNBOUND_HINT,
      })
      continue
    }
    const label = cellTitle(field)
    const required = fieldRequired(field)
    const mode = schemaCellMode(field, fields)
    if (mode === 'relation') {
      const rel = relationSchemaField(fields, field.name)
      const found = await resolveRelated(field.name, spoken, spec, { ...ctx, fieldRow: rel })
      if (found.status === 'one' && found.id) {
        cells.push({
          key: field.name,
          writeKey: fkColumnForRelation(rel, field.name),
          label,
          mode: 'relation',
          spoken,
          bound: true,
          required,
          display: found.label || found.id,
          write: found.id,
          hint: '',
        })
      } else if (found.status === 'many') {
        cells.push({
          key: field.name,
          label,
          mode: 'relation',
          spoken,
          bound: false,
          required,
          display: '',
          hint: UNBOUND_HINT,
          picks: found.rows.map((row) => ({
            id: String(row.id),
            label: rowIdentityLabel(row, found.columns, spoken),
          })),
        })
      } else {
        cells.push({
          key: field.name,
          label,
          mode: 'relation',
          spoken,
          bound: false,
          required,
          display: '',
          hint: UNBOUND_HINT,
        })
      }
      continue
    }
    if (mode === 'enum') {
      const hits = enumHits(field, spoken)
      if (hits.length === 1) {
        cells.push({
          key: field.name,
          writeKey: field.name,
          label,
          mode: 'enum',
          spoken,
          bound: true,
          required,
          display: hits[0].label,
          write: hits[0].code,
          hint: '',
        })
      } else {
        cells.push({
          key: field.name,
          label,
          mode: 'enum',
          spoken,
          bound: false,
          required: true,
          display: '',
          hint: UNBOUND_HINT,
        })
      }
      continue
    }
    cells.push({
      key: field.name,
      writeKey: field.name,
      label,
      mode: 'literal',
      spoken,
      bound: true,
      required,
      display: spoken,
      write: spoken,
      hint: '',
    })
  }
  const writePatch = {}
  const displayPatch = {}
  for (const cell of cells) {
    if (!cell.bound || cell.write == null || cell.write === '' || !cell.writeKey) continue
    writePatch[cell.writeKey] = cell.write
    displayPatch[cell.key] = cell.display
  }
  return {
    writePatch,
    displayPatch,
    cells,
    blockConfirm: cells.some(cellBlocks),
  }
}
