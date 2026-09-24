import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'
import { matchedWriteIdentity } from '../vendor-overlays/dsh-lan-assist/lookup.js'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-lookup-key-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate, createNocoWrite } = await import(pathToFileURL(join(staged, 'write.js')).href)

const PK = '388468591099904'
const CODE = 'AB1001'
const schema = [
  { name: 'id', interface: 'snowflakeId', title: '主键' },
  { name: 'code', interface: 'input', title: '编号' },
  { name: 'title', interface: 'input', title: '标题' },
  { name: 'status', interface: 'select', title: '状态' },
]
const mapped = { resource: 'biz_rows', fields: ['code', 'title', 'status'] }
const vocab = [{
  kind: '样例',
  resource: 'biz_rows',
  can: ['现查', '改行', '删除', '过审', '新建'],
  fields: ['code', 'title', 'status'],
}]
const collections = [{ name: 'biz_rows', title: '样例', fields: schema }]

function filterOf(url) {
  const raw = String(url).split('filter=')[1] || ''
  assert.ok(raw, String(url))
  return JSON.parse(decodeURIComponent(raw))
}

test('primary look with an empty business cell is the schema identifier', () => {
  const hit = matchedWriteIdentity(
    { id: PK, title: '旧' },
    PK,
    schema,
    mapped,
  )
  assert.deepEqual(hit, { field: 'id', value: PK })
})

test('a business cell that equals the look stays that cell', () => {
  const hit = matchedWriteIdentity(
    { id: PK, code: CODE, title: '旧' },
    CODE,
    schema,
    mapped,
  )
  assert.deepEqual(hit, { field: 'code', value: CODE })
})

test('a filled business cell that is not the look does not replace the identifier', () => {
  const hit = matchedWriteIdentity(
    { id: PK, code: CODE, title: '旧' },
    PK,
    schema,
    mapped,
  )
  assert.deepEqual(hit, { field: 'id', value: PK })
})

function writer(handler) {
  const calls = []
  const mouth = createNocoWrite({
    resolve: async () => ({
      connections: [{ baseUrl: 'http://nb.local', dialect: 'nocobase', collections }],
      vocab,
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init && init.method, body: init && init.body })
      const reply = await handler(calls.at(-1))
      return { ok: true, json: async () => reply }
    },
  })
  return { mouth, calls }
}

test('update and destroy of an empty business cell filter on the schema identifier', async () => {
  const updated = writer(async () => ({ data: [{ id: PK, title: '新标题' }] }))
  const changed = await updated.mouth.write({
    action: '改行',
    kind: '样例',
    no: PK,
    mapped,
    vocab,
    fields: { id: PK, title: '旧' },
    patch: { title: '新标题' },
  })
  assert.equal(changed.ok, true, changed.hint)
  assert.equal(updated.calls[0].url.includes(':update'), true)
  assert.deepEqual(filterOf(updated.calls[0].url), { id: PK })

  const removed = writer(async () => ({ data: 1 }))
  const destroyed = await removed.mouth.write({
    action: '删除',
    kind: '样例',
    no: PK,
    mapped,
    vocab,
    fields: { id: PK, title: '旧' },
  })
  assert.equal(destroyed.ok, true, destroyed.hint)
  assert.equal(removed.calls[0].url.includes(':destroy'), true)
  assert.deepEqual(filterOf(removed.calls[0].url), { id: PK })

  const approved = writer(async () => ({ data: [{ id: PK, status: 'approved' }] }))
  const passed = await approved.mouth.write({
    action: '过审',
    kind: '样例',
    no: PK,
    mapped,
    vocab,
    fields: { id: PK, status: 'pending' },
    patch: { status: 'approved' },
  })
  assert.equal(passed.ok, true, passed.hint)
  assert.equal(approved.calls[0].url.includes(':update'), true)
  assert.deepEqual(filterOf(approved.calls[0].url), { id: PK })
})

