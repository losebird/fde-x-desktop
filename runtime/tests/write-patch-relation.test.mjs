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

const ticketFields = [
  { name: 'title', title: '工单标题' },
  { name: 'assignee', title: '处理人', interface: 'm2o', target: 'users' },
  { name: 'priority', title: '优先级', interface: 'select', enums: { high: '高' } },
]

test('relationSchemaField picks m2o assignee', () => {
  const hit = relationSchemaField(ticketFields, 'assignee')
  assert.equal(hit && hit.target, 'users')
})

test('shapePatch resolves spoken assignee to assigneeId via users list', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    return {
      ok: true,
      json: async () => ({ data: [{ id: 42, username: 'acee', nickname: 'acee' }] }),
    }
  }
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
  assert.match(calls[0], /users:list/)
  assert.match(calls[0], /acee/)
})

test('shapePatch does not pass spoken assignee through when lookup misses', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ data: [] }),
  })
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
