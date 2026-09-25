/** Decision 15: object = connected table; spoken name = alias; graph = relations. */

import { createRequire } from 'node:module'
import { isUnfilteredListSheet, sheetCarriesIdentity } from '../vendor-overlays/dsh-lan-assist/session-round.js'

const require = createRequire(import.meta.url)
const spokenSeed = require('../vendor-overlays/dsh-lan-assist/vocab/spoken.json')

const FILLER_ROLES = new Set(['动作', '列举', '助词', '问句', '焦点', '改写', '连接', '标点'])
const WRITE_ACTIONS = new Set(['删除', '过审', '新建', '改行'])

function kindName(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.kind || row.label || '').trim()
}

function resourceOf(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.resource || '').trim()
}

function catalogVersionOf(row) {
  if (!row || typeof row !== 'object') return ''
  return String(row.catalogVersion || '').trim()
}

function fieldCount(row) {
  return Array.isArray(row?.fields) ? row.fields.length : 0
}

function canCount(row) {
  return Array.isArray(row?.can) ? row.can.length : 0
}

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value.split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function cluesOfRow(row) {
  if (!row || typeof row !== 'object') return []
  return Array.isArray(row.clues) ? row.clues : []
}

function oralAndGraphAliasTokens(row) {
  const out = []
  if (!row || typeof row !== 'object') return out
  out.push(...stringList(row.aliases))
  for (const clue of cluesOfRow(row)) {
    if (!clue || typeof clue !== 'object') continue
    if (String(clue.role || '').trim() !== '型') continue
    out.push(...stringList(clue.say || clue.says))
  }
  return out.filter(Boolean)
}

function pickCanonicalRow(rows) {
  const ranked = [...rows].sort((a, b) => {
    const va = catalogVersionOf(a) ? 1 : 0
    const vb = catalogVersionOf(b) ? 1 : 0
    if (vb !== va) return vb - va
    if (fieldCount(b) !== fieldCount(a)) return fieldCount(b) - fieldCount(a)
    return canCount(b) - canCount(a)
  })
  return ranked[0]
}

function connectorResourcesFrom(rows, explicit) {
  if (explicit && typeof explicit === 'object') {
    const listed = explicit instanceof Set ? [...explicit] : (Array.isArray(explicit) ? explicit : [])
    const packed = new Set(listed.map((item) => String(item || '').trim()).filter(Boolean))
    if (packed.size) return packed
  }
  const fromCatalog = new Set()
  for (const row of rows) {
    const resource = resourceOf(row)
    if (resource && (catalogVersionOf(row) || isConnectedResource(resource, new Set()))) {
      fromCatalog.add(resource)
    }
  }
  return fromCatalog
}

function isConnectedResource(resource, connectorResources) {
  if (!resource) return false
  if (connectorResources.size) return connectorResources.has(resource)
  return /^[A-Za-z][A-Za-z0-9._-]*$/.test(resource)
}

export function collapseKindsToConnectedTables(kinds, opts = {}) {
  const rows = []
  for (const raw of Array.isArray(kinds) ? kinds : []) {
    const row = typeof raw === 'string'
      ? { kind: raw.trim() }
      : { ...raw, kind: kindName(raw) }
    if (!row.kind) continue
    rows.push(row)
  }
  const connectorResources = connectorResourcesFrom(rows, opts.connectorResources)
  const byResource = new Map()
  for (const row of rows) {
    const resource = resourceOf(row)
    if (!isConnectedResource(resource, connectorResources)) continue
    const list = byResource.get(resource) || []
    list.push({ ...row, resource })
    byResource.set(resource, list)
  }
  const collapsed = []
  const aliases = {}
  for (const [, list] of byResource) {
    const canonical = pickCanonicalRow(list)
    const inherited = list.flatMap((row) => oralAndGraphAliasTokens(row))
    const aliasNames = [...new Set([
      ...list.map((row) => row.kind).filter((name) => name !== canonical.kind),
      ...inherited,
    ])].filter((name) => name && name !== canonical.kind)
    collapsed.push({
      ...canonical,
      label: canonical.label || canonical.kind,
      aliases: aliasNames,
    })
    aliases[canonical.kind] = canonical.kind
    for (const name of aliasNames) aliases[name] = canonical.kind
  }
  return { kinds: collapsed, aliases }
}

