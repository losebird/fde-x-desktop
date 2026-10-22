/**
 * Generic preview where pass-through: alias formats, shape-label → schema keys, date/year ranges.
 * @module dsh-lan-assist/where-pass
 */

import { enumMap, looksLikeRef } from './resolve.js'
import { PAGE_SIZE } from './plan.js'

export const WHERE_LIST_CAP = 5000

function list(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
}

function schemaTitle(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.title || (row.uiSchema && row.uiSchema.title) || '').trim()
}

const SKIP_SHAPE_FIELD = /^(id|createdAt|updatedAt|createdBy|updatedBy|createdById|updatedById)$/i

export function isDateField(row) {
  if (!row || typeof row !== 'object') return false
  const t = `${row.interface || ''} ${row.type || ''}`.toLowerCase()
  return t.includes('date') || t.includes('time') || t.includes('unixtimestamp')
}

export function isSkippedShapeField(name) {
  const n = String(name || '').trim()
  if (!n) return true
  return SKIP_SHAPE_FIELD.test(n) || /Id$|_id$/i.test(n)
}

export function schemaFieldByName(schemaFields, key) {
  const want = String(key || '').trim()
  if (!want) return null
  return (Array.isArray(schemaFields) ? schemaFields : []).find((row) => row && String(row.name || '') === want) || null
}

function dateColumnName(name, schemaFields) {
  const hit = schemaFieldByName(schemaFields, name)
  return hit && isDateField(hit) ? String(hit.name) : ''
}

function statusShapeLabel(label) {
  const want = String(label || '').trim()
  if (!want) return false
  if (want === '状态') return true
  return /^(status|state|stage)$/i.test(want)
}

function resolveStatusShapeKey(label, schemaFields, mappedKeys) {
  if (!statusShapeLabel(label)) return ''
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const mapped = mappedKeys instanceof Set ? mappedKeys : new Set()
  const statusNamed = fields.filter((row) => {
    const name = String((row && row.name) || '').trim()
    return name && /^(status|state|stage)$/i.test(name) && !mapped.has(name)
  })
  if (statusNamed.length === 1) return statusNamed[0].name
  const want = String(label || '').trim()
  const byTitle = fields.find((row) => {
    const name = String((row && row.name) || '').trim()
    if (!name || mapped.has(name)) return false
    const title = schemaTitle(row)
    if (!title) return false
    return title === want || title.endsWith(want) || title.includes(want)
  })
  if (byTitle && byTitle.name) return byTitle.name
  return statusNamed[0] && statusNamed[0].name ? statusNamed[0].name : ''
}

export function vocabRow(kind, vocab) {
  const key = String(kind || '').trim()
  if (!key) return null
  for (const row of Array.isArray(vocab) ? vocab : []) {
    if (!row) continue
    const name = String(row.kind || row.label || '').trim()
    if (name === key) return row
  }
  return null
}

function enrichVocabHit(vocabHit, kind, vocab) {
  const key = String(kind || '').trim()
  let hit = vocabHit && typeof vocabHit === 'object' ? { ...vocabHit } : { kind: key }
  if (!key) return hit
  for (const row of Array.isArray(vocab) ? vocab : []) {
    if (!row) continue
    const name = String(row.kind || row.label || '').trim()
    if (name !== key) continue
    hit = {
      ...hit,
      ...row,
      kind: name,
      fields: Array.isArray(row.fields) && row.fields.length ? row.fields : hit.fields,
      fieldLabels: row.fieldLabels || hit.fieldLabels,
      ticketField: row.ticketField || hit.ticketField,
    }
    if (Array.isArray(hit.fields) && hit.fields.length) break
  }
  return hit
}

function ticketFieldOf(vocabHit) {
  const explicit = String((vocabHit && vocabHit.ticketField) || '').trim()
  if (explicit) return explicit
  for (const entry of Array.isArray(vocabHit?.fields) ? vocabHit.fields : []) {
    const name = String(entry || '').trim()
    if (/No$|^code$|^no$/i.test(name)) return name
  }
  return ''
}

