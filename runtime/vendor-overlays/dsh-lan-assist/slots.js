/**
 * Structured slot enrichment from speech + workspace vocab (clues, kinds, relations).
 * No utterance-specific literals; uses registered kind labels and clue tables only.
 * @module dsh-lan-assist/slots
 */

import { collectionFields, mapKind, registeredKinds, relatedField } from './lookup.js'
import {
  inferNegatedClosedHit,
  schemaFieldsForKind,
  syntheticEnumClues,
} from './enum-clues.js'
import { saysOf } from './resolve.js'
import { vocabRow } from './where-pass.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const spokenSeed = require('./vocab/spoken.json')

function escapeRe(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

function negatedInSpeech(speech, hitIndex, extra) {
  const before = String(speech || '').slice(0, Math.max(0, hitIndex)).trim()
  if (!before) return false
  const particles = saysOf(extra, '否定')
  for (const say of particles.sort((a, b) => b.length - a.length)) {
    if (!say) continue
    if (before.endsWith(say) || before.includes(say)) return true
  }
  return false
}

function findClueHit(speech, clue, extra) {
  if (!clue || typeof clue !== 'object') return null
  const say = stringList(clue.say || clue.says || clue.label || clue.word || clue.words)
  const keys = stringList(clue.keys || clue.field || clue.fields)
  const values = stringList(clue.values || clue.value)
  const words = say.length ? say : values
  if (!words.length || !keys.length) return null
  const sorted = [...words].sort((a, b) => b.length - a.length)
  const re = new RegExp(sorted.map(escapeRe).join('|'), 'gi')
  const match = re.exec(String(speech || ''))
  if (!match) return null
  const hitIndex = match.index
  const negRole = String(clue.role || clue.slot || '').trim() === '否定'
  let not = clue.not === true || negRole || negatedInSpeech(speech, hitIndex, extra)
  if (!not && spokenSeed && Array.isArray(spokenSeed.clues)) {
    const hitText = String(match[0] || '')
    for (const seed of spokenSeed.clues) {
      if (!seed || seed.not !== true) continue
      const says = stringList(seed.say || seed.says)
      if (says.some((item) => item === hitText || (item.length > 1 && hitText.includes(item)))) {
        not = true
        break
      }
    }
  }
  const dateBefore = stringList(clue.dateBefore || clue.date_before)
  return {
    hitIndex,
    keys,
    values: values.length ? values : words,
    not,
    dateBefore: dateBefore.length ? dateBefore : undefined,
    say: match[0],
  }
}

function kindMentions(text, kinds) {
  const speech = String(text || '')
  const hits = []
  for (const kind of kinds) {
    const label = String(kind || '').trim()
    if (!label || label.length < 2) continue
    let from = 0
    while (from <= speech.length) {
      const idx = speech.indexOf(label, from)
      if (idx < 0) break
      hits.push({ kind: label, index: idx, end: idx + label.length })
      from = idx + label.length
    }
  }
  hits.sort((a, b) => a.index - b.index)
  return hits
}

function nearestKindForHit(hitIndex, mentions) {
  if (!mentions.length) return ''
  let best = mentions[0]
  let bestDist = Math.abs(hitIndex - (best.index + best.end) / 2)
  for (const row of mentions) {
    const center = (row.index + row.end) / 2
    const dist = Math.abs(hitIndex - center)
    if (dist < bestDist) {
      best = row
      bestDist = dist
    }
  }
  return best.kind
}

function relationsFromVocab(vocab, extra = {}) {
  const out = []
  const push = (rel) => {
    if (!rel || typeof rel !== 'object') return
    const from = String(rel.from || rel.fromKind || '').trim()
    const to = String(rel.to || rel.toKind || '').trim()
    const field = String(rel.field || '').trim()
    if (!from || !to) return
    out.push(field ? { from, to, field } : { from, to })
  }
  for (const row of Array.isArray(vocab) ? vocab : []) {
    for (const rel of Array.isArray(row && row.relations) ? row.relations : []) push(rel)
  }
  for (const rel of Array.isArray(extra.relations) ? extra.relations : []) push(rel)
  return out
}

function hopParentKindForTarget(targetKind, speech, extra) {
  const bag = { vocab: extra.vocab, ...extra }
  const kinds = registeredKinds(bag)
  const mentioned = [...new Set(kindMentions(speech, kinds).map((row) => row.kind))]
  const target = String(targetKind || '').trim()
  if (!target || mentioned.length < 2) return ''
  const parents = parentKindsOf(target, bag)
  for (const parent of parents) {
    if (mentioned.includes(parent)) return parent
  }
  for (const other of mentioned) {
    if (other === target) continue
    const reversed = parentKindsOf(other, bag)
    if (reversed.includes(target)) return other
  }
  return ''
}

function parentKindsOf(targetKind, extra) {
  const target = String(targetKind || '').trim()
  if (!target) return []
  const out = []
  const seen = new Set()
  for (const rel of relationsFromVocab(extra.vocab, extra)) {
    if (rel.to === target && rel.from && !seen.has(rel.from)) {
      seen.add(rel.from)
      out.push(rel.from)
    }
  }
  for (const from of registeredKinds(extra)) {
    if (!from || from === target || seen.has(from)) continue
    const field = relatedField(from, target, extra)
    if (field) {
      seen.add(from)
      out.push(from)
    }
  }
  return out
}

function vocabWithSpoken(vocab) {
  const rows = Array.isArray(vocab) ? vocab.slice() : []
  if (!rows.some((row) => row && (row.spoken || row.kind === '口语'))) {
    rows.push({
      kind: '口语',
      spoken: true,
      clues: spokenSeed && Array.isArray(spokenSeed.clues) ? spokenSeed.clues : [],
    })
  }
  return rows
}

function syntheticCluesByKind(vocab, extra) {
  const map = new Map()
  for (const row of Array.isArray(vocab) ? vocab : []) {
    const kind = String(row && (row.kind || row.label) || '').trim()
    if (!kind || kind === '口语') continue
    const schemaFields = schemaFieldsForKind(kind, vocab, extra)
    if (!schemaFields.length) continue
    map.set(kind, syntheticEnumClues(kind, schemaFields, vocabRow(kind, vocab)))
  }
  return map
}

function clueHitsInSpeech(speech, vocab, extra = {}) {
  const text = String(speech || '')
  if (!text.trim()) return []
  const mergedVocab = vocabWithSpoken(vocab)
  const kinds = registeredKinds({ vocab: mergedVocab })
  const mentions = kindMentions(text, kinds)
  const bag = { vocab: mergedVocab, ...extra }
  const synthetic = syntheticCluesByKind(mergedVocab, extra)
  const hits = []
  for (const row of mergedVocab) {
    if (!row) continue
    const owner = String(row.kind || row.label || '').trim()
    const clues = [
      ...cluesOfRow(row),
      ...(synthetic.get(owner) || []),
    ]
    for (const clue of clues) {
      const packed = findClueHit(text, clue, bag)
      if (!packed) continue
      const assign = owner && owner !== '口语' && mentions.some((m) => m.kind === owner)
        ? owner
        : nearestKindForHit(packed.hitIndex, mentions)
      hits.push({ ...packed, assignKind: assign || owner || '' })
    }
  }
  for (const kind of kinds) {
    if (kind === '口语') continue
    const schemaFields = schemaFieldsForKind(kind, mergedVocab, extra)
    const inferred = inferNegatedClosedHit(text, kind, schemaFields, mergedVocab)
    if (!inferred) continue
    hits.push({
      ...inferred,
      assignKind: nearestKindForHit(inferred.hitIndex, mentions) || kind,
    })
  }
  return hits
}

function termKey(term) {
  return JSON.stringify({
    keys: term.keys,
    values: term.values,
    not: !!term.not,
    dateBefore: term.dateBefore || [],
    dateAfter: term.dateAfter || [],
  })
}

function mergeTerms(list) {
  const out = []
  const seen = new Set()
  for (const term of Array.isArray(list) ? list : []) {
    if (!term || typeof term !== 'object') continue
    const key = termKey(term)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      keys: [...(term.keys || [])],
      values: [...(term.values || [])],
      not: !!term.not,
      ...(Array.isArray(term.dateBefore) && term.dateBefore.length ? { dateBefore: term.dateBefore } : {}),
      ...(Array.isArray(term.dateAfter) && term.dateAfter.length ? { dateAfter: term.dateAfter } : {}),
    })
  }
  return out
}

