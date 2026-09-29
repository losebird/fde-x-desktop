import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createSessionRoundStore,
  isConfirmableWritePreview,
  isEligibleRoundSheet,
  isLeftoverAfterCandidate,
  isUnfilteredListSheet,
  holdsWorkstationAsk,
  isWorkstationHeldWrite,
  roundBlocksChatAsk,
  stampWroteLookup,
  wroteLookupLocksSpec,
} from '../vendor-overlays/dsh-lan-assist/session-round.js'
import { isNewOfficialRound } from '../biz/connected-kind.mjs'

function hopSheet(kind = 'KindLeaf') {
  return {
    kind,
    action: '现查',
    speech: 'first spoken line',
    sessionId: 'sess-a',
    officialBound: true,
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

test('published official carries the session id', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const sheet = hopSheet()
  delete sheet.sessionId
  rounds.noteToolSheet('sess-a', sheet)
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').sessionId, 'sess-a')
  assert.equal(typeof rounds.servedSheet('sess-a').roundId, 'string')
  assert.ok(rounds.servedSheet('sess-a').roundId)
})

test('each official publish gets a new roundId', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet('KindOne'))
  rounds.closeRound('sess-a')
  const first = rounds.servedSheet('sess-a').roundId
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet('KindTwo'))
  rounds.closeRound('sess-a')
  assert.notEqual(rounds.servedSheet('sess-a').roundId, first)
})

test('listed 现查 after write confirm publishes a new roundId', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindLeaf',
    action: '过审',
    preview_id: 'pv_confirm',
    canWrite: true,
    speech: 'approve this row',
    sessionId: 'sess-a',
    rows: [{ no: 'HIT-1' }],
    changes: [{ field: 'status', from: 'open', to: 'done' }],
  })
  rounds.closeRound('sess-a')
  const writeOfficial = rounds.servedSheet('sess-a')
  assert.equal(writeOfficial.action, '过审')
  assert.equal(writeOfficial.preview_id, 'pv_confirm')
  const listed = {
    kind: 'KindLeaf',
    action: '现查',
    speech: 'approve this row',
    sessionId: 'sess-a',
    querySettled: true,
    no: 'HIT-1',
    from: { kind: 'KindParent' },
    hopWhere: [{ keys: ['status'], values: ['open'] }],
    rows: [{ no: 'HIT-1', status: 'done' }],
  }
  assert.equal(rounds.publishOfficial('sess-a', listed), true)
  const next = rounds.servedSheet('sess-a')
  assert.equal(next.action, '现查')
  assert.notEqual(next.roundId, writeOfficial.roundId)
  assert.equal(isNewOfficialRound(writeOfficial, next), true)
})

test('write confirm is served only at turn end, replacing the previous lookup', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
  rounds.startRound('sess-a')
  const write = {
    kind: 'KindLeaf',
    action: '过审',
    preview_id: 'pv_confirm',
    canWrite: true,
    speech: 'second spoken line',
    sessionId: 'sess-a',
    rows: [{ no: 'HIT-1' }],
    changes: [{ field: 'status', from: 'open', to: 'done' }],
  }
  rounds.noteToolSheet('sess-a', write)
  assert.equal(rounds.servedSheet('sess-a').kind, hopSheet().kind)
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').preview_id, 'pv_confirm')
  assert.equal(rounds.servedSheet('sess-a').action, '过审')
  rounds.publishOfficial('sess-a', { ...write, ok: true })
  assert.equal(rounds.servedSheet('sess-a').preview_id, 'pv_confirm')
  assert.equal(rounds.servedSheet('sess-a').action, '过审')
})

