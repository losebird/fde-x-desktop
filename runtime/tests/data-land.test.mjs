import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyDataLand, dataLandView, dataViewOfHref, emptyDataBrowse, hrefHasDataLand } from '../memory/data-land.mjs'

test('bare data href does not pulse land or wipe app selection', () => {
  const current = {
    ...emptyDataBrowse(),
    view: 'overview',
    workspaceAppId: 'app_1',
    land: 3,
  }
  const next = applyDataLand(current, { panel: 'data' })
  assert.equal(hrefHasDataLand({ panel: 'data' }), false)
  assert.equal(next.land, 3)
  assert.equal(next.workspaceAppId, 'app_1')
  assert.equal(next.view, 'overview')
})

test('operations land writes traceId and keeps overview keys', () => {
  const current = {
    ...emptyDataBrowse(),
    workspaceAppId: 'app_1',
    slug: 'board',
    land: 1,
  }
  const next = applyDataLand(current, { panel: 'data', tab: 'operations', traceId: 'trace_a' })
  assert.equal(next.view, 'operations')
  assert.equal(next.traceId, 'trace_a')
  assert.equal(next.workspaceAppId, 'app_1')
  assert.equal(next.slug, 'board')
  assert.equal(next.land, 2)
})

test('records land writes kind/rowId and keeps operations traceId', () => {
  const current = {
    ...emptyDataBrowse(),
    view: 'operations',
    traceId: 'trace_a',
    workspaceAppId: 'app_1',
    land: 4,
  }
  const next = applyDataLand(current, { panel: 'data', tab: 'records', kind: '工单', rowId: 'NO-9' })
  assert.equal(next.view, 'records')
  assert.equal(next.kind, '工单')
  assert.equal(next.rowId, 'NO-9')
  assert.equal(next.traceId, 'trace_a')
  assert.equal(next.workspaceAppId, 'app_1')
  assert.equal(next.land, 5)
})

test('slug-only href lands overview', () => {
  assert.equal(dataViewOfHref({ slug: 'cards' }, 'records'), 'overview')
  const next = applyDataLand(emptyDataBrowse(), { panel: 'data', slug: 'cards' })
  assert.equal(next.view, 'overview')
  assert.equal(next.slug, 'cards')
  assert.equal(next.land, 1)
  assert.equal(dataLandView(), 'overview')
})

test('land view follows the pulse target, not a later tab click', () => {
  const afterOps = applyDataLand(emptyDataBrowse(), { panel: 'data', tab: 'operations', traceId: 'trace_a' })
  assert.equal(dataLandView(), 'operations')
  const afterRecords = applyDataLand(afterOps, { panel: 'data', tab: 'records', kind: '工单', rowId: 'NO-9' })
  assert.equal(dataLandView(), 'records')
  assert.equal(afterRecords.traceId, 'trace_a')
  const noPulse = applyDataLand(afterRecords, { panel: 'data' })
  assert.equal(noPulse.land, afterRecords.land)
  assert.equal(dataLandView(), 'records')
})
