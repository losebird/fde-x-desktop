import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearBizPreviewDismissed,
  dismissShouldClearHall,
  hallPreviewIdFromState,
  isBizPreviewDismissed,
  rememberBizPreviewDismissed,
  sheetAfterDismissedWrite,
} from '../biz/dismissed-previews.mjs'
import { sheetPayloadFromRaw } from '../biz/sheet-payload.mjs'

test('dismissed preview ids suppress re-emit eligibility', () => {
  const id = 'pv_test1234'
  clearBizPreviewDismissed(id)
  assert.equal(isBizPreviewDismissed(id), false)
  rememberBizPreviewDismissed(id)
  assert.equal(isBizPreviewDismissed(id), true)
  clearBizPreviewDismissed(id)
  assert.equal(isBizPreviewDismissed(id), false)
})

test('sheetPayloadFromRaw keeps changes array for preview diff', () => {
  const sheet = sheetPayloadFromRaw({
    kind: '示例型',
    action: '改行',
    preview_id: 'pv_abcd1234',
    rows: [{ no: '1', fields: { title: 'a' } }],
    columns: [{ key: 'title', label: '标题' }],
    changes: [{ field: 'title', label: '标题', from: '旧', to: '新' }],
  })
  assert.ok(sheet)
  assert.equal(sheet.changes.length, 1)
  assert.equal(sheet.changes[0].field, 'title')
})

test('sheetPayloadFromRaw keeps speech, nested from, and hop steps', () => {
  const sheet = sheetPayloadFromRaw({
    kind: 'ChildC',
    action: '现查',
    rows: [{ no: '1' }],
    columns: [],
    speech: 'ParentA MidB ChildC',
    from: { kind: 'ParentA', from: { kind: 'MidB' } },
    hopWhere: [{ keys: ['status'], values: ['pending'] }],
    steps: [{ kind: 'ParentA' }, { kind: 'MidB' }, { kind: 'ChildC' }],
  })
  assert.ok(sheet)
  assert.equal(sheet.speech, 'ParentA MidB ChildC')
  assert.equal(sheet.from.kind, 'ParentA')
  assert.equal(sheet.from.from.kind, 'MidB')
  assert.equal(sheet.steps.length, 3)
  assert.equal(sheet.hopWhere.length, 1)
})

test('sheetPayloadFromRaw keeps each unbound peer hit and does not add a relation', () => {
  const sheet = sheetPayloadFromRaw({
    kind: '甲',
    action: '现查',
    rows: [{ no: 'A1' }],
    columns: [{ key: 'status', label: '状态', enums: { x: '筛' } }],
    where: [{ keys: ['status'], values: ['x'] }],
    speech: '甲并且乙，筛',
    hitTotalState: 'known',
    hitTotal: 3,
    peers: [{
      kind: '乙',
      action: '现查',
      rows: [{ no: 'B1', fields: { status: '筛' } }],
      columns: [{ key: 'status', label: '状态', enums: { y: '筛' } }],
      where: [{ keys: ['status'], values: ['y'] }],
      querySettled: true,
      hitTotalState: 'known',
      hitTotal: 5,
      from: { kind: '不该出现' },
      steps: [{ kind: '不该出现' }],
      canWrite: true,
    }],
  })
  assert.ok(sheet)
  assert.equal(sheet.from, undefined)
  assert.equal(sheet.steps, undefined)
  assert.equal(sheet.peers.length, 1)
  assert.equal(sheet.peers[0].kind, '乙')
  assert.equal(sheet.peers[0].hitTotal, 5)
  assert.equal(sheet.peers[0].rows[0].no, 'B1')
  assert.deepEqual(sheet.peers[0].where, [{ keys: ['status'], values: ['y'] }])
  assert.equal(sheet.peers[0].from, undefined)
  assert.equal(sheet.peers[0].steps, undefined)
  assert.equal(sheet.peers[0].canWrite, undefined)
  const again = sheetPayloadFromRaw(sheet)
  assert.equal(again.peers[0].hitTotal, 5)
  assert.equal(again.peers[0].from, undefined)
})

test('dismiss does not clear hall when a newer preview already replaced the token', () => {
  assert.equal(dismissShouldClearHall('pv_new', 'pv_old'), false)
  assert.equal(dismissShouldClearHall('pv_old', 'pv_old'), true)
  assert.equal(dismissShouldClearHall('', 'pv_old'), false)
  assert.equal(dismissShouldClearHall('pv_live', ''), false)
  assert.equal(
    hallPreviewIdFromState({
      pendingSheet: { action: '删除', preview_id: 'pv_del' },
      pendingWrite: { preview_id: 'pv_old' },
    }),
    'pv_del',
  )
})

test('dismissed write token still exposes remainRows list, not null', () => {
  const id = 'pv_write_remain'
  clearBizPreviewDismissed(id)
  rememberBizPreviewDismissed(id)
  const out = sheetAfterDismissedWrite({
    kind: 'ListKind',
    action: '改行',
    preview_id: id,
    rows: [{ no: 'ONE' }],
    remainRows: [{ no: 'A' }, { no: 'B' }],
    speech: 'list speech',
  })
  assert.ok(out)
  assert.equal(out.action, '现查')
  assert.equal(out.preview_id, '')
  assert.equal(out.rows.length, 2)
  assert.equal(out.speech, 'list speech')
  clearBizPreviewDismissed(id)
})

test('dismissed write of the same row count still exposes remainRows', () => {
  const id = 'pv_write_same_n'
  clearBizPreviewDismissed(id)
  rememberBizPreviewDismissed(id)
  const remain = [{ no: 'A' }, { no: 'B' }]
  const out = sheetAfterDismissedWrite({
    kind: 'ListKind',
    action: '改行',
    preview_id: id,
    rows: remain.slice(),
    remainRows: remain,
    speech: 'list speech',
    hopWhere: [{ keys: ['status'], values: ['open'] }],
  })
  assert.ok(out)
  assert.equal(out.action, '现查')
  assert.equal(out.preview_id, '')
  assert.equal(out.rows.length, 2)
  assert.equal(out.speech, 'list speech')
  clearBizPreviewDismissed(id)
})
