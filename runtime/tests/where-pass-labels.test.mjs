import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { bindWhereKeys, fieldLabelMap, resolveShapeKey, termFilterPart } from '../vendor-overlays/dsh-lan-assist/where-pass.js'

describe('where-pass field label binding', () => {
  const vocab = [{
    kind: '工单',
    ticketField: 'ticketNo',
    fields: ['ticketNo', '单号', '状态'],
  }]

  test('resolveShapeKey maps ui title from schema', () => {
    const schema = [{ name: 'status', title: '状态' }]
    assert.equal(resolveShapeKey('状态', schema, vocab[0]), 'status')
  })

  test('resolveShapeKey maps stored fieldLabels when schema titles missing', () => {
    const schema = [
      { name: 'ticketNo', title: '' },
      { name: 'status', title: '', enums: { processing: '处理中' } },
    ]
    const row = {
      ...vocab[0],
      fieldLabels: { '单号': 'ticketNo', '状态': 'status' },
    }
    const map = fieldLabelMap(row, schema)
    assert.equal(map['状态'], 'status')
    assert.equal(resolveShapeKey('状态', schema, row), 'status')
  })

  test('bindWhereKeys infers enum field for Chinese label without titles', () => {
    const schema = [
      { name: 'ticketNo', title: '' },
      { name: 'title', title: '' },
      { name: 'status', title: '', enums: { processing: '处理中' } },
    ]
    const term = { keys: ['状态'], values: ['processing'], not: false }
    const bound = bindWhereKeys([term], '工单', vocab, schema)
    assert.deepEqual(bound, [{ keys: ['status'], values: ['processing'], not: false }])
  })

  test('bindWhereKeys resolves keys on normalized clue terms with empty date slots', () => {
    const schema = [
      { name: 'status', title: '工单状态', enums: { processing: '处理中' } },
    ]
    const term = {
      keys: ['状态'],
      values: ['processing'],
      not: false,
      dateBefore: [],
      dateAfter: [],
    }
    const bound = bindWhereKeys([term], '工单', vocab, schema)
    assert.deepEqual(bound, [{ ...term, keys: ['status'] }])
  })

  test('bindWhereKeys maps shape 状态 to status when connector title is 工单状态', () => {
    const schema = [
      { name: 'ticketNo', title: '单号' },
      { name: 'category', title: '工单类型', enums: { incident: '故障' } },
      { name: 'priority', title: '优先级', enums: { high: '高' } },
      { name: 'status', title: '工单状态', enums: { processing: '处理中' } },
    ]
    const term = { keys: ['状态'], values: ['processing'], not: false }
    const bound = bindWhereKeys([term], '工单', vocab, schema)
    assert.deepEqual(bound, [{ keys: ['status'], values: ['processing'], not: false }])
  })

  test('bindWhereKeys resolves Chinese field via raw collection titles', () => {
    const schema = [
      { name: 'ticketNo', title: '' },
      { name: 'status', title: '', enums: { processing: '处理中' } },
    ]
    const rawLabels = { '单号': 'ticketNo', '状态': 'status' }
    const term = { keys: ['状态'], values: ['processing'], not: false }
    const bound = bindWhereKeys([term], '工单', vocab, schema, rawLabels)
    assert.deepEqual(bound, [{ keys: ['status'], values: ['processing'], not: false }])
  })

  test('termFilterPart ORs the same value across multiple field keys', () => {
    const part = termFilterPart({ keys: ['bizType', 'refType'], values: ['生产领料'], not: false }, '2026-01-01')
    assert.deepEqual(part, {
      $or: [{ bizType: '生产领料' }, { refType: '生产领料' }],
    })
  })
})
