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

  test('translateBizIntent reads where from input', () => {
    const out = translateBizIntent({
      kind: '工单',
      action: '现查',
      input: { where: [{ keys: ['status'], values: ['open'] }] },
    }, '/tmp/ws')
    assert.deepEqual(out.payload.where, [{ keys: ['status'], values: ['open'] }])
  })

  test('translateBizIntent passes through gate action tokens from vocab', () => {
    const out = translateBizIntent({ kind: '采购单', action: '过审', no: 'PO-1' }, '/tmp/ws')
    assert.equal(out.payload.action, '过审')
    assert.equal(out.payload.no, 'PO-1')
  })

  test('translateBizIntent passes where and from hop for 改行 like 现查', () => {
    const where = [{ keys: ['status'], values: ['open'] }]
    const from = { kind: '合同', where: [{ keys: ['status'], values: ['active'], not: true }] }
    const out = translateBizIntent({
      kind: '工单',
      action: 'record.update',
      input: { remark: 'x' },
      where,
      from,
    }, '/tmp/ws')
    assert.equal(out.payload.action, '改行')
    assert.deepEqual(out.payload.where, where)
    assert.deepEqual(out.payload.from, from)
    assert.deepEqual(out.payload.patch, { remark: 'x' })
  })

  test('translateBizIntent passes where for 新建', () => {
    const where = [{ keys: ['category'], values: ['A'] }]
    const out = translateBizIntent({
      kind: '工单',
      action: 'record.create',
      input: { title: 'new' },
      where,
    }, '/tmp/ws')
    assert.equal(out.payload.action, '新建')
    assert.deepEqual(out.payload.where, where)
    assert.deepEqual(out.payload.patch, { title: 'new' })
  })
})
