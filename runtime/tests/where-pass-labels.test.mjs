import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bindWhereKeys,
  fieldLabelMap,
  identityNameRestFilter,
  schemaObjectNameKeys,
  isObjectNameKey,
  resolveShapeKey,
  rowsMatchingWhere,
  termFilterPart,
} from '../vendor-overlays/dsh-lan-assist/where-pass.js'

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

  test('identity name values that are not tickets use contains', () => {
    const part = termFilterPart({ keys: ['名称', 'name'], values: ['显示模组'], not: false }, '2026-01-01')
    assert.deepEqual(part, { name: { $includes: '显示模组' } })
  })

  test('ticket-like name values stay exact', () => {
    const part = termFilterPart({ keys: ['name'], values: ['P1300'], not: false }, '2026-01-01')
    assert.deepEqual(part, { name: 'P1300' })
  })

  test('名称-only keys still contain-match name and title', () => {
    const part = termFilterPart({ keys: ['名称'], values: ['显示模组'], not: false }, '2026-01-01')
    assert.deepEqual(part, {
      $or: [
        { name: { $includes: '显示模组' } },
        { title: { $includes: '显示模组' } },
      ],
    })
  })

  test('relation title 名称 nests contains on related name', () => {
    const schema = [{ name: 'product', title: '商品名称', interface: 'm2o', target: 'products' }]
    const part = termFilterPart({ keys: ['product'], values: ['显示模组'], not: false }, '2026-01-01', schema)
    assert.ok(part.product)
    assert.ok(part.product.$or)
    assert.equal(part.product.$or.some((row) => row.name && row.name.$includes === '显示模组'), true)
  })

  test('rowsMatchingWhere contains a name suffix', () => {
    const rows = [{ name: '显示模组-II81' }, { name: '其他' }]
    const hit = rowsMatchingWhere(rows, [{ keys: ['name'], values: ['显示模组'] }], [])
    assert.equal(hit.length, 1)
    assert.equal(hit[0].name, '显示模组-II81')
  })

  test('Chinese 商品名称 key resolves to the related display field', () => {
    const schema = [{ name: 'product', title: '商品名称', interface: 'm2o', target: 'products' }]
    const part = termFilterPart({ keys: ['商品名称'], values: ['显示模组'], not: false }, '2026-01-01', schema)
    assert.ok(part.product)
    assert.equal(part.product.$or.some((row) => row.name && row.name.$includes === '显示模组'), true)
  })

  test('name and related 名称 keys OR together', () => {
    const schema = [
      { name: 'name', title: '名称' },
      { name: 'product', title: '商品名称', interface: 'm2o', target: 'products' },
    ]
    const part = termFilterPart({ keys: ['name', 'product'], values: ['显示模组'], not: false }, '2026-01-01', schema)
    assert.ok(part.$or)
    assert.equal(part.$or.some((row) => row.name && row.name.$includes === '显示模组'), true)
    assert.equal(part.$or.some((row) => row.product && row.product.$or), true)
  })

  test('rowsMatchingWhere contains a related display name suffix', () => {
    const schema = [{ name: 'product', title: '商品名称', interface: 'm2o' }]
    const rows = [
      { product: { name: '显示模组-II81' } },
      { product: { name: '其他' } },
    ]
    const hit = rowsMatchingWhere(rows, [{ keys: ['product'], values: ['显示模组'] }], schema)
    assert.equal(hit.length, 1)
    assert.equal(hit[0].product.name, '显示模组-II81')
  })

  test('title is not an object name key', () => {
    const schema = [{ name: 'title', title: '标题', interface: 'input' }]
    assert.deepEqual(schemaObjectNameKeys(schema), [])
  })

  test('object name keys include 姓名 and collection titleField', () => {
    const schema = [{ name: 'fullName', title: '姓名' }]
    assert.equal(isObjectNameKey('fullName', schema), true)
    assert.deepEqual(schemaObjectNameKeys(schema), ['fullName'])
    const titled = [{ name: 'displayName', title: '显示' }]
    assert.deepEqual(schemaObjectNameKeys(titled, { titleField: 'displayName' }), ['displayName'])
    assert.deepEqual(schemaObjectNameKeys([{ name: 'title', title: '标题' }], { titleField: 'title' }), [])
  })

  test('collection titleField that is the primary key is not an object name', () => {
    const tickets = [
      { name: 'id', type: 'snowflakeId', interface: 'snowflakeId', title: 'ID', primaryKey: true },
      { name: 'title', type: 'string', interface: 'input', title: '工单标题' },
      { name: 'ticketNo', type: 'string', interface: 'input', title: '工单编号' },
    ]
    assert.equal(isObjectNameKey('id', tickets, { titleField: 'id' }), false)
    assert.deepEqual(schemaObjectNameKeys(tickets, { titleField: 'id' }), [])

    const customers = [
      { name: 'id', type: 'snowflakeId', interface: 'snowflakeId', title: 'ID', primaryKey: true },
      { name: 'name', type: 'string', interface: 'input', title: '客户名称' },
    ]
    assert.deepEqual(schemaObjectNameKeys(customers, { titleField: 'id' }), ['name'])
  })

  test('identityNameRestFilter nests related 名称', () => {
    const schema = [{ name: 'product', title: '商品名称', interface: 'm2o' }]
    const part = identityNameRestFilter('显示模组', schema)
    assert.ok(part.product)
    assert.equal(part.product.$or.some((row) => row.name && row.name.$includes === '显示模组'), true)
  })
})
