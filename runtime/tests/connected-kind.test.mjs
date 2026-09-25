import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalizeSheetKind,
  collapseKindsToConnectedTables,
  dropActionBatchLeftover,
  isConnectorCatalogDump,
  isSpokenActionOrBatchToken,
  resolveConnectedKind,
  sheetAfterCancelCover,
  sheetForNamedSession,
  sheetForPendingGet,
  sheetForOfficialGet,
  shouldSkipCoveringPending,
  speechWantsMatchSet,
} from '../biz/connected-kind.mjs'

test('distinct connector tables keep both kinds; short spoken still binds the short table', () => {
  const collapsed = collapseKindsToConnectedTables([
    { kind: 'ShortKind', resource: 'res_short', catalogVersion: 'schema:1', fields: ['no'], can: ['现查'] },
    {
      kind: 'ShortKindTrailRecord',
      resource: 'res_trail',
      catalogVersion: 'schema:1',
      fields: ['no', 'trail'],
      can: ['现查'],
      clues: [{ role: '型', say: ['ShortKind'] }],
    },
  ])
  assert.deepEqual(collapsed.kinds.map((row) => row.kind).sort(), ['ShortKind', 'ShortKindTrailRecord'])
  assert.equal(resolveConnectedKind('ShortKind', collapsed), 'ShortKind')
  assert.equal(resolveConnectedKind('ShortKindTrailRecord', collapsed), 'ShortKindTrailRecord')
})

test('same resource collapses to the connector-generated kind; no resource is not previewable', () => {
  const collapsed = collapseKindsToConnectedTables([
    { kind: 'LongKind', resource: 'res_a', catalogVersion: 'schema:1', fields: ['a', 'b', 'c'], can: ['现查', '过审'] },
    { kind: 'ShortKind', resource: 'res_a', fields: ['no'], can: ['现查'] },
    { kind: 'Orphan', fields: ['x'] },
    { kind: 'GraphOnly', resource: '(in graph)', fields: ['no'], can: ['现查', '过审'] },
  ])
  assert.deepEqual(collapsed.kinds.map((row) => row.kind), ['LongKind'])
  assert.equal(collapsed.aliases.ShortKind, 'LongKind')
  assert.equal(resolveConnectedKind('ShortKind', collapsed), 'LongKind')
  assert.equal(resolveConnectedKind('LongKind', collapsed), 'LongKind')
  assert.equal(resolveConnectedKind('Orphan', collapsed), '')
  assert.equal(resolveConnectedKind('GraphOnly', collapsed), '')
  assert.equal(resolveConnectedKind('ShortKind', []), 'ShortKind')
})

test('collection-stem resource without catalogVersion stays previewable', () => {
  const collapsed = collapseKindsToConnectedTables([
    { kind: 'TicketKind', resource: 'biz_tickets', fields: ['no'], can: ['现查'] },
    { kind: 'GraphOnly', resource: '(in graph)', fields: ['no'], can: ['现查'] },
  ])
  assert.deepEqual(collapsed.kinds.map((row) => row.kind), ['TicketKind'])
  assert.equal(resolveConnectedKind('TicketKind', collapsed), 'TicketKind')
  assert.equal(resolveConnectedKind('GraphOnly', collapsed), '')
})

test('shorter catalog kind name wins over longer kind oral alias when both are connected tables', () => {
  const kinds = [
    {
      kind: 'LongKind',
      resource: 'res_long',
      catalogVersion: 'schema:1',
      fields: ['a', 'b'],
      can: ['现查'],
      clues: [{ role: '型', say: ['ShortKind'] }],
    },
    {
      kind: 'ShortKind',
      resource: 'res_short',
      catalogVersion: 'schema:1',
      fields: ['no'],
      can: ['现查'],
    },
  ]
  const collapsed = collapseKindsToConnectedTables(kinds)
  assert.deepEqual(collapsed.kinds.map((row) => row.kind).sort(), ['LongKind', 'ShortKind'])
  assert.equal(resolveConnectedKind('ShortKind', kinds), 'ShortKind')
  assert.equal(resolveConnectedKind('ShortKind', collapsed), 'ShortKind')
  assert.equal(resolveConnectedKind('LongKind', kinds), 'LongKind')
})

