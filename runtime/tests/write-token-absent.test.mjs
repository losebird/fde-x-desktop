import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldOpenWriteConfirm, writeTokenStatus } from '../../src/lib/write-confirm.ts'

test('a history write sheet without a token does not open the drawer', () => {
  const sheet = {
    kind: '费用报销',
    action: '改行',
    preview_id: 'pv-history',
    canWrite: true,
    rows: [{ no: '1', fields: { remarks: '项目出差' } }],
    changes: [{ field: 'remarks', from: '项目出差', to: '项目出差（取消验）' }],
  }
  assert.equal(writeTokenStatus(sheet), 'absent')
  assert.equal(shouldOpenWriteConfirm(sheet, { dismissed: false, hasChanges: true, alreadyAtTarget: false }), false)
})

test('an open write token still opens the drawer', () => {
  const sheet = {
    kind: '费用报销',
    action: '改行',
    preview_id: 'pv-live',
    writeToken: 'open',
    canWrite: true,
    rows: [{ no: '1', fields: { remarks: '项目出差' } }],
    changes: [{ field: 'remarks', from: '项目出差', to: '项目出差（取消验）' }],
  }
  assert.equal(writeTokenStatus(sheet), 'live')
  assert.equal(shouldOpenWriteConfirm(sheet, { dismissed: false, hasChanges: true, alreadyAtTarget: false }), true)
  assert.equal(writeTokenStatus(sheet, { 'pv-live': 'open' }), 'live')
})
