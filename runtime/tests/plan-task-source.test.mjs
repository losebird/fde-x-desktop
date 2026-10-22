import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planAppSource, planAskFields, planTaskSource } from '../app-source.mjs'
import { applyDataLand, dataViewOfHref, emptyDataBrowse } from '../memory/data-land.mjs'

const ledger = 'app_' + 'a'.repeat(32)
const rid = 'rec' + 'b'.repeat(32)

test('planAppSource still rejects every non-app ref', () => {
  assert.equal(planAppSource('im:req_1'), null)
  assert.equal(planAppSource('biz:采购单:PO-2026-001'), null)
  assert.equal(planAppSource('biz:lan/采购单:PO-2026-001'), null)
  assert.equal(planAppSource('biz:trace_ab12'), null)
  assert.equal(planAppSource('fde-task:task_x'), null)
  assert.equal(planAppSource(`app:${ledger}:${rid}`)?.kind, 'row')
})

test('every stored task origin can open except a hand-built task', () => {
  const app = planTaskSource(`app:${ledger}`)
  assert.equal(app?.kind, 'app')
  assert.deepEqual(app?.href, planAppSource(`app:${ledger}`)?.href)
  assert.match(app?.label || '', /应用/)

  const row = planTaskSource(`app:${ledger}:${rid}`)
  assert.equal(row?.kind, 'row')
  assert.deepEqual(row?.href, planAppSource(`app:${ledger}:${rid}`)?.href)
  assert.equal(dataViewOfHref(row.href), 'overview')

  const biz = planTaskSource('biz:采购单:PO-2026-001')
  assert.equal(biz?.kind, 'biz-record')
  assert.equal(biz?.label, '采购单 PO-2026-001')
  assert.deepEqual(biz?.href, { panel: 'data', tab: 'records', kind: '采购单', rowId: 'PO-2026-001' })
  const landed = applyDataLand(emptyDataBrowse(), biz.href)
  assert.equal(landed.view, 'records')
  assert.equal(landed.kind, '采购单')
  assert.equal(landed.rowId, 'PO-2026-001')

  const named = planTaskSource('biz:lan/采购单:PO-2026-001')
  assert.equal(named?.kind, 'biz-record')
  assert.equal(named?.href.connection, 'lan')
  assert.equal(named?.href.kind, '采购单')
  assert.equal(named?.href.rowId, 'PO-2026-001')
  assert.match(named?.label || '', /lan/)
  const withConn = applyDataLand(emptyDataBrowse(), named.href)
  assert.equal(withConn.view, 'records')
  assert.equal(withConn.connection, 'lan')
  assert.equal(withConn.kind, '采购单')
  assert.equal(withConn.rowId, 'PO-2026-001')

  const kept = applyDataLand({ ...emptyDataBrowse(), connection: 'current' }, biz.href)
  assert.equal(kept.connection, 'current')

  const trace = planTaskSource('biz:trace_ab12')
  assert.equal(trace?.kind, 'biz-trace')
  assert.equal(trace?.href.traceId, 'trace_ab12')
  assert.equal(dataViewOfHref(trace.href), 'operations')
  const ops = applyDataLand(emptyDataBrowse(), trace.href)
  assert.equal(ops.view, 'operations')
  assert.equal(ops.traceId, 'trace_ab12')

  const im = planTaskSource('im:req_1')
  assert.equal(im?.kind, 'im')
  assert.equal(im?.href.panel, 'im')
  assert.equal(im?.href.requestId, 'req_1')
  assert.match(im?.label || '', /IM/)

  assert.equal(planTaskSource('fde-task:task_x'), null)
  assert.equal(planTaskSource('dsh-goal:g1'), null)
  assert.equal(planTaskSource('memory:aa'), null)
  assert.equal(planTaskSource('biz:'), null)
  assert.equal(planTaskSource('im:'), null)
})

test('ask fields name a biz record and an IM thread without loading an app', async () => {
  const biz = await planAskFields('biz:lan/采购单:PO-2026-001', {
    loadApp() {
      throw new Error('loaded an app')
    },
    probeRow() {
      throw new Error('probed')
    },
  })
  assert.equal(biz.connection, 'lan')
  assert.equal(biz.kind, '采购单')
  assert.equal(biz.rowId, 'PO-2026-001')

  const im = await planAskFields('im:req_1', {
    loadApp() {
      throw new Error('loaded an app')
    },
    probeRow() {
      throw new Error('probed')
    },
  })
  assert.equal(im.requestId, 'req_1')

  const plain = await planAskFields('biz:采购单:PO-2026-001', {
    loadApp() {
      throw new Error('loaded an app')
    },
    probeRow() {
      throw new Error('probed')
    },
  })
  assert.equal(Object.hasOwn(plain, 'connection'), false)
  assert.equal(plain.kind, '采购单')
  assert.equal(plain.rowId, 'PO-2026-001')
})