test('oral 型 slots and graph aliases fold onto the connected table', () => {
  const collapsed = collapseKindsToConnectedTables([
    {
      kind: 'LongKind',
      resource: 'res_a',
      catalogVersion: 'schema:1',
      fields: ['a'],
      can: ['现查', '过审'],
      aliases: ['GraphSay'],
      clues: [{ role: '型', say: ['OralSay'] }],
    },
  ])
  assert.equal(resolveConnectedKind('OralSay', collapsed), 'LongKind')
  assert.equal(resolveConnectedKind('GraphSay', collapsed), 'LongKind')
  assert.equal(resolveConnectedKind('GraphSay', [
    { kind: 'LongKind', resource: 'res_a', catalogVersion: 'schema:1', aliases: ['GraphSay'] },
  ]), 'LongKind')
})

test('canonicalizeSheetKind remaps a spoken alias; empty catalog leaves the sheet', () => {
  const kinds = [
    {
      kind: 'LongKind',
      resource: 'res_a',
      catalogVersion: 'schema:1',
      aliases: ['ShortSay'],
      can: ['现查', '过审'],
    },
  ]
  const remapped = canonicalizeSheetKind({ kind: 'ShortSay', action: '过审', rows: [{ no: 'R-1' }] }, kinds)
  assert.equal(remapped.kind, 'LongKind')
  assert.equal(remapped.action, '过审')
  const passthrough = canonicalizeSheetKind({ kind: 'ShortSay', action: '过审' }, [])
  assert.equal(passthrough.kind, 'ShortSay')
  assert.equal(canonicalizeSheetKind({ kind: 'Orphan', action: '过审' }, kinds), null)
})

test('action/batch leftover is not a kind or row identity', () => {
  const kinds = [
    {
      kind: 'LongKind',
      resource: 'res_a',
      catalogVersion: 'schema:1',
      can: ['现查', '过审'],
      clues: [{ role: '型', say: ['ShortSay'] }],
    },
  ]
  assert.equal(isSpokenActionOrBatchToken('一批', kinds), true)
  assert.equal(speechWantsMatchSet('pending ShortSay 都过一下', kinds), true)
  assert.equal(dropActionBatchLeftover('一批', 'pending ShortSay 都过一下', kinds), '')
  assert.equal(dropActionBatchLeftover('单都', 'pending ShortSay 都过一下', kinds), '')
  assert.equal(dropActionBatchLeftover('NameRest', '把停用客户 NameRest 改成成交', kinds), 'NameRest')
})

test('empty second shot and catalog dump skip covering a populated pending', () => {
  const populated = {
    kind: 'LongKind',
    action: '现查',
    speech: 'batch this table',
    rows: [{ no: 'ROW-1' }, { no: 'ROW-2' }],
  }
  assert.equal(shouldSkipCoveringPending(populated, {
    kind: 'ShortKind',
    action: '过审',
    speech: 'batch this table',
    rows: [],
  }), true)
  assert.equal(shouldSkipCoveringPending(populated, {
    kind: 'LongKind',
    action: '现查',
    rows: Array.from({ length: 20 }, (_, index) => ({ no: `C-${index}` })),
  }), true)
  assert.equal(isConnectorCatalogDump({
    kind: 'LongKind',
    action: '现查',
    rows: [{ no: 'C-0' }],
  }), true)
  assert.equal(shouldSkipCoveringPending(populated, {
    kind: 'LongKind',
    action: '过审',
    speech: 'batch this table',
    preview_id: 'pv_ok',
    rows: [{ no: 'ROW-1' }],
  }), false)
})

test('person pick and waiting hit-set are not covered by a leftover write', () => {
  const hitSet = {
    kind: 'LongKind',
    action: '改行',
    speech: 'rewrite spoken name',
    listed: true,
    ambiguous: true,
    rows: [{ no: 'HIT-1' }, { no: 'HIT-2' }],
  }
  const leftoverWrite = {
    kind: 'LongKind',
    action: '改行',
    speech: 'rewrite spoken name',
    preview_id: 'pv_other',
    rows: [{ no: 'HIT-1' }],
  }
  assert.equal(shouldSkipCoveringPending(hitSet, leftoverWrite), true)
  const picked = {
    kind: 'LongKind',
    action: '改行',
    speech: 'rewrite spoken name',
    preview_id: 'pv_pick',
    picked: true,
    rows: [{ no: 'HIT-2' }],
  }
  assert.equal(shouldSkipCoveringPending(picked, leftoverWrite), true)
  const personPick = {
    ...leftoverWrite,
    picked: true,
    preview_id: 'pv_pick',
    rows: [{ no: 'HIT-2' }],
  }
  assert.equal(shouldSkipCoveringPending(hitSet, personPick), false)
  assert.equal(shouldSkipCoveringPending(picked, {
    kind: 'LongKind',
    action: '现查',
    speech: 'next utterance on another kind',
    rows: [{ no: 'NEXT-1' }],
  }), false)
  assert.equal(shouldSkipCoveringPending(hitSet, {
    kind: 'LongKind',
    action: '现查',
    speech: 'lookup HIT-1',
    rows: [{ no: 'HIT-1' }],
  }), true)
  assert.equal(shouldSkipCoveringPending(picked, {
    kind: 'LongKind',
    action: '现查',
    speech: 'lookup HIT-2',
    rows: [{ no: 'HIT-2' }],
  }), true)
})

