/**
 * Structured slot enrichment from speech + workspace vocab (clues, kinds, relations).
 * No utterance-specific literals; uses registered kind labels and clue tables only.
 * @module dsh-lan-assist/slots
 */

import { collectionFields, mapKind, registeredKinds, relatedField } from './lookup.js'
import { saysOf } from './resolve.js'

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
  const not = clue.not === true || negRole || negatedInSpeech(speech, hitIndex, extra)
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

function relationsFromVocab(vocab) {
  const out = []
  for (const row of Array.isArray(vocab) ? vocab : []) {
    for (const rel of Array.isArray(row && row.relations) ? row.relations : []) {
      if (!rel || typeof rel !== 'object') continue
      const from = String(rel.from || rel.fromKind || '').trim()
      const to = String(rel.to || rel.toKind || '').trim()
      const field = String(rel.field || '').trim()
      if (!from || !to) continue
      out.push(field ? { from, to, field } : { from, to })
    }
  }
  return out
}

function parentKindsOf(targetKind, extra) {
  const target = String(targetKind || '').trim()
  if (!target) return []
  const out = []
  const seen = new Set()
  for (const rel of relationsFromVocab(extra.vocab)) {
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

function clueHitsInSpeech(speech, vocab, extra = {}) {
  const text = String(speech || '')
  if (!text.trim()) return []
  const kinds = registeredKinds({ vocab })
  const mentions = kindMentions(text, kinds)
  const bag = { vocab, ...extra }
  const hits = []
  for (const row of Array.isArray(vocab) ? vocab : []) {
    if (!row) continue
    for (const clue of cluesOfRow(row)) {
      const packed = findClueHit(text, clue, bag)
      if (!packed) continue
      const owner = String(row.kind || row.label || '').trim()
      const assign = owner && owner !== '口语' && mentions.some((m) => m.kind === owner)
        ? owner
        : nearestKindForHit(packed.hitIndex, mentions)
      hits.push({ ...packed, assignKind: assign || owner || '' })
    }
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

function termsForKind(hits, kind) {
  const want = String(kind || '').trim()
  return mergeTerms(hits.filter((row) => row.assignKind === want).map((row) => ({
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

  const bag = { vocab, collections: extra.collections, kinds: extra.kinds }
  const parents = parentKindsOf(targetKind, bag)
  if (!parents.length) return base

  const hits = clueHitsInSpeech(speech, vocab)
  const parent = parents.find((kind) => termsForKind(hits, kind).length) || parents.find((kind) => (
    kindMentions(speech, [kind]).length
  ))
  if (!parent) return base

  const parentWhere = termsForKind(hits, parent)
  const childWhere = mergeTerms([
    ...termsForKind(hits, targetKind),
    ...(Array.isArray(base.where) ? base.where : []),
  ])
  if (!parentWhere.length && !childWhere.length) return base

  const next = { ...base }
  if (parentWhere.length) {
    next.from = { kind: parent, where: parentWhere }
  }
  if (childWhere.length) next.where = childWhere
  return next
}

export { clueHitsInSpeech, parentKindsOf, kindMentions }
