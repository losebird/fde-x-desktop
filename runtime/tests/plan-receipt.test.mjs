import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'plan-receipt-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })

const { planReceipt, planReceiptNext } = await import(pathToFileURL(join(staged, 'plan-receipt.mjs')).href)
const { materializeSettledRepeat } = await import(pathToFileURL(join(staged, 'query-settle.mjs')).href)
const { createGate, livePendingWrite, livePendingSheet } = await import(pathToFileURL(join(staged, 'gate.js')).href)
const { PAGE_SIZE } = await import(pathToFileURL(join(staged, 'plan.js')).href)

const sessionId = 'sess-receipt'
const workspace = '/tmp/receipt-ws'

function fatListedWrite(n = 95) {
  const matches = Array.from({ length: n }, (_, i) => ({
    no: `EXP${String(i + 1).padStart(8, '0')}`,
    status: '待审',
    fields: {
      expenseNo: `EXP${String(i + 1).padStart(8, '0')}`,
      applicant: `EMP${1000 + i}`,
      department: '总经办',
      approver: `EMP${2000 + i}`,
      category: '差旅',
      amount: String(1000 + i),
      remarks: '客户拜访'.repeat(8),
      status: '待审',
      id: String(371713484914708 + i),
    },
    lookup: { field: 'id', value: String(371713484914708 + i) },
  }))
  return {
    ok: true,
    kind: '费用报销',
    action: '过审',
    listed: true,
    ambiguous: true,
    preview_id: '',
    to: '已通过',
    patch: { status: '已通过' },
    speak: `这张单共 ${n} 条，本页 ${n} 条。`,
    speech: '待审报销单都过一下。',
    matches,
    hitTotal: n,
    hitTotalState: 'known',
    sheet: {
      kind: '费用报销',
      action: '过审',
      listed: true,
      ambiguous: true,
      preview_id: '',
      to: '已通过',
      patch: { status: '已通过' },
      rows: matches,
      hitTotal: n,
      hitTotalState: 'known',
      speech: '待审报销单都过一下。',
    },
  }
}

test('listed write receipt has next pick-rows and no row bodies', () => {
  const raw = fatListedWrite(95)
  const receipt = planReceipt(raw)
  assert.equal(receipt.next, 'pick-rows')
  assert.equal(receipt.ok, true)
  assert.equal(receipt.listed, true)
  assert.equal(receipt.kind, '费用报销')
  assert.equal(receipt.action, '过审')
  assert.equal(receipt.to, '已通过')
  assert.equal(receipt.n, 95)
  assert.equal(receipt.hitTotal, 95)
  assert.equal(receipt.preview_id, undefined)
  assert.equal(receipt.sheet, undefined)
  assert.equal(receipt.matches, undefined)
  assert.equal(receipt.rows, undefined)
  assert.ok(Array.isArray(receipt.nos))
  assert.equal(receipt.nos.length, PAGE_SIZE)
  assert.equal(receipt.nos[0], 'EXP00000001')
  const receiptBytes = JSON.stringify(receipt).length
  const rawBytes = JSON.stringify(raw).length
  assert.ok(receiptBytes < 8000, `receipt ${receiptBytes}`)
  assert.ok(rawBytes > 40000, `raw ${rawBytes}`)
  assert.doesNotMatch(JSON.stringify(receipt), /客户拜访/)
  assert.doesNotMatch(JSON.stringify(receipt), /371713484914708/)
})

test('token write receipt has next confirm', () => {
  const receipt = planReceipt({
    ok: true,
    kind: '请假申请',
    action: '过审',
    preview_id: 'pv_one',
    canWrite: true,
    no: 'LV-1',
    matches: [{ no: 'LV-1', status: '草稿', fields: { id: '1' } }],
    sheet: {
      kind: '请假申请',
      action: '过审',
      preview_id: 'pv_one',
      canWrite: true,
      rows: [{ no: 'LV-1', status: '草稿', fields: { id: '1' } }],
    },
  })
  assert.equal(receipt.next, 'confirm')
  assert.equal(receipt.preview_id, 'pv_one')
  assert.equal(receipt.canWrite, true)
  assert.equal(receipt.matches, undefined)
  assert.equal(receipt.sheet, undefined)
})

