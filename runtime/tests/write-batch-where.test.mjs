import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'write-batch-where-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })

const { createGate } = await import(pathToFileURL(join(staged, 'write.js')).href)
const { createSessionRoundStore, isEligibleRoundSheet } = await import(pathToFileURL(join(staged, 'session-round.js')).href)

const pendingWhere = [{ keys: ['status', '状态'], values: ['pending', '待审'] }]

const mixedCatalog = [
  ...Array.from({ length: 96 }, (_, i) => ({
    no: `P-${i + 1}`,
    status: 'pending',
    fields: { id: String(i + 1), status: 'pending', code: `P-${i + 1}` },
  })),
  ...Array.from({ length: 120 }, (_, i) => ({
    no: `O-${i + 1}`,
    status: i % 3 === 0 ? 'approved' : 'paid',
    fields: { id: `o${i + 1}`, status: i % 3 === 0 ? 'approved' : 'paid', code: `O-${i + 1}` },
  })),
]

const docVocab = [
  {
    kind: '单据',
    resource: 'biz_docs',
    catalogVersion: 'schema:1',
    can: ['现查', '过审'],
    clues: [{ say: ['待审'], keys: ['status', '状态'], values: ['pending', '待审'] }],
  },
]

const expenseFields = [
  { name: 'status', title: '状态', enums: { pending: '待审', approved: '已通过', paid: '已付款' } },
  { name: 'code', title: '单号', interface: 'input' },
]

function gate(catalog = mixedCatalog, { respectWhere = false } = {}) {
  return createGate({
    vocab: docVocab,
    lookupTodo(spec) {
      let rows = catalog.slice()
      const no = String(spec.no || spec.ticket || '').trim()
      if (no) rows = rows.filter((row) => String(row.no || '') === no)
      if (respectWhere) {
        const where = Array.isArray(spec.where) ? spec.where : []
        if (where.length) {
          rows = rows.filter((row) => where.every((term) => {
            const keys = Array.isArray(term.keys) ? term.keys : []
            const values = (Array.isArray(term.values) ? term.values : []).map(String)
            if (!keys.length || !values.length) return true
            const fields = row.fields || {}
            const hit = keys.some((key) => values.includes(String(fields[key] ?? row[key] ?? '')))
            return term.not ? !hit : hit
          }))
        }
      }
      if (!rows.length) return { ok: false, error: 'NOT_FOUND', matches: [] }
      return {
        ok: true,
        matches: rows,
        hitTotal: rows.length,
        hitTotalState: 'known',
        no: rows.length === 1 ? rows[0].no : '',
        status: rows[0].status,
        fields: rows.length === 1 ? rows[0].fields : {},
      }
    },
    collectionsOf: async () => [{ name: 'biz_docs', title: '单据' }],
    async fieldsOf() {
      return expenseFields
    },
  })
}

function sheetOf(result) {
  return result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
}

test('batch 过审 mints one set token for the pending hit set', async () => {
  const g = gate(mixedCatalog, { respectWhere: false })
  const result = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    batch: true,
    where: pendingWhere,
    to: 'approved',
    speech: '都过一下',
    userSpeech: '都过一下',
  })
  assert.equal(result.ok, true)
  assert.notEqual(result.error, 'TOO_MANY')
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.ok(String(result.preview_id || sheet.preview_id || '').startsWith('pv_'))
  assert.equal(sheet.listed, false)
  assert.equal(sheet.batch, true)
  assert.equal(sheet.canWrite, true)
  assert.equal(rows.length, 96)
  assert.equal(sheet.hitTotal, 96)
  assert.equal(sheet.hitTotalState, 'known')
  assert.ok(rows.every((row) => String(row.status || row.fields?.status || '') === 'pending'))

  const first = rows[0]
  const picked = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    batch: true,
    where: pendingWhere,
    to: 'approved',
    speech: '都过一下',
    userSpeech: '都过一下',
    picked: true,
    no: first.no,
    lookup: first.lookup,
  })
  const pickedSheet = sheetOf(picked)
  const pickedRows = Array.isArray(pickedSheet.rows) ? pickedSheet.rows : []
  assert.equal(picked.ok, true)
  assert.ok(String(picked.preview_id || pickedSheet.preview_id || '').startsWith('pv_'))
  assert.equal(pickedRows.length, 1)
  assert.equal(pickedRows[0].no, first.no)
})

