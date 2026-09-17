import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePreviewWhere } from '../biz/where.mjs'
import { translateBizIntent } from '../routes/biz.mjs'

describe('biz preview where pass-through', () => {
  test('normalizePreviewWhere keeps gate-native terms', () => {
    const where = [
      { keys: ['status'], values: ['open'] },
      { dateAfter: ['createdAt'], values: ['2026-01-01'] },
      { dateBefore: ['createdAt'], values: ['2027-01-01'] },
    ]
    assert.deepEqual(normalizePreviewWhere(where), where)
  })

  test('normalizePreviewWhere converts briefing field/op/value aliases', () => {
    assert.deepEqual(
      normalizePreviewWhere([{ field: 'status', op: 'eq', value: 'open' }]),
      [{ keys: ['status'], values: ['open'], not: false }],
    )
    assert.deepEqual(
      normalizePreviewWhere([{ field: 'createdAt', op: 'gte', value: '2026-01-01' }]),
      [{ dateAfter: ['createdAt'], values: ['2026-01-01'] }],
    )
  })

  test('translateBizIntent passes normalized where for 现查', () => {
    const out = translateBizIntent({
      kind: '工单',
      action: 'record.read',
      where: [{ field: '日期', op: 'gte', value: '2026' }],
    }, '/tmp/ws')
    assert.equal(out.payload.action, '现查')
    assert.deepEqual(out.payload.where, [{ dateAfter: ['日期'], values: ['2026'] }])
  })

  test('translateBizIntent passes through gate action tokens from vocab', () => {
    const out = translateBizIntent({ kind: '采购单', action: '过审', no: 'PO-1' }, '/tmp/ws')
    assert.equal(out.payload.action, '过审')
    assert.equal(out.payload.no, 'PO-1')
  })
})
