import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-name-id-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)

const NAME = '通达'
const vocab = [
  {
    kind: '客户',
    resource: 'biz_customers',
    can: ['现查', '改行'],
    clues: [{ say: ['停用', 'inactive'], keys: ['status'], values: ['inactive', '停用'] }],
  },
]

const catalog = [
  { no: 'C-1', status: 'inactive', fields: { id: '1', status: 'inactive', name: `${NAME}甲`, code: 'C-1' } },
  { no: 'C-2', status: 'inactive', fields: { id: '2', status: 'inactive', name: `${NAME}乙`, code: 'C-2' } },
  { no: 'C-3', status: 'inactive', fields: { id: '3', status: 'inactive', name: '别家停用', code: 'C-3' } },
  { no: 'C-4', status: 'active', fields: { id: '4', status: 'active', name: `${NAME}丙`, code: 'C-4' } },
  ...Array.from({ length: 12 }, (_, i) => ({
    no: `C-X${i}`,
    status: 'active',
    fields: { id: `x${i}`, status: 'active', name: `目录${i}`, code: `C-X${i}` },
  })),
]

function termHit(row, term) {
  const keys = Array.isArray(term.keys) ? term.keys : []
  const values = (Array.isArray(term.values) ? term.values : []).map(String)
  if (!keys.length || !values.length) return true
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  const hit = keys.some((key) => values.includes(String(fields[key] ?? row[key] ?? '')))
  return term.not ? !hit : hit
}

function applyWhere(rows, where) {
  if (!Array.isArray(where) || !where.length) return rows
  return rows.filter((row) => where.every((term) => termHit(row, term)))
}

function lookupTodo(spec) {
  let rows = catalog.slice()
  rows = applyWhere(rows, spec.where)
  const look = String(spec.no || '').trim()
  if (look) {
    const needle = look.toLowerCase()
    rows = rows.filter((row) => {
      const fields = row.fields || {}
      return [row.no, fields.name, fields.code].some((item) => String(item || '').toLowerCase().includes(needle))
    })
  }
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
    async fieldsOf() {
      return [
        { name: 'status', title: '客户状态', enums: { inactive: '停用', active: '成交' } },
        { name: 'name', title: '客户名称' },
      ]
    },
  })
}

function sheetOf(result) {
  return result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
}

test('停用 ∩ spoken name is a write preview of the match set, not the customer catalog', async () => {
  const speech = `把停用客户${NAME}改成成交。只要预览，不要过账，不要 biz_write。`
  const result = await gate().preview({
    workspace: '/tmp/name-id-ws',
    kind: '客户',
    action: '改行',
    speech,
    patch: { status: 'active' },
  })
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  const nos = rows.map((row) => String(row.no || ''))
  assert.equal(result.ok, true)
  assert.equal(sheet.kind, '客户')
  assert.equal(sheet.action, '改行')
  assert.equal(rows.length, 2)
  assert.deepEqual(nos.sort(), ['C-1', 'C-2'])
  assert.ok(rows.length < catalog.length)
  assert.ok(String(result.preview_id || sheet.preview_id || '').startsWith('pv_'))
  const changes = Array.isArray(sheet.changes) ? sheet.changes : []
  assert.ok(changes.some((row) => row && row.field === 'status' && String(row.from) !== String(row.to)))
})

test('model 现查 still issues a 改行 preview when speech has a rewrite', async () => {
  const speech = `把停用客户${NAME}改成成交。只要预览，不要过账，不要 biz_write。`
  const result = await gate().preview({
    workspace: '/tmp/name-id-ws',
    kind: '客户',
    action: '现查',
    speech,
    userSpeech: speech,
  })
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(sheet.action, '改行')
  assert.equal(rows.length, 2)
  assert.ok(String(result.preview_id || sheet.preview_id || '').startsWith('pv_'))
  const changes = Array.isArray(sheet.changes) ? sheet.changes : []
  assert.ok(changes.some((row) => row && row.field === 'status' && String(row.from) !== String(row.to)))
})


test('write without identity does not dump the catalog as a preview sheet', async () => {
  const result = await gate().preview({
    workspace: '/tmp/name-id-ws',
    kind: '客户',
    action: '改行',
    speech: '改客户。',
    patch: { status: 'active' },
  })
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(rows.length, 0)
  assert.ok(!result.preview_id && !sheet.preview_id)
  assert.notEqual(result.error, undefined)
})
