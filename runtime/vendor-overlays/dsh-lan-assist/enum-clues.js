/**
 * Clue synthesis from live collection enums + shape labels (no utterance literals).
 * @module dsh-lan-assist/enum-clues
 */

import { enumMap } from './resolve.js'
import { collectionFields, mapKind } from './lookup.js'
import { resolveShapeKey, vocabRow } from './where-pass.js'

const CLOSED_LABEL = /关|关闭|resolved|closed|done|completed|cancelled|canceled|void/i

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    return trimmed.split(/[,，、]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function statusShapeKeys(schemaFields, vocabHit) {
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const keys = new Set()
  const statusKey = resolveShapeKey('状态', fields, vocabHit)
  if (statusKey) keys.add(statusKey)
  for (const row of fields) {
    const name = String((row && row.name) || '').trim()
    if (name && /^(status|state|stage)$/i.test(name)) keys.add(name)
  }
  return [...keys]
}

function enumsOnField(field) {
  if (!field || typeof field !== 'object') return {}
  const packed = (field.enums && typeof field.enums === 'object' && !Array.isArray(field.enums) && Object.keys(field.enums).length)
    ? field.enums
    : enumMap(field)
  return packed && typeof packed === 'object' ? packed : {}
}

function fieldForKey(key, schemaFields) {
  const want = String(key || '').trim()
  return (Array.isArray(schemaFields) ? schemaFields : []).find((row) => row && String(row.name || '') === want) || null
}

export function closedEnumCodesForKeys(schemaFields, keys, vocabHit) {
  const codes = new Set()
  const listed = stringList(keys)
  const fallback = listed.length ? listed : statusShapeKeys(schemaFields, vocabHit)
  for (const rawKey of fallback) {
    const key = resolveShapeKey(rawKey, schemaFields, vocabHit)
    const field = fieldForKey(key, schemaFields)
    const enums = enumsOnField(field)
    for (const [code, label] of Object.entries(enums)) {
      const text = `${label || ''} ${code || ''}`
      if (CLOSED_LABEL.test(text)) codes.add(String(code))
    }
  }
  return [...codes]
}

export function schemaFieldsForKind(kind, vocab, extra = {}) {
  const key = String(kind || '').trim()
  const cached = extra.schemaByKind && extra.schemaByKind[key]
  if (Array.isArray(cached) && cached.length) return cached
  const collections = Array.isArray(extra.collections) ? extra.collections : []
  const mapped = mapKind(kind, { vocab, collections, kinds: extra.kinds })
  if (!mapped || !mapped.resource) return []
  return collectionFields(mapped.resource, collections)
}

export function expandNegatedClosedValues(terms, schemaFields, kind, vocab) {
  const vocabHit = vocabRow(kind, vocab)
  return (Array.isArray(terms) ? terms : []).map((term) => {
    if (!term || typeof term !== 'object' || !term.not) return term
    const codes = closedEnumCodesForKeys(schemaFields, term.keys, vocabHit)
    if (!codes.length) return term
    return { ...term, values: codes }
  })
}

