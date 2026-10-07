import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bizTraceIdOf,
  mentionRowsFromSheets,
  mentionsInText,
  originHref,
  uniqueMentions,
} from '../memory/origin-href.mjs'

test('originHref lands biz traces on records with kind and no', () => {
  const href = originHref('biz:trace_1', { audit: { kind: '工单', recordNo: 'WO-9' } })
  assert.equal(href.panel, 'data')
  assert.equal(href.tab, 'records')
  assert.equal(href.kind, '工单')
  assert.equal(href.rowId, 'WO-9')
  assert.equal(href.traceId, 'trace_1')
  assert.equal(originHref('biz:dup'), null)
  assert.equal(bizTraceIdOf('biz:trace_1'), 'trace_1')
})

test('originHref IM uses peer not requestId as thread', () => {
  const href = originHref('im:r1', {
    mailbox: { self: { id: 'me' }, requests: [{ id: 'r1', from: 'p1', to: ['me'] }] },
  })
  assert.equal(href.panel, 'im')
  assert.equal(href.requestId, 'r1')
  assert.equal(href.peerId, 'p1')
})

test('mentions only unique evidence nos', () => {
  const evidence = uniqueMentions([
    { kind: '工单', no: 'WO-9' },
    { kind: '工单', recordNo: 'WO-9' },
    { kind: '采购单', no: 'WO-9' },
    { kind: '工单', no: 'WO-12' },
  ])
  assert.deepEqual(evidence, [{ kind: '工单', no: 'WO-12' }])
  const parts = mentionsInText('看一下 WO-12 和 WO-9', [
    { kind: '工单', no: 'WO-12' },
    { kind: '工单', no: 'WO-9' },
  ])
  const linked = parts.filter((row) => row.mention).map((row) => row.mention.no)
  assert.deepEqual(linked, ['WO-12', 'WO-9'])
})

test('sheet rows become mention evidence', () => {
  const rows = mentionRowsFromSheets([
    { kind: '工单', rows: [{ no: 'WO-1' }, { orderId: 'WO-2' }] },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].no, 'WO-1')
})
