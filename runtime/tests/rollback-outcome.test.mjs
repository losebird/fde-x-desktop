import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { rollbackBadgeFromAudit } from '../biz/rollback-outcome.mjs'

describe('rollback badge', () => {
  test('rollback write action is never can', () => {
    const changes = [{ field: 'status', from: 'b', to: 'a' }]
    assert.equal(rollbackBadgeFromAudit('回退', changes, 'none'), 'none')
  })

  test('rolled_back state wins over 改行 changes', () => {
    const changes = [{ field: 'status', from: 'b', to: 'a' }]
    assert.equal(rollbackBadgeFromAudit('改行', changes, 'rolled_back'), 'rolled_back')
  })
})
