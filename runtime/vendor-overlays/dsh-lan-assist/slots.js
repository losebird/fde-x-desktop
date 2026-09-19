/**
 * Structured slot enrichment from speech + workspace vocab (clues, kinds, relations).
 * No utterance-specific literals; uses registered kind labels and clue tables only.
 * @module dsh-lan-assist/slots
 */

import { collectionFields, mapKind, registeredKinds, relatedField, schemaRelatedField } from './lookup.js'
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

function isLeftoverShortKind(kind, labels, extra) {
  const name = String(kind || '').trim()
  if (!name) return false
  const hasSuffix = labels.some((other) => other !== name && other.endsWith(name))
  if (!hasSuffix) return false
  if (!extra || !Object.keys(extra).length) return true
  const relations = relationsFromVocab(extra.vocab, extra)
  if (relations.some((rel) => rel.from === name || rel.to === name)) return false
  return true
}

function titleSuffixTokens(title) {
  const out = []
  const label = String(title || '').trim()
  for (let len = label.length - 1; len >= 2; len -= 1) {
    out.push(label.slice(label.length - len))
  }
  return out
}

function spokenAliasTokens(kind, vocab) {
  const row = vocabRow(kind, vocab)
  if (!row) return []
  const says = []
  for (const clue of cluesOfRow(row)) {
    if (String(clue.role || '').trim() !== '型') continue
    for (const say of stringList(clue.say || clue.says)) {
      const alias = String(say || '').trim()
      if (alias && alias !== kind) says.push(alias)
    }
  }
  return says
}

function pushGraphAliasFields(obj, kind, out) {
  if (!obj || typeof obj !== 'object') return
  for (const key of ['alias', 'aliases', 'label', 'say']) {
    for (const item of stringList(obj[key])) {
      if (item && item !== kind) out.push(item)
    }
  }
}

function graphAliasTokens(kind, extra = {}) {
  const tokens = []
  const row = vocabRow(kind, extra.vocab)
  if (row) {
    for (const item of stringList(row.aliases)) {
      if (item && item !== kind) tokens.push(item)
    }
    for (const rel of Array.isArray(row.relations) ? row.relations : []) {
      pushGraphAliasFields(rel, kind, tokens)
    }
  }
  for (const rel of Array.isArray(extra.relations) ? extra.relations : []) {
    if (rel.from !== kind && rel.to !== kind) continue
    pushGraphAliasFields(rel, kind, tokens)
  }
  return tokens
}

function tokensForKindLabel(label, extra) {
  const tokens = new Set()
  if (label.length >= 2) tokens.add(label)
  for (const suffix of titleSuffixTokens(label)) tokens.add(suffix)
  if (extra && extra.vocab) {
    for (const alias of spokenAliasTokens(label, extra.vocab)) {
      if (alias.length >= 2) tokens.add(alias)
    }
    for (const alias of graphAliasTokens(label, extra)) {
      if (alias.length >= 2) tokens.add(alias)
    }
  }
  return [...tokens].filter((token) => token.length >= 2)
}

