import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  collapseKindsToConnectedTables,
  isConnectorCatalogDump,
  resolveConnectedKind,
  shouldSkipCoveringPending,
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