test('a business cell with a value is still the filter', async () => {
  const { mouth, calls } = writer(async () => ({ data: [{ id: PK, code: CODE, title: '新标题' }] }))
  const changed = await mouth.write({
    action: '改行',
    kind: '样例',
    no: CODE,
    mapped,
    vocab,
    fields: { id: PK, code: CODE, title: '旧' },
    patch: { title: '新标题' },
  })
  assert.equal(changed.ok, true, changed.hint)
  assert.deepEqual(filterOf(calls[0].url), { code: CODE })
})

test('zero-row update and destroy are not success', async () => {
  const updated = writer(async () => ({ data: [] }))
  const changed = await updated.mouth.write({
    action: '改行',
    kind: '样例',
    no: PK,
    mapped,
    vocab,
    fields: { id: PK, title: '旧' },
    patch: { title: '新标题' },
  })
  assert.equal(changed.ok, false)
  assert.equal(changed.failed, true)
  assert.match(String(changed.hint || ''), /没有改到行/)
  assert.deepEqual(filterOf(updated.calls[0].url), { id: PK })

  const removed = writer(async () => ({ data: 0 }))
  const destroyed = await removed.mouth.write({
    action: '删除',
    kind: '样例',
    no: PK,
    mapped,
    vocab,
    fields: { id: PK, title: '旧' },
  })
  assert.equal(destroyed.ok, false)
  assert.equal(destroyed.failed, true)
  assert.match(String(destroyed.hint || ''), /没有改到行/)
  assert.equal(removed.calls[0].url.includes(':destroy'), true)
})

test('create does not look up a row', async () => {
  const { mouth, calls } = writer(async () => ({ data: { id: '1', title: '新标题' } }))
  const created = await mouth.write({
    action: '新建',
    kind: '样例',
    no: '新单',
    mapped,
    vocab,
    patch: { title: '新标题' },
  })
  assert.equal(created.ok, true, created.hint)
  assert.equal(calls[0].url, 'http://nb.local/api/biz_rows:create')
  assert.equal(calls[0].url.includes('filter='), false)
})

test('confirm posts the same identity the preview row already matched', async () => {
  const calls = []
  const mouth = createNocoWrite({
    resolve: async () => ({
      connections: [{ baseUrl: 'http://nb.local', dialect: 'nocobase', collections }],
      vocab,
    }),
    fetchImpl: async (url) => {
      calls.push(String(url))
      const filter = filterOf(url)
      return {
        ok: true,
        json: async () => ({ data: [{ id: PK, ...(filter.code ? { code: filter.code } : {}), title: '新标题' }] }),
      }
    },
  })
  function gateFor(row) {
    calls.length = 0
    const fingerprint = `${row.no}:待审:t`
    return createGate({
      vocab,
      collectionsOf: async () => collections,
      lookupTodo: async () => ({
        ok: true,
        no: row.no,
        status: '待审',
        fingerprint,
        fields: row.fields,
        matches: [{ no: row.no, status: '待审', fields: row.fields }],
      }),
      postWrite: (spec) => mouth.write(spec),
    })
  }

  const empty = gateFor({ no: PK, fields: { id: PK, title: '新标题' } })
  const preview = await empty.preview({
    workspace: '/tmp/lookup-key',
    kind: '样例',
    action: '改行',
    no: PK,
    patch: { title: '新标题' },
  })
  assert.ok(preview.preview_id, preview.hint || preview.error)
  const written = await empty.write({ preview_id: preview.preview_id, workspace: '/tmp/lookup-key' })
  assert.equal(written.ok, true, written.hint)
  assert.deepEqual(filterOf(calls.at(-1)), { id: PK })

  const filled = gateFor({ no: CODE, fields: { id: PK, code: CODE, title: '新标题' } })
  const again = await filled.preview({
    workspace: '/tmp/lookup-key',
    kind: '样例',
    action: '改行',
    no: CODE,
    patch: { title: '新标题' },
  })
  assert.ok(again.preview_id, again.hint || again.error)
  const posted = await filled.write({ preview_id: again.preview_id, workspace: '/tmp/lookup-key' })
  assert.equal(posted.ok, true, posted.hint)
  assert.deepEqual(filterOf(calls.at(-1)), { code: CODE })
})
