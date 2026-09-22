/**
 * Structured slot enrichment from speech + workspace vocab (clues, kinds, relations).
 * No utterance-specific literals; uses registered kind labels and clue tables only.
 * @module dsh-lan-assist/slots
 */

import { collectionFields, mapKind, registeredKinds, relatedField, schemaHasField } from './lookup.js'
import { schemaFieldsForKind } from './enum-clues.js'
import { enumMap, peelSpoken, saysOf } from './resolve.js'
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
  if (!M || !spec || M === spec) return false
  return spokenAndGraphAliasTokens(M, extra).has(spec)
}

function publishedEdgesAmong(set, bag) {
  const edges = []
  for (const rel of relationsFromVocab(bag.vocab, bag)) {
    const from = String(rel.from || rel.fromKind || '').trim()
    const to = String(rel.to || rel.toKind || '').trim()
    if (!from || !to || from === to) continue
    if (!set.has(from) || !set.has(to)) continue
    edges.push({ from, to })
  }
  return edges
}

function downstreamLeaves(related, edges) {
  const hasChild = new Set(edges.map((rel) => rel.from))
  return related.filter((kind) => !hasChild.has(kind))
}

function deepestMention(candidates, speech, bag) {
  let best = ''
  let bestDepth = -1
  for (const kind of candidates) {
    const depth = relatedKindChain(kind, speech, bag).length
    if (depth > bestDepth) {
      bestDepth = depth
      best = kind
    }
  }
  return best
}

/**
 * When speech mentions two or more graph-related kinds, hop target is the
 * downstream of a published edge. A self link does not count as that edge.
 * A cycle keeps the edge whose downstream is named later in the speech.
 */
function relatedMentionedHopLeaf(speech, bag) {
  const { related } = relatedMentionedKinds(speech, bag.vocab, bag)
  if (related.length < 2) return ''
  const set = new Set(related)
  const edges = publishedEdgesAmong(set, bag)
  let leaves = downstreamLeaves(related, edges)
  if (!leaves.length && edges.length) {
    const order = new Map()
    for (const hit of kindMentions(String(speech || ''), related, bag)) {
      if (!order.has(hit.kind)) order.set(hit.kind, hit.index)
    }
    const forward = edges.filter((rel) => (order.get(rel.to) ?? -1) > (order.get(rel.from) ?? -1))
    const forwardLeaves = downstreamLeaves(related, forward)
    if (forwardLeaves.length) leaves = forwardLeaves
  }
  if (leaves.length === 1) return leaves[0]
  if (leaves.length > 1) {
    const best = deepestMention(leaves, speech, bag)
    if (best) return best
  }
  return deepestMention(related, speech, bag)
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
  if (user.includes(model) && user.length > model.length) return user
  const bag = { vocab, ...extra }
  const names = registeredKinds(bag)
  const userKindCount = new Set(kindMentions(user, names, bag).map((row) => row.kind)).size
  const modelKindCount = new Set(kindMentions(model, names, bag).map((row) => row.kind)).size
  if (userKindCount > modelKindCount) return user
  const userRel = relatedMentionedKinds(user, vocab, extra).related.length
  const modelRel = relatedMentionedKinds(model, vocab, extra).related.length
  if (userRel > modelRel) return user
  if (userRel === modelRel && userRel > 0 && user.length > model.length) return user
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
  return out
}

function vocabWithSpoken(vocab) {
  const rows = Array.isArray(vocab) ? vocab.map((row) => (row && typeof row === 'object' ? { ...row } : row)) : []
  const seed = spokenSeed && Array.isArray(spokenSeed.clues) ? spokenSeed.clues : []
  const idx = rows.findIndex((row) => row && (row.spoken || row.kind === '口语'))
  if (idx < 0) {
    rows.push({
      kind: '口语',
      spoken: true,
      clues: seed,
    })
    return rows
  }
  const have = cluesOfRow(rows[idx])
  rows[idx] = { ...rows[idx], clues: [...have, ...seed] }
  return rows
}

function rewriteSpan(speech) {
  const text = String(speech || '')
  const says = saysOf({ vocab: vocabWithSpoken([]) }, '改写')
  let hitSay = ''
  let at = -1
  for (const say of [...says].sort((a, b) => b.length - a.length)) {
    if (!say) continue
    const idx = text.indexOf(say)
    if (idx >= 0 && (at < 0 || idx < at || (idx === at && say.length > hitSay.length))) {
      at = idx
      hitSay = say
    }
  }
  if (at < 0 || !hitSay) return { at: -1, end: -1, say: '', after: '' }
  const tail = text.slice(at + hitSay.length)
  const m = tail.match(/^\s*([\u4e00-\u9fffA-Za-z0-9._-]{1,32})/)
  const after = m ? m[1] : ''
  return { at, end: at + hitSay.length + (m ? m[0].length : 0), say: hitSay, after }
}

