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

function sheetKind(sheet) {
  return String((sheet && sheet.kind) || '').trim()
}

function sheetSpeech(sheet) {
  return String((sheet && sheet.speech) || '').trim()
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
  if (isUnfilteredListSheet(sheet)) return false
  const rows = sheetRowCount(sheet)
  const action = sheetAction(sheet)
  const previewId = sheetPreviewId(sheet)
  if (action === '现查' && rows <= 0 && sheet.querySettled !== true) return false
  if (action && action !== '现查' && rows <= 0 && !previewId && !(sheet.ambiguous || sheet.listed)) {
    return false
  }
  return rows > 0 || Boolean(previewId) || Boolean(sheet.ambiguous || sheet.listed) || sheet.querySettled === true
}

function sharesWrittenRows(prev, incoming) {
  const prevNos = sheetNos(prev)
  if (!prevNos.length) return false
  const incomingNos = sheetNos(incoming)
  if (incomingNos.some((no) => prevNos.includes(no))) return true
  const speech = sheetSpeech(incoming)
  return prevNos.some((no) => no && speech.includes(no))
}

/** Tool-called 现查 (no write token) replaces a same-round speech-bound write preview instead of leftover-cancel. */
function explicitLiveLookupSupersedesWrite(prev, incoming) {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
  if (sheetAction(incoming) !== '现查' || sheetPreviewId(incoming)) return false
  if (incoming.picked === true) return false
  const prevAct = sheetAction(prev)
  if (!prevAct || prevAct === '现查') return false
  if (prev.picked === true) return false
  if (prev.ambiguous || prev.listed) return false
  if (isUnfilteredListSheet(incoming) && !sharesWrittenRows(prev, incoming)) return false
  return true
}

function leftoverQueryCoveringWrite(prev, incoming) {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
  if (explicitLiveLookupSupersedesWrite(prev, incoming)) return false
  const prevAct = sheetAction(prev)
  if (!prevAct || prevAct === '现查') return false
  if (sheetAction(incoming) !== '现查') return false
  if (incoming.picked === true) return false
  const prevKind = sheetKind(prev)
  const nextKind = sheetKind(incoming)
  if (prevKind && nextKind && prevKind !== nextKind) return false
  const waitingHit = Boolean(
    sheetRowCount(prev) > 1
    && !sheetPreviewId(prev)
    && (prev.ambiguous || prev.listed),
  )
  if (waitingHit) return true
  const prevNos = sheetNos(prev)
  if (!prevNos.length) return false
  const incomingNos = sheetNos(incoming)
  const speech = sheetSpeech(incoming)
  return incomingNos.some((no) => prevNos.includes(no))
    || prevNos.some((no) => no && speech.includes(no))
}

function relationFromKind(sheet) {
  const from = sheet && sheet.from
  if (!from || typeof from !== 'object' || Array.isArray(from)) return ''
  return String(from.kind || '').trim()
}

