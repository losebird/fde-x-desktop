/**
 * Schema-driven m2o resolution (patch + where). No spoken.json FK whitelist.
 * @module dsh-lan-assist/relation-bind
 */

import { enumMap, saysOf } from './resolve.js'
import { ensureSpoken } from './vocab/spoken.js'
import { resolveShapeKey } from './where-pass.js'

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

function spokenResourceFilters(raw, resource) {
  const ors = []
  const tail = String(resource || '').split('/').pop().toLowerCase()
  if (tail === 'users') {
    ors.push({ username: raw }, { nickname: raw }, { email: raw })
  }
  ors.push({ name: { $includes: raw } }, { title: { $includes: raw } }, { code: raw })
  return ors
}

export async function resolveRelatedId(name, value, spec, ctx) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^\d+$/.test(raw)) return raw
  const extra = {
    vocab: spec.vocab,
    kinds: (ctx.conn && ctx.conn.kinds),
    collections: (ctx.conn && ctx.conn.collections),
    ...(ctx.extra || {}),
  }
  extra.vocab = ensureSpoken(extra.vocab)
  const conn = ctx.conn || {}
  const fetchImpl = ctx.fetchImpl
  const baseUrl = String(conn.baseUrl || '').replace(/\/+$/, '')
  const token = String(conn.token || extra.token || '')
  if (!baseUrl || !fetchImpl) return ''
  const fieldRow = ctx.fieldRow && typeof ctx.fieldRow === 'object' ? ctx.fieldRow : null
  const targetResource = fieldRow && String(fieldRow.target || '').trim()
  if (!targetResource) return ''
  const ors = spokenResourceFilters(raw, targetResource)
  const filter = encodeURIComponent(JSON.stringify(ors.length === 1 ? ors[0] : { $or: ors }))
  try {
    const res = await fetchImpl(`${baseUrl}/api/${targetResource}:list?pageSize=5&filter=${filter}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    const rows = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [])
    const hit = rows.filter((row) => row && row.id != null && /^\d+$/.test(String(row.id)))
    if (hit.length !== 1) return ''
    return String(hit[0].id)
  } catch {
    return ''
  }
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
    const values = []
    for (const raw of list(term.values)) {
      const spoken = String(raw ?? '').trim()
      if (!spoken) continue
      if (/^\d+$/.test(spoken)) {
        values.push(spoken)
        continue
      }
      let id = ''
      for (const key of keys) {
        const rel = relationSchemaField(fields, key)
        if (!rel) continue
        const resolved = await resolveRelatedId(key, spoken, spec, { ...ctx, fieldRow: rel })
        if (resolved) {
          id = resolved
          break
        }
      }
      if (id) values.push(id)
    }
    if (!values.length && list(term.values).length) continue
    out.push({ ...term, keys, values })
  }
  return out
}
