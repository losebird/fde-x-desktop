import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { enrichStructuredSlots } from '../vendor-overlays/dsh-lan-assist/slots.js'
import { termFilterPart } from '../vendor-overlays/dsh-lan-assist/where-pass.js'
import { rowMatchesAll } from '../vendor-overlays/dsh-lan-assist/resolve.js'
import { FDE_DSH_HOME } from '../config.mjs'

const QUOTE = '客户胡文今天12点电脑故障紧急保修，现在已处理完成'
const SPEECH = `把问题描述是"${QUOTE}"的那笔工单删除`

const vocab = [
  {
    kind: '客户',
    resource: 'biz_customers',
    can: ['现查', '改行', '删除', '过审'],
  },
  {
    kind: '工单',
    resource: 'biz_tickets',
    can: ['现查', '改行', '删除', '过审', '新建'],
    relations: [{ from: '客户', to: '工单', field: 'customer' }],
  },
]

const ticketFields = [
  { name: 'description', title: '问题描述', interface: 'textarea' },
  { name: 'type', title: '工单类型', interface: 'select', enums: { incident: '故障', request: '请求' } },
  { name: 'priority', title: '优先级', interface: 'select', enums: { urgent: '紧急', low: '低' } },
  { name: 'customer', title: '客户', interface: 'm2o', target: 'biz_customers' },
]

const extra = {
  vocab,
  schemaByKind: {
    工单: ticketFields,
    客户: [{ name: 'name', title: '客户名称', interface: 'input' }],
  },
  relations: [{ from: '客户', to: '工单', field: 'customer' }],
}

function valuesOf(where) {
  return (Array.isArray(where) ? where : []).flatMap((term) => term.values || [])
}

function textTerm(where) {
  return (Array.isArray(where) ? where : []).find((term) => term && term.text === true)
}

test('quoted description delete keeps that text column and does not hop', () => {
  const out = enrichStructuredSlots({
    kind: '工单',
    action: '删除',
    speech: SPEECH,
    where: [{ keys: ['description', '问题描述'], values: [QUOTE] }],
  }, vocab, extra)
  const term = textTerm(out.where)
  assert.ok(term)
  assert.deepEqual(term.keys, ['description'])
  assert.deepEqual(term.values, [QUOTE])
  assert.equal(term.title, '问题描述')
  assert.equal(out.from, undefined)
  assert.equal(out.no, undefined)
  assert.equal(valuesOf(out.where).includes('incident'), false)
  assert.equal(valuesOf(out.where).includes('urgent'), false)
})

test('words inside the scoped text do not become enum filters or a customer hop', () => {
  const out = enrichStructuredSlots({
    kind: '工单',
    action: '改行',
    speech: `问题描述是「${QUOTE}」的工单改一下`,
    where: [{ keys: ['问题描述'], values: [QUOTE] }],
  }, vocab, extra)
  const where = Array.isArray(out.where) ? out.where : []
  assert.equal(where.some((term) => (term.values || []).includes('incident')), false)
  assert.equal(where.some((term) => (term.values || []).includes('urgent')), false)
  assert.equal(out.from, undefined)
  assert.notEqual(out.no, '胡文')
  const steps = Array.isArray(out.steps) ? out.steps : []
  assert.equal(steps.some((step) => step && step.kind === '客户'), false)
})

test('unmatched column does not leftover-scan another kind', () => {
  const out = enrichStructuredSlots({
    kind: '工单',
    action: '删除',
    speech: '把备注是"客户胡文今天故障"的那笔工单删除',
    where: [{ keys: ['备注'], values: ['客户胡文今天故障'] }],
  }, vocab, extra)
  assert.notEqual(out.no, '胡文')
  assert.equal(out.from, undefined)
  const where = Array.isArray(out.where) ? out.where : []
  assert.equal(where.some((term) => (term.keys || []).includes('name')), false)
  assert.equal(where.some((term) => (term.values || []).includes('客户胡文今天故障')), false)
  assert.equal(where.some((term) => (term.values || []).includes('incident')), false)
  assert.equal(textTerm(where), undefined)
})