function isFilterableHit(hit) {
  if (!hit || typeof hit !== 'object') return false
  const keys = (hit.keys || []).map((item) => String(item || '').trim()).filter(Boolean)
  if (!keys.length) return false
  if (keys.every((key) => key === 'role' || key === 'action' || key === 'join')) return false
  return keys.some((key) => /^(status|state|stage|priority|category|type|状态|优先级|类型)$/i.test(key))
}

function closedLikeValues(values) {
  return (Array.isArray(values) ? values : []).some((item) => (
    /关|关闭|resolved|closed|done|completed/i.test(String(item || ''))
  ))
}

function dedupeNegatedClosedHits(hits) {
  const list = Array.isArray(hits) ? hits : []
  const hasNeg = list.some((row) => row && row.not && closedLikeValues(row.values))
  if (!hasNeg) return list
  return list.filter((row) => !(row && !row.not && closedLikeValues(row.values)))
}

function compressStatusWhere(terms) {
  const list = Array.isArray(terms) ? terms : []
  if (list.length <= 1) return list
  const statusLike = list.every((term) => (
    (term.keys || []).some((key) => /^(status|state|stage|状态)$/i.test(String(key || '')))
  ))
  if (!statusLike) return list
  const values = [...new Set(list.flatMap((term) => term.values || []))]
  const not = list.some((term) => term && term.not)
  return [{
    keys: [...(list[0].keys || [])],
    values,
    not,
    ...(Array.isArray(list[0].dateBefore) && list[0].dateBefore.length ? { dateBefore: list[0].dateBefore } : {}),
  }]
}

