import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'
import { openDatabase } from '../db.mjs'
import { rollbackPreviewBody, rollbackPreviewRequest } from '../biz/audit-lookup.mjs'
import { resolveBizCorpusOrigin } from '../biz/corpus-origin.mjs'
import { enrichStructuredSlots } from '../vendor-overlays/dsh-lan-assist/slots.js'
import { nocobasePath } from '../vendor-overlays/dsh-lan-assist/lookup.js'
import { historyOptionLabel } from '../../src/lib/biz-list-query.ts'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-rollback-pk-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate, createNocoWrite } = await import(pathToFileURL(join(staged, 'write.js')).href)

const PK = '371712729939987'
const CODE = 'CUST2056'
const KIND = '客户'

const customerVocab = [{
  kind: KIND,
  resource: 'biz_customers',
  can: ['现查', '改行', '删除', '过审', '新建'],
  fields: ['code', 'name', 'notes'],
}]

const customerSchema = [
  { name: 'id', interface: 'snowflakeId', title: '主键' },
  { name: 'code', interface: 'input', title: '编号' },
  { name: 'name', interface: 'input', title: '名称' },
  { name: 'notes', interface: 'textarea', title: '备注' },
]

const customerMapped = { resource: 'biz_customers', fields: ['code', 'name', 'notes'] }

function filterOf(url) {
  const raw = String(url).split('filter=')[1] || ''
  assert.ok(raw, String(url))
  return JSON.parse(decodeURIComponent(raw.split('&')[0]))
}

function assertPkFilter(filter) {
  const flat = JSON.stringify(filter)
  assert.equal(flat.includes('回退'), false)
  assert.equal(flat.includes('$includes'), false)
  assert.equal(flat.includes(PK), true)
}

test('CUST2056-style rollback keeps the row pk and never name-includes 回退', () => {
  const requested = rollbackPreviewRequest({
    kind: KIND,
    action: '改行',
    recordNo: CODE,
    receiptId: PK,
    lookupBind: { speech: '改客户 CUST2056 备注改成测试修改', bizKind: KIND },
  }, KIND, { notes: 'active' }, '/tmp/ws')
  assert.equal(requested.ok, true)
  const body = requested.body
  assert.equal(body.kind, KIND)
  assert.equal(body.no, PK)
  assert.equal(String(body.speech || ''), '')
  assert.equal(body.where, undefined)
  const filled = enrichStructuredSlots(body, customerVocab)
  assert.equal(filled.no, PK)
  assert.notEqual(filled.no, '回退')
  const path = nocobasePath(customerMapped, filled.no, KIND, customerSchema)
  assertPkFilter(filterOf(`http://nb.local${path}`))
})

test('rollback of another kind uses that object and its row pk', () => {
  const ticketPk = '900100200300400'
  const requested = rollbackPreviewRequest({
    kind: '工单',
    action: '改行',
    recordNo: 'WO-9',
    receiptId: ticketPk,
  }, '工单', { title: '旧标题' }, '/tmp/ws')
  assert.equal(requested.ok, true)
  assert.equal(requested.body.kind, '工单')
  assert.equal(requested.body.no, ticketPk)
  assert.equal(String(requested.body.speech || ''), '')
})

test('old audit without a row pk misses and does not build an unfiltered list', () => {
  const missed = rollbackPreviewRequest({
    kind: KIND,
    action: '改行',
    recordNo: CODE,
    receiptId: '',
    lookupBind: { speech: '改客户 CUST2056 备注改成测试修改' },
  }, KIND, { notes: 'active' }, '/tmp/ws')
  assert.equal(missed.ok, false)
  assert.equal(missed.body, undefined)
  assert.match(String(missed.hint || ''), /这一行对不上/)
  assert.equal(String(missed.hint || '').includes('回退'), false)
  const dumped = nocobasePath(customerMapped, '', KIND, customerSchema)
  assert.equal(dumped.includes('filter='), false)
  assert.equal(missed.listPath, undefined)
})

test('spoken 改行 still lets a leftover name replace a filled number', () => {
  const speech = '把客户恒通改成测试修改'
  const filled = enrichStructuredSlots({
    kind: KIND,
    action: '改行',
    no: CODE,
    speech,
    patch: { notes: '测试修改' },
  }, customerVocab)
  assert.equal(filled.no, '恒通')
  assert.notEqual(filled.no, CODE)
})

