import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSessionRoundStore,
  isEligibleRoundSheet,
  isLeftoverAfterCandidate,
  isUnfilteredListSheet,
  stampWroteLookup,
} from '../vendor-overlays/dsh-lan-assist/session-round.js'

function hopSheet(kind = 'KindLeaf') {
  return {
    kind,
    action: '现查',
    speech: 'first spoken line',
    sessionId: 'sess-a',
    from: { kind: 'KindParent' },
    hopWhere: [{ keys: ['status'], values: ['open'] }],
    rows: [{ no: 'HIT-1' }, { no: 'HIT-2' }],
  }
}

function dumpSheet(kind = 'KindOther', speech = 'first spoken line') {
  return {
    kind,
    action: '现查',
    speech,
    sessionId: 'sess-a',
    rows: Array.from({ length: 8 }, (_, index) => ({ no: `C-${index}` })),
  }
}

test('unfiltered list is leftover even when speech is stamped; page size is not a rule', () => {
  assert.equal(isUnfilteredListSheet(dumpSheet()), true)
  assert.equal(isUnfilteredListSheet({
    kind: 'KindA',
    action: '现查',
    speech: 'list this table',
    rows: [{ no: 'ONLY-1' }],
  }), true)
  assert.equal(isUnfilteredListSheet(hopSheet()), false)
  assert.equal(isEligibleRoundSheet(hopSheet()), true)
  assert.equal(isEligibleRoundSheet(dumpSheet()), false)
})

test('settled rows show before round close; the tool note itself does not emit', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const process = rounds.noteToolSheet('sess-a', hopSheet())
  assert.equal(process.emit, false)
  assert.equal(process.process, true)
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
  assert.equal(rounds.servedSheet('sess-a').rows.length, 2)
  assert.equal(rounds.isOpen('sess-a'), true)
  const leftover = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(leftover.leftover, true)
  assert.equal(leftover.cancel, true)
  assert.equal(leftover.emit, true)
  assert.equal(leftover.official.kind, hopSheet().kind)
  assert.equal(leftover.official.from.kind, 'KindParent')
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
  assert.equal(rounds.isOpen('sess-a'), false)
})

test('turn end hands this-round hop, not a later leftover dump', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.from.kind, 'KindParent')
  const leftover = rounds.noteToolSheet('sess-a', dumpSheet('KindOther', 'lookup something else'))
  assert.equal(leftover.emit, false)
  assert.equal(leftover.process, false)
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
})

test('chat-only close emits nothing and keeps the previous official', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  rounds.closeRound('sess-a')
  const first = rounds.servedSheet('sess-a')
  const second = rounds.startRound('sess-a')
  assert.ok(second)
  assert.equal(rounds.isOpen('sess-a'), true)
  assert.equal(rounds.servedSheet('sess-a'), first)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, false)
  assert.equal(rounds.servedSheet('sess-a'), first)
})

test('next send replaces the previous official after that round closes', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet('KindOne'))
  rounds.closeRound('sess-a')
  rounds.startRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').kind, 'KindOne')
  rounds.noteToolSheet('sess-a', hopSheet('KindTwo'))
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').kind, 'KindTwo')
})

test('speech-bound 新建 in-round is superseded by explicit 现查 lookup, not leftover cancel', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const mistakenWrite = {
    kind: 'KindW',
    action: '新建',
    speech: '库里已改上',
    sessionId: 'sess-a',
    preview_id: 'pv-mistake',
    rows: [{ no: 'RCPT-1' }],
    changes: [],
  }
  rounds.noteToolSheet('sess-a', mistakenWrite)
  const lookup = rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '现查',
    speech: 'lookup RCPT-1',
    rows: [{ no: 'RCPT-1' }],
  })
  assert.equal(lookup.cancel, false)
  assert.equal(lookup.process, true)
  assert.equal(rounds.peek('sess-a').candidate.action, '现查')
})

test('write leftover 现查 does not become official', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const write = {
    kind: 'KindW',
    action: '改行',
    speech: 'change this row',
    sessionId: 'sess-a',
    preview_id: 'pv-write',
    picked: true,
    rows: [{ no: 'ROW-9' }],
  }
  assert.equal(isLeftoverAfterCandidate(write, {
    kind: 'KindW',
    action: '现查',
    speech: 'lookup ROW-9',
    rows: [{ no: 'ROW-9' }],
  }), true)
  rounds.noteToolSheet('sess-a', write)
  const leftover = rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '现查',
    speech: 'lookup ROW-9',
    rows: [{ no: 'ROW-9' }],
  })
  assert.equal(leftover.cancel, true)
  assert.equal(leftover.emit, true)
  assert.equal(rounds.servedSheet('sess-a').action, '改行')
})