function spanOverlaps(start, end, spans) {
  return spans.some((row) => start < row.end && end > row.index)
}

function fieldEnumEntries(field) {
  if (!field || typeof field !== 'object') return []
  const packed = enumMap(field)
  const source = Object.keys(packed).length
    ? packed
    : (field.enums && typeof field.enums === 'object' && !Array.isArray(field.enums) ? field.enums : {})
  return Object.entries(source).map(([code, label]) => [String(code).trim(), String(label || '').trim()])
}

function fieldIdentityOf(field) {
  const title = String((field && (field.title || (field.uiSchema && field.uiSchema.title))) || '').trim()
  const name = String((field && field.name) || '').trim()
  return { identity: title || name, name, title }
}

function sayIsBounded(text, say, index) {
  if (!/^[A-Za-z0-9_]+$/.test(say)) return true
  const before = index > 0 ? text[index - 1] : ''
  const after = text[index + say.length] || ''
  if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) return false
  if (say.length < 3) return true
  return true
}

function kindMentionOverlapsEnumLabel(text, mention, bound, mergedVocab, extra) {
  const token = text.slice(mention.index, mention.end)
  if (!token) return false
  for (const kind of bound) {
    const fields = schemaFieldsForKind(kind, mergedVocab, extra)
    for (const field of fields) {
      for (const [code, label] of fieldEnumEntries(field)) {
        for (const phrase of [label, code]) {
          if (!phrase || phrase.length <= token.length) continue
          if (!phrase.startsWith(token)) continue
          if (text.slice(mention.index, mention.index + phrase.length) === phrase) return true
        }
      }
    }
  }
  return false
}

function resolveClueValuesForField(field, matchedSay, clue) {
  const say = String(matchedSay || '').trim()
  if (!say) return []
  const packed = fieldEnumsOf(field)
  if (packed) {
    const codes = []
    for (const [code, label] of Object.entries(packed)) {
      if (enumValueMatches(say, code, label)) codes.push(String(code))
    }
    if (codes.length) return [...new Set(codes)]
  }
  const clueValues = stringList(clue && (clue.values || clue.value))
  const direct = clueValues.filter((item) => enumValueMatches(say, item, item))
  if (direct.length) {
    if (packed) {
      const mapped = direct.map((item) => {
        for (const [code, label] of Object.entries(packed)) {
          if (enumValueMatches(say, code, label)) return String(code)
        }
        return String(item)
      })
      return [...new Set(mapped)]
    }
    return [...new Set(direct.map((item) => String(item)))]
  }
  if (clue && clue.not === true && packed) {
    return clueValues.filter((item) => Object.prototype.hasOwnProperty.call(packed, String(item)))
  }
  return []
}

function joinWordSays(vocab, which) {
  const says = []
  for (const row of vocabWithSpoken(vocab)) {
    for (const clue of cluesOfRow(row)) {
      if (!clue) continue
      const role = String(clue.role || '').trim()
      const keys = stringList(clue.keys || clue.field)
      if (role !== '连接' && !keys.includes('join')) continue
      const values = stringList(clue.values || clue.value)
      if (!values.includes(which)) continue
      says.push(...stringList(clue.say || clue.says))
    }
  }
  return [...new Set(says.filter(Boolean))].sort((a, b) => b.length - a.length)
}

function speechKeysOnly(clue, names) {
  const keys = stringList(clue && (clue.keys || clue.field))
  return keys.length > 0 && keys.every((key) => names.includes(key))
}