test('confirmable write preview is the round candidate; leftover 现查 does not cover; Ask is guarded', () => {
  assert.equal(isConfirmableWritePreview({
    action: '改行',
    preview_id: 'pv_w',
    canWrite: true,
    changes: [{ field: 'status' }],
  }), true)
  assert.equal(isConfirmableWritePreview({
    action: '现查',
    preview_id: 'pv_w',
    canWrite: true,
  }), false)
  assert.equal(isConfirmableWritePreview({
    action: '改行',
    preview_id: 'pv_w',
  }), false)
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-w')
  const noted = rounds.noteToolSheet('sess-w', {
    kind: 'KindLeaf',
    action: '改行',
    preview_id: 'pv_w',
    canWrite: true,
    speech: 'rewrite a row',
    rows: [{ no: 'HIT-1' }],
    changes: [{ field: 'status', from: 'a', to: 'b' }],
  })
  assert.equal(noted.cancel, false)
  assert.equal(noted.emit, false)
  assert.equal(noted.process, true)
  assert.equal(rounds.peek('sess-w').candidate.preview_id, 'pv_w')
  const leftover = rounds.noteToolSheet('sess-w', dumpSheet())
  assert.equal(leftover.leftover, true)
  assert.equal(leftover.cancel, false)
  const lookupRound = createSessionRoundStore()
  lookupRound.startRound('sess-l')
  const lookup = lookupRound.noteToolSheet('sess-l', hopSheet())
  assert.equal(lookup.cancel, false)
  assert.equal(lookup.process, true)
  const tools = readFileSync(join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist', 'tools.js'), 'utf8')
  assert.doesNotMatch(tools, /concludeChatTurn/)
  assert.doesNotMatch(tools, /concludeTurn/)
  assert.doesNotMatch(tools, /endTurnAfterWritePreview/)
  assert.doesNotMatch(tools, /scheduleLeftoverCancel/)
  const execute = tools.slice(tools.indexOf("name: 'biz_preview'"), tools.indexOf("name: 'biz_write'"))
  assert.match(execute, /planReceipt/)
  assert.doesNotMatch(execute, /endTurn/)
  assert.doesNotMatch(execute, /\.cancel\(/)
  const index = readFileSync(join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist', 'index.js'), 'utf8')
  assert.match(index, /ask_user_question/)
  assert.match(index, /roundBlocksChatAsk/)
  assert.match(index, /speechHoldsWorkstationWrite/)
  assert.match(index, /user-questions\/request/)
  assert.match(index, /agent\/created/)
  assert.match(index, /bindWorkstationAskRefuse/)
  assert.match(index, /scoped\.on\('user-questions\/request', refuseWorkstationChatAsk, \{ prepend: true \}/)
  assert.match(index, /ctx\.on\('agent\/created'/)
  assert.match(index, /boundAskRefuse\.has\(agent\)/)
  const createdAt = index.indexOf("ctx.on('agent/created'")
  const listAt = index.indexOf('liveAgents.list()')
  assert.ok(createdAt > 0 && listAt > createdAt)
  const bindBody = index.slice(index.indexOf('function bindWorkstationAskRefuse'), index.indexOf("ctx.on('agent/created'"))
  assert.ok(bindBody.indexOf("scoped.on('user-questions/request'") < bindBody.indexOf('boundAskRefuse.add(agent)'))
  assert.match(index, /inject = \['tools', 'webServer', 'llm', 'agents'\]/)
  assert.doesNotMatch(index, /speechHasConnectorWrite/)
  assert.doesNotMatch(index, /scheduleLeftoverCancel/)
})

test('listed write 人选 is official at close', () => {
  assert.equal(isWorkstationHeldWrite({
    action: '改行',
    listed: true,
    ambiguous: true,
    rows: [{ no: 'HIT-1' }, { no: 'HIT-2' }],
  }), true)
  assert.equal(isWorkstationHeldWrite({
    action: '现查',
    listed: true,
    rows: [{ no: 'HIT-1' }],
  }), false)
  assert.equal(isWorkstationHeldWrite({
    action: '改行',
    blockConfirm: true,
    rows: [{ no: 'CUST-1' }],
  }), false)
  assert.equal(isWorkstationHeldWrite({
    action: '改行',
    blockConfirm: true,
    rows: [{ no: 'CUST-1' }],
    cells: [{ key: 'status', bound: false, picks: [{ id: '1', label: '成交' }] }],
  }), true)
  assert.equal(isWorkstationHeldWrite({
    action: '改行',
    preview_id: 'pv_w',
    canWrite: true,
    rows: [{ no: 'CUST-1' }],
  }), true)
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-pick')
  const noted = rounds.noteToolSheet('sess-pick', {
    kind: 'KindLeaf',
    action: '改行',
    listed: true,
    ambiguous: true,
    speech: 'rewrite these rows',
    rows: [{ no: 'HIT-1' }, { no: 'HIT-2' }],
  })
  assert.equal(noted.cancel, false)
  assert.equal(noted.process, true)
  assert.equal(rounds.peek('sess-pick').candidate.listed, true)
  const closed = rounds.closeRound('sess-pick')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.listed, true)
  assert.equal(closed.official.action, '改行')
})

test('格对不上 without picks is not official; pick-cells are official', () => {
  const unbound = {
    kind: '客户',
    action: '改行',
    blockConfirm: true,
    speech: '改成成交',
    rows: [{ no: 'CUST2197' }],
    cells: [{ key: 'status', bound: false, hint: '这一格对不上' }],
  }
  assert.equal(holdsWorkstationAsk(unbound), false)
  assert.equal(isWorkstationHeldWrite(unbound), false)
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-unbound')
  rounds.noteToolSheet('sess-unbound', {
    kind: '客户',
    action: '现查',
    officialBound: true,
    speech: '查客户',
    rows: [{ no: 'CUST2197' }],
  })
  rounds.noteToolSheet('sess-unbound', unbound)
  const closed = rounds.closeRound('sess-unbound')
  assert.equal(closed.official.action, '现查')
  assert.equal(closed.official.blockConfirm, undefined)

  const picks = {
    kind: '客户',
    action: '改行',
    blockConfirm: true,
    speech: '改成成交',
    rows: [{ no: 'CUST2197' }],
    cells: [{ key: 'status', bound: false, picks: [{ id: '1', label: '成交' }] }],
  }
  assert.equal(isWorkstationHeldWrite(picks), true)
  const pickRounds = createSessionRoundStore()
  pickRounds.startRound('sess-picks')
  pickRounds.noteToolSheet('sess-picks', picks)
  const pickClosed = pickRounds.closeRound('sess-picks')
  assert.equal(pickClosed.emit, true)
  assert.equal(pickClosed.official.action, '改行')
})

test('Ask is blocked only by a confirmable token or a listed write that can be picked', () => {
  assert.equal(roundBlocksChatAsk(null, true), false)
  assert.equal(roundBlocksChatAsk({ open: true, candidate: null, userSpeech: '改成成交' }, false), false)
  assert.equal(roundBlocksChatAsk({ open: true, candidate: null, userSpeech: '改成成交' }, true), false)
  assert.equal(roundBlocksChatAsk({
    open: true,
    candidate: {
      action: '改行',
      preview_id: 'pv_w',
      canWrite: true,
      changes: [{ field: 'status' }],
    },
  }, false), true)
  assert.equal(roundBlocksChatAsk({
    open: true,
    candidate: {
      action: '过审',
      listed: true,
      ambiguous: true,
      rows: [{ no: 'A' }, { no: 'B' }],
    },
  }, false), true)
  assert.equal(roundBlocksChatAsk({
    open: true,
    candidate: {
      action: '过审',
      listed: true,
      blockConfirm: true,
      rows: [{ no: 'A' }, { no: 'B' }],
    },
  }, false), false)
  assert.equal(roundBlocksChatAsk({
    open: false,
    candidate: null,
  }, true), false)
})

test('tool note keeps a candidate; leftover freeze waits for turn end', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const process = rounds.noteToolSheet('sess-a', hopSheet())
  assert.equal(process.emit, false)
  assert.equal(process.process, true)
  assert.equal(rounds.servedSheet('sess-a'), null)
  assert.equal(rounds.isOpen('sess-a'), true)
  const leftover = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(leftover.leftover, true)
  assert.equal(leftover.cancel, false)
  assert.equal(leftover.emit, false)
  assert.equal(rounds.servedSheet('sess-a'), null)
  assert.equal(rounds.isOpen('sess-a'), true)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.kind, hopSheet().kind)
  assert.equal(closed.official.from.kind, 'KindParent')
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
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(rounds.servedSheet('sess-a').kind, 'KindTwo')
})

test('settled 现查 does not leftover-lock a later 现查 of another kind', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindPay',
    action: '现查',
    speech: 'first spoken line',
    sessionId: 'sess-a',
    from: { kind: 'KindCust' },
    hopWhere: [{ keys: ['status'], values: ['pending'] }],
    querySettled: true,
    listed: true,
    rows: [],
  })
  const repeat = rounds.noteToolSheet('sess-a', {
    kind: 'KindPay',
    action: '现查',
    speech: 'first spoken line',
    sessionId: 'sess-a',
    from: { kind: 'KindCust' },
    querySettledRepeat: true,
    error: 'QUERY_SETTLED',
    listed: true,
    rows: [],
  })
  assert.equal(repeat.cancel, false)
  assert.equal(repeat.leftover, true)
  const nextKind = rounds.noteToolSheet('sess-a', {
    kind: 'KindDoc',
    action: '现查',
    speech: 'first spoken line',
    sessionId: 'sess-a',
    officialBound: true,
    from: { kind: 'KindPay' },
    listed: true,
    rows: [{ no: 'DOC-1' }],
  })
  assert.equal(nextKind.cancel, false)
  assert.equal(nextKind.process, true)
  assert.equal(rounds.peek('sess-a').boundSheet.kind, 'KindDoc')
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.kind, 'KindDoc')
})