function shapedEntries(vocabHit, schemaFields) {
  const ticket = ticketFieldOf(vocabHit)
  const entries = []
  const seen = new Set()
  if (ticket) {
    const row = (Array.isArray(schemaFields) ? schemaFields : []).find((item) => item && item.name === ticket)
    entries.push({ label: ticket, key: ticket })
    seen.add(ticket)
    const title = schemaTitle(row)
    if (title && title !== ticket) entries.push({ label: title, key: ticket })
  }
  for (const row of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((row && row.name) || '').trim()
    if (!name || seen.has(name) || isSkippedShapeField(name)) continue
    entries.push({ label: schemaTitle(row) || name, key: name })
    seen.add(name)
  }
  return entries
}

function inferLabelsFromVocabAndSchema(vocabHit, schemaFields) {
  const map = {}
  const vocabFields = Array.isArray(vocabHit?.fields) ? vocabHit.fields : []
  const ascii = vocabFields
    .map((item) => String(item || '').trim())
    .filter((item) => item && /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
  for (const key of ascii) map[key] = key
  const pool = []
  for (const row of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((row && row.name) || '').trim()
    if (!name || isSkippedShapeField(name) || ascii.includes(name)) continue
    pool.push(name)
  }
  let poolAt = 0
  for (let i = 0; i < vocabFields.length; i += 1) {
    const label = String(vocabFields[i] || '').trim()
    if (!label || map[label]) continue
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
      map[label] = label
      continue
    }
    const prev = String(vocabFields[i - 1] || '').trim()
    if (i > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(prev)) {
      map[label] = map[prev] || prev
      continue
    }
    const mappedKeys = new Set(Object.values(map))
    const statusKey = resolveStatusShapeKey(label, schemaFields, mappedKeys)
    if (statusKey) {
      map[label] = statusKey
      continue
    }
    const enumKey = (Array.isArray(schemaFields) ? schemaFields : []).find((row) => {
      const name = String((row && row.name) || '').trim()
      if (!name || mappedKeys.has(name)) return false
      const enums = row.enums && typeof row.enums === 'object' ? row.enums : null
      return enums && Object.keys(enums).length
    })
    if (enumKey && enumKey.name) {
      map[label] = enumKey.name
      continue
    }
    const dateKey = (Array.isArray(schemaFields) ? schemaFields : []).find((row) => {
      const name = String((row && row.name) || '').trim()
      return name && !mappedKeys.has(name) && isDateField(row)
    })
    if (dateKey && dateKey.name) {
      map[label] = dateKey.name
      continue
    }
    const statusNamed = (Array.isArray(schemaFields) ? schemaFields : []).filter((row) => (
      /^(status|state|stage)$/i.test(String((row && row.name) || ''))
    ))
    if (statusNamed.length === 1 && !mappedKeys.has(statusNamed[0].name)) {
      map[label] = statusNamed[0].name
      continue
    }
    if (pool[poolAt]) {
      map[label] = pool[poolAt]
      poolAt += 1
    }
  }
  return map
}

function labelsFromVocabFieldList(vocabHit, schemaFields) {
  const map = {}
  const vocabFields = Array.isArray(vocabHit?.fields) ? vocabHit.fields : []
  const entries = shapedEntries(vocabHit, schemaFields)
  for (let i = 0; i < vocabFields.length; i += 1) {
    const label = String(vocabFields[i] || '').trim()
    if (!label || map[label]) continue
    const hit = entries.find((item) => item.label === label)
    if (hit) {
      map[label] = hit.key
      continue
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
      const keyHit = entries.find((item) => item.key === label)
      map[label] = keyHit ? keyHit.key : label
      continue
    }
    if (statusShapeLabel(label)) {
      const statusKey = resolveStatusShapeKey(label, schemaFields)
      if (statusKey) {
        map[label] = statusKey
        continue
      }
    }
    if (i > 0) {
      const prev = String(vocabFields[i - 1] || '').trim()
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(prev) && map[prev]) map[label] = map[prev]
    }
  }
  for (let i = 0; i < vocabFields.length; i += 1) {
    const label = String(vocabFields[i] || '').trim()
    if (!label || map[label] || /^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) continue
    const slot = entries[i]
    if (slot && slot.label === label) map[label] = slot.key
  }
  Object.assign(map, inferLabelsFromVocabAndSchema(vocabHit, schemaFields))
  return map
}