function termsForKind(hits, kind) {
  const want = String(kind || '').trim()
  return mergeTerms(dedupeNegatedClosedHits(hits).filter((row) => row.assignKind === want && isFilterableHit(row)).map((row) => ({
    keys: row.keys,
    values: row.values,
    not: row.not,
    dateBefore: row.dateBefore,
  })))
}

/**
 * When the model only filled the child kind + partial where, recover parent hop slots
 * from speech using vocab clues and graph/catalog relations (or collection FK inference).
 */
export function enrichStructuredSlots(spec, vocab, extra = {}) {
  const base = spec && typeof spec === 'object' ? { ...spec } : {}
  const speech = String(base.speech || base.quote || '').trim()
  const targetKind = String(base.kind || '').trim()
  if (!speech || !targetKind) return base
  if (base.from && typeof base.from === 'object' && base.from.kind) return base
  if (Array.isArray(base.steps) && base.steps.length) return base

  const bag = {
    vocab,
    collections: extra.collections,
    kinds: extra.kinds,
    relations: extra.relations,
    schemaByKind: extra.schemaByKind,
  }
  const hits = clueHitsInSpeech(speech, vocab, bag)
  const childWhere = mergeTerms([
    ...termsForKind(hits, targetKind),
    ...(Array.isArray(base.where) ? base.where : []),
  ])
  const parents = parentKindsOf(targetKind, bag)
  let parent = parents.find((kind) => termsForKind(hits, kind).length) || parents.find((kind) => (
    kindMentions(speech, [kind]).length
  ))
  if (!parent) parent = hopParentKindForTarget(targetKind, speech, bag)
  const parentWhereRaw = parent ? termsForKind(hits, parent) : []
  const parentWhere = compressStatusWhere(parentWhereRaw)
  const parentValues = new Set(parentWhere.flatMap((term) => term.values || []))
  const childFiltered = childWhere.filter((term) => {
    const vals = term.values || []
    if (!parentWhere.length || !vals.length) return true
    return !vals.every((value) => parentValues.has(value))
  })

  if (!parent && !parentWhere.length && !childFiltered.length) return base

  const next = { ...base }
  if (parent) {
    next.from = parentWhere.length ? { kind: parent, where: parentWhere } : { kind: parent }
  }
  if (childFiltered.length) next.where = childFiltered
  return next
}

export { clueHitsInSpeech, parentKindsOf, kindMentions }