test('LOOKUP receipt has next continue and this-call kind', () => {
  const receipt = planReceipt({
    ok: false,
    error: 'LOOKUP',
    hint: '销售合同对不上。',
    kind: '销售合同',
    action: '现查',
    no: 'HT20250409363',
    speak: '销售合同对不上。',
    sheet: { kind: '销售合同', action: '现查', rows: [], speech: '东莞联创到期合同' },
  })
  assert.equal(receipt.ok, false)
  assert.equal(receipt.error, 'LOOKUP')
  assert.equal(receipt.next, 'continue')
  assert.equal(receipt.kind, '销售合同')
  assert.equal(receipt.action, '现查')
  assert.equal(receipt.sheet, undefined)
  assert.equal(receipt.n, 0)
})

test('blockConfirm without picks has next continue; pick-cells stop', () => {
  assert.equal(planReceiptNext({
    ok: true,
    action: '过审',
    blockConfirm: true,
    kind: '单据',
    matches: [{ no: 'A-1' }],
  }), 'continue')
  assert.equal(planReceiptNext({
    ok: true,
    action: '改行',
    blockConfirm: true,
    kind: '单据',
    matches: [{ no: 'A-1' }],
    cells: [{ key: 'status', bound: false, picks: [{ id: '1', label: '成交' }] }],
  }), 'stop')
})

test('MISS_TARGET receipt has next continue and status enums', () => {
  const receipt = planReceipt({
    ok: false,
    error: 'MISS_TARGET',
    kind: '请假申请',
    action: '过审',
    speak: '请假申请状态对不上「已过」。这档是pending=待审、approved=已通过。',
    to: '已过',
    statusDomain: { field: 'status', enums: { pending: '待审', approved: '已通过' } },
    matches: [{ no: 'LV-1' }],
    sheet: {
      kind: '请假申请',
      action: '过审',
      statusDomain: { field: 'status', enums: { pending: '待审', approved: '已通过' } },
      rows: [{ no: 'LV-1' }],
    },
  })
  assert.equal(receipt.ok, false)
  assert.equal(receipt.error, 'MISS_TARGET')
  assert.equal(receipt.next, 'continue')
  assert.equal(receipt.preview_id, undefined)
  assert.deepEqual(receipt.status, { field: 'status', enums: { pending: '待审', approved: '已通过' } })
  assert.equal(receipt.sheet, undefined)
  assert.equal(receipt.matches, undefined)
})

test('set token receipt has next confirm', () => {
  const receipt = planReceipt({
    ok: true,
    kind: '费用报销',
    action: '过审',
    preview_id: 'pv_set',
    canWrite: true,
    batch: true,
    nos: ['E-1', 'E-2'],
    matches: [{ no: 'E-1' }, { no: 'E-2' }],
    sheet: {
      kind: '费用报销',
      action: '过审',
      preview_id: 'pv_set',
      canWrite: true,
      batch: true,
      rows: [{ no: 'E-1' }, { no: 'E-2' }],
    },
  })
  assert.equal(receipt.next, 'confirm')
  assert.equal(receipt.preview_id, 'pv_set')
  assert.equal(receipt.batch, true)
  assert.equal(receipt.listed, undefined)
})

test('settled repeat receipt stays a slim QUERY_SETTLED object', () => {
  const payload = materializeSettledRepeat({
    ok: true,
    error: 'QUERY_SETTLED',
    querySettledRepeat: true,
    kind: 'ChildB',
    action: '现查',
    speak: '共 3 条，本页 3 条。',
    sheet: { kind: 'ChildB', action: '现查', querySettled: true, hitTotal: 3 },
  })
  assert.equal(payload.error, 'QUERY_SETTLED')
  assert.equal(payload.ok, true)
  assert.equal(payload.next, 'stop')
  assert.match(String(payload.speak || ''), /已结算/)
  assert.equal(payload.sheet, undefined)
  assert.equal(payload.hitTotal, 3)
  assert.deepEqual(payload.rows || [], [])
})