function rawFieldTitle(field) {
  if (!field || typeof field !== 'object') return ''
  const ui = field.uiSchema && typeof field.uiSchema === 'object' ? field.uiSchema : {}
  return String(ui.title || field.title || field.label || '').trim()
}

export function fieldLabelsFromRawCollection(resource, collections) {
  const want = String(resource || '').trim()
  if (!want) return {}
  const map = {}
  for (const row of Array.isArray(collections) ? collections : []) {
    const name = String((row && (row.name || row.resource)) || '').trim()
    if (name !== want) continue
    for (const item of [].concat((row && row.fields) || [])) {
      if (!item || typeof item !== 'object') continue
      const key = String(item.name || '').trim()
      if (!key) continue
      const title = rawFieldTitle(item)
      map[key] = key
      if (title) map[title] = key
    }
    return map
  }
  return map
}

export function fieldLabelMap(vocabHit, schemaFields, extraLabels) {
  const map = {}
  Object.assign(map, labelsFromVocabFieldList(vocabHit, schemaFields))
  const stored = vocabHit && vocabHit.fieldLabels
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    Object.assign(map, stored)
  }
  for (const row of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((row && row.name) || '').trim()
    if (!name) continue
    const title = schemaTitle(row)
    map[name] = name
    if (title) map[title] = name
  }
  if (extraLabels && typeof extraLabels === 'object' && !Array.isArray(extraLabels)) {
    Object.assign(map, extraLabels)
  }
  return map
}

function dateFieldNames(schemaFields, vocabHit) {
  const names = []
  const hinted = String((vocabHit && vocabHit.dateField) || '').trim()
  if (hinted) names.push(hinted)
  for (const row of Array.isArray(schemaFields) ? schemaFields : []) {
    if (row && isDateField(row) && row.name) names.push(String(row.name))
  }
  return [...new Set(names.filter(Boolean))]
}

export function resolveShapeKey(label, schemaFields, vocabHit, extraLabels) {
  const want = String(label || '').trim()
  if (!want) return want
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const statusKey = resolveStatusShapeKey(want, fields)
  if (statusKey) return statusKey
  const labels = fieldLabelMap(vocabHit, fields, extraLabels)
  if (labels[want]) return labels[want]
  const vocabFields = Array.isArray(vocabHit?.fields) ? vocabHit.fields : []
  if (vocabFields.includes(want)) {
    const titled = fields.find((row) => schemaTitle(row) === want)
    if (titled && titled.name) return titled.name
    const statusCols = fields.filter((row) => /^(status|state|stage)$/i.test(String(row.name || '')))
    if (statusCols.length === 1) return statusCols[0].name
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(want)) return want
  for (const row of fields) {
    if (!row) continue
    const name = String(row.name || '').trim()
    const title = schemaTitle(row)
    if (name === want || title === want) return name
    if (title && (title.endsWith(want) || title.includes(want))) return name
  }
  if (/日期|时间|date|time/i.test(want)) {
    const hinted = String((vocabHit && vocabHit.dateField) || '').trim()
    if (hinted) return hinted
    const dateHit = fields.find(isDateField)
    if (dateHit && dateHit.name) return String(dateHit.name)
  }
  return want
}

function yearBounds(value) {
  const y = String(value || '').trim()
  if (!/^\d{4}$/.test(y)) return null
  return { start: `${y}-01-01`, end: `${Number(y) + 1}-01-01` }
}

function expandYearOnKeys(term, schemaFields) {
  const keys = list(term.keys)
  const values = list(term.values)
  if (!keys.length || values.length !== 1) return [term]
  const bounds = yearBounds(values[0])
  if (!bounds) return [term]
  const dateKey = keys.map((key) => dateColumnName(key, schemaFields)).find(Boolean)
  if (!dateKey) return [term]
  return [
    { dateAfter: [dateKey], values: [bounds.start] },
    { dateBefore: [dateKey], values: [bounds.end] },
  ]
}

