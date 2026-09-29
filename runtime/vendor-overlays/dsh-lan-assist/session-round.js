/**
 * One human send → one official sheet from this round's tool results.
 * Process previews are not official. Slot last-write is not this round's result.
 * @module dsh-lan-assist/session-round
 */

function sheetRowCount(sheet) {
  if (!sheet || typeof sheet !== 'object') return 0
  return Array.isArray(sheet.rows) ? sheet.rows.length : 0
}

function sheetAction(sheet) {
  return String((sheet && sheet.action) || '').trim()
}

function sheetPreviewId(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.preview_id || sheet.previewId || '').trim()
}

export function shouldCancelDshAfterWritePreview(action, previewId) {
  return Boolean(String(previewId || '').trim()) && String(action || '').trim() !== '现查'
}

/** Human can confirm this sheet on the workstation. Chat must not keep asking. */
export function isConfirmableWritePreview(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  const previewId = sheetPreviewId(sheet)
  const action = sheetAction(sheet)
  if (!shouldCancelDshAfterWritePreview(action, previewId)) return false
  if (sheet.picked === true) return true
  if (sheet.canWrite === true || sheet.can_write === true) return true
  return Array.isArray(sheet.changes) && sheet.changes.length > 0
}

function sheetHasPicks(sheet) {
  const cells = Array.isArray(sheet && sheet.cells) ? sheet.cells : []
  return cells.some((cell) => cell && Array.isArray(cell.picks) && cell.picks.length > 0)
}

/** This utterance's write result: token, listed pick, or pick-cells. Goes to candidate. */
export function isRoundWriteResult(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  const action = sheetAction(sheet)
  if (!action || action === '现查') return false
  if (!isEligibleRoundSheet(sheet)) return false
  if (shouldCancelDshAfterWritePreview(action, sheetPreviewId(sheet))) return true
  if (isConfirmableWritePreview(sheet)) return true
  if (canPickListedWrite(sheet)) return true
  if (sheetHasPicks(sheet)) return true
  return false
}

/** Alias of isRoundWriteResult: this sheet is the round write candidate. */
export function isWorkstationHeldWrite(sheet) {
  return isRoundWriteResult(sheet)
}

function canPickListedWrite(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  const action = sheetAction(sheet)
  if (!action || action === '现查') return false
  if (sheet.blockConfirm === true) return false
  if (sheet.listed !== true && sheet.ambiguous !== true) return false
  return sheetRowCount(sheet) >= 2
}

/** Live token or listed write that a row pick can mint. */
export function holdsWorkstationAsk(sheet) {
  if (isConfirmableWritePreview(sheet)) return true
  return canPickListedWrite(sheet)
}

/** Ask stays blocked only while the right side can confirm or pick. */
export function roundBlocksChatAsk(round, _writeSpeech) {
  if (!round) return false
  return holdsWorkstationAsk(round.candidate)
}

function sheetKind(sheet) {
  return String((sheet && sheet.kind) || '').trim()
}

function sheetSpeech(sheet) {
  return String((sheet && sheet.speech) || '').trim()
}

function sheetPage(sheet) {
  const page = Number(sheet && sheet.page)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

/** Next page of the same 现查 is not leftover cancel. */
function isPagedLookupContinuation(candidate, incoming) {
  if (!candidate || !incoming) return false
  if (sheetAction(candidate) !== '现查' || sheetAction(incoming) !== '现查') return false
  if (sheetPreviewId(candidate) || sheetPreviewId(incoming)) return false
  return sheetPage(incoming) > sheetPage(candidate)
}

function sheetNos(sheet) {
  if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.rows)) return []
  return sheet.rows.map((row) => {
    if (!row || typeof row !== 'object') return ''
    return String(row.no || '').trim()
  }).filter(Boolean)
}

