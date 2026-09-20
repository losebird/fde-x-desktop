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
  shouldSkipCoveringPending,
  speechWantsMatchSet,
} from '../biz/connected-kind.mjs'

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
  assert.equal(sheetAfterCancelCover(null, catalog), null)
  assert.equal(sheetAfterCancelCover(null, hop), hop)
})