test('speech-bound 新建 with a preview token is not superseded by 现查 of the same row', () => {
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
  assert.equal(lookup.leftover, true)
  assert.equal(lookup.process, false)
  assert.equal(rounds.peek('sess-a').candidate.action, '新建')
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.action, '新建')
  assert.equal(closed.official.preview_id, 'pv-mistake')
})

test('改行 preview token is not replaced by same-round 现查 of the same row', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const write = {
    kind: 'KindLeaf',
    action: '改行',
    speech: 'change this urgent row',
    sessionId: 'sess-a',
    preview_id: 'pv_live',
    canWrite: true,
    rows: [{ no: 'TK-1' }],
    changes: [{ field: 'status', from: 'resolved', to: 'processing' }],
  }
  rounds.noteToolSheet('sess-a', write)
  const lookup = rounds.noteToolSheet('sess-a', {
    kind: 'KindLeaf',
    action: '现查',
    speech: 'change this urgent row',
    sessionId: 'sess-a',
    rows: [{ no: 'TK-1', status: 'resolved' }],
  })
  assert.equal(lookup.cancel, false)
  assert.equal(lookup.leftover, true)
  assert.equal(lookup.emit, false)
  assert.equal(rounds.peek('sess-a').candidate.action, '改行')
  assert.equal(rounds.peek('sess-a').candidate.preview_id, 'pv_live')
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.action, '改行')
  assert.equal(closed.official.preview_id, 'pv_live')
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
  rounds.noteToolSheet('sess-a', write)
  const leftover = rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '现查',
    speech: 'lookup ROW-9',
    rows: [{ no: 'ROW-9' }],
  })
  assert.equal(leftover.cancel, false)
  assert.equal(leftover.emit, false)
  assert.equal(rounds.servedSheet('sess-a'), null)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.action, '改行')
  assert.equal(closed.official.preview_id, 'pv-write')
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