/** An empty sheet of a third kind does not replace this round's relation. */
export function emptyOtherKindStealsRelation(candidate, incoming) {
  if (!candidate || !incoming) return false
  if (sheetRowCount(incoming) > 0) return false
  if (sheetAction(incoming) && sheetAction(incoming) !== '现查') return false
  const prev = sheetKind(candidate)
  const next = sheetKind(incoming)
  if (!prev || !next || prev === next) return false
  const fromKind = relationFromKind(candidate)
  if (!fromKind || next === fromKind) return false
  return true
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

function utteranceSheetPaints(sheet, round) {
  if (!sheet || typeof sheet !== 'object') return false
  if (round && round.wroteFollowup && !sheetCarriesWrittenIdentity(sheet, round.wroteIdentity)) return false
  if (sheetRowCount(sheet) > 0) return true
  const action = sheetAction(sheet)
  return Boolean(action && action !== '现查' && sheetPreviewId(sheet))
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

/** Fill a wrote follow-up lookup with the identity just written, when the call left it off. */
export function stampWroteLookup(spec, identity) {
  const next = spec && typeof spec === 'object' ? { ...spec } : {}
  if (!identity || typeof identity !== 'object' || specHasIdentity(next)) return next
  const no = String(identity.no || '').trim()
  if (no) {
    next.no = no
    return next
  }
  if (Array.isArray(identity.where) && identity.where.length) {
    next.where = identity.where
    return next
  }
  const nos = Array.isArray(identity.nos)
    ? identity.nos.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (nos.length === 1) next.no = nos[0]
  return next
}

export function isLeftoverAfterCandidate(candidate, incoming) {
  if (!candidate || !incoming) return false
  if (leftoverQueryCoveringWrite(candidate, incoming)) return true
  if (isUnfilteredListSheet(incoming)) {
    if (candidate.wroteReceipt === true) return false
    return true
  }
  if (sheetRowCount(candidate) > 0 && sheetRowCount(incoming) === 0) return true
  return false
}

function newRoundId() {
  return `rnd_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`
}

export function createSessionRoundStore() {
  const bySession = new Map()

  function peek(sessionId) {
    const sid = String(sessionId || '').trim()
    if (!sid) return null
    return bySession.get(sid) || null
  }

  function startRound(sessionId, opts = {}) {
    const sid = String(sessionId || '').trim()
    if (!sid) return ''
    const prev = peek(sid)
    if (prev && prev.open) return prev.roundId
    const id = newRoundId()
    const wroteFollowup = Boolean(opts.followup && prev && prev.wroteFollowup)
    bySession.set(sid, {
      roundId: id,
      open: true,
      candidate: null,
      weak: null,
      official: prev ? prev.official : null,
      kindFocus: null,
      handed: Boolean(prev && prev.official),
      closedBy: '',
      wroteFollowup,
      wroteIdentity: wroteFollowup && prev ? (prev.wroteIdentity || null) : null,
    })
    return id
  }

  function closeRound(sessionId, reason = 'turn', extra = {}) {
    const sid = String(sessionId || '').trim()
    const round = peek(sid)
    if (!round) return { official: null, emit: false, cancel: false }
    if (reason === 'wrote') {
      round.candidate = null
      round.weak = null
      round.open = false
      round.kindFocus = null
      round.closedBy = 'wrote'
      round.wroteFollowup = true
      round.wroteIdentity = extra && extra.identity ? extra.identity : (round.wroteIdentity || null)
      return { official: round.official || null, emit: false, cancel: false }
    }
    if (round.open) {
      round.open = false
      const next = round.candidate || round.weak
      const bareFollowup = Boolean(
        round.wroteFollowup && next && !sheetCarriesWrittenIdentity(next, round.wroteIdentity),
      )
      if (next && !bareFollowup) round.official = next
    }
    round.kindFocus = null
    round.closedBy = reason === 'leftover' ? 'leftover' : 'turn'
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
      if (round && round.closedBy === 'leftover') {
        return {
          emit: false,
          official: round.official,
          cancel: true,
          leftover: true,
          cancelKind: 'plugin-leftover',
          process: false,
        }
      }
      if (round && round.official && isLeftoverAfterCandidate(round.official, incomingRaw)) {
        return {
          emit: false,
          official: round.official,
          cancel: true,
          leftover: true,
          cancelKind: 'plugin-leftover',
          process: false,
        }
      }
      if (!isEligibleRoundSheet(incomingRaw) && !isUnfilteredListSheet(incomingRaw)) {
        return { emit: false, official: round ? round.official : null, cancel: false, process: false }
      }
      startRound(sid)
      round = peek(sid)
    }

    if (round.wroteFollowup && sheetCarriesWrittenIdentity(incomingRaw, round.wroteIdentity)) {
      incomingRaw = { ...incomingRaw, wroteReceipt: true }
    }

    if (round.candidate && emptyOtherKindStealsRelation(round.candidate, incomingRaw)) {
      return { emit: false, official: null, cancel: false, process: true }
    }

    if (round.candidate && explicitLiveLookupSupersedesWrite(round.candidate, incomingRaw)) {
      round.candidate = incomingRaw
      round.kindFocus = null
      return { emit: false, official: null, cancel: false, process: true }
    }

    if (round.candidate && isLeftoverAfterCandidate(round.candidate, incomingRaw)) {
      const closed = closeRound(sid, 'leftover')
      return { ...closed, cancel: true, leftover: true, cancelKind: 'plugin-leftover', process: false }
    }

    if (isUnfilteredListSheet(incomingRaw)) {
      if (!round.weak) round.weak = incomingRaw
      return { emit: false, official: null, cancel: false, leftover: Boolean(round.candidate), process: true }
    }

    if (isEligibleRoundSheet(incomingRaw)) {
      round.candidate = incomingRaw
      round.kindFocus = null
    }

    return { emit: false, official: null, cancel: false, process: true }
  }

  function officialSheet(sessionId) {
    const round = peek(sessionId)
    if (!round) return null
    return round.official || null
  }

  function focusKindSheet(sessionId, view) {
    const sid = String(sessionId || '').trim()
    if (!sid || !view || typeof view !== 'object') return false
    const round = peek(sid)
    if (!round || !round.official) return false
    round.kindFocus = view
    return true
  }

  function servedSheet(sessionId) {
    const round = peek(sessionId)
    if (!round) return null
    if (round.kindFocus && typeof round.kindFocus === 'object') return round.kindFocus
    if (round.open && utteranceSheetPaints(round.candidate, round)) return round.candidate
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

  return {
    peek,
    startRound,
    closeRound,
    noteToolSheet,
    officialSheet,
    focusKindSheet,
    servedSheet,
    isOpen,
    isWroteFollowup,
    wroteIdentity,
    noteHumanUtterance,
  }
}