test('closeRound wrote clears open candidate before secretary follow-up', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '改行',
    preview_id: 'pv-old',
    rows: [{ no: 'R1' }],
  })
  rounds.closeRound('sess-a', 'wrote')
  const round = rounds.peek('sess-a')
  assert.equal(round.open, false)
  assert.equal(round.candidate, null)
  assert.equal(round.closedBy, 'wrote')
})

test('eligible tool result after a closed round opens the next send', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet('KindOne'))
  rounds.closeRound('sess-a')
  const next = rounds.noteToolSheet('sess-a', hopSheet('KindTwo'))
  assert.equal(next.emit, false)
  assert.equal(rounds.isOpen('sess-a'), true)
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').kind, 'KindTwo')
})

test('leftover after handoff does not reopen, even when the next lookup is eligible', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  const handed = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(handed.cancel, true)
  assert.equal(handed.emit, true)
  assert.equal(rounds.isOpen('sess-a'), false)
  const again = rounds.noteToolSheet('sess-a', hopSheet('KindLater'))
  assert.equal(again.cancel, true)
  assert.equal(again.leftover, true)
  assert.equal(again.emit, false)
  assert.equal(rounds.isOpen('sess-a'), false)
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
  rounds.closeRound('sess-a')
  const next = rounds.noteToolSheet('sess-a', hopSheet('KindTwo'))
  assert.equal(next.cancel, false)
  assert.equal(rounds.isOpen('sess-a'), true)
})

test('leftover dump after a closed official does not open a new round', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  rounds.closeRound('sess-a')
  const leftover = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(leftover.leftover, true)
  assert.equal(leftover.cancel, true)
  assert.equal(leftover.emit, false)
  assert.equal(rounds.servedSheet('sess-a').from.kind, 'KindParent')
})

test('non-sheet tool result does not open a round', () => {
  const rounds = createSessionRoundStore()
  const empty = rounds.noteToolSheet('sess-a', { ok: false, error: 'NO_CONNECTOR' })
  assert.equal(empty.emit, false)
  assert.equal(empty.process, false)
  assert.equal(rounds.peek('sess-a'), null)
  assert.equal(rounds.servedSheet('sess-a'), null)
})

test('weak unfiltered is official only when the round produced nothing else', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const first = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(first.emit, false)
  assert.equal(first.cancel, false)
  assert.equal(rounds.servedSheet('sess-a'), null)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(isUnfilteredListSheet(closed.official), true)
})

test('a settled 现查 with no rows is eligible and becomes the official sheet', () => {
  const empty = {
    kind: 'KindLeaf',
    action: '现查',
    sessionId: 'sess-a',
    querySettled: true,
    hitTotal: 0,
    hitTotalState: 'known',
    from: { kind: 'KindParent' },
    rows: [],
  }
  assert.equal(isEligibleRoundSheet(empty), true)
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', empty)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.kind, 'KindLeaf')
  assert.equal(closed.official.rows.length, 0)
})

test('an empty sheet of another kind does not replace the relation', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindLeaf',
    action: '现查',
    sessionId: 'sess-a',
    querySettled: true,
    hitTotal: 0,
    hitTotalState: 'known',
    from: { kind: 'KindParent' },
    rows: [],
    speech: 'lookup the relation',
  })
  const stolen = rounds.noteToolSheet('sess-a', {
    kind: 'KindOther',
    action: '现查',
    sessionId: 'sess-a',
    querySettled: true,
    hitTotal: 0,
    hitTotalState: 'known',
    rows: [],
    speech: 'lookup the relation',
  })
  assert.equal(stolen.cancel, false)
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').kind, 'KindLeaf')
  assert.equal(rounds.servedSheet('sess-a').from.kind, 'KindParent')
})

test('lookupNo is a filtered receipt, not an unfiltered list', () => {
  assert.equal(isUnfilteredListSheet({
    kind: 'KindA',
    action: '现查',
    lookupNo: 'ROW-1',
    rows: [{ no: 'ROW-1' }],
  }), false)
})