/** Unfiltered 现查 list. Speech may be stamped; page size is not a rule. */
export function isUnfilteredListSheet(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (sheetAction(sheet) !== '现查') return false
  if (sheetPreviewId(sheet)) return false
  if (String(sheet.lookupNo || '').trim()) return false
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

export function isEligibleRoundSheet(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (sheet.ok === false) return false
  const action = sheetAction(sheet)
  if (sheet.officialBound === true && action === '现查') return true
  if (isUnfilteredListSheet(sheet)) return false
  const rows = sheetRowCount(sheet)
  const previewId = sheetPreviewId(sheet)
  if (action === '现查' && rows <= 0 && sheet.querySettled !== true) return false
  if (action && action !== '现查' && rows <= 0 && !previewId && !(sheet.ambiguous || sheet.listed) && !sheetHasPicks(sheet)) {
    return false
  }
  return rows > 0 || Boolean(previewId) || Boolean(sheet.ambiguous || sheet.listed) || sheetHasPicks(sheet) || sheet.querySettled === true
}

export function sheetCarriesIdentity(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (String(sheet.lookupNo || '').trim()) return true
  const where = sheet.where ?? sheet.listWhere
  if (Array.isArray(where) && where.length) return true
  if (Array.isArray(sheet.hopWhere) && sheet.hopWhere.length) return true
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && String(from.kind || '').trim()) return true
  if (Array.isArray(sheet.steps) && sheet.steps.length) return true
  return false
}

function writtenIdentityNos(identity) {
  if (!identity || typeof identity !== 'object') return []
  const nos = []
  const one = String(identity.no || '').trim()
  if (one) nos.push(one)
  if (Array.isArray(identity.nos)) {
    for (const item of identity.nos) {
      const no = String(item || '').trim()
      if (no) nos.push(no)
    }
  }
  return nos
}

/** Follow-up 现查 paints only when it carries the identity just written. */
export function sheetCarriesWrittenIdentity(sheet, identity) {
  if (!sheetCarriesIdentity(sheet)) return false
  if (!identity || typeof identity !== 'object') return false
  const nos = writtenIdentityNos(identity)
  if (nos.length) {
    const lookup = String(sheet.lookupNo || '').trim()
    if (lookup && nos.includes(lookup)) return true
    const rowNos = sheetNos(sheet)
    return nos.some((no) => rowNos.includes(no))
  }
  if (Array.isArray(identity.where) && identity.where.length) {
    const where = sheet.where ?? sheet.listWhere
    return Array.isArray(where) && where.length > 0
  }
  return false
}

function specHasIdentity(spec) {
  if (!spec || typeof spec !== 'object') return false
  if (String(spec.no || spec.ticket || '').trim()) return true
  if (Array.isArray(spec.where) && spec.where.length) return true
  if (Array.isArray(spec.steps) && spec.steps.some((step) => step && (
    String(step.no || '').trim() || (Array.isArray(step.where) && step.where.length)
  ))) return true
  return false
}

function identityNos(identity) {
  const no = String((identity && identity.no) || '').trim()
  const nos = Array.isArray(identity && identity.nos)
    ? identity.nos.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (no && !nos.includes(no)) nos.unshift(no)
  return nos
}

export function wroteLookupLocksSpec(spec, identity) {
  if (!identity || typeof identity !== 'object') return false
  const specKind = String((spec && spec.kind) || '').trim()
  const identKind = String(identity.kind || '').trim()
  if (specKind && identKind && specKind !== identKind) return false
  return identityNos(identity).length > 0 || Boolean(identKind)
}

/** Fill a wrote follow-up lookup with the written identity. lock: same kind, identity over write-speech where. */
export function stampWroteLookup(spec, identity, opts = {}) {
  const next = spec && typeof spec === 'object' ? { ...spec } : {}
  if (!identity || typeof identity !== 'object') return next
  const nos = identityNos(identity)
  const identityNo = nos.length === 1 ? nos[0] : ''
  const identKind = String(identity.kind || '').trim()
  if (opts.lock === true) {
    if (!wroteLookupLocksSpec(next, identity)) return next
    next.speech = ''
    next.userSpeech = ''
    delete next.where
    delete next.quote
    if (identKind && !String(next.kind || '').trim()) next.kind = identKind
    if (identityNo) next.no = identityNo
    else if (nos.length) next.nos = nos
    return next
  }
  if (specHasIdentity(next)) return next
  if (identityNo) {
    next.no = identityNo
    return next
  }
  if (nos.length === 1) next.no = nos[0]
  return next
}