function expandYearOnDateSlot(term, slot, schemaFields, vocabHit, extraLabels) {
  const resolved = list(term[slot]).map((key) => resolveShapeKey(key, schemaFields, vocabHit, extraLabels))
  const values = list(term.values)
  const packed = { ...term, [slot]: resolved }
  if (!resolved.length) return [packed]
  const dateKey = resolved.map((key) => dateColumnName(key, schemaFields)).find(Boolean)
  if (values.length !== 1 || !dateKey) return [packed]
  const bounds = yearBounds(values[0])
  if (!bounds) return [packed]
  if (slot === 'dateAfter') {
    return [
      { dateAfter: [dateKey], values: [bounds.start] },
      { dateBefore: [dateKey], values: [bounds.end] },
    ]
  }
  if (slot === 'dateBefore') return [{ dateBefore: [dateKey], values: [bounds.end] }]
  return [packed]
}

function normalizeBound(value) {
  const text = String(value || '').trim()
  const bounds = yearBounds(text)
  return bounds ? bounds.start : text
}

function normalizeUpperBound(value) {
  const text = String(value || '').trim()
  const bounds = yearBounds(text)
  return bounds ? bounds.end : text
}

export function normalizeAliasTerm(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  if (Array.isArray(raw.keys) || raw.dateBefore || raw.dateAfter) return raw
  const field = String(raw.field || raw.fieldName || raw.key || '').trim()
  const op = String(raw.op || raw.operator || 'eq').trim().toLowerCase()
  const value = raw.value !== undefined ? raw.value : raw.values
  if (!field) return raw
  const values = list(value)
  if (!values.length && value !== undefined && value !== null && String(value).trim()) {
    values.push(String(value).trim())
  }
  if (!values.length) return raw
  if (/^(gte|ge|after|from|dateafter|>=)$/.test(op)) {
    return { dateAfter: [field], values }
  }
  if (/^(lte|le|before|to|datebefore|<=)$/.test(op)) {
    return { dateBefore: [field], values }
  }
  return { keys: [field], values, not: /^(ne|neq|not|!=)$/.test(op) }
}

export function normalizeAliasWhere(raw) {
  const out = []
  for (const row of Array.isArray(raw) ? raw : []) {
    const norm = normalizeAliasTerm(row)
    if (Array.isArray(norm)) out.push(...norm)
    else if (norm) out.push(norm)
  }
  return out
}

export function bindWhereKeys(terms, kind, vocab, schemaFields, extraLabels) {
  const vocabHit = enrichVocabHit(vocabRow(kind, vocab), kind, vocab)
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const out = []
  for (const term of Array.isArray(terms) ? terms : []) {
    if (!term || typeof term !== 'object') continue
    if (Array.isArray(term.dateAfter) && term.dateAfter.length) {
      out.push(...expandYearOnDateSlot(term, 'dateAfter', fields, vocabHit, extraLabels))
      continue
    }
    if (Array.isArray(term.dateBefore) && term.dateBefore.length) {
      out.push(...expandYearOnDateSlot(term, 'dateBefore', fields, vocabHit, extraLabels))
      continue
    }
    const keys = list(term.keys).map((key) => resolveShapeKey(key, fields, vocabHit, extraLabels))
    const packed = { ...term, keys }
    if (keys.length && list(term.values).length === 1 && yearBounds(term.values[0])) {
      out.push(...expandYearOnKeys(packed, fields))
      continue
    }
    out.push(packed)
  }
  return out
}

export function listLimitForWhere(where) {
  return Array.isArray(where) && where.length ? WHERE_LIST_CAP : PAGE_SIZE
}

export function previewRowCap(structured) {
  return structured ? WHERE_LIST_CAP : PAGE_SIZE
}

function enumFilterPart(key, vals, not) {
  if (!key || !vals.length) return null
  if (not) {
    return vals.length === 1 ? { [key]: { $ne: vals[0] } } : { [key]: { $notIn: vals } }
  }
  return vals.length === 1 ? { [key]: vals[0] } : { [key]: { $in: vals } }
}

function textFilterPart(key, vals, term) {
  if (!key || !vals.length) return null
  if (term && term.textPass === 'contains') {
    return vals.length === 1
      ? { [key]: { $includes: vals[0] } }
      : { $or: vals.map((value) => ({ [key]: { $includes: value } })) }
  }
  return enumFilterPart(key, vals, term && term.not)
}

