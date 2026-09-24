import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-patch-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { shapePatch, relationSchemaField } = await import(pathToFileURL(join(staged, 'write.js')).href)
const {
  approveNextStatusCode,
  bindSpokenCells,
  bindWhereRelationTerms,
  spokenMatchColumns,
} = await import(pathToFileURL(join(staged, 'relation-bind.js')).href)

const userCollection = {
  name: 'users',
  fields: [
    { name: 'username', interface: 'input' },
    { name: 'nickname', interface: 'input' },
    { name: 'email', interface: 'email' },
    { name: 'phone', interface: 'phone' },
  ],
}
const customerCollection = {
  name: 'biz_customers',
  fields: [
    { name: 'name', interface: 'input' },
    { name: 'code', interface: 'input' },
  ],
}

const ticketFields = [
  { name: 'title', title: '工单标题' },
  { name: 'customer', title: '客户', interface: 'm2o', target: 'biz_customers' },
  { name: 'assignee', title: '处理人', interface: 'm2o', target: 'users' },
  { name: 'priority', title: '优先级', interface: 'select', enums: { high: '高' } },
  { name: 'status', title: '工单状态', interface: 'select', enums: { pending: '待处理', approved: '已通过', resolved: '已解决' } },
]

function mockFetch(handlers) {
  return async (url) => {
    for (const [needle, data] of handlers) {
      if (String(url).includes(needle)) {
        return { ok: true, json: async () => ({ data }) }
      }
    }
    return { ok: true, json: async () => ({ data: [] }) }
  }
}

test('relationSchemaField picks m2o assignee', () => {
  const hit = relationSchemaField(ticketFields, 'assignee')
  assert.equal(hit && hit.target, 'users')
})

test('shapePatch resolves spoken assignee to assigneeId via users list', async () => {
  const fetchImpl = mockFetch([
    ['users:list', [{ id: 42, username: 'acee', nickname: 'acee' }]],
  ])
  const shaped = await shapePatch(
    { assignee: 'acee', title: '测试新增功能' },
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    {
      schemaFields: ticketFields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl,
      extra: { collections: [userCollection] },
    },
  )
  assert.equal(shaped.assigneeId, '42')
  assert.equal(shaped.assignee, undefined)
  assert.equal(shaped.title, '测试新增功能')
})

test('shapePatch resolves customer company name and code to customerId', async () => {
  const fetchImpl = mockFetch([
    ['biz_customers:list', [{ id: 16, name: '南京智航交通科技有限公司', code: 'CUST-016' }]],
  ])
  const byName = await shapePatch(
    { customer: '南京智航交通科技有限公司' },
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    { schemaFields: ticketFields, conn: { baseUrl: 'http://nb.local', token: 't' }, fetchImpl, extra: { collections: [customerCollection] } },
  )
  assert.equal(byName.customerId, '16')
  assert.equal(byName.customer, undefined)

  const byCode = await shapePatch(
    { customer: 'CUST-016' },
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    { schemaFields: ticketFields, conn: { baseUrl: 'http://nb.local', token: 't' }, fetchImpl, extra: { collections: [customerCollection] } },
  )
  assert.equal(byCode.customerId, '16')
})

test('shapePatch does not pass spoken assignee through when lookup misses', async () => {
  const fetchImpl = mockFetch([])
  const shaped = await shapePatch(
    { assignee: 'zxz' },
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    {
      schemaFields: ticketFields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl,
      extra: { collections: [userCollection] },
    },
  )
  assert.equal(shaped.assignee, undefined)
  assert.equal(shaped.assigneeId, undefined)
})

test('bindWhereRelationTerms resolves customer name on where keys', async () => {
  const fetchImpl = mockFetch([
    ['biz_customers:list', [{ id: 99, name: '恒通', code: 'CUST-HT' }]],
  ])
  const terms = await bindWhereRelationTerms(
    [{ keys: ['customer'], values: ['恒通'] }],
    ticketFields,
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    { conn: { baseUrl: 'http://nb.local', token: 't' }, fetchImpl, extra: { collections: [customerCollection] } },
    null,
    {},
  )
  assert.equal(terms[0].values[0], '99')
})

test('approveNextStatusCode uses schema enum not 已过 literal', () => {
  const vocab = [{ clues: [{ say: ['已过审'], keys: ['status'], values: ['approved', 'posted'] }] }]
  const code = approveNextStatusCode(ticketFields, vocab, 'pending')
  assert.equal(code, 'approved')
  assert.notEqual(code, '已过')
})

test('spoken match columns come from the target schema only', () => {
  assert.deepEqual(spokenMatchColumns(userCollection.fields), ['username', 'nickname', 'email', 'phone'])
  assert.deepEqual(spokenMatchColumns([
    { name: 'id' },
    { name: 'nickname', interface: 'input' },
    { name: 'createdAt', interface: 'datetime' },
    { name: 'boss', interface: 'm2o', target: 'users' },
  ]), ['nickname'])
})