test('cancel cover keeps the hall list and never substitutes a catalog dump', () => {
  const hop = {
    kind: 'LongKind',
    action: '现查',
    speech: 'batch this table',
    hopWhere: [{ keys: ['status'], values: ['open'] }],
    rows: [{ no: 'ROW-1' }, { no: 'ROW-2' }],
  }
  const catalog = {
    kind: 'LongKind',
    action: '现查',
    rows: Array.from({ length: 20 }, (_, index) => ({ no: `C-${index}` })),
  }
  const stripped = {
    kind: 'LongKind',
    action: '现查',
    rows: hop.rows,
  }
  assert.equal(sheetAfterCancelCover(hop, catalog), hop)
  assert.equal(sheetAfterCancelCover(stripped, catalog), stripped)
  assert.equal(sheetAfterCancelCover(catalog, hop), hop)
  assert.equal(sheetAfterCancelCover(null, catalog), null)
  assert.equal(sheetAfterCancelCover(null, hop), hop)
})

test('named session GET does not serve another session hall', () => {
  const live = { kind: 'KindA', action: '现查', sessionId: 'sess-a', rows: [{ no: 'A-1' }] }
  const other = { kind: 'KindB', action: '改行', sessionId: 'sess-b', rows: [{ no: 'B-1' }] }
  assert.equal(sheetForNamedSession(live, 'sess-a'), live)
  assert.equal(sheetForNamedSession(other, 'sess-a'), null)
  assert.equal(sheetForNamedSession(live, ''), live)
  assert.equal(sheetForNamedSession(null, 'sess-a'), null)
  const covered = sheetAfterCancelCover(null, other)
  assert.equal(sheetForNamedSession(covered, 'sess-a'), null)
  assert.equal(sheetForNamedSession(covered, 'sess-b'), other)
})

test('named GET keeps session write when hall is unstamped or a covering dump', () => {
  const stamped = {
    kind: 'KindW',
    action: '改行',
    sessionId: 'sess-a',
    preview_id: 'pv-1',
    speech: 'change this row',
    rows: [{ no: 'ROW-9' }],
  }
  const unstampedHall = {
    kind: 'KindW',
    action: '改行',
    preview_id: 'pv-1',
    speech: 'change this row',
    rows: [{ no: 'ROW-9' }],
  }
  const dump = {
    kind: 'KindW',
    action: '现查',
    rows: Array.from({ length: 20 }, (_, index) => ({ no: `C-${index}` })),
  }
  const emptyWrite = {
    kind: 'KindW',
    action: '过审',
    speech: 'change this row',
    rows: [],
  }
  const otherQuery = {
    kind: 'KindQ',
    action: '现查',
    speech: 'list the other table',
    rows: [{ no: 'Q-1' }],
  }
  const gotWrite = sheetForPendingGet(unstampedHall, stamped, 'sess-a')
  assert.equal(gotWrite?.kind, 'KindW')
  assert.equal(gotWrite?.action, '改行')
  assert.equal(gotWrite?.sessionId, 'sess-a')
  assert.equal(sheetForPendingGet(dump, stamped, 'sess-a'), stamped)
  const kept = sheetForPendingGet(emptyWrite, stamped, 'sess-a')
  assert.equal(kept?.action, '改行')
  assert.equal(kept?.rows?.length, 1)
  const next = sheetForPendingGet(otherQuery, stamped, 'sess-a')
  assert.equal(next?.kind, 'KindQ')
  assert.equal(next?.action, '现查')
  assert.equal(sheetForPendingGet(unstampedHall, stamped, 'sess-b'), null)
  assert.equal(sheetForPendingGet({
    kind: 'KindB',
    action: '改行',
    sessionId: 'sess-b',
    rows: [{ no: 'B-1' }],
  }, null, 'sess-a'), null)
})

