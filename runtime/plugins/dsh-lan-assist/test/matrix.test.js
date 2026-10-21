import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRows } from '../resolve.js'
import { createLookup } from '../lookup.js'
import { createGate } from '../write.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'

function memStore() {
  let state = emptyState()
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
}

const KINDS = [
  { kind: '客户', resource: 'biz_customers', ticket: 'CUST-020', clue: '西安高新区', field: 'address', ticketField: 'code' },
  { kind: '工单', resource: 'biz_tickets', ticket: 'WO-3', clue: '灰度告警', field: 'title', ticketField: 'ticketNo' },
  { kind: '合同', resource: 'biz_contracts', ticket: 'HT-2026-020', clue: '系统集成', field: 'remark', ticketField: 'contractNo' },
  { kind: '采购单', resource: 'biz_purchase_orders', ticket: 'PO-12', clue: '天工急件', field: 'name', ticketField: 'orderNo' },
]

const VOCAB = KINDS.map((row) => ({ kind: row.kind, fields: ['单号', '状态'], can: ['现查', '过审'], resource: row.resource, ticketField: row.ticketField }))

const TABLE = {
  客户: [
    { code: 'CUST-020', name: '西安天工', address: '西安高新区', remark: '重点', status: 'inactive', owner: 'emp_lin', updatedAt: '1' },
    { code: 'CUST-021', name: '成都中天', address: '成都高新区', remark: '培训', status: 'active', owner: 'emp_lin', updatedAt: '1' },
  ],
  工单: [
    { ticketNo: 'WO-3', title: '灰度告警', remark: '今晚看', status: 'open', owner: 'emp_lin', updatedAt: '1' },
    { ticketNo: 'WO-4', title: '发票核对', remark: '财务', status: 'open', owner: 'emp_lin', updatedAt: '1' },
  ],
  合同: [
    { contractNo: 'HT-2026-020', name: '集成框架', remark: '系统集成', status: 'reviewing', owner: 'emp_lin', updatedAt: '1' },
    { contractNo: 'HT-9', name: '培训框架', remark: '培训', status: 'signed', owner: 'emp_lin', updatedAt: '1' },
  ],
  采购单: [
    { orderNo: 'PO-12', name: '天工急件', remark: '加急', status: 'pending', owner: 'emp_lin', updatedAt: '1' },
    { orderNo: 'PO-13', name: '成都备件', remark: '常规', status: 'pending', owner: 'emp_lin', updatedAt: '1' },
  ],
}

function ticketField(kind) {
  const hit = KINDS.find((row) => row.kind === kind)
  return hit ? hit.ticketField : 'code'
}

function liveTable() {
  return createLookup({
    vocab: VOCAB,
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      const hit = KINDS.find((row) => decoded.includes(row.resource))
      if (!hit) return { ok: true, status: 200, json: async () => ({ data: [] }) }
      return { ok: true, status: 200, json: async () => ({ data: TABLE[hit.kind] }) }
    },
  })
}

test('typed lines do not auto-preview writes from speech', async () => {
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: async () => ({ ok: false, error: 'NOT_FOUND' }),
    gate: createGate({
      lookupTodo: async () => ({ ok: false, error: 'NOT_FOUND' }),
      now: () => 1_700_000_000_000,
      loadVocab: async () => VOCAB,
    }),
  })
  for (const text of ['改一下工单 灰度告警', '删一下合同 系统集成', '过一下采购单 PO-12', '新建客户 西安天工']) {
    const heard = await A.hearUserLine('s', text, '/ws')
    assert.notEqual(heard.heard, 'preview', text)
    assert.ok(!heard.preview || !heard.preview.preview_id, text)
  }
})

test('any field on any table resolves 0 / 1 / many the same way', () => {
  for (const spec of KINDS) {
    const rows = TABLE[spec.kind]
    const one = resolveRows(rows, spec.clue, [ticketField(spec.kind)])
    assert.equal(one.ok, true, spec.kind)
    assert.equal(one.ambiguous, false, spec.kind)
    assert.equal(one.no, spec.ticket, spec.kind)
    const none = resolveRows(rows, '没有这条', [ticketField(spec.kind)])
    assert.equal(none.ok, false, spec.kind)
    assert.equal(none.error, 'NOT_FOUND', spec.kind)
  }
  const many = resolveRows(TABLE.客户, '高新区')
  assert.equal(many.ok, true)
  assert.equal(many.ambiguous, true)
  assert.equal(many.matches.length, 2)
})

test('lookup and write preview share the same unique-ticket resolve', async () => {
  const lookup = liveTable()
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    loadVocab: async () => VOCAB,
  })
  for (const spec of KINDS) {
    const found = await lookup.lookupTodo({ kind: spec.kind, no: spec.clue })
    assert.equal(found.ok, true, spec.kind)
    assert.equal(found.no, spec.ticket, spec.kind)
    const preview = await gate.preview({
      kind: spec.kind,
      no: spec.clue,
      action: '改行',
      patch: { remark: '跟进' },
      workspace: '/ws',
    })
    assert.equal(preview.ok, true, spec.kind)
    assert.equal(preview.no, spec.ticket, spec.kind)
    assert.equal(preview.action, '改行', spec.kind)
  }
})

test('typed chat matrix: lookup speaks, writes preview, create skips old row, many refuse', async () => {
  const lookup = liveTable()
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now: () => 1_700_000_000_000,
      loadVocab: async () => VOCAB,
    }),
  })

  const heard = await A.hearUserLine('s', '查一下客户 西安高新区', '/ws')
  assert.notEqual(heard.heard, 'lookup')
  const seen = await A.previewBiz({
    kind: '客户',
    no: '西安高新区',
    action: '现查',
    speech: '查一下客户 西安高新区',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(seen.ok, true)
  assert.match(seen.speak || seen.sheet.speak || seen.no, /CUST-020|西安/)
  assert.notEqual((await A.dock('s')) && (await A.dock('s')).mode, 'preview')

  const change = await A.previewBiz({
    kind: '工单',
    no: '灰度告警',
    action: '改行',
    patch: { remark: '跟进' },
    speech: '改一下工单 灰度告警',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(change.ok, true)
  assert.equal(change.kind, '工单')
  assert.equal(change.no, 'WO-3')
  assert.equal(change.action, '改行')

  const remove = await A.previewBiz({
    kind: '合同',
    no: '系统集成',
    action: '删除',
    speech: '删一下合同 系统集成',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(remove.ok, true)
  assert.equal(remove.kind, '合同')
  assert.equal(remove.no, 'HT-2026-020')
  assert.equal(remove.action, '删除')
  assert.match(remove.speak, /将删/)

  const created = await A.previewBiz({
    kind: '客户',
    no: '新客',
    action: '新建',
    speech: '新建客户 新客',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(created.ok, true)
  assert.equal(created.action, '新建')
  assert.match(created.speak, /将新建/)

  const many = await A.previewBiz({
    kind: '客户',
    no: '高新区',
    action: '改行',
    speech: '改一下客户 高新区',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.ok(!many.preview_id)
  assert.ok((many.sheet && many.sheet.rows || []).length > 1)
})

test('ticket-shaped clues stay exact even when another field contains the digits', () => {
  const rows = [
    { code: 'CUST-020', remark: '对照 CUST-021', status: 'inactive' },
    { code: 'CUST-021', remark: '主档', status: 'active' },
  ]
  const one = resolveRows(rows, 'CUST-021', ['code'])
  assert.equal(one.ok, true)
  assert.equal(one.ambiguous, false)
  assert.equal(one.no, 'CUST-021')
})
