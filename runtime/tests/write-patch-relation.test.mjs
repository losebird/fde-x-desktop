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
  bindWhereRelationTerms,
} = await import(pathToFileURL(join(staged, 'relation-bind.js')).href)

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
      extra: { collections: [] },
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
    { schemaFields: ticketFields, conn: { baseUrl: 'http://nb.local', token: 't' }, fetchImpl, extra: {} },
  )
  assert.equal(byName.customerId, '16')
  assert.equal(byName.customer, undefined)

  const byCode = await shapePatch(
    { customer: 'CUST-016' },
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    { schemaFields: ticketFields, conn: { baseUrl: 'http://nb.local', token: 't' }, fetchImpl, extra: {} },
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
      extra: { collections: [] },
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
    { conn: { baseUrl: 'http://nb.local', token: 't' }, fetchImpl, extra: {} },
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
