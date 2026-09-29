import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-pk-title-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)

const customers = [
  { name: 'id', type: 'snowflakeId', interface: 'snowflakeId', title: 'ID', primaryKey: true },
  { name: 'name', type: 'string', interface: 'input', title: '客户名称' },
]
const contacts = [
  { name: 'id', type: 'snowflakeId', interface: 'snowflakeId', title: 'ID', primaryKey: true },
  { name: 'name', type: 'string', interface: 'input', title: '姓名' },
]
const tickets = [
  { name: 'id', type: 'snowflakeId', interface: 'snowflakeId', title: 'ID', primaryKey: true },
  { name: 'title', type: 'string', interface: 'input', title: '工单标题' },
  { name: 'ticketNo', type: 'string', interface: 'input', title: '工单编号' },
  { name: 'customer', type: 'belongsTo', interface: 'm2o', title: '客户' },
  { name: 'contact', type: 'belongsTo', interface: 'm2o', title: '联系人' },
  { name: 'priority', type: 'string', interface: 'select', title: '优先级', enums: { urgent: '紧急', low: '低' } },
  { name: 'status', type: 'string', interface: 'select', title: '工单状态', enums: { processing: '处理中', done: '已解决' } },
]
const collections = [
  { name: 'biz_customers', title: '客户', titleField: 'id', fields: customers },
  { name: 'biz_contacts', title: '联系人', titleField: 'id', fields: contacts },
  { name: 'biz_tickets', title: '工单', titleField: 'id', fields: tickets },
]
const vocab = [
  {
    kind: '客户',
    resource: 'biz_customers',
    can: ['现查', '改行'],
    relations: [{ from: '客户', to: '工单', field: 'customer' }],
  },
  {
    kind: '联系人',
    resource: 'biz_contacts',
    can: ['现查'],
    relations: [{ from: '联系人', to: '工单', field: 'contact' }],
  },
  {
    kind: '工单',
    resource: 'biz_tickets',
    can: ['现查', '改行'],
    relations: [
      { from: '客户', to: '工单', field: 'customer' },
      { from: '联系人', to: '工单', field: 'contact' },
    ],
    clues: [{ say: ['紧急', 'urgent'], keys: ['priority'], values: ['urgent', '紧急'] }],
  },
]
const schemaByKind = { 客户: customers, 联系人: contacts, 工单: tickets }

const customerRows = [
  { no: 'C-YQ', status: 'inactive', fields: { id: '3717', name: '武汉云启电子有限公司', status: 'inactive' } },
  { no: 'C-HC', status: 'active', fields: { id: '8800', name: '武汉汇川网络科技有限公司', status: 'active' } },
]
const contactRows = [
  { no: 'P-1', fields: { id: '19', name: '高娟洋' } },
]
const ticketRows = [
  {
    no: 'TK20251226865',
    status: 'processing',
    fields: {
      id: '371713512177771',
      ticketNo: 'TK20251226865',
      title: '报表错误',
      priority: 'urgent',
      status: 'processing',
      customerId: '3717',
    },
  },
  {
    no: 'TK20250211633',
    status: 'new',
    fields: {
      id: 'other-urgent',
      ticketNo: 'TK20250211633',
      title: '别家故障',
      priority: 'urgent',
      status: 'new',
      customerId: '8800',
    },
  },
  {
    no: 'TK20260417494',
    status: 'closed',
    fields: {
      id: 'low-yq',
      ticketNo: 'TK20260417494',
      title: '报表错误',
      priority: 'low',
      status: 'closed',
      customerId: '3717',
    },
  },
]

function termHit(row, term) {
  const keys = Array.isArray(term.keys) ? term.keys : []
  const values = (Array.isArray(term.values) ? term.values : []).map(String)
  if (!keys.length || !values.length) return true
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  const contains = term.text === true || term.textPass === 'contains'
  const hit = keys.some((key) => {
    const text = String(fields[key] ?? row[key] ?? '')
    return contains
      ? values.some((value) => text.includes(value))
      : values.includes(text)
  })
  return term.not ? !hit : hit
}

function applyWhere(rows, where) {
  if (!Array.isArray(where) || !where.length) return rows
  return rows.filter((row) => where.every((term) => termHit(row, term)))
}

function lookupTodo(spec) {
  const kind = String(spec.kind || '')
  let rows = kind === '客户' ? customerRows : kind === '联系人' ? contactRows : kind === '工单' ? ticketRows : []
  const relatedIds = spec.related && Array.isArray(spec.related.ids) ? spec.related.ids.map(String) : []
  if (relatedIds.length) {
    const field = String(spec.related.field || 'customerId')
    const idSet = new Set(relatedIds)
    const fk = field === 'customer' || field === 'customerId' ? 'customerId' : field
    rows = rows.filter((row) => idSet.has(String(row.fields[fk] || row.fields[field] || row.fields.id || '')))
  }
  rows = applyWhere(rows, spec.where)
  if (!rows.length) return { ok: false, error: 'NOT_FOUND', matches: [] }
  return {
    ok: true,
    matches: rows,
    no: rows.length === 1 ? rows[0].no : '',
    status: rows[0].status,
    fields: rows.length === 1 ? rows[0].fields : {},
  }
}

function gate() {
  return createGate({
    vocab,
    lookupTodo,
    async collectionsOf() { return collections },
    async fieldsOf(kind) { return schemaByKind[kind] || [] },
  })
}

test('empty schema leftover does not filter the target by default name', async () => {
  const speech = '把武汉云启那张紧急工单改成已解决。'
  const seen = []
  const g = createGate({
    vocab,
    lookupTodo(spec) {
      seen.push(spec)
      return lookupTodo(spec)
    },
    async collectionsOf() { return [] },
    async fieldsOf() { return [] },
  })
  const result = await g.preview({
    workspace: '/tmp/empty-schema-ws',
    kind: '工单',
    action: '改行',
    speech,
    userSpeech: speech,
    patch: { status: 'done' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'NO_IDENTITY')
  assert.equal(seen.length, 0)
  const speak = String(result.hint || result.speak || '')
  assert.equal(speak.includes('name'), false)
  assert.equal(speak.includes('这一列'), false)
})

test('pk titleField leftover shop name previews the related urgent ticket', async () => {
  const speech = '把武汉云启那张紧急工单改成已解决。'
  const result = await gate().preview({
    workspace: '/tmp/pk-title-ws',
    kind: '工单',
    action: '改行',
    speech,
    userSpeech: speech,
    from: {
      kind: '客户',
      where: [{ keys: ['name'], values: ['武汉云启'], text: true, textPass: 'contains' }],
    },
    where: [{ keys: ['priority'], values: ['urgent'] }],
    patch: { status: 'done' },
  })
  const sheet = result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(result.ok, true)
  assert.equal(sheet.kind, '工单')
  assert.equal(sheet.action, '改行')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].no, 'TK20251226865')
  assert.notEqual(String(sheet.speak || ''), '')
  assert.equal(String(sheet.speak || '').includes('对不上'), false)
  assert.ok(result.preview_id || sheet.preview_id)
})