function rawCatalogKindNames(index) {
  const names = new Set()
  if (!Array.isArray(index)) return names
  for (const raw of index) {
    const row = typeof raw === 'string' ? { kind: raw.trim() } : { kind: kindName(raw) }
    if (row.kind) names.add(row.kind)
  }
  return names
}

export function resolveConnectedKind(spoken, index) {
  const name = String(spoken || '').trim()
  if (!name) return ''
  const rawKinds = rawCatalogKindNames(index)
  if (rawKinds.has(name)) return name
  const packed = Array.isArray(index) ? collapseKindsToConnectedTables(index) : index
  if (!packed || !Array.isArray(packed.kinds)) return name
  if (packed.kinds.length === 0) {
    return Array.isArray(index) && index.length ? '' : name
  }
  if (packed.kinds.some((row) => row.kind === name)) return name
  const mapped = packed.aliases && packed.aliases[name]
  if (mapped) return mapped
  for (const row of packed.kinds) {
    if (Array.isArray(row.aliases) && row.aliases.includes(name)) return row.kind
  }
  return ''
}

export function canonicalizeSheetKind(sheet, index) {
  if (!sheet || typeof sheet !== 'object') return sheet
  const kind = String(sheet.kind || '').trim()
  if (!kind) return sheet
  const packed = Array.isArray(index) ? collapseKindsToConnectedTables(index) : index
  if (!packed || !Array.isArray(packed.kinds) || packed.kinds.length === 0) return sheet
  const resolved = resolveConnectedKind(kind, packed)
  if (!resolved) return null
  if (resolved === kind) return sheet
  return { ...sheet, kind: resolved }
}

function vocabRows(vocab) {
  const rows = Array.isArray(vocab) ? vocab.map((row) => (row && typeof row === 'object' ? { ...row } : row)) : []
  const seed = spokenSeed && Array.isArray(spokenSeed.clues) ? spokenSeed.clues : []
  const idx = rows.findIndex((row) => row && (row.spoken || row.kind === '口语' || row.id === 'spoken'))
  if (idx < 0) {
    rows.push({ kind: '口语', spoken: true, clues: seed })
    return rows
  }
  const have = cluesOfRow(rows[idx])
  rows[idx] = { ...rows[idx], clues: [...have, ...seed] }
  return rows
}

function roleSays(vocab, role) {
  const want = String(role || '').trim()
  const out = []
  for (const row of vocabRows(vocab)) {
    if (Array.isArray(row?.can) && want === '动作') {
      out.push(...row.can.map((item) => String(item || '').trim()).filter(Boolean))
    }
    for (const clue of cluesOfRow(row)) {
      if (!clue || typeof clue !== 'object') continue
      if (String(clue.role || '').trim() !== want) continue
      out.push(...stringList(clue.say || clue.says))
    }
  }
  return [...new Set(out.filter(Boolean))]
}

export function spokenFillerTokens(vocab) {
  const tokens = new Set()
  for (const role of FILLER_ROLES) {
    for (const say of roleSays(vocab, role)) tokens.add(say)
  }
  for (const row of vocabRows(vocab)) {
    for (const act of Array.isArray(row?.can) ? row.can : []) {
      const name = String(act || '').trim()
      if (name) tokens.add(name)
    }
  }
  return tokens
}

export function isSpokenActionOrBatchToken(name, vocab) {
  const text = String(name || '').trim()
  if (!text) return false
  const tokens = spokenFillerTokens(vocab)
  if (tokens.has(text)) return true
  let rest = text
  for (const say of [...tokens].sort((a, b) => b.length - a.length)) {
    if (!say) continue
    rest = rest.split(say).join(' ')
  }
  return !rest.replace(/\s+/g, '').trim()
}

export function speechWantsMatchSet(speech, vocab) {
  const text = String(speech || '')
  if (!text.trim()) return false
  if (roleSays(vocab, '列举').some((say) => say && text.includes(say))) return true
  const particles = roleSays(vocab, '助词')
  const actionSays = []
  for (const row of vocabRows(vocab)) {
    for (const clue of cluesOfRow(row)) {
      if (!clue || typeof clue !== 'object') continue
      if (String(clue.role || '').trim() !== '动作') continue
      const values = stringList(clue.values || clue.value)
      if (values.length && !values.some((value) => WRITE_ACTIONS.has(value))) continue
      actionSays.push(...stringList(clue.say || clue.says))
    }
  }
  for (const say of actionSays) {
    if (!say) continue
    const idx = text.indexOf(say)
    if (idx <= 0) continue
    const before = text.slice(Math.max(0, idx - 4), idx)
    if (particles.some((particle) => particle && before.endsWith(particle))) return true
  }
  return false
}

