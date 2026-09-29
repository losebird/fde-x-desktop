import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalizeSheetKind,
  collapseKindsToConnectedTables,
  dropActionBatchLeftover,
  isConnectorCatalogDump,
  isSpokenActionOrBatchToken,
  resolveConnectedKind,
  unresolvedKindBlocksOfficial,
  sheetForNamedSession,
  sheetForOfficialGet,
  isNewOfficialRound,
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

test('new official 现查 is not blocked when the catalog has not mapped the kind', () => {
  const catalog = [{ kind: 'KindKnown', resource: 'res_known', can: ['现查'] }]
  const lookup = { kind: 'KindUnknown', action: '现查', roundId: 'rnd_2', rows: [{ no: 'U-1' }] }
  assert.equal(unresolvedKindBlocksOfficial(lookup, catalog, true), false)
  assert.equal(unresolvedKindBlocksOfficial(lookup, catalog, false), true)
})

test('new official roundId is a new result even with the same speech', () => {
  const prev = { kind: 'KindA', action: '现查', speech: 'same line', roundId: 'rnd_1', rows: [{ no: 'A-1' }] }
  const next = { kind: 'KindA', action: '现查', speech: 'same line', roundId: 'rnd_2', rows: [{ no: 'A-2' }] }
  assert.equal(isNewOfficialRound(prev, next), true)
  assert.equal(isNewOfficialRound(next, { ...next, rows: [{ no: 'A-2' }] }), false)
})

test('stripped roundId still treats a different 现查 as a new official round', () => {
  const prev = {
    kind: '工单',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    where: [{ keys: ['客户状态'], values: ['停用'] }],
    rows: Array.from({ length: 20 }, (_, i) => ({ no: `TK-OLD-${i}` })),
  }
  const next = {
    kind: '工单',
    action: '现查',
    speech: '故障类而且紧急、还没关的工单是哪家客户的？',
    where: [{ keys: ['工单类型'], values: ['故障'] }],
    rows: [{ no: 'TK-NEW-1' }],
  }
  assert.equal(isNewOfficialRound(prev, next), true)
})

test('named session GET does not serve another session hall', () => {
  const live = { kind: 'KindA', action: '现查', sessionId: 'sess-a', rows: [{ no: 'A-1' }] }
  const other = { kind: 'KindB', action: '改行', sessionId: 'sess-b', rows: [{ no: 'B-1' }] }
  assert.equal(sheetForNamedSession(live, 'sess-a'), live)
  assert.equal(sheetForNamedSession(other, 'sess-a'), null)
  assert.equal(sheetForNamedSession(live, ''), live)
  assert.equal(sheetForNamedSession(null, 'sess-a'), null)
  assert.equal(sheetForNamedSession(other, 'sess-b'), other)
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
  assert.equal(shouldSkipCoveringPending(pickedWrite, {
    kind: 'KindTicket',
    action: '现查',
    speech: 'another lookup',
    rows: [{ no: 'T-1' }, { no: 'T-2' }],
  }), false)
  assert.equal(shouldSkipCoveringPending(pickedWrite, emptyCover), true)
  assert.equal(shouldSkipCoveringPending(pickedWrite, emptyNewSpeech), true)
  assert.equal(shouldSkipCoveringPending(pickedWrite, dump), true)
})

test('post-write 现查 reread replaces the write preview of the same row', () => {
  const writePreview = {
    kind: 'KindW',
    action: '过审',
    preview_id: 'pv-open',
    canWrite: true,
    speech: '过一下这张 ROW-9',
    rows: [{ no: 'ROW-9' }],
  }
  const reread = {
    kind: 'KindW',
    action: '现查',
    querySettled: true,
    speech: '现查 ROW-9 现在的值',
    rows: [{ no: 'ROW-9', status: 'done' }],
  }
  assert.equal(shouldSkipCoveringPending(writePreview, reread), false)
})

test('official GET serves this session official only', () => {
  const official = {
    kind: 'KindLeaf',
    action: '现查',
    sessionId: 'sess-a',
    from: { kind: 'KindParent' },
    rows: [{ no: 'HIT-1' }],
  }
  assert.equal(sheetForOfficialGet(official, 'sess-a')?.kind, 'KindLeaf')
  assert.equal(sheetForOfficialGet(official, 'sess-a')?.rows?.[0]?.no, 'HIT-1')
  assert.equal(sheetForOfficialGet(official, 'sess-b'), null)
  assert.equal(sheetForOfficialGet(null, 'sess-a'), null)
  const unstamped = {
    kind: 'KindLeaf',
    action: '现查',
    querySettled: true,
    hitTotal: 0,
    hitTotalState: 'known',
    rows: [],
  }
  const stamped = sheetForOfficialGet(unstamped, 'sess-a')
  assert.equal(stamped?.sessionId, 'sess-a')
  assert.equal(stamped?.hitTotal, 0)
  assert.equal(sheetForOfficialGet({ ...unstamped, sessionId: 'sess-a' }, 'sess-b'), null)
})
