/**
 * Generic preview where pass-through: alias formats, shape-label → schema keys, date/year ranges.
 * @module dsh-lan-assist/where-pass
 */

import { PAGE_SIZE } from './plan.js'

export const WHERE_LIST_CAP = 5000

function list(value) {
  return (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
}

function schemaTitle(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.title || (row.uiSchema && row.uiSchema.title) || '').trim()
}

function isDateField(row) {
  if (!row || typeof row !== 'object') return false
  const t = String(row.type || '').toLowerCase()
  return t.includes('date') || t.includes('time')
}

function vocabRow(kind, vocab) {
  const key = String(kind || '').trim()
  if (!key) return null
  for (const row of Array.isArray(vocab) ? vocab : []) {
    if (!row) continue
    const name = String(row.kind || row.label || '').trim()
    if (name === key) return row
  }
  return null
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

export function resolveShapeKey(label, schemaFields, vocabHit) {
  const want = String(label || '').trim()
  if (!want) return want
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(want)) return want
  const fields = Array.isArray(schemaFields) ? schemaFields : []
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

function expandYearOnKeys(term, schemaFields, vocabHit) {
  const keys = list(term.keys).map((key) => resolveShapeKey(key, schemaFields, vocabHit))
  const values = list(term.values)
  if (!keys.length || values.length !== 1) return [term]
  const bounds = yearBounds(values[0])
  if (!bounds) return [term]
  const dateKey = keys.find((key) => {
    const row = (schemaFields || []).find((item) => item && item.name === key)
    return row && isDateField(row)
  }) || dateFieldNames(schemaFields, vocabHit)[0]
  if (!dateKey) return [term]
  return [
    { dateAfter: [dateKey], values: [bounds.start] },
    { dateBefore: [dateKey], values: [bounds.end] },
  ]
}

function expandYearOnDateSlot(term, slot, schemaFields, vocabHit) {
  const keys = list(term[slot])
  const values = list(term.values)
  if (!keys.length || values.length !== 1) return [term]
  const bounds = yearBounds(values[0])
  if (!bounds) return [term]
  const resolved = keys.map((key) => resolveShapeKey(key, schemaFields, vocabHit))
  const dateKey = resolved.find((key) => {
    const row = (schemaFields || []).find((item) => item && item.name === key)
    return row && isDateField(row)
  }) || resolved[0]
  if (!dateKey) return [term]
  if (slot === 'dateAfter') {
    return [
      { dateAfter: [dateKey], values: [bounds.start] },
      { dateBefore: [dateKey], values: [bounds.end] },
    ]
  }
  if (slot === 'dateBefore') return [{ dateBefore: [dateKey], values: [bounds.end] }]
  return [term]
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

export function bindWhereKeys(terms, kind, vocab, schemaFields) {
  const vocabHit = vocabRow(kind, vocab)
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const out = []
  for (const term of Array.isArray(terms) ? terms : []) {
    if (!term || typeof term !== 'object') continue
    if (term.dateAfter) {
      out.push(...expandYearOnDateSlot(term, 'dateAfter', fields, vocabHit))
      continue
    }
    if (term.dateBefore) {
      out.push(...expandYearOnDateSlot(term, 'dateBefore', fields, vocabHit))
      continue
    }
    const keys = list(term.keys).map((key) => resolveShapeKey(key, fields, vocabHit))
    const packed = { ...term, keys }
    if (keys.length && list(term.values).length === 1 && yearBounds(term.values[0])) {
      out.push(...expandYearOnKeys(packed, fields, vocabHit))
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

export function termFilterPart(term, today) {
  const keys = list(term.keys)
  const vals = list(term.values)
  const asciiKey = keys.find((item) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(item))
  const statusPart = asciiKey && vals.length
    ? (term.not
      ? (vals.length === 1 ? { [asciiKey]: { $ne: vals[0] } } : { [asciiKey]: { $notIn: vals } })
      : (vals.length === 1 ? { [asciiKey]: vals[0] } : { [asciiKey]: { $in: vals } }))
    : null
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