export function dropActionBatchLeftover(no, speech, vocab) {
  const name = String(no || '').trim()
  if (!name) return ''
  if (isSpokenActionOrBatchToken(name, vocab)) return ''
  if (!speechWantsMatchSet(speech, vocab)) return name
  if (/[A-Za-z0-9]/.test(name)) return name
  return ''
}

function sheetPreviewId(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  const id = sheet.preview_id ?? sheet.previewId
  return typeof id === 'string' ? id.trim() : ''
}

function sheetRowCount(sheet) {
  if (!sheet || typeof sheet !== 'object') return 0
  return Array.isArray(sheet.rows) ? sheet.rows.length : 0
}

export function isConnectorCatalogDump(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() !== '现查') return false
  if (sheetPreviewId(sheet)) return false
  if (String(sheet.speech || '').trim()) return false
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return false
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return false
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) {
    return false
  }
  if (Array.isArray(sheet.steps) && sheet.steps.length) return false
  return true
}

function sheetPicked(sheet) {
  return Boolean(sheet && typeof sheet === 'object' && sheet.picked === true)
}

function sheetSpeech(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.speech || '').trim()
}

function waitingHitSetPick(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (sheetPreviewId(sheet)) return false
  if (sheetRowCount(sheet) <= 1) return false
  const action = String(sheet.action || '').trim()
  if (!action || action === '现查') return false
  return Boolean(sheet.ambiguous || sheet.listed)
}

function sheetKindName(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.kind || '').trim()
}

function isWriteAction(sheet) {
  const action = String((sheet && sheet.action) || '').trim()
  return Boolean(action && action !== '现查')
}

function sheetNos(sheet) {
  if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.rows)) return []
  return sheet.rows.map((row) => {
    if (!row || typeof row !== 'object') return ''
    return String(row.no || '').trim()
  }).filter(Boolean)
}

function leftoverQueryCoveringWrite(prev, incoming) {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
  if (!isWriteAction(prev)) return false
  if (String(incoming.action || '').trim() !== '现查') return false
  if (sheetPicked(incoming)) return false
  const prevKind = sheetKindName(prev)
  const nextKind = sheetKindName(incoming)
  if (prevKind && nextKind && prevKind !== nextKind) return false
  if (waitingHitSetPick(prev)) return true
  const prevNos = sheetNos(prev)
  if (!prevNos.length) return false
  const incomingNos = sheetNos(incoming)
  const speech = sheetSpeech(incoming)
  return incomingNos.some((no) => prevNos.includes(no))
    || prevNos.some((no) => no && speech.includes(no))
}

/** This-turn spoken sheet: new speech, or a new kind+action with rows. Empty leftover guns are not this. */
function isNewSpokenUtterance(prev, incoming) {
  if (!incoming || typeof incoming !== 'object') return false
  if (isConnectorCatalogDump(incoming)) return false
  if (sheetRowCount(incoming) <= 0) return false
  const prevSpeech = sheetSpeech(prev)
  const nextSpeech = sheetSpeech(incoming)
  if (nextSpeech && nextSpeech !== prevSpeech) return true
  const prevKind = sheetKindName(prev)
  const nextKind = sheetKindName(incoming)
  const prevAct = String((prev && prev.action) || '').trim()
  const nextAct = String((incoming && incoming.action) || '').trim()
  return Boolean((nextKind && nextKind !== prevKind) || (nextAct && nextAct !== prevAct))
}