test('enum column still requires an enum hit', () => {
  const missed = enrichStructuredSlots({
    kind: '工单',
    action: '过审',
    speech: '把优先级那笔工单过审',
    where: [{ keys: ['priority', '优先级'], values: ['整句不是枚举'] }],
  }, vocab, extra)
  assert.equal(valuesOf(missed.where).includes('整句不是枚举'), false)
  assert.equal(valuesOf(missed.where).includes('urgent'), false)

  const hit = enrichStructuredSlots({
    kind: '工单',
    action: '删除',
    speech: '把优先级是紧急的那笔工单删除',
    where: [
      { keys: ['priority'], values: ['not-real'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
  }, vocab, extra)
  assert.equal(valuesOf(hit.where).includes('urgent'), true)
  assert.equal(valuesOf(hit.where).includes('not-real'), false)
  assert.equal(textTerm(hit.where), undefined)
})

test('text column filter is exact first, then contains', () => {
  const term = { keys: ['description'], values: [QUOTE], text: true }
  assert.deepEqual(termFilterPart(term), { description: QUOTE })
  assert.deepEqual(termFilterPart({ ...term, textPass: 'contains' }), {
    description: { $includes: QUOTE },
  })
  const row = { description: `${QUOTE}。` }
  assert.equal(rowMatchesAll(row, [term], 'and', 'exact'), false)
  assert.equal(rowMatchesAll(row, [term], 'and', 'contains'), true)
  assert.equal(rowMatchesAll({ description: QUOTE }, [term], 'and', 'exact'), true)
})

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-column-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate, livePendingSheet } = await import(pathToFileURL(join(staged, 'gate.js')).href)

test('column miss replaces the previous sheet', async () => {
  const sessionId = 'sess-column-miss'
  const workspace = '/tmp/column-miss'
  let state = {
    pendingWrite: null,
    pendingSheet: null,
    sheetTrail: [],
    liveOpening: null,
    requests: {},
  }
  const store = {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
  const now = () => 1_700_000_000_000
  const snapshot = async (sid) => ({
    pendingSheet: livePendingSheet(await store.get(), null, now(), sid || sessionId),
  })
  const gate = createGate({
    store,
    now,
    snapshot,
    note() {},
    opts: {
      gate: {
        async preview(spec) {
          if (spec.columnMiss === true) {
            const sheet = {
              kind: '工单',
              action: '删除',
              rows: [],
              speech: spec.speech,
              speak: '工单的问题描述这一列对不上，0 条，不是没去查。',
              columnMiss: true,
              sessionId: spec.sessionId,
              workspace: spec.workspace,
            }
            return {
              ok: false,
              error: 'NOT_FOUND',
              action: '删除',
              kind: '工单',
              hint: sheet.speak,
              sheet,
              sessionId: spec.sessionId,
              workspace: spec.workspace,
            }
          }
          const sheet = {
            kind: '工单',
            action: '现查',
            rows: [{ no: 'OLD-1', fields: { title: '上一张' } }],
            speech: spec.speech,
            sessionId: spec.sessionId,
            workspace: spec.workspace,
          }
          return { ok: true, action: '现查', kind: '工单', sheet, sessionId: spec.sessionId, workspace: spec.workspace }
        },
      },
    },
    catalogOf() { return [] },
    async reopenReplyDraft() { return false },
    async hearBusinessEvent() {},
    async rememberFocus() {},
  })
  await gate.previewBiz({
    kind: '工单',
    action: '现查',
    speech: '打开工单 OLD-1',
    sessionId,
    workspace,
  })
  const filled = await snapshot(sessionId)
  assert.equal(filled.pendingSheet.rows[0].no, 'OLD-1')
  await gate.previewBiz({
    kind: '工单',
    action: '删除',
    columnMiss: true,
    speech: SPEECH,
    sessionId,
    workspace,
  })
  const next = await snapshot(sessionId)
  assert.equal(next.pendingSheet.columnMiss, true)
  assert.equal(next.pendingSheet.rows.length, 0)
  assert.match(next.pendingSheet.speak, /问题描述这一列对不上/)
  assert.notEqual(next.pendingSheet.rows[0] && next.pendingSheet.rows[0].no, 'OLD-1')
})