function fieldTitleOf(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.title || (row.uiSchema && row.uiSchema.title) || '').trim()
}

function isAsciiFieldName(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(key || ''))
}

function isNameTitleKey(key) {
  const k = String(key || '').trim()
  return k === '名称' || /名称$/.test(k) || k === '姓名' || /姓名$/.test(k)
}

function objectNameTitle(title) {
  const text = String(title || '').trim()
  if (!text) return false
  return /名称/.test(text) || /姓名$/.test(text) || text === '姓名'
}

function isSurrogateIdentityKey(key, schemaFields) {
  const k = String(key || '').trim()
  if (!k) return false
  if (/^(id|pk|uuid|uid|key)$/i.test(k)) return true
  if (/Id$/.test(k)) return true
  const hit = schemaFieldByName(schemaFields, k)
  if (!hit) return false
  if (hit.primaryKey === true) return true
  const iface = String(hit.interface || '')
  const typ = String(hit.type || '')
  if (/^(snowflakeId|integer|bigInt|uid|uuid|id)$/i.test(iface)) return true
  if (/^(snowflakeId|integer|bigInt|uid|uuid)$/i.test(typ)) return true
  const title = fieldTitleOf(hit)
  if (/^(id|ID|主键)$/.test(title)) return true
  return false
}

export function isIdentityNameKey(key, schemaFields) {
  const k = String(key || '').trim()
  if (!k) return false
  if (isSurrogateIdentityKey(k, schemaFields)) return false
  if (/^(name|title)$/i.test(k) || isNameTitleKey(k)) return true
  return objectNameTitle(fieldTitleOf(schemaFieldByName(schemaFields, k)))
}

export function isObjectNameKey(key, schemaFields, extra = {}) {
  const k = String(key || '').trim()
  if (!k) return false
  if (isSurrogateIdentityKey(k, schemaFields)) return false
  const titleField = String((extra && extra.titleField) || '').trim()
  if (titleField && k === titleField && k !== 'title' && !isSurrogateIdentityKey(titleField, schemaFields)) return true
  if (/^name$/i.test(k) || isNameTitleKey(k)) return true
  if (/^title$/i.test(k)) return false
  return objectNameTitle(fieldTitleOf(schemaFieldByName(schemaFields, k)))
}

export function schemaObjectNameKeys(schemaFields, extra = {}) {
  const named = []
  for (const field of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((field && field.name) || '').trim()
    if (!name) continue
    if (isObjectNameKey(name, schemaFields, extra)) named.push(name)
  }
  const titleField = String((extra && extra.titleField) || '').trim()
  if (
    titleField
    && titleField !== 'title'
    && !isSurrogateIdentityKey(titleField, schemaFields)
    && !named.includes(titleField)
  ) {
    const hit = schemaFieldByName(schemaFields, titleField)
    if (hit || !Array.isArray(schemaFields) || !schemaFields.length) named.push(titleField)
  }
  return [...new Set(named)]
}

export function isAssocRelationField(key, schemaFields) {
  const hit = schemaFieldByName(schemaFields, key)
  if (!hit) return false
  const iface = String(hit.interface || hit.type || '')
  return /^(m2o|o2o|belongsTo)$/i.test(iface)
}

export function isNameRelationField(key, schemaFields) {
  if (!isAssocRelationField(key, schemaFields)) return false
  return isIdentityNameKey(key, schemaFields)
}

export function nestedNameContainsPart(key, vals) {
  const want = vals.filter((value) => value && !looksLikeRef(value))
  if (!key || !want.length) return null
  const inner = want.flatMap((value) => [
    { name: { $includes: value } },
    { title: { $includes: value } },
  ])
  return { [key]: inner.length === 1 ? inner[0] : { $or: inner } }
}

export function shouldContainNameTerm(keys, vals, term, schemaFields) {
  if (!keys.length || !vals.length) return false
  if (Array.isArray(term && term.dateBefore) && term.dateBefore.length) return false
  if (Array.isArray(term && term.dateAfter) && term.dateAfter.length) return false
  if (!keys.some((key) => isIdentityNameKey(key, schemaFields))) return false
  return vals.some((value) => !looksLikeRef(value))
}