export function shouldSkipCoveringPending(prev, incoming) {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
  if (leftoverQueryCoveringWrite(prev, incoming)) return true
  if (isNewSpokenUtterance(prev, incoming)) return false
  const prevSpeech = sheetSpeech(prev)
  const nextSpeech = sheetSpeech(incoming)
  const sameSpeech = Boolean(prevSpeech && nextSpeech && prevSpeech === nextSpeech)
  if (sheetPicked(prev) && sheetPreviewId(prev) && !sheetPicked(incoming)) {
    if (!nextSpeech || sameSpeech) return true
  }
  if (waitingHitSetPick(prev) && sheetPreviewId(incoming) && !sheetPicked(incoming)) return true
  const prevRows = sheetRowCount(prev)
  const nextRows = sheetRowCount(incoming)
  if (prevRows <= 0) return false
  if (nextRows > 0) {
    return isConnectorCatalogDump(incoming) && !nextSpeech
  }
  if (prevSpeech && nextSpeech && prevSpeech === nextSpeech) return true
  if (isConnectorCatalogDump(incoming)) return true
  const action = String(incoming.action || '').trim()
  if (action && action !== '现查' && !sheetPreviewId(incoming)) return true
  if (nextRows === 0 && prevRows > 0) return true
  return false
}

/** Cancel/GET: keep the utterance sheet; never let a covering dump win from either side. */
export function sheetAfterCancelCover(hallSheet, lastEmitted) {
  const hall = hallSheet && typeof hallSheet === 'object' ? hallSheet : null
  const last = lastEmitted && typeof lastEmitted === 'object' ? lastEmitted : null
  if (hall && last) {
    if (shouldSkipCoveringPending(hall, last)) return hall
    if (shouldSkipCoveringPending(last, hall)) return last
  }
  if (hall && !isConnectorCatalogDump(hall)) return hall
  if (last && !isConnectorCatalogDump(last)) return last
  return null
}

/** Named session GET/hydrate: never serve another session's hall or lastEmitted. */
export function sheetForNamedSession(sheet, sessionId) {
  const sid = String(sessionId || '').trim()
  if (!sid) return sheet && typeof sheet === 'object' ? sheet : null
  if (!sheet || typeof sheet !== 'object') return null
  return String(sheet.sessionId || '').trim() === sid ? sheet : null
}

/**
 * GET pending-sheet: dump vs utterance cover, then named-session filter.
 * Unstamped lan-assist hall must not wipe this session's last emit (改行 preview 200 → GET empty).
 */
export function sheetForPendingGet(hallSheet, lastEmitted, sessionId) {
  const last = lastEmitted && typeof lastEmitted === 'object' ? lastEmitted : null
  const covered = sheetAfterCancelCover(hallSheet, last)
  const namedCovered = sheetForNamedSession(covered, sessionId)
  if (namedCovered) return namedCovered
  const namedLast = sheetForNamedSession(last, sessionId)
  if (!namedLast) return null
  if (!covered) return namedLast
  const coveredSid = String(covered.sessionId || '').trim()
  const sid = String(sessionId || '').trim()
  if (coveredSid && coveredSid !== sid) return namedLast
  if (!coveredSid && shouldSkipCoveringPending(namedLast, covered)) return namedLast
  if (!coveredSid && sid) return { ...covered, sessionId: sid }
  return namedLast
}

function isHumanWritePreview(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  const action = String(sheet.action || '').trim()
  const previewId = String(sheet.preview_id || sheet.previewId || '').trim()
  return Boolean(previewId) && action !== '现查'
}

/** This utterance's settled 现查. Unfiltered and catalog dumps are not it. */
function isSettledUtteranceLookup(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() !== '现查') return false
  if (sheet.picked === true) return false
  if (isUnfilteredListSheet(sheet) || isConnectorCatalogDump(sheet)) return false
  if (!sheetCarriesIdentity(sheet)) return false
  if (sheetRowCount(sheet) > 0) return true
  return sheet.querySettled === true
}

/**
 * GET/hydrate: this utterance's settled 现查, else the unused write preview.
 * A later catalog or unidentified list does not replace the write.
 */
export function sheetForOfficialGet(official, lastEmitted, sessionId) {
  const last = lastEmitted && typeof lastEmitted === 'object' ? lastEmitted : null
  let off = official && typeof official === 'object' ? official : null
  const sid = String(sessionId || '').trim()
  if (off && sid && !String(off.sessionId || '').trim()) off = { ...off, sessionId: sid }
  if (!sid) {
    if (isHumanWritePreview(last) && !isSettledUtteranceLookup(off)) return last
    return off || last
  }
  const namedLast = sheetForNamedSession(last, sid)
  const namedOff = sheetForNamedSession(off, sid)
  if (isHumanWritePreview(namedLast) && !isSettledUtteranceLookup(namedOff)) return namedLast
  return namedOff || namedLast
}
