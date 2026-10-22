import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  focusEntityFor,
  formatPlanAppSource,
  planAppSource,
  planAskFields,
} from '../app-source.mjs'
import { applyDataLand, dataViewOfHref, emptyDataBrowse, hrefHasDataLand } from '../memory/data-land.mjs'
import { originHref } from '../memory/origin-href.mjs'
import { renderOriginEntity } from '../memory/origin-entity.mjs'

const ledger = 'app_' + 'a'.repeat(32)
const rid = 'rec' + 'b'.repeat(32)

const orders = { slug: 'orders', entities: [{ name: 'item' }] }
const two = { slug: 'orders', entities: [{ name: 'item' }, { name: 'second' }] }

function blockFor(fields) {
  return renderOriginEntity({ title: '买牛奶', fields })
}

test('formatPlanAppSource keeps a ledger id and a record id', () => {
  assert.equal(formatPlanAppSource({ ledgerId: ledger, rowId: rid }), `app:${ledger}:${rid}`)
  assert.equal(formatPlanAppSource({ ledgerId: ledger }), `app:${ledger}`)
  assert.equal(formatPlanAppSource({ ledgerId: ledger, rowId: '' }), `app:${ledger}`)
  assert.equal(formatPlanAppSource({ ledgerId: ledger, rowId: null }), `app:${ledger}`)
  assert.equal(formatPlanAppSource({ ledgerId: ledger, rowId: 'preview_item_0' }), null)
  assert.equal(formatPlanAppSource({ ledgerId: 'orders', rowId: rid }), null)
})

test('a row source opens the data app on that record', () => {
  const handle = planAppSource(`app:${ledger}:${rid}`)
  assert.equal(handle?.kind, 'row')
  assert.equal(handle?.ledgerId, ledger)
  assert.equal(handle?.rid, rid)
  assert.equal(handle?.href.workspaceAppId, ledger)
  assert.equal(handle?.href.appRid, rid)
  for (const key of ['rowId', 'entity', 'kind', 'slug', 'tab']) {
    assert.equal(Object.hasOwn(handle.href, key), false, key)
  }
  assert.equal(dataViewOfHref(handle.href), 'overview')
  const landed = applyDataLand(emptyDataBrowse(), handle.href)
  assert.equal(landed.view, 'overview')
  assert.equal(landed.workspaceAppId, ledger)
  assert.equal(landed.appRid, rid)
  assert.equal(landed.rowId, '')
  assert.equal(landed.slug, '')

  const app = planAppSource(`app:${ledger}`)
  assert.equal(app?.kind, 'app')
  assert.equal(Object.hasOwn(app.href, 'appRid'), false)
  const cleared = applyDataLand(landed, app.href)
  assert.equal(cleared.appRid, '')
  assert.equal(cleared.workspaceAppId, ledger)
})

test('memory strings and other origins are not plan app sources', () => {
  assert.equal(planAppSource(`app:orders:item:${rid}`), null)
  assert.equal(planAppSource('app:orders'), null)
  assert.equal(planAppSource('im:r1'), null)
  assert.equal(dataViewOfHref({ workspaceAppId: ledger, rowId: rid }), 'records')
  assert.equal(dataViewOfHref({ workspaceAppId: ledger, appRid: rid }), 'overview')
  assert.equal(hrefHasDataLand({ appRid: rid }), false)
  const ledgerHref = originHref(`app:${ledger}:${rid}`)
  assert.equal(ledgerHref.slug, ledger)
  assert.equal(Object.hasOwn(ledgerHref, 'rowId'), false)
  assert.equal(originHref(`app:orders:item:${rid}`).tab, 'records')
})

test('ask fields name the one entity without probing', async () => {
  const fields = await planAskFields(`app:${ledger}:${rid}`, {
    loadApp: async () => ({ spec: orders }),
    probeRow() {
      throw new Error('probed')
    },
  })
  const block = blockFor(fields)
  assert.equal(block.includes('slug：orders'), true)
  assert.equal(block.includes('entity：item'), true)
  assert.equal(block.includes(`rid：${rid}`), true)
  assert.equal(Object.keys(fields).join(','), 'slug,entity,rid')

  const appFields = await planAskFields(`app:${ledger}`, {
    loadApp: async () => ({ spec: orders }),
    probeRow() {
      throw new Error('probed')
    },
  })
  const appBlock = blockFor(appFields)
  assert.equal(appBlock.includes('slug：orders'), true)
  assert.equal(appBlock.includes('rid：'), false)
  assert.equal(appBlock.includes('entity：'), false)
  assert.equal(Object.hasOwn(appFields, 'entity'), false)
  assert.equal(Object.hasOwn(appFields, 'rid'), false)
})

test('ask fields keep a single probed entity', async () => {
  const fields = await planAskFields(`app:${ledger}:${rid}`, {
    loadApp: async () => ({ spec: two }),
    probeRow(_slug, entity) {
      return entity === 'second'
    },
  })
  const block = blockFor(fields)
  assert.equal(block.includes('entity：second'), true)
  assert.equal(block.includes('item'), false)
  assert.equal(Object.keys(fields).join(','), 'slug,entity,rid')
})

test('ask fields drop entity when several rows match', async () => {
  const fields = await planAskFields(`app:${ledger}:${rid}`, {
    loadApp: async () => ({ spec: two }),
    probeRow() {
      return true
    },
  })
  const block = blockFor(fields)
  assert.equal(block.includes('rid：'), true)
  assert.equal(block.includes('entity：'), false)
  assert.equal(Object.hasOwn(fields, 'entity'), false)
})

test('a missing app still names the record id', async () => {
  const fields = await planAskFields(`app:${ledger}:${rid}`, {
    loadApp: async () => null,
    probeRow() {
      throw new Error('probed')
    },
  })
  const block = blockFor(fields)
  assert.equal(block.includes('rid：'), true)
  assert.equal(block.includes('slug：'), false)
  assert.equal(Object.keys(fields).join(','), 'rid')
  assert.equal(await focusEntityFor(null, rid, () => { throw new Error('probed') }), '')
})
