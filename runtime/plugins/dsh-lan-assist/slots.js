/**
 * Slot helpers the gate still uses: round speech recall, nest from/steps,
 * catalog leftover-kind refuse, clicked-row write filter, write-speech ask lock.
 * Speech does not author where, from, or hops.
 * @module dsh-lan-assist/slots
 */

import { connectorCatalogPresent, kindLabelTokens, kindPreviewableInCatalog, mapKind, registeredKinds, resolveConnectedKindName, resolveKindAlias } from './lookup.js'
import { enumValueMatches, schemaFieldsForKind } from './enum-clues.js'
import { enumMap, saysOf } from './resolve.js'
import { vocabRow } from './where-pass.js'
import { enumHits } from './relation-bind.js'
import { spokenSeedClues, vocabWithSpoken } from './vocab/spoken.js'

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
  const seedClues = spokenSeedClues()
  if (!not && seedClues.length) {
    const hitText = String(match[0] || '')
    for (const seed of seedClues) {
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

/** Catalog leftover: unique suffix among live tables, or among graph neighbors of already-mentioned kinds. */
function leftoverShortTokensForKind(kind, extra) {
  const name = String(kind || '').trim()
  if (!name || !extra) return []
  const previewable = registeredKinds(extra)
  if (!previewable.includes(name)) return []
  const scope = Array.isArray(extra.leftoverScope) && extra.leftoverScope.length
    ? extra.leftoverScope.filter((label) => previewable.includes(label))
    : previewable
  const rows = [
    ...(Array.isArray(extra.vocab) ? extra.vocab : []),
    ...(Array.isArray(extra.kinds) ? extra.kinds : []),
    ...(Array.isArray(extra.maps) ? extra.maps : []),
  ]
  const shorts = new Set()
  for (const row of rows) {
    const short = typeof row === 'string'
      ? row.trim()
      : String((row && (row.kind || row.label || row.title)) || '').trim()
    if (short) shorts.add(short)
  }
  for (let len = 2; len < name.length; len += 1) shorts.add(name.slice(-len))
  const named = []
  for (const short of shorts) {
    if (!short || short === name || short.length < 2) continue
    if (previewable.includes(short)) continue
    if (!name.endsWith(short)) continue
    if (!isLeftoverShortKind(short, previewable, extra)) continue
    const owners = scope.filter((label) => label !== short && label.endsWith(short))
    if (owners.length === 1 && owners[0] === name) named.push(short)
  }
  return [...new Set(named)]
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
  for (const token of kindLabelTokens(label)) {
    if (token.length >= 2) tokens.add(token)
  }
  if (label.length >= 2) tokens.add(label)
  if (extra && extra.vocab) {
    for (const alias of spokenAliasTokens(label, extra.vocab)) {
      if (alias.length >= 2) tokens.add(alias)
    }
    for (const alias of graphAliasTokens(label, extra)) {
      if (alias.length >= 2) tokens.add(alias)
    }
  }
  for (const alias of leftoverShortTokensForKind(label, extra)) {
    if (alias.length >= 2) tokens.add(alias)
  }
  return [...tokens].filter((token) => token.length >= 2)
}

function kindMentionsScan(text, kinds, extra) {
  const speech = String(text || '')
  const labels = [...new Set((Array.isArray(kinds) ? kinds : []).map((kind) => String(kind || '').trim()).filter((label) => label.length >= 2))]
  const leftoverShorts = new Set(labels.flatMap((kind) => leftoverShortTokensForKind(kind, extra)))
  const candidates = []
  for (const kind of labels) {
    const tokens = tokensForKindLabel(kind, extra)
    for (const token of tokens) {
      let from = 0
      while (from <= speech.length) {
        const idx = speech.indexOf(token, from)
        if (idx < 0) break
        if (leftoverShorts.has(token) && !sayIsBounded(speech, token, idx)) {
          from = idx + 1
          continue
        }
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

function suffixOwnerGroups(speech, extra) {
  const text = String(speech || '')
  const previewable = registeredKinds(extra)
  const seen = new Set()
  const groups = []
  for (const kind of previewable) {
    for (let len = 2; len < String(kind).length; len += 1) {
      const short = String(kind).slice(-len)
      if (!short || seen.has(short) || previewable.includes(short)) continue
      const idx = text.indexOf(short)
      if (idx < 0) continue
      if (/^[A-Za-z0-9_]+$/.test(short) && !sayIsBounded(text, short, idx)) continue
      const owners = previewable.filter((label) => label !== short && label.endsWith(short))
      if (owners.length < 2) continue
      seen.add(short)
      groups.push({ short, owners })
    }
  }
  return groups
}

function countPickedEdges(picked, extra) {
  const set = new Set(picked)
  let n = 0
  for (const kind of picked) {
    for (const other of graphNeighbors(kind, extra)) {
      if (set.has(other)) n += 1
    }
  }
  return n
}

function coMentionKinds(speech, extra) {
  const groups = suffixOwnerGroups(speech, extra)
  if (!groups.length) return []
  let combos = 1
  for (const group of groups) {
    combos *= group.owners.length
    if (combos > 64) return []
  }
  let best = []
  let bestScore = 0
  let ties = 0
  const walk = (index, picked) => {
    if (index >= groups.length) {
      const score = countPickedEdges(picked, extra)
      if (score > bestScore) {
        bestScore = score
        best = picked.slice()
        ties = 1
      } else if (score === bestScore && score > 0) {
        ties += 1
      }
      return
    }
    for (const owner of groups[index].owners) walk(index + 1, picked.concat(owner))
  }
  walk(0, [])
  return bestScore > 0 && ties === 1 ? best : []
}

function kindMentions(text, kinds, extra) {
  const first = kindMentionsScan(text, kinds, extra)
  const mentioned = [...new Set(first.map((row) => row.kind))]
  if (extra && mentioned.length) {
    const scope = new Set(mentioned)
    for (const kind of mentioned) {
      for (const other of graphNeighbors(kind, extra)) scope.add(other)
    }
    if (scope.size > mentioned.length) {
      const second = kindMentionsScan(text, kinds, { ...extra, leftoverScope: [...scope] })
      if (second.length) return second
    }
  }
  if (!extra) return first
  const co = coMentionKinds(text, extra)
  if (!co.length) return first
  return kindMentionsScan(text, kinds, { ...extra, leftoverScope: co })
}

function relationsFromVocab(vocab, extra = {}) {
  const out = []
  const bag = { vocab, ...extra }
  const push = (rel) => {
    if (!rel || typeof rel !== 'object') return
    const from = resolveKindAlias(String(rel.from || rel.fromKind || '').trim(), bag)
    const to = resolveKindAlias(String(rel.to || rel.toKind || '').trim(), bag)
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

export function nestFromSteps(steps) {
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
          if (!phrase || phrase.length < 2) continue
          if (phrase.length > token.length && phrase.startsWith(token)) {
            if (text.slice(mention.index, mention.index + phrase.length) === phrase) return true
          }
          if (phrase.length > token.length) {
            let from = Math.max(0, mention.index - phrase.length)
            while (from <= mention.index) {
              const idx = text.indexOf(phrase, from)
              if (idx < 0) break
              if (mention.index >= idx && mention.end <= idx + phrase.length) return true
              from = idx + 1
            }
          }
        }
      }
    }
  }
  return false
}

function resolvedEnumValuesForOwnerRows(rows, ownerKind, mergedVocab, extra) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return []
  const say = String(list[0].say || '').trim()
  const owner = String(ownerKind || list[0].ownerKind || '').trim()
  if (!say || !owner) return list[0].values || []
  const fields = schemaFieldsForKind(owner, mergedVocab, extra)
  const codes = new Set()
  for (const row of list) {
    const keys = (row.keys || []).map((item) => String(item || '').trim()).filter(Boolean)
    for (const field of fields) {
      const ident = fieldIdentityOf(field)
      const keyHit = keys.some((key) => (
        key === ident.identity || key === ident.name || key === ident.title
      ))
      if (!keyHit) continue
      for (const code of resolveClueValuesForField(field, say, null, mergedVocab)) codes.add(code)
    }
  }
  if (codes.size) return [...codes]
  return list[0].values || []
}

function resolveClueValuesForField(field, matchedSay, clue, vocab) {
  const say = String(matchedSay || '').trim()
  if (!say) return []
  const packed = fieldEnumsOf(field)
  const clueValues = stringList(clue && (clue.values || clue.value))
  if (clue && clue.not === true && packed) {
    const codes = []
    for (const item of clueValues) {
      if (Object.prototype.hasOwnProperty.call(packed, String(item))) {
        codes.push(String(item))
        continue
      }
      for (const [code, label] of Object.entries(packed)) {
        if (String(label || '') === item) codes.push(String(code))
      }
    }
    return [...new Set(codes)]
  }
  if (packed) {
    const hits = enumHits(field, say, vocab)
    if (hits.length === 1) return [hits[0].code]
    return []
  }
  const direct = clueValues.filter((item) => enumValueMatches(say, item, item))
  if (direct.length) return [...new Set(direct.map((item) => String(item)))]
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
        ? resolveClueValuesForField(matched, packed.say, clue, mergedVocab)
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
  const packageClues = []
  for (const row of mergedVocab) {
    if (row && (row.spoken || row.kind === '口语')) packageClues.push(...cluesOfRow(row))
  }
  if (!packageClues.length) packageClues.push(...spokenSeedClues())
  const seenSeed = new Set()
  for (const clue of packageClues) {
    if (!clue || typeof clue !== 'object') continue
    if (speechKeysOnly(clue, ['role', 'action', 'join'])) continue
    const packed = findClueHit(text, clue, bag)
    if (!packed) continue
    const mark = `${Number(packed.hitIndex) || 0}:${packed.say}:${clue.not === true || packed.not === true ? 1 : 0}`
    if (seenSeed.has(mark)) continue
    seenSeed.add(mark)
    const owners = bound.filter((kind) => kindOwnsFieldClue(kind, clue, packed, mergedVocab, extra))
    for (const owner of owners) {
      const fields = schemaFieldsForKind(owner, mergedVocab, extra)
      const keys = stringList(clue.keys || clue.field)
      const matched = fields.find((field) => {
        const ident = fieldIdentityOf(field)
        return keys.includes(ident.identity) || keys.includes(ident.name) || keys.includes(ident.title)
      })
      const ident = matched ? fieldIdentityOf(matched) : { identity: keys[0] || '', name: keys[0] || '' }
      if (!ident.identity) continue
      let resolvedValues = matched
        ? resolveClueValuesForField(matched, packed.say, clue, mergedVocab)
        : stringList(clue.values || clue.value)
      if (!resolvedValues.length) resolvedValues = stringList(clue.values || clue.value)
      if (!resolvedValues.length && !(clue.not === true || packed.not === true)) continue
      pushCandidate({
        ...packed,
        keys: [...new Set([ident.identity, ident.name].filter(Boolean))],
        values: resolvedValues,
        not: clue.not === true || packed.not === true,
      }, owner)
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
    if (byOwner.size > 1) {
      const sample = group[0]
      const glued = adjacentKindAfterEnum(text, sample && sample.end, mentions, [...byOwner.keys()])
      if (glued && byOwner.has(glued)) {
        for (const owner of [...byOwner.keys()]) {
          if (owner !== glued) byOwner.delete(owner)
        }
      } else {
        byOwner.clear()
      }
    }
    for (const rows of byOwner.values()) {
      const identities = [...new Set(rows.map((row) => String((row.keys || [])[0] || '')).filter(Boolean))]
      if (identities.length !== 1) {
        const row = rows[0]
        const mergedKeys = [...new Set(rows.flatMap((item) => (item.keys || []).map(String).filter(Boolean)))]
        if (!mergedKeys.length) continue
        const values = resolvedEnumValuesForOwnerRows(rows, row.ownerKind, mergedVocab, extra)
        assigned.push({
          hitIndex: row.start,
          say: row.say,
          keys: mergedKeys,
          values,
          not: row.not === true,
          ...(Array.isArray(row.dateBefore) && row.dateBefore.length ? { dateBefore: row.dateBefore } : {}),
          assignKind: row.ownerKind,
          owned: true,
        })
        continue
      }
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

const WRITE_ACTIONS = ['删除', '过审', '新建', '改行']

function hitSpan(hit) {
  const start = Number(hit && hit.hitIndex) || 0
  return { start, end: start + String((hit && hit.say) || '').length }
}

function actionHitNestedInField(hit, hits) {
  const span = hitSpan(hit)
  if (span.end <= span.start) return false
  return (Array.isArray(hits) ? hits : []).some((other) => {
    if (other === hit) return false
    const keys = Array.isArray(other && other.keys) ? other.keys : []
    if (keys.includes('action') || keys.includes('role') || keys.includes('join')) return false
    const outer = hitSpan(other)
    return outer.start <= span.start && outer.end >= span.end && (outer.end - outer.start) > (span.end - span.start)
  })
}

function spokenActionHits(speech, vocab, extra, actions) {
  const want = Array.isArray(actions) ? actions : []
  const hits = clueHitsInSpeech(speech, vocab, extra)
  const found = []
  for (const hit of hits) {
    if (!Array.isArray(hit.keys) || !hit.keys.includes('action')) continue
    const act = want.find((item) => (hit.values || []).includes(item))
    if (!act || actionHitNestedInField(hit, hits)) continue
    if (!found.includes(act)) found.push(act)
  }
  return found
}

function spokenWriteActions(speech, vocab, extra = {}) {
  return spokenActionHits(speech, vocab, extra, WRITE_ACTIONS)
}

/** Write action slot, or 改写 followed by a value. Used to lock chat-ask after a write utterance. */
export function speechHoldsWorkstationWrite(speech, vocab, extra = {}) {
  const text = String(speech || '').trim()
  if (!text) return false
  if (spokenWriteActions(text, vocab, extra).length) return true
  const span = rewriteSpan(text)
  return span.at >= 0 && Boolean(span.after)
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
  return wanted ? [] : list
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

export function unpreviewablePlanKind(plan, extra = {}) {
  const steps = Array.isArray(plan && plan.steps) ? plan.steps : []
  const names = []
  const add = (value) => {
    const name = String(value || '').trim()
    if (name && !names.includes(name)) names.push(name)
  }
  add(plan && plan.kind)
  for (const step of steps) add(step && step.kind)
  const target = String((steps.length && steps[steps.length - 1] && steps[steps.length - 1].kind) || (plan && plan.kind) || '').trim()
  const labels = registeredKinds(extra)
  for (const raw of names) {
    let name = resolveConnectedKindName(raw, extra) || raw
    if (leftoverKindMissingFromCatalog(name, extra)) {
      if (name === target) return name
      const longer = labels.find((label) => isLeftoverShortKind(name, [label], extra) && kindPreviewableInCatalog(label, extra))
      if (!longer) return name
      name = longer
    }
    if (leftoverKindMissingFromCatalog(name, extra)) return name
    if (!kindPreviewableInCatalog(name, extra)) return name
    if (connectorCatalogPresent(extra) && !resolveConnectedKindName(name, extra) && !mapKind(name, extra)) return name
  }
  return ''
}