export function termWantsContainsKeep(term, schemaFields) {
  if (!term || typeof term !== 'object') return false
  if (term.text === true) return true
  return shouldContainNameTerm(list(term.keys), list(term.values), term, schemaFields)
}

export function schemaIdentityNameKeys(schemaFields) {
  const named = []
  for (const field of Array.isArray(schemaFields) ? schemaFields : []) {
    const name = String((field && field.name) || '').trim()
    if (!name) continue
    if (isIdentityNameKey(name, schemaFields)) named.push(name)
  }
  return [...new Set(named)]
}

export function identityNameRestFilter(rest, schemaFields) {
  const want = String(rest || '').trim()
  if (!want || looksLikeRef(want)) return null
  const keys = schemaIdentityNameKeys(schemaFields).filter(isAsciiFieldName)
  const use = keys.length ? keys : ['name', 'title']
  const parts = use.map((key) => (
    isNameRelationField(key, schemaFields)
      ? nestedNameContainsPart(key, [want])
      : { [key]: { $includes: want } }
  )).filter(Boolean)
  if (!parts.length) return null
  return parts.length === 1 ? parts[0] : { $or: parts }
}

function asciiKeysForTerm(keys, schemaFields) {
  const ascii = [...new Set(keys.filter(isAsciiFieldName))]
  if (ascii.length) return ascii
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const fromSchema = []
  for (const key of keys) {
    for (const row of fields) {
      const name = String((row && row.name) || '').trim()
      if (!isAsciiFieldName(name)) continue
      const title = fieldTitleOf(row)
      if (name === key || title === key) fromSchema.push(name)
      else if (isNameTitleKey(key) && isIdentityNameKey(name, schemaFields)) fromSchema.push(name)
    }
  }
  if (fromSchema.length) return [...new Set(fromSchema)]
  if (keys.some(isNameTitleKey)) return ['name', 'title']
  return []
}

function nameContainsFilterParts(asciiKeys, vals, term, schemaFields) {
  const nested = asciiKeys.map((key) => (
    isAssocRelationField(key, schemaFields) || isNameRelationField(key, schemaFields)
      ? nestedNameContainsPart(key, vals)
      : null
  )).filter(Boolean)
  const nameKeys = asciiKeys.filter((key) => (
    isIdentityNameKey(key, schemaFields)
    && !isAssocRelationField(key, schemaFields)
    && !isNameRelationField(key, schemaFields)
  ))
  const scalar = nameKeys.map((key) => textFilterPart(key, vals, { ...term, textPass: 'contains' })).filter(Boolean)
  return [...nested, ...scalar]
}