test('confirm write uses the same row pk the rollback preview looked up', async () => {
  const calls = []
  const lookups = []
  const collections = [{ name: 'biz_customers', title: KIND, fields: customerSchema }]
  const mouth = createNocoWrite({
    resolve: async () => ({
      connections: [{ baseUrl: 'http://nb.local', dialect: 'nocobase', collections }],
      vocab: customerVocab,
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: init && init.body })
      return { ok: true, json: async () => ({ data: [{ id: PK, code: CODE, notes: 'active' }] }) }
    },
  })
  const gate = createGate({
    vocab: customerVocab,
    collectionsOf: async () => collections,
    fieldsOf: async () => customerSchema,
    lookupTodo: async (spec) => {
      lookups.push({ no: String(spec.no || ''), speech: String(spec.speech || '') })
      const notes = lookups.length >= 3 ? 'active' : '测试修改'
      return {
        ok: true,
        no: CODE,
        status: 'active',
        fingerprint: `${PK}:notes`,
        fields: { id: PK, code: CODE, name: '深圳恒通电子有限公司', notes },
        matches: [{
          no: CODE,
          status: 'active',
          fields: { id: PK, code: CODE, name: '深圳恒通电子有限公司', notes },
        }],
      }
    },
    postWrite: (spec) => mouth.write(spec),
  })
  const requested = rollbackPreviewRequest({
    kind: KIND,
    action: '改行',
    recordNo: CODE,
    receiptId: PK,
  }, KIND, { notes: 'active' }, '/tmp/ws')
  const preview = await gate.preview({ ...requested.body, workspace: '/tmp/ws' })
  assert.equal(preview.ok === false, false, preview.hint || preview.error)
  assert.equal(lookups[0] && lookups[0].no, PK)
  assert.equal(lookups[0] && lookups[0].speech, '')
  assert.equal(JSON.stringify(lookups).includes('回退'), false)
  const written = await gate.write({ preview_id: preview.preview_id, workspace: '/tmp/ws' })
  assert.equal(written.ok, true, written.hint)
  const update = calls.find((row) => row.url.includes(':update'))
  assert.ok(update, calls.map((row) => row.url).join('\n'))
  assert.deepEqual(filterOf(update.url), { id: PK })
})

test('preview chrome reads the history action, not speech 回退', () => {
  const fromSpeech = historyOptionLabel(
    { kind: KIND, action: '改行' },
    { kind: KIND, action: '改行', speech: '回退', rows: [{ no: CODE }] },
  )
  assert.equal(fromSpeech, `${KIND} · 改行 · ${CODE}`)
  assert.equal(fromSpeech.includes('回退'), false)
  const fromAction = historyOptionLabel(
    { kind: KIND, action: '回退' },
    { kind: KIND, action: '回退', speech: '回退', rows: [{ no: CODE }] },
  )
  assert.equal(fromAction, `${KIND} · 回退 · ${CODE}`)
})

test('empty speech and the old marker are not original corpus', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rollback-corpus-'))
  const db = openDatabase(join(dir, 'audit.sqlite'), join(import.meta.dirname, '..', 'migrations'))
  const { insertBizWriteAudit } = await import('../db.mjs')
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws-corpus',
    traceId: 'trace_empty_speech',
    kind: '项目任务',
    action: '回退',
    recordNo: 'row_pk_1',
    source: 'workstation',
    changes: [{ field: 'status', from: 'b', to: 'a' }],
    lookupBind: { speech: '' },
  })
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws-corpus',
    traceId: 'trace_marker_speech',
    kind: '项目任务',
    action: '回退',
    recordNo: 'row_pk_2',
    source: 'workstation',
    changes: [{ field: 'status', from: 'b', to: 'a' }],
    lookupBind: { speech: '回退' },
  })
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws-corpus',
    traceId: 'trace_real_speech',
    kind: '项目任务',
    action: '改行',
    recordNo: 'row_pk_3',
    source: 'workstation',
    changes: [{ field: 'status', from: 'a', to: 'b' }],
    lookupBind: { speech: '把那一行改回去' },
  })
  const url = new URL('http://127.0.0.1/api/v1/corpus/x?cwd=/tmp/ws-corpus')
  const empty = await resolveBizCorpusOrigin({ db, traceId: 'trace_empty_speech', url })
  const marker = await resolveBizCorpusOrigin({ db, traceId: 'trace_marker_speech', url })
  const real = await resolveBizCorpusOrigin({ db, traceId: 'trace_real_speech', url })
  rmSync(dir, { recursive: true, force: true })
  assert.equal(empty.ok, false)
  assert.equal(empty.text, undefined)
  assert.equal(marker.ok, false)
  assert.equal(marker.text, undefined)
  assert.equal(real.ok, true)
  assert.equal(real.text, '把那一行改回去')
})

test('rollbackPreviewBody does not put 回退 in the speech slot', () => {
  const body = rollbackPreviewBody({ where: [{ field: 'id', op: 'eq', value: '9' }] }, '项目任务', '9', { title: '旧标题' }, '/tmp/ws')
  assert.equal(body.no, '9')
  assert.equal(String(body.speech || ''), '')
  assert.equal(body.where, undefined)
})