test('leftover dump is not official; a later eligible hop still becomes the candidate', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  const handed = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(handed.cancel, false)
  assert.equal(handed.leftover, true)
  assert.equal(handed.emit, false)
  assert.equal(rounds.isOpen('sess-a'), true)
  assert.equal(rounds.servedSheet('sess-a'), null)
  const again = rounds.noteToolSheet('sess-a', hopSheet('KindLater'))
  assert.equal(again.cancel, false)
  assert.equal(again.leftover, undefined)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.kind, 'KindLater')
  assert.equal(rounds.isOpen('sess-a'), false)
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
  assert.equal(leftover.cancel, false)
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

test('weak unfiltered is not promoted when the round produced nothing else', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  const first = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(first.emit, false)
  assert.equal(first.cancel, false)
  assert.equal(rounds.servedSheet('sess-a'), null)
  const closed = rounds.closeRound('sess-a')
  assert.equal(closed.emit, false)
  assert.equal(closed.official, null)
  assert.equal(rounds.servedSheet('sess-a'), null)
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
    officialBound: true,
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
    officialBound: true,
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

test('wroteFollowup survives startRound without followup flag until a human utterance', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-latch')
  rounds.closeRound('sess-latch', 'wrote', { identity: { no: 'ROW-1' } })
  rounds.startRound('sess-latch')
  assert.equal(rounds.isWroteFollowup('sess-latch'), true)
  assert.equal(rounds.wroteIdentity('sess-latch').no, 'ROW-1')
  rounds.startRound('sess-latch', { utterance: true, speech: '再查一遍' })
  assert.equal(rounds.isWroteFollowup('sess-latch'), false)
  assert.equal(rounds.wroteIdentity('sess-latch'), null)
})