export function termFilterPart(term, today, schemaFields) {
  const keys = list(term.keys)
  const vals = list(term.values)
  const asciiKeys = asciiKeysForTerm(keys, schemaFields)
  const wantsContains = (term && (term.text === true || term.textPass === 'contains'))
    || shouldContainNameTerm(asciiKeys.length ? asciiKeys : keys, vals, term, schemaFields)
  const nameParts = wantsContains ? nameContainsFilterParts(asciiKeys, vals, term, schemaFields) : []
  if (nameParts.length === 1) return nameParts[0]
  if (nameParts.length > 1) return { $or: nameParts }
  if (term && term.text === true) {
    return textFilterPart(asciiKeys[0], vals, term)
  }
  let statusPart = null
  if (asciiKeys.length > 1 && vals.length) {
    const slice = asciiKeys.map((key) => enumFilterPart(key, vals, term.not)).filter(Boolean)
    if (slice.length === 1) statusPart = slice[0]
    else if (slice.length > 1) statusPart = { $or: slice }
  } else {
    const asciiKey = asciiKeys[0]
    statusPart = enumFilterPart(asciiKey, vals, term.not)
  }
  const dateBeforeParts = list(term.dateBefore)
    .filter((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
    .map((item) => {
      const bound = normalizeUpperBound((term.values || [])[0])
      return bound ? { [item]: { $lt: bound } } : null
    })
    .filter(Boolean)
  const dateAfterParts = list(term.dateAfter)
    .filter((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
    .map((item) => {
      const bound = normalizeBound((term.values || [])[0])
      return bound ? { [item]: { $gte: bound } } : null
    })
    .filter(Boolean)
  const dateParts = [...dateBeforeParts, ...dateAfterParts]
  if (statusPart && dateParts.length) return { $and: [statusPart, ...dateParts] }
  if (statusPart) return statusPart
  if (dateParts.length) return dateParts.length === 1 ? dateParts[0] : { $and: dateParts }
  return null
}

function schemaEnumsForKey(schemaFields, key) {
  const want = String(key || '').trim()
  if (!want) return null
  const hit = (Array.isArray(schemaFields) ? schemaFields : []).find((row) => row && String(row.name || '') === want)
  if (!hit || typeof hit !== 'object') return null
  const enums = (hit.enums && typeof hit.enums === 'object' && !Array.isArray(hit.enums) && Object.keys(hit.enums).length)
    ? hit.enums
    : enumMap(hit)
  return enums && Object.keys(enums).length ? enums : null
}

function rowFieldRaw(row, key) {
  const fields = row && row.fields && typeof row.fields === 'object' ? row.fields : {}
  if (fields[key] != null && fields[key] !== '') {
    if (typeof fields[key] === 'object') {
      const label = fields[key].name || fields[key].title || fields[key].label
      if (label != null && String(label).trim()) return String(label).trim()
    } else return String(fields[key])
  }
  if (row && row[key] != null && row[key] !== '') {
    if (typeof row[key] === 'object') {
      const label = row[key].name || row[key].title || row[key].label
      if (label != null && String(label).trim()) return String(label).trim()
    } else return String(row[key])
  }
  return ''
}

function valueMatchesTerm(raw, vals, enums, contains) {
  const text = String(raw || '').trim()
  if (!text) return false
  const folded = text.toLowerCase()
  for (const v of vals) {
    const want = String(v || '').trim()
    if (!want) continue
    if (text === want) return true
    if (contains && folded.includes(want.toLowerCase())) return true
    if (!enums) continue
    for (const [code, label] of Object.entries(enums)) {
      const labelText = String(label || '').trim()
      if (want === code && text === code) return true
      if (want === labelText && (text === code || text === labelText)) return true
      if (text === code && labelText === want) return true
      if (text === labelText && labelText === want) return true
    }
  }
  return false
}

function parseDateValue(raw) {
  const text = String(raw || '').trim()
  if (!text) return NaN
  return Date.parse(text)
}

function rowDateHits(row, keys, compare) {
  return (Array.isArray(keys) ? keys : []).some((key) => {
    const t = parseDateValue(rowFieldRaw(row, key))
    return Number.isFinite(t) && compare(t)
  })
}

function rowMatchesTerm(row, term, schemaFields) {
  if (!term || typeof term !== 'object') return true
  const keys = list(term.keys)
  const vals = list(term.values)
  const after = list(term.dateAfter)
  const before = list(term.dateBefore)
  if (after.length) {
    const floor = parseDateValue(vals[0])
    if (!Number.isFinite(floor)) return false
    return rowDateHits(row, after, (t) => t >= floor)
  }
  if (before.length) {
    if (vals[0]) {
      const ceiling = parseDateValue(vals[0])
      if (!Number.isFinite(ceiling)) return false
      return rowDateHits(row, before, (t) => t < ceiling)
    }
    const now = Date.now()
    return rowDateHits(row, before, (t) => t < now)
  }
  if (!keys.length || !vals.length) return true
  const asciiKeys = keys.filter((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
  const contains = term.textPass === 'contains'
    || shouldContainNameTerm(asciiKeys.length ? asciiKeys : keys, vals, term, schemaFields)
  const hit = keys.some((key) => {
    const enums = schemaEnumsForKey(schemaFields, key)
    const raw = rowFieldRaw(row, key)
    return valueMatchesTerm(raw, vals, enums, contains)
  })
  return term.not ? !hit : hit
}

/** Client-side hit set for bound plan where (write batch must not count unfiltered rows). */
export function rowsMatchingWhere(rows, where, schemaFields) {
  const terms = Array.isArray(where) ? where : []
  const listRows = Array.isArray(rows) ? rows : []
  if (!terms.length) return listRows.slice()
  return listRows.filter((row) => terms.every((term) => rowMatchesTerm(row, term, schemaFields)))
}
