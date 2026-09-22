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

function leftoverQueryCoveringWrite(prev, incoming) {
  if (!prev || !incoming || typeof prev !== 'object' || typeof incoming !== 'object') return false
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

export function isLeftoverAfterCandidate(candidate, incoming) {
  if (!candidate || !incoming) return false
  if (leftoverQueryCoveringWrite(candidate, incoming)) return true
  if (isUnfilteredListSheet(incoming)) return true
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

  function startRound(sessionId) {
    const sid = String(sessionId || '').trim()
    if (!sid) return ''
    const prev = peek(sid)
    if (prev && prev.open) return prev.roundId
    const id = newRoundId()
    bySession.set(sid, {
      roundId: id,
      open: true,
      candidate: null,
      weak: null,
      official: prev ? prev.official : null,
      handed: Boolean(prev && prev.official),
      closedBy: '',
    })
    return id
  }

  function closeRound(sessionId, reason = 'turn') {
    const sid = String(sessionId || '').trim()
    const round = peek(sid)
    if (!round) return { official: null, emit: false, cancel: false }
    if (round.open) {
      round.open = false
      const next = round.candidate || round.weak
      if (next) round.official = next
    }
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
        return { emit: false, official: round.official, cancel: true, leftover: true, process: false }
      }
      if (round && round.official && isLeftoverAfterCandidate(round.official, incomingRaw)) {
        return { emit: false, official: round.official, cancel: true, leftover: true, process: false }
      }
      if (!isEligibleRoundSheet(incomingRaw) && !isUnfilteredListSheet(incomingRaw)) {
        return { emit: false, official: round ? round.official : null, cancel: false, process: false }
      }
      startRound(sid)
      round = peek(sid)
    }

    if (round.candidate && emptyOtherKindStealsRelation(round.candidate, incomingRaw)) {
      return { emit: false, official: null, cancel: false, process: true }
    }

    if (round.candidate && isLeftoverAfterCandidate(round.candidate, incomingRaw)) {
      const closed = closeRound(sid, 'leftover')
      return { ...closed, cancel: true, leftover: true, process: false }
    }

    if (isUnfilteredListSheet(incomingRaw)) {
      if (!round.weak) round.weak = incomingRaw
      return { emit: false, official: null, cancel: false, leftover: Boolean(round.candidate), process: true }
    }

    if (isEligibleRoundSheet(incomingRaw)) {
      round.candidate = incomingRaw
    }

    return { emit: false, official: null, cancel: false, process: true }
  }

  function servedSheet(sessionId) {
    const round = peek(sessionId)
    if (!round) return null
    return round.official || null
  }

  function isOpen(sessionId) {
    return Boolean(peek(sessionId)?.open)
  }

  return {
    peek,
    startRound,
    closeRound,
    noteToolSheet,
    servedSheet,
    isOpen,
  }
}
