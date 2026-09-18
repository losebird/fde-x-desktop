import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearBizPreviewDismissed,
  dismissShouldClearHall,
  hallPreviewIdFromState,
  isBizPreviewDismissed,
  rememberBizPreviewDismissed,
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

test('dismiss does not clear hall when a newer preview already replaced the token', () => {
  assert.equal(dismissShouldClearHall('pv_new', 'pv_old'), false)
  assert.equal(dismissShouldClearHall('pv_old', 'pv_old'), true)
  assert.equal(dismissShouldClearHall('', 'pv_old'), true)
  assert.equal(dismissShouldClearHall('pv_live', ''), true)
  assert.equal(
    hallPreviewIdFromState({
      pendingSheet: { action: '删除', preview_id: 'pv_del' },
      pendingWrite: { preview_id: 'pv_old' },
    }),
    'pv_del',
  )
})