function kindMentions(text, kinds, extra) {
  const speech = String(text || '')
  const labels = [...new Set((Array.isArray(kinds) ? kinds : []).map((kind) => String(kind || '').trim()).filter((label) => label.length >= 2))]
  const candidates = []
  for (const kind of labels) {
    const tokens = tokensForKindLabel(kind, extra)
    for (const token of tokens) {
      let from = 0
      while (from <= speech.length) {
        const idx = speech.indexOf(token, from)
        if (idx < 0) break
        candidates.push({ kind, token, index: idx, end: idx + token.length })
        from = idx + 1
      }
    }
  }
  const candidateKinds = new Set(candidates.map((row) => row.kind))
  const neighborScore = (kind) => {
    if (!extra || !extra.vocab) return 0
    return graphNeighbors(kind, extra).filter((other) => other !== kind && candidateKinds.has(other)).length
  }
  candidates.sort((a, b) => {
    const byToken = b.token.length - a.token.length
    if (byToken !== 0) return byToken
    const byGraph = neighborScore(b.kind) - neighborScore(a.kind)
    if (byGraph !== 0) return byGraph
    const aLeft = isLeftoverShortKind(a.kind, labels, extra) ? 1 : 0
    const bLeft = isLeftoverShortKind(b.kind, labels, extra) ? 1 : 0
    if (aLeft !== bLeft) return aLeft - bLeft
    const aExact = a.token === a.kind ? 0 : 1
    const bExact = b.token === b.kind ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    return b.kind.length - a.kind.length
  })
  const taken = new Array(speech.length).fill(false)
  const hits = []
  for (const row of candidates) {
    let blocked = false
    for (let i = row.index; i < row.end; i += 1) {
      if (taken[i]) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    hits.push({ kind: row.kind, index: row.index, end: row.end })
    for (let i = row.index; i < row.end; i += 1) taken[i] = true
  }
  hits.sort((a, b) => a.index - b.index)
  return hits
}

function spokenAndGraphAliasTokens(kind, extra) {
  const out = new Set()
  if (!extra || !extra.vocab) return out
  for (const alias of spokenAliasTokens(kind, extra.vocab)) {
    if (alias.length >= 2) out.add(alias)
  }
  for (const alias of graphAliasTokens(kind, extra)) {
    if (alias.length >= 2) out.add(alias)
  }
  return out
}

function sharesFragmentWithSpec(mentionedKind, specKind, extra) {
  const M = String(mentionedKind || '').trim()
  const spec = String(specKind || '').trim()
  if (!M || !spec) return false
  if (M.endsWith(spec)) return true
  for (const suffix of titleSuffixTokens(M)) {
    if (spec.startsWith(suffix)) return true
  }
  if (spokenAndGraphAliasTokens(M, extra).has(spec)) return true
  return false
}

function remapEnrichTargetKind(specKind, speech, bag) {
  const spec = String(specKind || '').trim()
  if (!spec) return spec
  const kinds = registeredKinds(bag)
  const mentioned = [...new Set(kindMentions(speech, kinds, bag).map((row) => row.kind))]
  const needRemap = isLeftoverShortKind(spec, kinds, bag) || !mentioned.includes(spec)
  if (!needRemap) return spec
  const candidates = mentioned.filter((M) => sharesFragmentWithSpec(M, spec, bag))
  if (!candidates.length) return spec
  const mentionedSet = new Set(mentioned)
  const score = (M) => {
    const neighbors = graphNeighbors(M, bag)
    if (neighbors.some((n) => mentionedSet.has(n))) return 3
    if (neighbors.length) return 2
    return 1
  }
  candidates.sort((a, b) => {
    const byGraph = score(b) - score(a)
    if (byGraph !== 0) return byGraph
    return b.length - a.length
  })
  return candidates[0]
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

function kindAfterClueInSpeech(speech, hitIndex, sayText, mentions) {
  const hitEnd = hitIndex + String(sayText || '').length
  let bestKind = ''
  let bestGap = Infinity
  for (const row of mentions) {
    if (row.index < hitEnd) continue
    const between = speech.slice(hitEnd, row.index)
    if (!/^[\s∩、，,；;：:·\-—]*$/u.test(between)) continue
    const gap = row.index - hitEnd
    if (gap < bestGap) {
      bestGap = gap
      bestKind = row.kind
    }
  }
  return bestKind || nearestKindForHit(hitIndex, mentions)
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
  const chain = relatedKindChain(targetKind, speech, extra)
  if (chain.length >= 2) return chain[chain.length - 2]
  return ''
}

function graphNeighbors(kind, extra) {
  const want = String(kind || '').trim()
  if (!want) return []
  const out = []
  const seen = new Set()
  const push = (other) => {
    const name = String(other || '').trim()
    if (!name || name === want || seen.has(name)) return
    seen.add(name)
    out.push(name)
  }
  for (const rel of relationsFromVocab(extra.vocab, extra)) {
    if (rel.from === want) push(rel.to)
    if (rel.to === want) push(rel.from)
  }
  if (Array.isArray(extra.collections) && extra.collections.length) {
    for (const other of registeredKinds(extra)) {
      if (schemaRelatedField(want, other, extra) || schemaRelatedField(other, want, extra)) {
        push(other)
      }
    }
  }
  return out
}

/**
 * Mentioned related kinds, ordered from furthest graph ancestor toward target.
 * Length is the number of kinds on the chain (2, 3, …) — never capped at a pair.
 */
function relatedKindChain(targetKind, speech, extra) {
  const target = String(targetKind || '').trim()
  if (!target) return []
  const kinds = registeredKinds(extra)
  const mentioned = [...new Set(kindMentions(speech, kinds, extra).map((row) => row.kind))]
  const bag = new Set(mentioned)
  bag.add(target)
  const undirected = new Map()
  const addU = (a, b) => {
    if (!undirected.has(a)) undirected.set(a, new Set())
    undirected.get(a).add(b)
  }
  const seed = [...bag]
  for (const kind of seed) {
    for (const other of graphNeighbors(kind, extra)) {
      if (!bag.has(other)) continue
      addU(kind, other)
      addU(other, kind)
    }
  }
  if (Array.isArray(extra.collections) && extra.collections.length) {
    for (let i = 0; i < seed.length; i += 1) {
      for (let j = i + 1; j < seed.length; j += 1) {
        const left = seed[i]
        const right = seed[j]
        if (schemaRelatedField(left, right, extra) || schemaRelatedField(right, left, extra)) {
          addU(left, right)
          addU(right, left)
        }
      }
    }
  }
  const connected = new Set()
  const queue = [target]
  connected.add(target)
  while (queue.length) {
    const cur = queue.shift()
    for (const next of (undirected.get(cur) || [])) {
      if (connected.has(next)) continue
      connected.add(next)
      queue.push(next)
    }
  }
  if (connected.size < 2) return [target]
  const incoming = new Map()
  const children = new Map()
  for (const kind of connected) {
    incoming.set(kind, 0)
    children.set(kind, [])
  }
  for (const rel of relationsFromVocab(extra.vocab, extra)) {
    if (!connected.has(rel.from) || !connected.has(rel.to)) continue
    incoming.set(rel.to, (incoming.get(rel.to) || 0) + 1)
    children.get(rel.from).push(rel.to)
  }
  if (Array.isArray(extra.collections) && extra.collections.length) {
    for (const from of connected) {
      for (const to of connected) {
        if (from === to) continue
        if (!schemaRelatedField(from, to, extra)) continue
        if ((children.get(from) || []).includes(to)) continue
        incoming.set(to, (incoming.get(to) || 0) + 1)
        children.get(from).push(to)
      }
    }
  }
  const ready = [...connected].filter((kind) => (incoming.get(kind) || 0) === 0)
  const ordered = []
  const seen = new Set()
  while (ready.length) {
    let idx = 0
    if (ready.length > 1) {
      const skipTarget = ready.findIndex((kind) => kind !== target)
      if (skipTarget >= 0) idx = skipTarget
    }
    const node = ready.splice(idx, 1)[0]
    if (seen.has(node)) continue
    seen.add(node)
    ordered.push(node)
    for (const child of (children.get(node) || [])) {
      incoming.set(child, incoming.get(child) - 1)
      if (incoming.get(child) === 0) ready.push(child)
    }
  }
  for (const kind of connected) {
    if (!seen.has(kind)) ordered.push(kind)
  }
  return [...ordered.filter((kind) => kind !== target), target]
}

function relatedMentionedKinds(speech, vocab, extra = {}) {
  const bag = { vocab, ...extra }
  const kinds = registeredKinds(bag)
  const mentioned = [...new Set(kindMentions(String(speech || ''), kinds, bag).map((row) => row.kind))]
  if (!mentioned.length) return { mentioned, related: [] }
  const mentionedSet = new Set(mentioned)
  const undirected = new Map()
  const addU = (a, b) => {
    if (!undirected.has(a)) undirected.set(a, new Set())
    undirected.get(a).add(b)
  }
  for (const kind of mentioned) {
    for (const other of graphNeighbors(kind, bag)) {
      if (!mentionedSet.has(other)) continue
      addU(kind, other)
      addU(other, kind)
    }
  }
  if (Array.isArray(extra.collections) && extra.collections.length) {
    for (let i = 0; i < mentioned.length; i += 1) {
      for (let j = i + 1; j < mentioned.length; j += 1) {
        const left = mentioned[i]
        const right = mentioned[j]
        if (schemaRelatedField(left, right, bag) || schemaRelatedField(right, left, bag)) {
          addU(left, right)
          addU(right, left)
        }
      }
    }
  }
  const seen = new Set()
  let related = []
  for (const start of mentioned) {
    if (seen.has(start)) continue
    const component = []
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const cur = queue.shift()
      component.push(cur)
      for (const next of (undirected.get(cur) || [])) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    if (component.length > related.length) related = component
  }
  return { mentioned, related }
}

export function pickHopSpeech(modelSpeech, userSpeech, vocab, extra = {}) {
  const model = String(modelSpeech || '').trim()
  const user = String(userSpeech || '').trim()
  if (!user) return model
  if (!model) return user
  if (model === user) return model
  const userRel = relatedMentionedKinds(user, vocab, extra).related.length
  const modelRel = relatedMentionedKinds(model, vocab, extra).related.length
  if (userRel > modelRel) return user
  return model
}

const lastSpeechBySession = new Map()

export function rememberUserSpeech(sessionId, speech) {
  const sid = String(sessionId || '').trim()
  const text = String(speech || '').trim()
  if (!sid || !text) return
  if (lastSpeechBySession.has(sid)) lastSpeechBySession.delete(sid)
  lastSpeechBySession.set(sid, text)
  while (lastSpeechBySession.size > 32) {
    const oldest = lastSpeechBySession.keys().next().value
    lastSpeechBySession.delete(oldest)
  }
}

export function recalledUserSpeech(sessionId) {
  return lastSpeechBySession.get(String(sessionId || '').trim()) || ''
}

function nestFromSteps(steps) {
  const hops = (Array.isArray(steps) ? steps : []).slice(0, -1)
  if (!hops.length) return undefined
  let node = null
  for (let i = hops.length - 1; i >= 0; i -= 1) {
    const step = hops[i]
    const next = {
      kind: step.kind,
      ...(Array.isArray(step.where) && step.where.length ? { where: step.where } : {}),
    }
    if (node) next.from = node
    node = next
  }
  return node
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
  const mentions = kindMentions(text, kinds, { vocab: mergedVocab, ...extra })
  const bag = { vocab: mergedVocab, ...extra }
  const synthetic = syntheticCluesByKind(mergedVocab, extra)
  const hits = []
  for (const row of mergedVocab) {
    if (!row) continue
    const owner = String(row.kind || row.label || '').trim()
    const explicit = cluesOfRow(row)
    const clues = [
      ...explicit,
      ...(synthetic.get(owner) || []),
    ]
    for (const clue of clues) {
      const packed = findClueHit(text, clue, bag)
      if (!packed) continue
      const ownerMentioned = owner && owner !== '口语' && mentions.some((m) => m.kind === owner)
      const fromSynthetic = !(explicit.includes(clue))
      const assign = ownerMentioned && !fromSynthetic
        ? owner
        : kindAfterClueInSpeech(text, packed.hitIndex, packed.say, mentions)
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
      assignKind: kindAfterClueInSpeech(text, inferred.hitIndex, inferred.say, mentions) || kind,
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

function whereForKind(hits, kind, extraWhere) {
  const merged = mergeTerms([
    ...termsForKind(hits, kind),
    ...(Array.isArray(extraWhere) ? extraWhere : []),
  ])
  return compressStatusWhere(merged)
}

/**
 * When the model only filled the child kind + partial where, recover hop slots
 * from speech using vocab clues and graph/catalog relations (or collection FK inference).
 * Mentioned related kinds (2 or more) become one chain of steps — not a single pair.
 */
export function enrichStructuredSlots(spec, vocab, extra = {}) {
  const base = spec && typeof spec === 'object' ? { ...spec } : {}
  const speech = String(base.speech || base.quote || '').trim()
  let targetKind = String(base.kind || '').trim()
  if (!speech || !targetKind) return base

  const bag = {
    vocab,
    collections: extra.collections,
    kinds: extra.kinds,
    relations: extra.relations,
    schemaByKind: extra.schemaByKind,
  }
  targetKind = remapEnrichTargetKind(targetKind, speech, bag)
  const hits = clueHitsInSpeech(speech, vocab, bag)
  const chainKinds = relatedKindChain(targetKind, speech, bag)
  const existingSteps = Array.isArray(base.steps) ? base.steps.filter((row) => row && row.kind) : []

  if (chainKinds.length >= 2) {
    const steps = chainKinds.map((kind, index) => {
      const extraWhere = kind === targetKind && index === chainKinds.length - 1
        ? (Array.isArray(base.where) ? base.where : [])
        : []
      const where = whereForKind(hits, kind, extraWhere)
      const prev = index > 0 ? chainKinds[index - 1] : ''
      return prev ? { kind, where, from: prev } : { kind, where }
    })
    const ancestorValues = new Set(steps.slice(0, -1).flatMap((step) => (
      (step.where || []).flatMap((term) => term.values || [])
    )))
    const last = steps[steps.length - 1]
    last.where = (last.where || []).filter((term) => {
      const vals = term.values || []
      if (!ancestorValues.size || !vals.length) return true
      return !vals.every((value) => ancestorValues.has(value))
    })
    const next = { ...base, kind: targetKind, steps }
    const from = nestFromSteps(steps)
    if (from) next.from = from
    if (last.where.length) next.where = last.where
    else delete next.where
    return next
  }

  if (base.from && typeof base.from === 'object' && base.from.kind) return base
  if (existingSteps.length) return base

  const childWhere = whereForKind(hits, targetKind, base.where)
  const parents = parentKindsOf(targetKind, bag)
  let parent = parents.find((kind) => termsForKind(hits, kind).length) || parents.find((kind) => (
    kindMentions(speech, [kind], bag).length
  ))
  if (!parent) parent = hopParentKindForTarget(targetKind, speech, bag)
  const parentWhere = parent ? whereForKind(hits, parent) : []
  const parentValues = new Set(parentWhere.flatMap((term) => term.values || []))
  const childFiltered = childWhere.filter((term) => {
    const vals = term.values || []
    if (!parentWhere.length || !vals.length) return true
    return !vals.every((value) => parentValues.has(value))
  })

  if (!parent && !parentWhere.length && !childFiltered.length) return base

  const next = { ...base, kind: targetKind }
  if (parent) {
    next.from = parentWhere.length ? { kind: parent, where: parentWhere } : { kind: parent }
  }
  if (childFiltered.length) next.where = childFiltered
  return next
}

/**
 * After kind resolve: leftover short names that are not in the connector catalog
 * cannot be preview/write targets. Not a denylist — leftover means a registered
 * kind is a suffix of a longer registered kind. No catalog → do not refuse.
 */
export function leftoverKindMissingFromCatalog(kind, extra = {}) {
  const name = String(kind || '').trim()
  if (!name) return false
  const labels = registeredKinds(extra)
  if (!isLeftoverShortKind(name, labels, extra)) return false
  const collections = extra.collections
  const kinds = extra.kinds
  const maps = extra.maps
  const hasCatalog = (Array.isArray(collections) && collections.length)
    || (Array.isArray(kinds) && kinds.length)
    || (Array.isArray(maps) && maps.length)
  if (!hasCatalog) return false
  return !mapKind(name, { collections, kinds, maps })
}

export { clueHitsInSpeech, parentKindsOf, kindMentions, relatedKindChain, nestFromSteps, relatedMentionedKinds }