test('stampWroteLookup fills a bare follow-up with the written identity', () => {
  const stamped = stampWroteLookup({ kind: 'KindW', action: '现查' }, { no: 'ROW-1' })
  assert.equal(stamped.no, 'ROW-1')
  const kept = stampWroteLookup({ kind: 'KindW', action: '现查', no: 'KEEP' }, { no: 'ROW-1' })
  assert.equal(kept.no, 'KEEP')
  const byWhere = stampWroteLookup({ kind: 'KindW', action: '现查' }, {
    where: [{ keys: ['title'], values: ['甲'] }],
  })
  assert.equal(byWhere.where, undefined)
})

test('locked wrote lookup clears write-speech where and stamps identity', () => {
  const locked = stampWroteLookup({
    kind: 'KindW',
    action: '现查',
    speech: '把停用客户改成成交',
    userSpeech: '把停用客户改成成交',
    where: [{ keys: ['status'], values: ['inactive'] }],
  }, { no: 'CUST2197' }, { lock: true })
  assert.equal(locked.no, 'CUST2197')
  assert.equal(locked.speech, '')
  assert.equal(locked.userSpeech, '')
  assert.equal(locked.where, undefined)
})

test('wrote lookup lock only binds the written kind', () => {
  const ident = { kind: '客户', no: 'CUST2197' }
  assert.equal(wroteLookupLocksSpec({ kind: '客户', action: '现查' }, ident), true)
  assert.equal(wroteLookupLocksSpec({ kind: '工单', action: '现查' }, ident), false)
  const other = stampWroteLookup({
    kind: '工单',
    action: '现查',
    speech: '查工单',
  }, ident, { lock: true })
  assert.equal(other.no, undefined)
  assert.equal(other.speech, '查工单')
  const filled = stampWroteLookup({ action: '现查' }, ident, { lock: true })
  assert.equal(filled.kind, '客户')
  assert.equal(filled.no, 'CUST2197')
})

test('settled 现查 rows paint at turn end and replace the previous write', () => {
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
  assert.equal(rounds.servedSheet('sess-a').preview_id, 'pv-prev')
  rounds.startRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').action, '改行')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindTicket',
    action: '现查',
    speech: 'which related rows',
    sessionId: 'sess-a',
    from: { kind: 'KindCustomer', no: 'ROW-PREV' },
    hopWhere: [{ keys: ['owner'], values: ['ROW-PREV'] }],
    officialBound: true,
    rows: [{ no: 'T-1' }, { no: 'T-2' }, { no: 'T-3' }, { no: 'T-4' }],
  })
  assert.equal(rounds.isOpen('sess-a'), true)
  assert.equal(rounds.servedSheet('sess-a').action, '改行')
  const painted = rounds.closeRound('sess-a')
  assert.equal(painted.official.action, '现查')
  assert.equal(painted.official.kind, 'KindTicket')
  assert.equal(painted.official.rows.length, 4)
  assert.deepEqual(painted.official.rows.map((row) => row.no), ['T-1', 'T-2', 'T-3', 'T-4'])
})

test('same-utterance leftover dump does not cover the matched sheet or an open write', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', hopSheet())
  rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(rounds.servedSheet('sess-a'), null)
  rounds.closeRound('sess-a')
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
  assert.equal(dumped.cancel, false)
  assert.equal(dumped.leftover, true)
  assert.equal(dumped.emit, false)
  assert.equal(writeRound.servedSheet('sess-b'), null)
  writeRound.closeRound('sess-b')
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
    officialBound: true,
    rows: [{ no: 'ROW-1' }],
  })
  assert.equal(rounds.isOpen('sess-a'), true)
  assert.equal(rounds.servedSheet('sess-a'), null)
  rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(rounds.servedSheet('sess-a'), null)
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').lookupNo, 'ROW-1')
  assert.equal(isUnfilteredListSheet(rounds.servedSheet('sess-a')), false)
})