/** Same hop 现查 already settled; connector returned QUERY_SETTLED or search_text drags the turn. */
export function isSettledQueryRepeatLeftover(candidate, incoming) {
  if (!candidate || !incoming || typeof candidate !== 'object' || typeof incoming !== 'object') return false
  if (candidate.querySettled !== true) return false
  if (sheetAction(candidate) !== '现查' || sheetPreviewId(candidate)) return false
  if (String(candidate.kind || '').trim() !== String(incoming.kind || '').trim()) return false
  if (incoming.querySettledRepeat === true || incoming.error === 'QUERY_SETTLED') return true
  return false
}

export function isLeftoverAfterCandidate(candidate, incoming) {
  if (!candidate || !incoming) return false
  if (isSettledQueryRepeatLeftover(candidate, incoming)) return true
  if (isUnfilteredListSheet(incoming) && candidate.wroteReceipt !== true) return true
  return false
}

function newRoundId() {
  return `rnd_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`
}

function canPublishSheet(sheet) {
  if (!isEligibleRoundSheet(sheet)) return false
  if (sheet.ok === false) return false
  if (String(sheet.error || '').trim() === 'TOO_MANY') return false
  return true
}

function settledRepeatFromOf(incoming, fallback) {
  if (incoming && (incoming.querySettledRepeat === true || incoming.error === 'QUERY_SETTLED')) {
    return incoming
  }
  return fallback || null
}

function leftoverCancelNote(incoming, extra = {}) {
  const settledRepeatFrom = settledRepeatFromOf(incoming, extra.settledRepeatFrom)
  return {
    emit: false,
    official: extra.official === undefined ? null : extra.official,
    cancel: false,
    leftover: true,
    process: false,
    ...(settledRepeatFrom ? { settledRepeatFrom } : {}),
  }
}

function blankRound(id, prev) {
  return {
    roundId: id,
    open: false,
    candidate: null,
    boundSheet: null,
    official: prev ? prev.official : null,
    publishedKey: prev && prev.publishedKey ? prev.publishedKey : '',
    officialBeforeWrite: prev ? (prev.officialBeforeWrite || null) : null,
    handed: Boolean(prev && prev.official),
    closedBy: '',
    wroteFollowup: false,
    wroteIdentity: null,
  }
}

function roundOfficialKey(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  const kind = String(sheet.kind || '').trim()
  const action = String(sheet.action || '').trim()
  const speech = String(sheet.speech || '').trim()
  const where = JSON.stringify(sheet.where ?? sheet.listWhere ?? [])
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const firstNo = rows.length && rows[0] && typeof rows[0] === 'object'
    ? String(rows[0].no || '').trim()
    : ''
  return `${kind}|${action}|${speech}|${where}|${rows.length}|${firstNo}|${sheetPage(sheet)}`
}

