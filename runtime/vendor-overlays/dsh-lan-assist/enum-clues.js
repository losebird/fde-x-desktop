/**
 * Clue synthesis from live collection enums + shape labels (no utterance literals).
 * @module dsh-lan-assist/enum-clues
 */

import { createRequire } from 'node:module'
import { enumMap } from './resolve.js'
import { collectionFields, mapKind } from './lookup.js'
import { resolveShapeKey, vocabRow } from './where-pass.js'

const require = createRequire(import.meta.url)
const spokenSeed = require('./vocab/spoken.json')

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

function cluesOfRow(row) {
  if (!row) return []
  const raw = row.clues
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([say, spec]) => (
      spec && typeof spec === 'object' ? { say, ...spec } : { say, value: spec }
    ))
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

function labelSuffixes(label) {
  const text = String(label || '').trim()
  if (!text) return []
  const out = new Set([text])
  const tail = text.match(/(?:已|未)?(.+[关閉].*)$/)
  if (tail && tail[1]) out.add(tail[1])
  if (text.length > 1) out.add(text.slice(-2))
  return [...out].filter((item) => item.length >= 1)
}

function negationPrefixesFromVocab(vocab) {
  const prefs = new Set()
  const rows = [
    ...(Array.isArray(vocab) ? vocab : []),
    spokenSeed && typeof spokenSeed === 'object' ? spokenSeed : null,
  ]
  for (const row of rows) {
    if (!row) continue
    for (const clue of cluesOfRow(row)) {
      if (!clue || clue.not !== true) continue
      for (const say of stringList(clue.say || clue.says)) {
        const m = String(say).match(/^(.{1,3})(.+[关閉].*)$/)
        if (m) prefs.add(m[1])
      }
    }
  }
  return [...prefs]
}

export function syntheticEnumClues(kind, schemaFields, vocabHit) {
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const clues = []
  const shapeKeys = new Map()
  for (const row of fields) {
    const name = String((row && row.name) || '').trim()
    if (!name) continue
    const title = String((row && row.title) || '').trim()
    const shape = title || name
    shapeKeys.set(name, shape)
    const enums = enumsOnField(row)
    for (const [code, label] of Object.entries(enums)) {
      const say = stringList(label).length ? stringList(label) : [String(code)]
      clues.push({
        say,
        keys: [shape, name],
        values: [String(code)],
      })
    }
  }
  const closedCodes = closedEnumCodesForKeys(fields, statusShapeKeys(fields, vocabHit), vocabHit)
  if (closedCodes.length) {
    const keys = statusShapeKeys(fields, vocabHit).map((key) => shapeKeys.get(key) || key)
    const says = new Set()
    for (const row of fields) {
      const enums = enumsOnField(row)
      for (const [code, label] of Object.entries(enums)) {
        if (!closedCodes.includes(String(code))) continue
        for (const frag of labelSuffixes(label)) says.add(frag)
      }
    }
    for (const say of says) {
      clues.push({ say: [say], keys, values: closedCodes, not: true })
    }
  }
  return clues
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

export function inferNegatedClosedHit(speech, kind, schemaFields, vocab) {
  const text = String(speech || '')
  if (!text.trim()) return null
  const vocabHit = vocabRow(kind, vocab)
  const keys = statusShapeKeys(schemaFields, vocabHit)
  const codes = closedEnumCodesForKeys(schemaFields, keys, vocabHit)
  if (!codes.length) return null
  const prefixes = negationPrefixesFromVocab(vocab)
  const frags = new Set()
  for (const row of schemaFields) {
    const enums = enumsOnField(row)
    for (const [code, label] of Object.entries(enums)) {
      if (!codes.includes(String(code))) continue
      for (const frag of labelSuffixes(label)) frags.add(frag)
    }
  }
  for (const prefix of prefixes) {
    for (const frag of frags) {
      const needle = `${prefix}${frag}`
      const idx = text.indexOf(needle)
      if (idx >= 0) {
        return {
          hitIndex: idx,
          keys,
          values: codes,
          not: true,
          say: needle,
        }
      }
    }
  }
  return null
}