test('new spoken utterance replaces a picked write; leftover 现查 and empty cover still skip', () => {
  const pickedWrite = {
    kind: 'KindW',
    action: '改行',
    speech: 'change this row',
    preview_id: 'pv-write',
    picked: true,
    rows: [{ no: 'ROW-9' }],
  }
  const nextSpeechWrite = {
    kind: 'KindQ',
    action: '过审',
    speech: 'batch the other table',
    preview_id: 'pv-next',
    rows: [{ no: 'Q-1' }, { no: 'Q-2' }],
  }
  const nextKindActionNoSpeech = {
    kind: 'KindQ',
    action: '过审',
    preview_id: 'pv-next-silent',
    rows: [{ no: 'Q-1' }],
  }
  const leftoverXiancha = {
    kind: 'KindW',
    action: '现查',
    speech: 'lookup ROW-9',
    rows: [{ no: 'ROW-9' }],
  }
  const emptyCover = {
    kind: 'KindW',
    action: '过审',
    speech: 'change this row',
    rows: [],
  }
  const emptyNewSpeech = {
    kind: 'KindQ',
    action: '过审',
    speech: 'batch the other table',
    rows: [],
  }
  const dump = {
    kind: 'KindW',
    action: '现查',
    rows: Array.from({ length: 20 }, (_, index) => ({ no: `C-${index}` })),
  }
  assert.equal(shouldSkipCoveringPending(pickedWrite, nextSpeechWrite), false)
  assert.equal(shouldSkipCoveringPending(pickedWrite, nextKindActionNoSpeech), false)
  assert.equal(shouldSkipCoveringPending(pickedWrite, leftoverXiancha), true)
  assert.equal(shouldSkipCoveringPending(pickedWrite, emptyCover), true)
  assert.equal(shouldSkipCoveringPending(pickedWrite, emptyNewSpeech), true)
  assert.equal(shouldSkipCoveringPending(pickedWrite, dump), true)
  const stampedWrite = { ...pickedWrite, sessionId: 'sess-a' }
  const gotNext = sheetForPendingGet(nextSpeechWrite, stampedWrite, 'sess-a')
  assert.equal(gotNext?.kind, 'KindQ')
  assert.equal(gotNext?.action, '过审')
  assert.equal(gotNext?.speech, 'batch the other table')
  const keptWrite = sheetForPendingGet(leftoverXiancha, stampedWrite, 'sess-a')
  assert.equal(keptWrite?.action, '改行')
  assert.equal(keptWrite?.rows?.[0]?.no, 'ROW-9')
  const keptEmpty = sheetForPendingGet(emptyCover, stampedWrite, 'sess-a')
  assert.equal(keptEmpty?.action, '改行')
})

test('official GET prefers last handed and never takes hall process', () => {
  const official = {
    kind: 'KindLeaf',
    action: '现查',
    sessionId: 'sess-a',
    from: { kind: 'KindParent' },
    rows: [{ no: 'HIT-1' }],
  }
  const last = {
    kind: 'KindW',
    action: '改行',
    sessionId: 'sess-a',
    preview_id: 'pv-human',
    rows: [{ no: 'ROW-1' }],
  }
  assert.equal(sheetForOfficialGet(official, last, 'sess-a')?.action, '现查')
  assert.equal(sheetForOfficialGet(official, last, 'sess-a')?.rows?.[0]?.no, 'HIT-1')
  assert.equal(sheetForOfficialGet(last, last, 'sess-a')?.action, '改行')
  assert.equal(sheetForOfficialGet(null, last, 'sess-a')?.preview_id, 'pv-human')
  const hallProcess = {
    kind: 'KindLeaf',
    action: '现查',
    sessionId: 'sess-a',
    speech: '库里已改上',
    rows: [{ no: 'ROW-1' }],
  }
  assert.equal(sheetForOfficialGet(hallProcess, last, 'sess-a')?.action, '改行')
  assert.equal(sheetForOfficialGet(official, null, 'sess-a')?.kind, 'KindLeaf')
  assert.equal(sheetForOfficialGet(official, last, 'sess-b'), null)
  const laterList = {
    kind: 'KindOther',
    action: '现查',
    sessionId: 'sess-a',
    rows: [{ no: 'PAGE-2' }],
  }
  assert.equal(sheetForOfficialGet(official, laterList, 'sess-a')?.kind, 'KindLeaf')
  assert.equal(sheetForOfficialGet(official, laterList, 'sess-a')?.rows?.[0]?.no, 'HIT-1')
  const unstamped = {
    kind: 'KindLeaf',
    action: '现查',
    querySettled: true,
    hitTotal: 0,
    hitTotalState: 'known',
    rows: [],
  }
  const stamped = sheetForOfficialGet(unstamped, null, 'sess-a')
  assert.equal(stamped?.sessionId, 'sess-a')
  assert.equal(stamped?.hitTotal, 0)
  assert.equal(sheetForOfficialGet({ ...unstamped, sessionId: 'sess-a' }, null, 'sess-b'), null)
})