test('stampWroteLookup fills a bare follow-up with the written identity', () => {
  const stamped = stampWroteLookup({ kind: 'KindW', action: '现查' }, { no: 'ROW-1' })
  assert.equal(stamped.no, 'ROW-1')
  const kept = stampWroteLookup({ kind: 'KindW', action: '现查', no: 'KEEP' }, { no: 'ROW-1' })
  assert.equal(kept.no, 'KEEP')
  const byWhere = stampWroteLookup({ kind: 'KindW', action: '现查' }, {
    where: [{ keys: ['title'], values: ['甲'] }],
  })
  assert.equal(byWhere.where.length, 1)
})

test('settled 现查 rows paint before turn end and replace the previous write', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindCustomer',
    action: '改行',
    speech: 'change the matched row',
    sessionId: 'sess-a',
    preview_id: 'pv-prev',
    rows: [{ no: 'ROW-PREV' }],
  })
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').action, '改行')
  rounds.startRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').action, '改行')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindTicket',
    action: '现查',
    speech: 'which related rows',
    sessionId: 'sess-a',
    from: { kind: 'KindCustomer', no: 'ROW-PREV' },
    hopWhere: [{ keys: ['owner'], values: ['ROW-PREV'] }],
    rows: [{ no: 'T-1' }, { no: 'T-2' }, { no: 'T-3' }, { no: 'T-4' }],
  })
  const painted = rounds.servedSheet('sess-a')
  assert.equal(rounds.isOpen('sess-a'), true)
  assert.equal(painted.action, '现查')
  assert.equal(painted.kind, 'KindTicket')
  assert.equal(painted.rows.length, 4)
  assert.deepEqual(painted.rows.map((row) => row.no), ['T-1', 'T-2', 'T-3', 'T-4'])
})

test('same-utterance leftover dump does not cover the matched sheet or an open write', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
  assert.equal(rounds.servedSheet('sess-a').from.kind, 'KindParent')
  assert.equal(isUnfilteredListSheet(rounds.servedSheet('sess-a')), false)

  const writeRound = createSessionRoundStore()
  writeRound.startRound('sess-b')
  writeRound.noteToolSheet('sess-b', {
    kind: 'KindW',
    action: '改行',
    speech: 'change this row',
    sessionId: 'sess-b',
    preview_id: 'pv-open',
    rows: [{ no: 'ROW-9' }],
  })
  const dumped = writeRound.noteToolSheet('sess-b', dumpSheet('KindW', 'change this row'))
  assert.equal(dumped.cancel, true)
  assert.equal(writeRound.servedSheet('sess-b').action, '改行')
  assert.equal(writeRound.servedSheet('sess-b').preview_id, 'pv-open')
})

test('wrote follow-up 现查 paints only when it carries the written identity', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.closeRound('sess-a', 'wrote', { identity: { no: 'ROW-1' } })
  rounds.startRound('sess-a', { followup: true })
  rounds.noteToolSheet('sess-a', dumpSheet())
  const bare = rounds.closeRound('sess-a')
  assert.equal(bare.emit, false)
  assert.equal(rounds.servedSheet('sess-a'), null)

  rounds.startRound('sess-a', { followup: true })
  rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '现查',
    lookupNo: 'ROW-1',
    rows: [{ no: 'ROW-1' }],
  })
  assert.equal(rounds.isOpen('sess-a'), true)
  assert.equal(rounds.servedSheet('sess-a').lookupNo, 'ROW-1')
  rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(rounds.servedSheet('sess-a').lookupNo, 'ROW-1')
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').lookupNo, 'ROW-1')
  assert.equal(isUnfilteredListSheet(rounds.servedSheet('sess-a')), false)
})

test('an unfiltered list does not cancel a wrote receipt that already carries identity', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.closeRound('sess-a', 'wrote', { identity: { no: 'ROW-1' } })
  rounds.startRound('sess-a', { followup: true })
  assert.equal(rounds.wroteIdentity('sess-a').no, 'ROW-1')
  const noted = rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '现查',
    lookupNo: 'ROW-1',
    rows: [{ no: 'ROW-1' }],
  })
  assert.equal(noted.cancel, false)
  assert.equal(rounds.peek('sess-a').candidate.wroteReceipt, true)
  const dump = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(dump.cancel, false)
  assert.equal(rounds.peek('sess-a').candidate.lookupNo, 'ROW-1')
  assert.equal(isLeftoverAfterCandidate(rounds.peek('sess-a').candidate, dumpSheet()), false)
})