test('unfiltered batch without identity is 缺身份 and is not an official round sheet', async () => {
  const onlyMany = Array.from({ length: 150 }, (_, i) => ({
    no: `M-${i + 1}`,
    status: 'pending',
    fields: { id: String(i + 1), status: 'pending', code: `M-${i + 1}` },
  }))
  const g = gate(onlyMany, { respectWhere: true })
  const result = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    batch: true,
    to: 'approved',
    speech: '都过一下',
    userSpeech: '都过一下',
  })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'NO_IDENTITY')
  const sheet = sheetOf(result)
  assert.equal(String(result.hint || sheet.hint || result.speak || '').includes('缺身份'), true)
  assert.equal(Array.isArray(sheet.rows) ? sheet.rows.length : 0, 0)
  assert.equal(isEligibleRoundSheet(sheet), false)

  const rounds = createSessionRoundStore()
  rounds.startRound('sess-batch-too-many')
  const note = rounds.noteToolSheet('sess-batch-too-many', sheet)
  assert.equal(note.process, true)
  assert.equal(rounds.peek('sess-batch-too-many').candidate, null)
  const closed = rounds.closeRound('sess-batch-too-many')
  assert.equal(closed.emit, false)
  assert.equal(closed.official, null)
})

test('json-string where still binds the pending hit set', async () => {
  const g = gate(mixedCatalog, { respectWhere: true })
  const result = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    batch: true,
    where: JSON.stringify(pendingWhere),
    to: 'approved',
    speech: '都过一下',
    userSpeech: '都过一下',
  })
  assert.notEqual(result.error, 'TOO_MANY')
  assert.equal(result.ok, true)
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(rows.length, 96)
})

test('batch write with no where does not copy official listed where', async () => {
  const g = gate(mixedCatalog, { respectWhere: true })
  const result = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    batch: true,
    to: 'approved',
    speech: '都过一下',
    userSpeech: '都过一下',
    officialSheet: {
      kind: '单据',
      action: '现查',
      where: pendingWhere,
      rows: mixedCatalog.slice(0, 20),
      hitTotal: 96,
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'NO_IDENTITY')
})

test('official listed where of another kind does not bind this write', async () => {
  const g = gate(mixedCatalog, { respectWhere: true })
  const result = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    batch: true,
    to: 'approved',
    speech: '都过一下',
    userSpeech: '都过一下',
    officialSheet: {
      kind: 'OtherKind',
      action: '现查',
      where: pendingWhere,
      rows: mixedCatalog.slice(0, 20),
    },
  })
  assert.equal(result.error, 'NO_IDENTITY')
  assert.equal(result.ok, false)
})

test('write with row identity does not inherit official listed where', async () => {
  const g = gate(mixedCatalog, { respectWhere: true })
  const result = await g.preview({
    workspace: '/tmp/batch-where-ws',
    kind: '单据',
    action: '过审',
    no: 'P-1',
    speech: '过一下这张 P-1',
    userSpeech: '过一下这张 P-1',
    officialSheet: {
      kind: '单据',
      action: '现查',
      where: pendingWhere,
      rows: mixedCatalog.slice(0, 20),
      hitTotal: 96,
    },
  })
  assert.notEqual(result.error, 'TOO_MANY')
  const sheet = sheetOf(result)
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  assert.equal(rows.length, 1)
  assert.equal(rows[0].no, 'P-1')
})