function clueHitsInSpeech(speech, vocab, extra = {}) {
  const text = String(speech || '')
  if (!text.trim()) return []
  const mergedVocab = vocabWithSpoken(vocab)
  const kinds = registeredKinds({ vocab: mergedVocab }).filter((kind) => kind && kind !== '口语')
  const mentions = kindMentions(text, kinds, { vocab: mergedVocab, ...extra })
  const bound = []
  const seenKind = new Set()
  for (const row of mentions) {
    if (seenKind.has(row.kind)) continue
    seenKind.add(row.kind)
    bound.push(row.kind)
  }
  const bag = { vocab: mergedVocab, ...extra }
  const roleHits = []
  for (const row of mergedVocab) {
    for (const clue of cluesOfRow(row)) {
      if (!speechKeysOnly(clue, ['role', 'action', 'join'])) continue
      const packed = findClueHit(text, clue, bag)
      if (!packed) continue
      roleHits.push({ ...packed, assignKind: '' })
    }
  }
  const occupied = mentions
    .filter((row) => !kindMentionOverlapsEnumLabel(text, row, bound, mergedVocab, extra))
    .map((row) => ({ index: row.index, end: row.end }))
  const candidates = []
  const pushCandidate = (packed, ownerKind) => {
    const say = String(packed.say || '')
    const start = Number(packed.hitIndex) || 0
    const end = start + say.length
    if (!say || end <= start || !ownerKind) return
    if (!sayIsBounded(text, say, start)) return
    if (spanOverlaps(start, end, occupied)) return
    candidates.push({
      ...packed,
      say,
      start,
      end,
      ownerKind,
      keys: Array.isArray(packed.keys) ? packed.keys : [],
      values: Array.isArray(packed.values) ? packed.values : [],
      not: packed.not === true,
    })
  }
  for (const row of mergedVocab) {
    const owner = String(row && (row.kind || row.label) || '').trim()
    if (!owner || owner === '口语' || row.spoken || !bound.includes(owner)) continue
    const fields = schemaFieldsForKind(owner, mergedVocab, extra)
    for (const clue of cluesOfRow(row)) {
      if (speechKeysOnly(clue, ['role', 'action', 'join'])) continue
      const packed = findClueHit(text, clue, bag)
      if (!packed) continue
      const keys = stringList(clue.keys || clue.field)
      const matched = fields.find((field) => {
        const ident = fieldIdentityOf(field)
        return keys.includes(ident.identity) || keys.includes(ident.name) || keys.includes(ident.title)
      })
      const ident = matched ? fieldIdentityOf(matched) : { identity: keys[0] || '', name: keys[0] || '' }
      if (!ident.identity) continue
      let resolvedValues = matched
        ? resolveClueValuesForField(matched, packed.say, clue)
        : stringList(clue.values || clue.value).filter((item) => enumValueMatches(packed.say, item, item))
      if (!resolvedValues.length && !(clue.not === true || packed.not === true)) continue
      pushCandidate({
        ...packed,
        keys: [...new Set([ident.identity, ident.name].filter(Boolean))],
        values: resolvedValues.length ? resolvedValues : packed.values,
        not: clue.not === true || packed.not === true,
      }, owner)
    }
  }
  const notClues = []
  for (const row of mergedVocab) {
    for (const clue of cluesOfRow(row)) {
      if (clue && clue.not === true) notClues.push(clue)
    }
  }
  for (const kind of bound) {
    const fields = schemaFieldsForKind(kind, mergedVocab, extra)
    for (const field of fields) {
      const ident = fieldIdentityOf(field)
      if (!ident.identity) continue
      const entries = fieldEnumEntries(field)
      if (!entries.length) continue
      const keys = [...new Set([ident.identity, ident.name].filter(Boolean))]
      for (const [code, label] of entries) {
        const says = [...new Set([label, code].filter((item) => item))]
        for (const say of says.sort((a, b) => b.length - a.length)) {
          let from = 0
          while (from <= text.length) {
            const idx = text.indexOf(say, from)
            if (idx < 0) break
            pushCandidate({
              hitIndex: idx,
              say,
              keys,
              values: [code],
              not: false,
            }, kind)
            from = idx + Math.max(1, say.length)
          }
        }
      }
      for (const clue of notClues) {
        const packed = findClueHit(text, clue, bag)
        if (!packed) continue
        const values = stringList(clue.values || clue.value)
        const ownedCodes = entries
          .filter(([code, label]) => values.includes(code) || (label && values.includes(label)) || packed.say === label || packed.say === code)
          .map(([code]) => code)
        if (!ownedCodes.length) continue
        pushCandidate({
          ...packed,
          keys,
          values: ownedCodes,
          not: true,
        }, kind)
      }
    }
  }
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)
  const takenSays = []
  const accepted = []
  for (const row of candidates) {
    const same = takenSays.some((span) => span.index === row.start && span.end === row.end)
    if (!same && spanOverlaps(row.start, row.end, takenSays)) continue
    accepted.push(row)
    if (!same) takenSays.push({ index: row.start, end: row.end })
  }
  const groups = new Map()
  for (const row of accepted) {
    const key = `${row.start}:${row.end}:${row.say}:${row.not ? 1 : 0}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const assigned = []
  for (const group of groups.values()) {
    const byOwner = new Map()
    for (const row of group) {
      const owner = String(row.ownerKind || '')
      if (!owner) continue
      if (!byOwner.has(owner)) byOwner.set(owner, [])
      byOwner.get(owner).push(row)
    }
    for (const rows of byOwner.values()) {
      const identities = [...new Set(rows.map((row) => String((row.keys || [])[0] || '')).filter(Boolean))]
      if (identities.length !== 1) continue
      const row = rows[0]
      assigned.push({
        hitIndex: row.start,
        say: row.say,
        keys: row.keys,
        values: row.values,
        not: row.not === true,
        ...(Array.isArray(row.dateBefore) && row.dateBefore.length ? { dateBefore: row.dateBefore } : {}),
        assignKind: row.ownerKind,
        owned: true,
      })
    }
  }
  const andSays = joinWordSays(mergedVocab, 'and')
  const orSays = joinWordSays(mergedVocab, 'or')
  const byKindField = new Map()
  for (const hit of assigned) {
    const id = `${hit.assignKind}\0${(hit.keys || [])[0] || ''}\0${hit.not ? 1 : 0}`
    if (!byKindField.has(id)) byKindField.set(id, [])
    byKindField.get(id).push(hit)
  }
  let contradicts = false
  for (const group of byKindField.values()) {
    const ordered = group.slice().sort((a, b) => a.hitIndex - b.hitIndex)
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const left = ordered[i]
        const right = ordered[j]
        const leftVals = (left.values || []).map(String).slice().sort().join('\0')
        const rightVals = (right.values || []).map(String).slice().sort().join('\0')
        if (!leftVals || leftVals === rightVals) continue
        const between = text.slice(left.hitIndex + String(left.say || '').length, right.hitIndex)
        const hasAnd = andSays.some((say) => say && between.includes(say))
        const hasOr = orSays.some((say) => say && between.includes(say))
        if (hasAnd && !hasOr) contradicts = true
      }
    }
  }
  const span = rewriteSpan(text)
  const keptAssigned = span.at < 0 ? assigned : assigned.filter((hit) => Number(hit.hitIndex) < span.at)
  const merged = [...roleHits, ...keptAssigned]
  if (contradicts) merged.contradicts = true
  return merged
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
  return Boolean(hit && hit.owned === true)
}

function termsForKind(hits, kind) {
  const want = String(kind || '').trim()
  return mergeTerms((Array.isArray(hits) ? hits : []).filter((row) => row.assignKind === want && isFilterableHit(row)).map((row) => ({
    keys: row.keys,
    values: row.values,
    not: row.not,
    dateBefore: row.dateBefore,
  })))
}

function fieldOnKindSchema(schemaFields, key) {
  if (schemaHasField(schemaFields, key)) return true
  const want = String(key || '').trim()
  if (!want) return false
  return (Array.isArray(schemaFields) ? schemaFields : []).some((row) => {
    if (!row) return false
    if (typeof row === 'string') return row.trim() === want
    return String(row.name || '').trim() === want || String(row.title || '').trim() === want
  })
}

function extraWhereOnKind(kind, extraWhere, extra = {}) {
  const list = Array.isArray(extraWhere) ? extraWhere : []
  if (!list.length) return []
  const vocab = extra.vocab || []
  const schemaFields = schemaFieldsForKind(kind, vocab, extra)
  if (!schemaFields.length) return list
  return list.filter((term) => {
    const keys = (term.keys || []).map((item) => String(item || '').trim()).filter(Boolean)
    if (!keys.length) return false
    return keys.every((key) => fieldOnKindSchema(schemaFields, key))
  })
}

function compressSameKeyTerms(terms) {
  return mergeTerms(terms)
}

function modelWhereAgreed(modelWhere, hits, kind) {
  const allowed = new Set(termsForKind(hits, kind).flatMap((term) => (
    (term.values || []).map((item) => String(item))
  )))
  if (!allowed.size) return []
  const out = []
  for (const term of Array.isArray(modelWhere) ? modelWhere : []) {
    if (!term || typeof term !== 'object') continue
    const values = (term.values || []).map((item) => String(item)).filter((value) => allowed.has(value))
    if (!values.length) continue
    out.push({ ...term, values })
  }
  return out
}

function whereForKind(hits, kind, extraWhere, extra = {}) {
  const merged = mergeTerms([
    ...termsForKind(hits, kind, extra),
    ...extraWhereOnKind(kind, extraWhere, extra),
  ])
  return compressSameKeyTerms(merged)
}

function stripSaysFromText(text, says) {
  let s = String(text || '')
  for (const say of [...new Set(says || [])].filter(Boolean).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(escapeRe(say), 'g'), ' ')
  }
  return s
}

function nameOwnerKind(speech, name, kinds) {
  const text = String(speech || '')
  const at = text.indexOf(name)
  const labels = (Array.isArray(kinds) ? kinds : []).map((kind) => String(kind || '').trim()).filter(Boolean)
  if (at < 0 || !labels.length) return labels[0] || ''
  let best = labels[0]
  let bestDist = Infinity
  for (const kind of labels) {
    const idx = text.indexOf(kind)
    if (idx < 0) continue
    const dist = Math.abs(idx - at)
    if (dist < bestDist) {
      bestDist = dist
      best = kind
    }
  }
  return best
}

/**
 * Leftover spoken object identity after peeling vocab fillers, kind labels,
 * clue says, rewrite targets, and patch values. Connector name fields match
 * this rest — never a hardcoded company string.
 */
export function leftoverNameIdentity(speech, vocab, extra = {}, spec = {}) {
  const bag = { ...extra, vocab: vocabWithSpoken((extra && extra.vocab) || vocab) }
  let s = String(speech || '')
  if (!s.trim()) return ''
  const span = rewriteSpan(speech)
  if (span.at >= 0) s = `${s.slice(0, span.at)} ${s.slice(span.end)}`
  s = peelSpoken(s, bag)
  const kinds = registeredKinds(bag)
  for (const kind of kinds) {
    s = stripSaysFromText(s, tokensForKindLabel(kind, bag))
  }
  for (const hit of clueHitsInSpeech(speech, vocab, bag)) {
    if (hit && hit.say) s = stripSaysFromText(s, [hit.say])
  }
  const patch = spec.patch && typeof spec.patch === 'object' && !Array.isArray(spec.patch) ? spec.patch : {}
  for (const value of Object.values(patch)) {
    const text = String(value ?? '').trim()
    if (text.length >= 2) s = stripSaysFromText(s, [text])
  }
  s = s.replace(/[^\u4e00-\u9fffA-Za-z0-9._-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const runs = s.match(/[\u4e00-\u9fff]{2,20}/g) || []
  if (runs.length === 1) return runs[0]
  if (runs.length > 1) {
    const ownerKind = nameOwnerKind(speech, runs[0], kinds)
    const nearest = runs.map((run) => {
      const at = String(speech || '').indexOf(run)
      const kindAt = ownerKind ? String(speech || '').indexOf(ownerKind) : -1
      return { run, dist: at < 0 || kindAt < 0 ? 9999 : Math.abs(at - kindAt) }
    }).sort((a, b) => a.dist - b.dist)
    return (nearest[0] && nearest[0].run) || runs[0]
  }
  if (/^[A-Za-z][A-Za-z0-9._-]{1,31}$/.test(s)) return s
  return ''
}

function carryQueryFlags(next, hits) {
  const packed = next && typeof next === 'object' ? next : {}
  if (hits && hits.filterRefused) packed.filterRefused = true
  if (hits && hits.contradicts) packed.contradicts = true
  return packed
}

function fillEmptyWhere(node, hits, extra = {}) {
  if (!node || typeof node !== 'object') return node
  const kind = String(node.kind || '').trim()
  if (!kind) return node
  if (Array.isArray(node.where) && node.where.length) return node
  const where = compressSameKeyTerms(termsForKind(hits, kind, extra))
  return where.length ? { ...node, where } : node
}

function attachSpeechIdentity(next, speech, vocab, bag, spec) {
  const packed = next && typeof next === 'object' ? { ...next } : {}
  const hits = clueHitsInSpeech(speech, vocab, bag)
  packed.kind = String(packed.kind || spec.kind || '').trim()
  if (Array.isArray(packed.steps) && packed.steps.length) {
    packed.steps = packed.steps.map((step) => fillEmptyWhere(step, hits, bag))
  }
  if (packed.from && typeof packed.from === 'object' && packed.from.kind) {
    packed.from = fillEmptyWhere(packed.from, hits, bag)
  }
  if (packed.kind) {
    const where = whereForKind(hits, packed.kind, packed.where, bag)
    if (where.length) packed.where = where
    else delete packed.where
  }
  const rawNo = String(packed.no || packed.ticket || spec.no || '').trim()
  const existingNo = dropSpokenBatchRowId(rawNo, speech, vocab, bag)
  if (spec.picked !== true) {
    if (existingNo) packed.no = existingNo
    else delete packed.no
    if (Array.isArray(packed.steps) && packed.steps.length) {
      packed.steps = packed.steps.map((step) => {
        if (!step || typeof step !== 'object') return step
        const stepNo = dropSpokenBatchRowId(step.no, speech, vocab, bag)
        if (!stepNo) {
          const copy = { ...step }
          delete copy.no
          return copy
        }
        return { ...step, no: stepNo }
      })
    }
  }
  const act = String(packed.action || spec.action || '').trim()
  const rewriting = rewriteSpan(speech).at >= 0
  const name = leftoverNameIdentity(speech, vocab, bag, { patch: packed.patch || spec.patch })
  const keepPicked = spec.picked === true && existingNo
  const spokenRef = existingNo && String(speech || '').includes(existingNo)
  if (keepPicked || spokenRef) {
    packed.no = existingNo
    return packed
  }
  if (!rewriting && act === '现查') return packed
  if (!name) return packed
  if (spokenWantsBatch(speech, vocab, bag) && !/[A-Za-z0-9]/.test(name)) return packed
  packed.no = name
  const stepKinds = Array.isArray(packed.steps)
    ? packed.steps.map((step) => String(step && step.kind || '').trim()).filter(Boolean)
    : []
  if (packed.from && packed.from.kind) stepKinds.unshift(String(packed.from.kind))
  if (packed.kind) stepKinds.push(packed.kind)
  const owner = nameOwnerKind(speech, name, stepKinds)
  if (Array.isArray(packed.steps) && packed.steps.length) {
    packed.steps = packed.steps.map((step) => {
      if (!step || String(step.kind || '').trim() !== owner) return step
      const stepNo = String(step.no || '').trim()
      if (stepNo && stepNo !== existingNo) return step
      return { ...step, no: name }
    })
  }
  if (packed.from && String(packed.from.kind || '').trim() === owner && !String(packed.from.no || '').trim()) {
    packed.from = { ...packed.from, no: name }
  }
  return packed
}

/**
 * Mentioned kinds that are not on this target's relation chain, and that own
 * a spoken enum. No edge is added between them.
 */
export function unlinkedConditionKinds(speech, targetKind, vocab, extra = {}) {
  const text = String(speech || '').trim()
  const target = String(targetKind || '').trim()
  if (!text || !target) return []
  const bag = { vocab, ...extra }
  const hits = clueHitsInSpeech(text, vocab, bag)
  const mentioned = [...new Set(kindMentions(text, registeredKinds(bag), bag).map((row) => row.kind))]
  const linked = new Set(relatedKindChain(target, text, bag))
  const onChain = linked.size > 1
  const out = []
  for (const kind of mentioned) {
    if (!kind || kind === target) continue
    if (onChain && linked.has(kind)) continue
    const where = whereForKind(hits, kind, undefined, bag)
    if (!where.length) continue
    out.push({ kind, where })
  }
  return out
}

function labelOccurs(text, label) {
  const say = String(label || '').trim()
  if (say.length < 2) return false
  let from = 0
  while (from < text.length) {
    const index = text.indexOf(say, from)
    if (index < 0) return false
    if (sayIsBounded(text, say, index)) return true
    from = index + say.length
  }
  return false
}

function sameObjectChain(node, targetKind) {
  const target = String(targetKind || '').trim()
  if (!target || !node || typeof node !== 'object' || Array.isArray(node)) return false
  let cur = node
  let depth = 0
  while (cur && typeof cur === 'object' && !Array.isArray(cur) && depth < 8) {
    if (String(cur.kind || '').trim() !== target) return false
    const nested = cur.from
    if (!nested || typeof nested !== 'object' || Array.isArray(nested) || !String(nested.kind || '').trim()) return true
    cur = nested
    depth += 1
  }
  return false
}

function chainRelation(node) {
  let cur = node
  let depth = 0
  while (cur && typeof cur === 'object' && !Array.isArray(cur) && depth < 8) {
    const relation = String(cur.relation || '').trim()
    if (relation) return relation
    cur = cur.from && typeof cur.from === 'object' && !Array.isArray(cur.from) ? cur.from : null
    depth += 1
  }
  return ''
}

function stepsAllSame(steps, targetKind) {
  const target = String(targetKind || '').trim()
  return steps.length > 0 && steps.every((row) => String(row && row.kind || '').trim() === target)
}

function stepsCarryRelation(steps) {
  return steps.some((row) => String(row && row.relation || '').trim())
}

/** The published self-edge whose field name or title the speech names. Two edges stay two queries. */
function spokenSelfRelation(kind, speech, extra) {
  const target = String(kind || '').trim()
  const text = String(speech || '')
  if (!target || !text) return ''
  const rels = relationsFromVocab(extra.vocab, extra).filter((rel) => (
    rel.from === target && rel.to === target && rel.field
  ))
  if (!rels.length) return ''
  const fields = schemaFieldsForKind(target, extra.vocab, extra)
  let bestField = ''
  let bestLen = 0
  let tie = false
  for (const rel of rels) {
    const row = fields.find((item) => item && item.name === rel.field)
    const labels = [...new Set([rel.field, row && row.title].map((item) => String(item || '').trim()).filter((item) => item.length >= 2))]
    for (const label of labels) {
      if (!labelOccurs(text, label)) continue
      if (label.length > bestLen) {
        bestField = rel.field
        bestLen = label.length
        tie = false
      } else if (label.length === bestLen && rel.field !== bestField) {
        tie = true
      }
    }
  }
  if (!bestField || tie) return ''
  return bestField
}

/**
 * When the model only filled the child kind + partial where, recover hop slots
 * from speech using vocab clues and published graph relations.
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
  const hopLeaf = relatedMentionedHopLeaf(speech, bag)
  targetKind = hopLeaf || remapEnrichTargetKind(targetKind, speech, bag)
  const hits = clueHitsInSpeech(speech, vocab, bag)
  const chainKinds = relatedKindChain(targetKind, speech, bag)
  const existingSteps = Array.isArray(base.steps) ? base.steps.filter((row) => row && row.kind) : []

  if (chainKinds.length >= 2) {
    const steps = chainKinds.map((kind, index) => {
      const extraWhere = kind === targetKind && index === chainKinds.length - 1
        ? modelWhereAgreed(base.where, hits, kind)
        : []
      const where = whereForKind(hits, kind, extraWhere, bag)
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
    return carryQueryFlags(attachSpeechIdentity(next, speech, vocab, bag, base), hits)
  }

  if ((base.from && typeof base.from === 'object' && base.from.kind) || existingSteps.length) {
    const next = { ...base, kind: targetKind }
    const selfField = spokenSelfRelation(targetKind, speech, bag)
    if (selfField) {
      const fromNode = next.from && typeof next.from === 'object' ? next.from : null
      if (fromNode && sameObjectChain(fromNode, targetKind) && !chainRelation(fromNode)) {
        next.from = { ...fromNode, relation: selfField }
      }
      if (existingSteps.length && stepsAllSame(existingSteps, targetKind) && !stepsCarryRelation(existingSteps)) {
        next.steps = existingSteps.length === 1
          ? [existingSteps[0], { kind: targetKind, from: targetKind, relation: selfField }]
          : existingSteps.map((row, index) => (
            index === existingSteps.length - 1
              ? { ...row, from: row.from || targetKind, relation: selfField }
              : row
          ))
      }
    }
    return carryQueryFlags(attachSpeechIdentity(next, speech, vocab, bag, base), hits)
  }

  const childWhere = whereForKind(hits, targetKind, modelWhereAgreed(base.where, hits, targetKind), bag)
  const parents = parentKindsOf(targetKind, bag)
  const mentioned = new Set(kindMentions(speech, registeredKinds(bag), bag).map((row) => row.kind))
  let parent = parents.find((kind) => mentioned.has(kind) && termsForKind(hits, kind, bag).length)
    || parents.find((kind) => mentioned.has(kind))
  if (!parent) parent = hopParentKindForTarget(targetKind, speech, bag)
  if (parent === targetKind) parent = ''
  const selfField = spokenSelfRelation(targetKind, speech, bag)
  const parentWhere = parent ? whereForKind(hits, parent, undefined, bag) : []
  const parentValues = new Set(parentWhere.flatMap((term) => term.values || []))
  const childFiltered = childWhere.filter((term) => {
    const vals = term.values || []
    if (!parentWhere.length || !vals.length) return true
    return !vals.every((value) => parentValues.has(value))
  })

  if (selfField) {
    const next = { ...base, kind: targetKind, from: { kind: targetKind, relation: selfField } }
    if (childFiltered.length) next.where = childFiltered
    return carryQueryFlags(attachSpeechIdentity(next, speech, vocab, bag, base), hits)
  }

  if (!parent && !parentWhere.length && !childFiltered.length) {
    return carryQueryFlags(attachSpeechIdentity({ ...base, kind: targetKind }, speech, vocab, bag, base), hits)
  }

  const next = { ...base, kind: targetKind }
  if (parent) {
    next.from = parentWhere.length ? { kind: parent, where: parentWhere } : { kind: parent }
  }
  if (childFiltered.length) next.where = childFiltered
  return carryQueryFlags(attachSpeechIdentity(next, speech, vocab, bag, base), hits)
}

const WRITE_ACTIONS = ['删除', '过审', '新建', '改行']

function spokenAction(speech, vocab, extra, actions) {
  const hits = clueHitsInSpeech(speech, vocab, extra)
  for (const act of actions) {
    if (hits.some((hit) => (hit.keys || []).includes('action') && (hit.values || []).includes(act))) return act
  }
  return ''
}

function spokenWriteAction(speech, vocab, extra = {}) {
  return spokenAction(speech, vocab, extra, WRITE_ACTIONS)
}

function spokenListAction(speech, vocab, extra = {}) {
  return spokenAction(speech, vocab, extra, ['现查'])
}

function fieldLabelOf(field) {
  if (!field || typeof field !== 'object') return ''
  const title = String(field.title || (field.uiSchema && field.uiSchema.title) || '').trim()
  return title || String(field.name || '').trim()
}

function fieldNameOf(field) {
  if (typeof field === 'string') return field.trim()
  if (!field || typeof field !== 'object') return ''
  return String(field.name || '').trim()
}

function fieldEnumsOf(field) {
  if (!field || typeof field !== 'object') return null
  const packed = enumMap(field)
  if (Object.keys(packed).length) return packed
  if (field.enums && typeof field.enums === 'object' && !Array.isArray(field.enums)) return field.enums
  return null
}

function enumValueMatches(after, code, label) {
  const want = String(after || '').trim()
  const key = String(code || '').trim()
  const say = String(label || '').trim()
  if (!want) return false
  if (key === want || say === want) return true
  if (want.length >= 2 && (say.startsWith(want) || want.startsWith(say) && say.length >= 2)) return true
  return false
}

function isStatusLikeField(field) {
  const name = fieldNameOf(field)
  const label = fieldLabelOf(field)
  return /^(status|state|stage|状态)$/i.test(name) || /状态/.test(label)
}

function rewritePatch(speech, schemaFields) {
  const span = rewriteSpan(speech)
  if (span.at < 0 || !span.after) return null
  const after = span.after
  const before = (String(speech || '').slice(0, span.at).match(/[\u4e00-\u9fffA-Za-z0-9._-]{1,32}\s*$/) || [])[0] || ''
  if (!after) return null
  const fields = Array.isArray(schemaFields) ? schemaFields : []
  const named = fields.find((field) => {
    const name = fieldNameOf(field)
    const label = fieldLabelOf(field)
    return (name && name === before) || (label && label === before)
  })
  if (named && fieldNameOf(named)) return { [fieldNameOf(named)]: after }
  const enumHits = fields.filter((field) => {
    const packed = fieldEnumsOf(field)
    if (!packed) return false
    return Object.entries(packed).some(([code, label]) => enumValueMatches(after, code, label))
  })
  const statusLike = enumHits.find((field) => isStatusLikeField(field))
  const hit = statusLike || enumHits[0]
  if (hit && fieldNameOf(hit)) return { [fieldNameOf(hit)]: after }
  const statusField = fields.find((field) => isStatusLikeField(field))
  if (statusField && fieldNameOf(statusField)) return { [fieldNameOf(statusField)]: after }
  return null
}

export function recoverWriteIntent(spec, vocab, extra = {}) {
  const next = spec && typeof spec === 'object' ? { ...spec } : {}
  let speech = String(next.speech || next.quote || '').trim()
  const kind = String(next.kind || '').trim()
  if (!speech || !kind) return next
  const bag = { vocab: vocabWithSpoken(vocab), ...extra }
  const userSpeech = String(next.userSpeech || '').trim()
  if (
    userSpeech
    && spokenListAction(userSpeech, vocab, extra) === '现查'
    && !spokenWriteAction(userSpeech, vocab, extra)
    && String(next.action || '').trim() !== '现查'
  ) {
    next.speech = userSpeech
    next.action = '现查'
    delete next.patch
    speech = userSpeech
  }
  const row = vocabRow(kind, bag.vocab)
  const can = Array.isArray(row && row.can) ? row.can.map((item) => String(item || '').trim()).filter(Boolean) : []
  const spoken = spokenWriteAction(speech, vocab, extra)
  if (spoken && can.includes(spoken)) {
    next.action = spoken
  }
  const act = String(next.action || '').trim()
  const hasPatch = next.patch && typeof next.patch === 'object' && !Array.isArray(next.patch) && Object.keys(next.patch).length
  if ((act === '改行' || act === '新建') && !hasPatch) {
    const schemaFields = extra.schemaByKind && extra.schemaByKind[kind]
    const patch = rewritePatch(speech, schemaFields)
    if (patch) next.patch = patch
  }
  return next
}

/** A clicked row is not the whole hit set. Match its id, else its displayed no. */
export function rowsForClickedWrite(rows, no = '') {
  const list = Array.isArray(rows) ? rows : []
  const wanted = String(no || '').trim()
  if (!wanted) return list
  const byId = list.filter((row) => {
    const fields = row && row.fields && typeof row.fields === 'object' ? row.fields : {}
    return String(fields.id || row.id || '') === wanted
  })
  if (byId.length) return byId
  const byNo = list.filter((row) => String((row && row.no) || '').trim() === wanted)
  if (byNo.length) return byNo
  return list
}

/** 列举 / 「都」+ 写动作：人要的本来就是一批，不要按模糊名去一家家问。 */
/** Batch leftover (助词+动作碎片) is not a row id. Alphanumeric tickets stay. */
export function dropSpokenBatchRowId(no, speech, vocab, extra = {}) {
  const name = String(no || '').trim()
  if (!name) return ''
  if (/[A-Za-z0-9]/.test(name)) return name
  if (spokenWantsBatch(speech, vocab, extra)) return ''
  return name
}

export function spokenWantsBatch(speech, vocab, extra = {}) {
  const text = String(speech || '')
  if (!text.trim()) return false
  const hits = clueHitsInSpeech(speech, vocab, extra)
  if (hits.some((hit) => (hit.values || []).includes('列举'))) return true
  for (const hit of hits) {
    const keys = (hit.keys || []).map((item) => String(item || ''))
    const values = (hit.values || []).map((item) => String(item || ''))
    if (!keys.includes('action') || !WRITE_ACTIONS.some((act) => values.includes(act))) continue
    const say = String(hit.say || '')
    if (!say) continue
    const idx = text.indexOf(say)
    if (idx <= 0) continue
    const before = text.slice(Math.max(0, idx - 2), idx)
    if (/都\s*$/.test(before)) return true
  }
  return false
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