test('wrote follow-up officialBound 现查 without identity does not replace official', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-a')
  rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '改行',
    preview_id: 'pv-w',
    rows: [{ no: 'ROW-1' }],
  })
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').preview_id, 'pv-w')
  rounds.closeRound('sess-a', 'wrote', { identity: { no: 'ROW-1' } })
  rounds.startRound('sess-a', { followup: true })
  rounds.noteToolSheet('sess-a', {
    kind: 'KindW',
    action: '现查',
    officialBound: true,
    speech: '把停用客户改成成交',
    rows: [],
  })
  rounds.closeRound('sess-a')
  assert.equal(rounds.servedSheet('sess-a').preview_id, 'pv-w')
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
    officialBound: true,
    rows: [{ no: 'ROW-1' }],
  })
  assert.equal(noted.cancel, false)
  assert.equal(rounds.peek('sess-a').boundSheet.wroteReceipt, true)
  const dump = rounds.noteToolSheet('sess-a', dumpSheet())
  assert.equal(dump.cancel, false)
  assert.equal(rounds.peek('sess-a').boundSheet.lookupNo, 'ROW-1')
  assert.equal(isLeftoverAfterCandidate(rounds.peek('sess-a').boundSheet, dumpSheet()), false)
})

test('hall /state with empty session id still serves the last official sheet', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-live')
  rounds.noteToolSheet('sess-live', hopSheet())
  assert.equal(rounds.servedSheet('sess-live'), null)
  rounds.closeRound('sess-live')
  assert.equal(rounds.servedSheet('').kind, hopSheet().kind)
  assert.equal(rounds.servedSheet('').rows.length, 2)
  assert.equal(rounds.servedSheet('sess-live').kind, hopSheet().kind)
})

test('later eligible hop replaces the official sheet, including a looser hop', () => {
  const tight = {
    kind: 'ChildB',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA',
    hopComplete: true,
    officialBound: true,
    from: { kind: 'ParentA', where: [{ keys: ['status'], values: ['expired'] }] },
    hopWhere: [{ keys: ['status'], values: ['expired'] }],
    steps: [{ kind: 'ParentA' }, { kind: 'ChildB' }],
    rows: [{ no: 'CB-HIT' }],
  }
  const loose = {
    kind: 'ChildB',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA 只列出待审',
    hopComplete: false,
    officialBound: true,
    from: { kind: 'ParentA' },
    steps: [{ kind: 'ParentA' }, { kind: 'ChildB' }],
    where: [{ keys: ['status'], values: ['pending'] }],
    rows: [{ no: 'CB-HIT' }, { no: 'CB-FAR' }, { no: 'CB-OTHER' }],
  }
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-hop')
  rounds.noteToolSheet('sess-hop', tight)
  rounds.noteToolSheet('sess-hop', loose)
  rounds.closeRound('sess-hop')
  const official = rounds.servedSheet('sess-hop')
  assert.equal(official.rows.length, 3)
  assert.deepEqual(official.rows.map((row) => row.no), ['CB-HIT', 'CB-FAR', 'CB-OTHER'])
})

test('a later 现查 that adds parent bind still becomes the candidate', () => {
  const emptyParent = {
    kind: 'ChildB',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA',
    hopComplete: false,
    from: { kind: 'ParentA' },
    steps: [{ kind: 'ParentA' }, { kind: 'ChildB' }],
    rows: [{ no: 'CB-1' }, { no: 'CB-2' }],
  }
  const boundParent = {
    kind: 'ChildB',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA',
    hopComplete: true,
    officialBound: true,
    from: { kind: 'ParentA', where: [{ keys: ['status'], values: ['expired'] }] },
    hopWhere: [{ keys: ['status'], values: ['expired'] }],
    steps: [{ kind: 'ParentA' }, { kind: 'ChildB' }],
    rows: [{ no: 'CB-HIT' }],
  }
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-refine')
  rounds.noteToolSheet('sess-refine', emptyParent)
  rounds.noteToolSheet('sess-refine', boundParent)
  rounds.closeRound('sess-refine')
  assert.equal(rounds.servedSheet('sess-refine').rows[0].no, 'CB-HIT')
})