test('$or uses only columns that exist on the target schema', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(String(url))
    return { ok: true, json: async () => ({ data: [], meta: { count: 0 } }) }
  }
  const nickOnly = {
    name: 'people',
    fields: [{ name: 'nickname', interface: 'input' }],
  }
  const fields = [
    { name: 'owner', title: '负责人', interface: 'm2o', target: 'people', foreignKey: 'ownerId' },
    { name: 'title', title: '标题' },
  ]
  await bindSpokenCells(
    { owner: 'ace', title: '一句' },
    fields,
    { kind: '单', mapped: { resource: 'things' } },
    {
      schemaFields: fields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl,
      extra: { collections: [nickOnly] },
    },
  )
  assert.ok(calls.length >= 1)
  for (const url of calls) {
    const filter = decodeURIComponent(String(url).split('filter=')[1] || '')
    assert.equal(filter.includes('"name"'), false)
    assert.equal(filter.includes('"title"'), false)
    assert.equal(filter.includes('"code"'), false)
    assert.equal(filter.includes('nickname'), true)
  }
})

test('relation binds only a unique row and shows that row, not the spoken phrase', async () => {
  const fetchImpl = async (url) => {
    const filter = decodeURIComponent(String(url).split('filter=')[1] || '')
    if (filter.includes('$includes')) {
      return {
        ok: true,
        json: async () => ({ data: [{ id: 7, nickname: 'Ace Admin', username: 'admin' }], meta: { count: 1 } }),
      }
    }
    return { ok: true, json: async () => ({ data: [], meta: { count: 0 } }) }
  }
  const bound = await bindSpokenCells(
    { 处理人: 'ace', title: '这句话' },
    ticketFields,
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    {
      schemaFields: ticketFields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl,
      extra: { collections: [userCollection] },
    },
  )
  assert.equal(bound.writePatch.assigneeId, '7')
  assert.equal(bound.writePatch.title, '这句话')
  assert.equal(bound.displayPatch.assignee, 'Ace Admin')
  assert.equal(bound.displayPatch.title, '这句话')
  assert.equal(bound.blockConfirm, false)
  const relation = bound.cells.find((cell) => cell.key === 'assignee')
  assert.equal(relation.bound, true)
  assert.equal(relation.display, 'Ace Admin')
})

test('nullable relation miss stays visible and does not block the other fields', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: [], meta: { count: 0 } }) })
  const bound = await bindSpokenCells(
    { assignee: 'nobody', title: '留下' },
    ticketFields,
    { kind: '工单' },
    {
      schemaFields: ticketFields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl,
      extra: { collections: [userCollection] },
    },
  )
  assert.equal(bound.writePatch.assigneeId, undefined)
  assert.equal(bound.writePatch.title, '留下')
  assert.equal(bound.blockConfirm, false)
  const relation = bound.cells.find((cell) => cell.key === 'assignee')
  assert.equal(relation.bound, false)
  assert.equal(relation.hint, '这一格对不上')
})

test('required relation miss blocks confirm and many matches are not guessed', async () => {
  const requiredFields = ticketFields.map((row) => (
    row.name === 'assignee' ? { ...row, required: true } : row
  ))
  const miss = await bindSpokenCells(
    { assignee: 'nobody', title: '留下' },
    requiredFields,
    { kind: '工单' },
    {
      schemaFields: requiredFields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl: async () => ({ ok: true, json: async () => ({ data: [], meta: { count: 0 } }) }),
      extra: { collections: [userCollection] },
    },
  )
  assert.equal(miss.blockConfirm, true)
  assert.equal(miss.writePatch.title, '留下')
  assert.equal(miss.writePatch.assigneeId, undefined)

  const many = await bindSpokenCells(
    { assignee: 'sam' },
    ticketFields,
    { kind: '工单' },
    {
      schemaFields: ticketFields,
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          data: [{ id: 1, nickname: 'Sam A' }, { id: 2, nickname: 'Sam B' }],
          meta: { count: 2 },
        }),
      }),
      extra: { collections: [userCollection] },
    },
  )
  assert.equal(many.blockConfirm, true)
  assert.equal(many.writePatch.assigneeId, undefined)
  const cell = many.cells.find((row) => row.key === 'assignee')
  assert.equal(cell.picks.length, 2)
})

test('enum binds one schema option and stops on zero', async () => {
  const unique = await bindSpokenCells(
    { 优先级: '高', title: '一句' },
    ticketFields,
    { kind: '工单' },
    { schemaFields: ticketFields },
  )
  assert.equal(unique.writePatch.priority, 'high')
  assert.equal(unique.displayPatch.priority, '高')
  assert.equal(unique.blockConfirm, false)

  const missed = await bindSpokenCells(
    { priority: '紧急' },
    ticketFields,
    { kind: '工单' },
    { schemaFields: ticketFields },
  )
  assert.equal(missed.blockConfirm, true)
  assert.equal(missed.writePatch.priority, undefined)
  assert.equal(missed.cells[0].bound, false)
})

test('a key that is not a schema cell is not dropped into an empty write', async () => {
  const bound = await bindSpokenCells(
    { 负责人: 'ace', title: '留下' },
    ticketFields,
    { kind: '工单' },
    { schemaFields: ticketFields },
  )
  assert.equal(bound.blockConfirm, true)
  assert.equal(bound.writePatch.title, '留下')
  assert.equal(Object.values(bound.writePatch).includes('ace'), false)
  const lost = bound.cells.find((cell) => cell.mode === 'unplaced')
  assert.ok(lost)
  assert.equal(lost.bound, false)
})