export function createSessionRoundStore() {
  const bySession = new Map()
  let lastPublishedSid = ''

  function peek(sessionId) {
    const sid = String(sessionId || '').trim()
    if (!sid) return null
    return bySession.get(sid) || null
  }

  function startRound(sessionId, opts = {}) {
    const sid = String(sessionId || '').trim()
    if (!sid) return ''
    const prev = peek(sid)
    if (opts.utterance) {
      if (prev && prev.open) closeRound(sid, 'turn')
      const prior = peek(sid) || prev
      const id = newRoundId()
      const round = blankRound(id, prior)
      round.open = true
      round.userSpeech = String(opts.speech || '').trim()
      round.boundSheet = null
      round.candidate = null
      bySession.set(sid, round)
      return id
    }
    if (prev && prev.open) return prev.roundId
    const id = newRoundId()
    const inheritFollowup = Boolean(prev && prev.wroteFollowup)
    const round = blankRound(id, prev)
    round.open = true
    round.wroteFollowup = inheritFollowup
    round.wroteIdentity = inheritFollowup && prev ? (prev.wroteIdentity || null) : null
    bySession.set(sid, round)
    return id
  }

  function publishInto(round, sheet, sessionId) {
    if (!round || !canPublishSheet(sheet)) return false
    const key = roundOfficialKey(sheet)
    if (key && key === round.publishedKey) return false
    const act = sheetAction(sheet)
    const prev = round.official
    if (act && act !== '现查' && sheetPreviewId(sheet) && prev && !sheetPreviewId(prev)) {
      round.officialBeforeWrite = prev
    }
    const sid = String(sessionId || sheet.sessionId || '').trim()
    let stamped = sheet
    if (sid && String(stamped.sessionId || '').trim() !== sid) stamped = { ...stamped, sessionId: sid }
    stamped = { ...stamped, roundId: newRoundId() }
    round.official = stamped
    round.publishedKey = key
    round.handed = false
    return true
  }

  function markPublished(sessionId) {
    const sid = String(sessionId || '').trim()
    if (sid) lastPublishedSid = sid
  }

  function publishOfficial(sessionId, sheet) {
    const sid = String(sessionId || '').trim()
    if (!sid || !sheet || typeof sheet !== 'object') return false
    let round = peek(sid)
    if (!round) {
      bySession.set(sid, blankRound(newRoundId(), null))
      round = peek(sid)
    }
    const ok = publishInto(round, sheet, sid)
    if (ok) markPublished(sid)
    return ok
  }

  function republishAfterDismiss(sessionId, restored) {
    const sid = String(sessionId || '').trim()
    const round = peek(sid)
    if (!round) return false
    const restoredSheet = restored && canPublishSheet(restored) ? restored : null
    const sheet = restoredSheet || (canPublishSheet(round.officialBeforeWrite) ? round.officialBeforeWrite : null)
    if (!sheet) {
      const current = round.official
      if (current && sheetPreviewId(current) && sheetAction(current) !== '现查') {
        round.official = null
        round.publishedKey = ''
        round.officialBeforeWrite = null
        round.handed = false
        return true
      }
      return false
    }
    const prevKey = round.publishedKey
    round.publishedKey = ''
    const ok = publishInto(round, sheet, sid)
    if (!ok) round.publishedKey = prevKey
    else round.officialBeforeWrite = null
    return ok
  }

  function closeRound(sessionId, reason = 'turn', extra = {}) {
    const sid = String(sessionId || '').trim()
    const round = peek(sid)
    if (!round) return { official: null, emit: false, cancel: false }
    if (reason === 'wrote') {
      round.candidate = null
      round.open = false
      round.closedBy = 'wrote'
      round.wroteFollowup = true
      round.wroteIdentity = extra && extra.identity ? extra.identity : (round.wroteIdentity || null)
      return { official: round.official || null, emit: false, cancel: false }
    }
    if (reason === 'leftover') {
      return { official: round.official || null, emit: false, cancel: false }
    }
    if (round.open) {
      round.open = false
      const writePreview = isRoundWriteResult(round.candidate) ? round.candidate : null
      const next = writePreview || round.boundSheet
      const ident = round.wroteIdentity
      const sameKind = Boolean(
        ident
        && ident.kind
        && String((next && next.kind) || '').trim()
        && String(next.kind).trim() === String(ident.kind).trim(),
      )
      const bareFollowup = Boolean(
        round.wroteFollowup
        && next
        && (!ident || !ident.kind || sameKind)
        && !sheetCarriesWrittenIdentity(next, ident),
      )
      if (next && canPublishSheet(next) && !bareFollowup) {
        const prevKey = roundOfficialKey(round.official)
        const nextKey = roundOfficialKey(next)
        publishInto(round, next, sid)
        if (nextKey && nextKey !== prevKey) round.handed = false
        markPublished(sid)
      }
    }
    round.closedBy = 'turn'
    const emit = Boolean(round.official) && !round.handed
    if (emit) round.handed = true
    return { official: emit ? round.official : null, emit, cancel: false }
  }

  function noteToolSheet(sessionId, incomingRaw) {
    const sid = String(sessionId || '').trim()
    if (!sid || !incomingRaw || typeof incomingRaw !== 'object') {
      return { emit: false, official: null, cancel: false, process: false }
    }
    let round = peek(sid)
    if (!round || !round.open) {
      if (round && round.official && isLeftoverAfterCandidate(round.official, incomingRaw)) {
        const settledRepeat = isSettledQueryRepeatLeftover(round.official, incomingRaw)
        return leftoverCancelNote(incomingRaw, {
          official: round.official,
          ...(settledRepeat ? { settledRepeatFrom: round.official } : {}),
        })
      }
      if (!isEligibleRoundSheet(incomingRaw) && !isUnfilteredListSheet(incomingRaw)) {
        return { emit: false, official: round ? round.official : null, cancel: false, process: false }
      }
      const harvestWrite = isRoundWriteResult(incomingRaw)
      const harvestLookup = Boolean(
        sheetAction(incomingRaw) === '现查'
        && canPublishSheet(incomingRaw)
        && !isUnfilteredListSheet(incomingRaw),
      )
      const emptyClosed = Boolean(
        round
        && !round.open
        && round.closedBy === 'turn'
        && !round.boundSheet
        && !isRoundWriteResult(round.candidate),
      )
      if (emptyClosed && (harvestLookup || harvestWrite)) {
        round.open = true
        if (harvestWrite) round.candidate = incomingRaw
        else round.boundSheet = incomingRaw
        const closed = closeRound(sid, 'turn')
        return {
          ...closed,
          process: true,
          leftover: false,
        }
      }
      startRound(sid)
      round = peek(sid)
    }

    if (round.wroteFollowup && sheetCarriesWrittenIdentity(incomingRaw, round.wroteIdentity)) {
      incomingRaw = { ...incomingRaw, wroteReceipt: true }
    }

    const ident = round.wroteIdentity
    const sameKind = Boolean(
      ident
      && ident.kind
      && String(incomingRaw.kind || '').trim() === String(ident.kind).trim(),
    )
    const followupMiss = Boolean(
      round.wroteFollowup
      && ident
      && (!ident.kind || sameKind)
      && !sheetCarriesWrittenIdentity(incomingRaw, ident),
    )

    if (sheetAction(incomingRaw) === '现查' && incomingRaw.picked !== true && !sheetPreviewId(incomingRaw)) {
      if (isRoundWriteResult(round.candidate)) {
        return leftoverCancelNote(incomingRaw)
      }
      if (incomingRaw.querySettledRepeat === true || incomingRaw.error === 'QUERY_SETTLED') {
        return leftoverCancelNote(incomingRaw, {
          settledRepeatFrom: round.boundSheet || round.candidate,
          cancel: false,
        })
      }
      if (isUnfilteredListSheet(incomingRaw) && (round.boundSheet || round.candidate)) {
        return leftoverCancelNote(incomingRaw)
      }
      if (!followupMiss && (canPublishSheet(incomingRaw) || incomingRaw.officialBound === true)) {
        round.boundSheet = incomingRaw
      }
    }

    if (isRoundWriteResult(incomingRaw)) {
      round.candidate = incomingRaw
      return {
        emit: false,
        official: null,
        cancel: false,
        process: true,
      }
    }

    return { emit: false, official: null, cancel: false, process: true }
  }

  function officialSheet(sessionId) {
    const round = peek(sessionId)
    if (!round) return null
    return round.official || null
  }

  function servedSheet(sessionId) {
    const sid = String(sessionId || '').trim() || lastPublishedSid
    const round = peek(sid)
    if (!round) return null
    return round.official || null
  }

  function isOpen(sessionId) {
    return Boolean(peek(sessionId)?.open)
  }

  function isWroteFollowup(sessionId) {
    return Boolean(peek(sessionId)?.wroteFollowup)
  }

  function wroteIdentity(sessionId) {
    const round = peek(sessionId)
    if (!round || !round.wroteFollowup) return null
    return round.wroteIdentity || null
  }

  function noteHumanUtterance(sessionId) {
    const round = peek(sessionId)
    if (round) round.wroteFollowup = false
  }

  /** Host search_text is not leftover-cancelled. Official sheet stays the round candidate. */
  function notePostSettledHopTool(sessionId, toolName) {
    const sid = String(sessionId || '').trim()
    const name = String(toolName || '').trim()
    if (!sid || name !== 'search_text') {
      return { emit: false, official: null, cancel: false, process: false }
    }
    return { emit: false, official: null, cancel: false, process: true }
  }

  return {
    peek,
    startRound,
    closeRound,
    noteToolSheet,
    notePostSettledHopTool,
    publishOfficial,
    republishAfterDismiss,
    officialSheet,
    servedSheet,
    isOpen,
    isWroteFollowup,
    wroteIdentity,
    noteHumanUtterance,
    roundSpeech(sessionId) {
      return String((peek(sessionId) && peek(sessionId).userSpeech) || '').trim()
    },
  }
}