test('later 现查 that adds a missing leaf filter covers the looser hop', () => {
  const allChild = {
    kind: '工单',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    hopComplete: false,
    from: { kind: '客户', where: [{ keys: ['状态'], values: ['停用'] }] },
    hopWhere: [{ keys: ['状态'], values: ['停用'] }],
    steps: [{ kind: '客户', where: [{ keys: ['状态'], values: ['停用'] }] }, { kind: '工单' }],
    rows: Array.from({ length: 8 }, (_, i) => ({ no: `TK-${i}`, status: i % 2 ? 'closed' : 'processing' })),
  }
  const openOnly = {
    kind: '工单',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？排除已关闭',
    hopComplete: true,
    officialBound: true,
    from: { kind: '客户', where: [{ keys: ['状态'], values: ['停用'] }] },
    hopWhere: [{ keys: ['状态'], values: ['停用'] }],
    steps: [
      { kind: '客户', where: [{ keys: ['状态'], values: ['停用'] }] },
      { kind: '工单', where: [{ keys: ['状态'], values: ['已关闭'], not: true }] },
    ],
    where: [{ keys: ['状态'], values: ['已关闭'], not: true }],
    rows: [{ no: 'TK-0', status: 'processing' }, { no: 'TK-2', status: 'processing' }],
  }
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-open')
  rounds.noteToolSheet('sess-open', allChild)
  rounds.noteToolSheet('sess-open', openOnly)
  rounds.closeRound('sess-open')
  const official = rounds.servedSheet('sess-open')
  assert.equal(official.rows.length, 2)
  assert.equal(official.rows[0].no, 'TK-0')
})

test('turn end closes the current open utterance round', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-stale')
  rounds.noteToolSheet('sess-stale', hopSheet())
  rounds.startRound('sess-stale', { utterance: true, speech: 'next spoken line' })
  rounds.noteToolSheet('sess-stale', {
    ...hopSheet(),
    speech: 'next spoken line',
    rows: [{ no: 'NEW-1' }],
  })
  const closed = rounds.closeRound('sess-stale', 'turn')
  assert.equal(closed.emit, true)
  assert.equal(rounds.servedSheet('sess-stale').rows[0].no, 'NEW-1')
})

test('turn end delivers the current utterance write preview', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-stale-write')
  rounds.noteToolSheet('sess-stale-write', hopSheet())
  rounds.closeRound('sess-stale-write')
  rounds.startRound('sess-stale-write', { utterance: true, speech: '改成成交' })
  rounds.noteToolSheet('sess-stale-write', {
    kind: '客户',
    action: '改行',
    speech: '改成成交',
    preview_id: 'pv_stale',
    rows: [{ no: 'C-1' }],
    changes: [{ field: 'status', from: 'inactive', to: 'active' }],
  })
  const closed = rounds.closeRound('sess-stale-write', 'turn')
  assert.equal(closed.emit, true)
  assert.equal(rounds.servedSheet('sess-stale-write').preview_id, 'pv_stale')
})

test('turn end with an empty utterance slot does not replace the previous official', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-stale-empty')
  rounds.noteToolSheet('sess-stale-empty', hopSheet())
  rounds.closeRound('sess-stale-empty')
  rounds.startRound('sess-stale-empty', { utterance: true, speech: 'next spoken line' })
  const closed = rounds.closeRound('sess-stale-empty', 'turn')
  assert.equal(closed.emit, false)
  assert.equal(rounds.peek('sess-stale-empty').boundSheet, null)
  assert.equal(rounds.servedSheet('sess-stale-empty').rows[0].no, hopSheet().rows[0].no)
})

test('officialBound 现查 after an empty 收口 still publishes and emits', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-late')
  rounds.noteToolSheet('sess-late', hopSheet())
  rounds.closeRound('sess-late')
  rounds.startRound('sess-late', { utterance: true, speech: '故障类而且紧急、还没关的工单是哪家客户的？' })
  const empty = rounds.closeRound('sess-late', 'turn')
  assert.equal(empty.emit, false)
  assert.equal(rounds.servedSheet('sess-late').rows[0].no, hopSheet().rows[0].no)
  const late = rounds.noteToolSheet('sess-late', {
    kind: '工单',
    action: '现查',
    speech: '故障类而且紧急、还没关的工单是哪家客户的？',
    officialBound: true,
    sessionId: 'sess-late',
    where: [{ keys: ['工单类型'], values: ['故障'] }, { keys: ['优先级'], values: ['紧急'] }],
    rows: [{ no: 'TK-NEW-1' }, { no: 'TK-NEW-2' }],
  })
  assert.equal(late.emit, true)
  assert.equal(rounds.servedSheet('sess-late').rows[0].no, 'TK-NEW-1')
  assert.equal(rounds.peek('sess-late').open, false)
})