function memStore(init = {}) {
  let state = {
    pendingWrite: null,
    pendingSheet: null,
    sheetTrail: [],
    liveOpening: null,
    requests: {},
    ...init,
  }
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
    peek() { return state },
  }
}

test('empty 现查 LOOKUP keeps pending listed write on the hall and returns this-call identity', async () => {
  const now = () => 1_700_000_000_000
  const store = memStore({
    pendingSheet: {
      kind: 'KindWrite',
      action: '过审',
      listed: true,
      ambiguous: true,
      speech: '都过一下',
      to: '已通过',
      preview_id: '',
      rows: Array.from({ length: 8 }, (_, i) => ({
        no: `W-${i + 1}`,
        status: '待审',
        fields: { status: '待审', blob: 'x'.repeat(80) },
      })),
      sessionId,
      workspace,
    },
  })
  const snapshot = async (sid) => {
    const state = await store.get()
    return {
      pendingWrite: livePendingWrite(state, null, now()),
      pendingSheet: livePendingSheet(state, null, now(), sid || sessionId),
    }
  }
  const gate = createGate({
    store,
    now,
    snapshot,
    note() {},
    opts: {
      gate: {
        async preview(spec) {
          return {
            ok: false,
            error: 'LOOKUP',
            hint: `${spec.kind}对不上。`,
            kind: spec.kind,
            action: spec.action || '现查',
            no: spec.no || '',
            speak: `${spec.kind}对不上。`,
            sheet: {
              kind: spec.kind,
              action: spec.action || '现查',
              no: spec.no || '',
              rows: [],
              speech: spec.speech,
            },
          }
        },
        async write() { return { ok: true } },
      },
    },
    catalogOf() { return [] },
    async reopenReplyDraft() { return false },
    async hearBusinessEvent() {},
    async rememberFocus() {},
  })
  const preview = await gate.previewBiz({
    kind: 'KindLookup',
    action: '现查',
    no: 'HT-1',
    speech: '另一型现查',
    sessionId,
    workspace,
  })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'LOOKUP')
  assert.equal(preview.kind, 'KindLookup')
  assert.equal(preview.sheet && preview.sheet.kind, 'KindLookup')
  assert.equal(Array.isArray(preview.sheet && preview.sheet.rows) ? preview.sheet.rows.length : 0, 0)
  assert.notEqual(preview.sheet && preview.sheet.kind, 'KindWrite')
  const hall = await snapshot(sessionId)
  assert.equal(hall.pendingSheet.kind, 'KindWrite')
  assert.equal(hall.pendingSheet.action, '过审')
  assert.equal(hall.pendingSheet.rows.length, 8)
  const receipt = planReceipt(preview)
  assert.equal(receipt.kind, 'KindLookup')
  assert.equal(receipt.next, 'continue')
  assert.equal(receipt.sheet, undefined)
  assert.doesNotMatch(JSON.stringify(receipt), /KindWrite/)
})

test('biz_preview execute always emits a plan receipt and does not conclude the turn', () => {
  const tools = readFileSync(join(overlayDir, 'tools.js'), 'utf8')
  const execute = tools.slice(tools.indexOf("name: 'biz_preview'"), tools.indexOf("name: 'biz_write'"))
  assert.match(execute, /planReceipt/)
  assert.match(execute, /JSON\.stringify\(planReceipt/)
  assert.doesNotMatch(execute, /concludeChatTurn/)
  assert.doesNotMatch(execute, /concludeTurn/)
  assert.match(execute, /这次的 patch\/to 套到整个绑定集合，发一张集合令牌/)
})