test('write preview after an empty 收口 still publishes and emits', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-late-write')
  rounds.noteToolSheet('sess-late-write', hopSheet())
  rounds.closeRound('sess-late-write')
  rounds.startRound('sess-late-write', { utterance: true, speech: '改成成交' })
  rounds.closeRound('sess-late-write', 'turn')
  const late = rounds.noteToolSheet('sess-late-write', {
    kind: '客户',
    action: '改行',
    speech: '改成成交',
    preview_id: 'pv_late',
    rows: [{ no: 'C-1' }],
    changes: [{ field: 'status', from: 'inactive', to: 'active' }],
  })
  assert.equal(late.emit, true)
  assert.equal(late.cancel, false)
  assert.equal(rounds.servedSheet('sess-late-write').preview_id, 'pv_late')
})

test('utterance round freezes userSpeech for the gate', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-sp', { utterance: true, speech: '停用客户还有哪些没关的工单？' })
  assert.equal(rounds.roundSpeech('sess-sp'), '停用客户还有哪些没关的工单？')
})

test('a new human utterance starts an empty slot so the next officialBound 现查 can replace the previous sheet', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-u')
  rounds.noteToolSheet('sess-u', {
    kind: '客户',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    officialBound: true,
    rows: [{ no: 'C-OLD' }],
  })
  rounds.closeRound('sess-u')
  assert.equal(rounds.servedSheet('sess-u').rows[0].no, 'C-OLD')
  rounds.startRound('sess-u', { utterance: true, speech: '故障类而且紧急、还没关的工单是哪家客户的？' })
  assert.equal(rounds.peek('sess-u').boundSheet, null)
  rounds.noteToolSheet('sess-u', {
    kind: '工单',
    action: '现查',
    speech: '故障类而且紧急、还没关的工单是哪家客户的？',
    officialBound: true,
    rows: [{ no: 'TK-NEW' }],
  })
  const closed = rounds.closeRound('sess-u')
  assert.equal(closed.emit, true)
  assert.equal(rounds.servedSheet('sess-u').rows[0].no, 'TK-NEW')
})

test('0-row officialBound 现查 still publishes as the round sheet', () => {
  const rounds = createSessionRoundStore()
  rounds.startRound('sess-empty')
  rounds.noteToolSheet('sess-empty', {
    kind: 'ChildB',
    action: '现查',
    speech: 'pending ChildB ∩ expired ParentA',
    officialBound: true,
    listed: true,
    rows: [],
  })
  const closed = rounds.closeRound('sess-empty')
  assert.equal(closed.emit, true)
  assert.equal(closed.official.officialBound, true)
  assert.equal(Array.isArray(closed.official.rows) ? closed.official.rows.length : -1, 0)
})

test('pick token over listed write saves the listed sheet for dismiss restore', () => {
  const rounds = createSessionRoundStore()
  const listed = {
    kind: 'KindPay',
    action: '改行',
    listed: true,
    speech: '把备注改成催收',
    sessionId: 'sess-pick',
    patch: { remark: '催收' },
    rows: [{ no: 'P-1' }, { no: 'P-2' }],
    ok: true,
  }
  const token = {
    kind: 'KindPay',
    action: '改行',
    preview_id: 'pv_pick',
    picked: true,
    canWrite: true,
    sessionId: 'sess-pick',
    patch: { remark: '催收' },
    rows: [{ no: 'P-1' }],
    changes: [{ field: 'remark', from: '', to: '催收' }],
    ok: true,
  }
  rounds.startRound('sess-pick')
  rounds.noteToolSheet('sess-pick', listed)
  rounds.closeRound('sess-pick')
  assert.equal(rounds.servedSheet('sess-pick').listed, true)
  assert.equal(rounds.publishOfficial('sess-pick', token), true)
  assert.equal(rounds.servedSheet('sess-pick').preview_id, 'pv_pick')
  assert.equal(rounds.servedSheet('sess-pick').rows.length, 1)
  assert.equal(rounds.republishAfterDismiss('sess-pick', listed), true)
  const restored = rounds.servedSheet('sess-pick')
  assert.equal(restored.listed, true)
  assert.equal(String(restored.preview_id || '').trim(), '')
  assert.equal(restored.rows.length, 2)
})
