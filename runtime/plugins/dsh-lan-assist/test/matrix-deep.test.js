import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRows } from '../resolve.js'
import { createLookup, mapKind } from '../lookup.js'
import { createGate, createNocoWrite, SYSTEM_TABLES } from '../write.js'
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

const VOCAB_ONLY = [
  { kind: '客户台账', resource: 'crm_accounts', ticketField: 'code', can: ['现查', '过审'] },
  { kind: '巡检单', resource: 'ops_rounds', ticketField: 'roundNo', can: ['现查'] },
]

const TABLES = {
  crm_accounts: [
    {
      code: 'A-1',
      title: '台账甲',
      city: '西安',
      remark: '系统集成',
      contact: { name: '林督', id: 'emp_lin' },
      status: 'active',
      owner: 'emp_lin',
      updatedAt: '1',
    },
    {
      code: 'A-2',
      title: '台账乙',
      city: '成都',
      remark: '对照 A-1',
      status: 'inactive',
      owner: 'emp_lin',
      updatedAt: '1',
    },
  ],
  ops_rounds: [
    { roundNo: 'RD-9', site: '南区机房', remark: '夜间', status: 'open', owner: 'emp_lin', updatedAt: '1' },
    { roundNo: 'RD-8', site: '北区机房', remark: '白班', status: 'done', owner: 'emp_lin', updatedAt: '1' },
  ],
  oa_orders: [
    { bizNo: 'OA-12', title: '天工急件', dept: '采购', status: 'pending', owner: 'emp_lin', updatedAt: '1' },
    { bizNo: 'OA-13', title: '成都备件', dept: '采购', status: 'pending', owner: 'emp_other', updatedAt: '1' },
  ],
}

function nocobaseLookup(extra = {}) {
  const calls = extra.calls || []
  return createLookup({
    baseUrl: extra.baseUrl || 'https://nb.example',
    staffId: extra.staffId || 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(String(url))
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(decoded)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { name: 'crm_accounts', title: '客户台账', fields: [{ name: 'code' }, { name: 'title' }] },
              { name: 'ops_rounds', title: '巡检单', fields: [{ name: 'roundNo' }, { name: 'site' }] },
            ],
          }),
        }
      }
      for (const [resource, rows] of Object.entries(TABLES)) {
        if (decoded.includes(`${resource}:list`)) {
          return { ok: true, status: 200, json: async () => ({ data: extra.rows || rows }) }
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
}

function restLookup(calls = []) {
  return createLookup({
    resolve: async () => ({
      staffId: 'emp_lin',
      connections: [{
        id: 'oa',
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        listPath: '/v1/orders?q={q}',
        ticketField: 'bizNo',
        writePath: '/v1/orders/{no}',
        kinds: [{ kind: '审批单', resource: 'oa_orders', ticketField: 'bizNo' }],
        staffId: 'emp_lin',
      }],
    }),
    fetchImpl: async (url) => {
      calls.push(String(url))
      return { ok: true, status: 200, json: async () => ({ items: TABLES.oa_orders }) }
    },
  })
}

test('mapKind source order: vocab, connector, discovery, then builtin fallback', () => {
  assert.deepEqual(mapKind('客户台账', {
    vocab: [{ kind: '客户台账', resource: 'crm_accounts', ticketField: 'code' }],
    collections: [{ name: 'other', title: '客户台账', fields: ['id'] }],
  }), { resource: 'crm_accounts', fields: ['code'] })
  assert.deepEqual(mapKind('巡检单', {
    kinds: [{ kind: '巡检单', resource: 'ops_rounds', ticketField: 'roundNo' }],
  }), { resource: 'ops_rounds', fields: ['roundNo'] })
  assert.deepEqual(mapKind('客户台账', {
    collections: [{ name: 'crm_accounts', title: '客户台账', fields: ['code', 'title'] }],
  }), { resource: 'crm_accounts', fields: ['code', 'title'] })
  assert.equal(mapKind('采购单', {}), null)
  assert.equal(mapKind('便签', {}), null)
})

test('typed parse does not auto-preview writes for vocab-only kinds', async () => {
  const A = createSecretary({
    store: memStore(),
    now: () => 1,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    loadVocab: async () => VOCAB_ONLY,
    lookupTodo: async () => ({ ok: false, error: 'NOT_FOUND' }),
    gate: createGate({
      lookupTodo: async () => ({ ok: false, error: 'NOT_FOUND' }),
      now: () => 1,
      loadVocab: async () => VOCAB_ONLY,
    }),
  })
  for (const text of ['改一下巡检单 南区机房', '删一下客户台账 A-1', '过一下客户台账 台账甲', '新建巡检单 西区']) {
    const heard = await A.hearUserLine('s', text, '/ws')
    assert.notEqual(heard.heard, 'preview', text)
    assert.ok(!heard.preview || !heard.preview.preview_id, text)
  }
})

test('any field, nested object and ticket-shaped remark resolve the same on every table', () => {
  const cases = [
    [TABLES.crm_accounts, '西安', 'A-1', ['code']],
    [TABLES.crm_accounts, '系统集成', 'A-1', ['code']],
    [TABLES.crm_accounts, '林督', 'A-1', ['code']],
    [TABLES.ops_rounds, '南区机房', 'RD-9', ['roundNo']],
    [TABLES.oa_orders, '天工急件', 'OA-12', ['bizNo']],
  ]
  for (const [rows, clue, ticket, fields] of cases) {
    const one = resolveRows(rows, clue, fields)
    assert.equal(one.ok, true, clue)
    assert.equal(one.ambiguous, false, clue)
    assert.equal(one.no, ticket, clue)
    assert.equal(resolveRows(rows, '没有这条', fields).error, 'NOT_FOUND', clue)
  }
  const many = resolveRows(TABLES.oa_orders, '采购', ['bizNo'])
  assert.equal(many.ambiguous, true)
  const exact = resolveRows(TABLES.crm_accounts, 'A-1', ['code'])
  assert.equal(exact.no, 'A-1')
  assert.equal(exact.ambiguous, false)
})

test('NocoBase lookup/preview/write share mapped resource for a vocab-only kind', async () => {
  const calls = []
  const writes = []
  const lookup = nocobaseLookup({ calls })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (url, init) => {
      writes.push({ url: String(url), method: init.method, body: init.body })
      if (init && init.body) {
        try {
          const parsed = JSON.parse(init.body)
          const values = parsed.values && typeof parsed.values === 'object' ? parsed.values : parsed
          const row = TABLES.crm_accounts.find((item) => item.code === 'A-1')
          if (row) Object.assign(row, values)
        } catch { /* ignore */ }
      }
      return { ok: true, json: async () => ({ receiptId: 'rcpt_a' }) }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: (spec) => writer.write(spec),
    now: () => 1,
    loadVocab: async () => VOCAB_ONLY,
  })
  for (const [kind, clue, ticket, action] of [
    ['客户台账', '西安', 'A-1', '改行'],
    ['巡检单', '南区机房', 'RD-9', '删除'],
    ['客户台账', '台账甲', 'A-1', '过审'],
  ]) {
    const preview = await gate.preview({
      kind,
      no: clue,
      action,
      patch: action === '改行' ? { remark: '跟进' } : undefined,
      workspace: '/ws',
    })
    assert.equal(preview.ok, true, `${kind}:${action}`)
    assert.equal(preview.no, ticket, `${kind}:${action}`)
    assert.ok(preview.mapped.resource, `${kind}:${action}`)
    const written = await gate.write({ preview_id: preview.preview_id, trace_id: `t_${kind}_${action}` })
    assert.equal(written.ok, true, `${kind}:${action}`)
  }
  const created = await gate.preview({
    kind: '客户台账',
    no: '新客',
    action: '新建',
    patch: { remark: '新客' },
    workspace: '/ws',
  })
  assert.equal(created.ok, true)
  assert.equal(created.action, '新建')
  const posted = await gate.write({ preview_id: created.preview_id, trace_id: 't_new' })
  assert.equal(posted.ok, true)
  assert.ok(writes.some((row) => /crm_accounts:(update|destroy|create)/.test(row.url)))
  assert.ok(writes.some((row) => /ops_rounds:destroy/.test(row.url)))
  assert.ok(writes.every((row) => !/biz_purchase_orders/.test(row.url)))
  assert.ok(calls.some((url) => /crm_accounts:list/.test(url) || /ops_rounds:list/.test(url)))
})

test('REST dialect uses configured path after any-field resolve', async () => {
  const calls = []
  const lookup = restLookup(calls)
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    loadVocab: async () => [{ kind: '审批单', resource: 'oa_orders', ticketField: 'bizNo', can: ['过审'] }],
  })
  const preview = await gate.preview({ kind: '审批单', no: '天工急件', action: '过审', workspace: '/ws' })
  assert.equal(preview.ok, true)
  assert.equal(preview.no, 'OA-12')
  assert.match(calls[0], /oa.example\/v1\/orders\?q=/)
  const many = await gate.preview({ kind: '审批单', no: '采购', action: '过审', workspace: '/ws' })
  assert.ok(!many.preview_id)
  assert.equal((many.sheet && many.sheet.rows || []).length, 2)
  const foreign = await gate.preview({ kind: '审批单', no: 'OA-13', action: '过审', workspace: '/ws' })
  assert.equal(foreign.ok, true)
  assert.equal(foreign.no, 'OA-13')
  assert.match(foreign.speak, /负责人不是这台号/)
})

test('discovery fills a kind only when vocab and connector have no map', async () => {
  const calls = []
  const lookup = nocobaseLookup({ calls })
  const found = await lookup.lookupTodo({ kind: '客户台账', no: 'A-1' })
  assert.equal(found.ok, true)
  assert.equal(found.no, 'A-1')
  assert.ok(calls.some((url) => /collections:list/.test(url)))
  assert.ok(calls.some((url) => /crm_accounts:list/.test(url)))
})

test('gate refusals stay the same on every unregistered or forbidden path', async () => {
  const lookup = nocobaseLookup()
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    loadVocab: async () => VOCAB_ONLY,
  })
  const missing = await gate.preview({ kind: '客户台账', no: 'A-1', action: '改行' })
  assert.equal(missing.error, 'NO_CWD')
  const unknown = await gate.preview({ kind: '便签', no: 'N-1', action: '改行', workspace: '/ws' })
  assert.equal(unknown.error, 'UNKNOWN_KIND')
  for (const table of SYSTEM_TABLES) {
    const blocked = await gate.preview({ kind: table, no: '1', action: '改行', workspace: '/ws' })
    assert.equal(blocked.error, 'SYSTEM_TABLE', table)
  }
  const denied = await gate.preview({ kind: '巡检单', no: 'RD-9', action: '过审', workspace: '/ws' })
  assert.equal(denied.error, 'ACTION_DENIED')
  const phone = await gate.preview({
    kind: '客户台账',
    no: 'A-1',
    action: '改行',
    patch: { phone: '13800138000' },
    workspace: '/ws',
  })
  assert.equal(phone.ok, true)
  assert.equal(phone.action, '改行')
  assert.deepEqual(phone.patch, { phone: '13800138000' })
  const none = await gate.preview({ kind: '客户台账', no: '没有这家', action: '改行', workspace: '/ws' })
  assert.equal(none.error, 'NOT_FOUND')
})

test('typed chat matrix covers vocab kinds, lookup-only, write preview and refuse-many', async () => {
  const lookup = nocobaseLookup()
  const A = createSecretary({
    store: memStore(),
    now: () => 1,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    loadVocab: async () => VOCAB_ONLY.map((row) => (
      row.kind === '巡检单' ? { ...row, can: ['现查', '改行'] } : row
    )),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now: () => 1,
      loadVocab: async () => VOCAB_ONLY.map((row) => (
        row.kind === '巡检单' ? { ...row, can: ['现查', '改行'] } : row
      )),
    }),
  })
  const heard = await A.hearUserLine('s', '查一下客户台账 西安', '/ws')
  assert.notEqual(heard.heard, 'lookup')
  const seen = await A.previewBiz({
    kind: '客户台账',
    no: '西安',
    action: '现查',
    speech: '查一下客户台账 西安',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(seen.ok, true)
  assert.match(seen.speak || seen.sheet.speak || seen.no, /A-1|台账甲|西安/)
  const dock = await A.dock('s')
  assert.notEqual(dock && dock.mode, 'preview')

  const change = await A.previewBiz({
    kind: '巡检单',
    no: '南区机房',
    action: '改行',
    patch: { site: '南区机房' },
    speech: '改一下巡检单 南区机房',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(change.ok, true)
  assert.equal(change.kind, '巡检单')
  assert.equal(change.no, 'RD-9')
  assert.equal(change.mapped.resource, 'ops_rounds')

  const created = await A.previewBiz({
    kind: '客户台账',
    no: '新客',
    action: '新建',
    speech: '新建客户台账 新客',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.equal(created.action, '新建')
  assert.match(created.speak, /将新建/)

  const many = await A.previewBiz({
    kind: '客户台账',
    no: '台账',
    action: '改行',
    speech: '改一下客户台账 台账',
    sessionId: 's',
    workspace: '/ws',
    merge: false,
  })
  assert.ok(!many.preview_id)
  assert.ok((many.sheet && many.sheet.rows || []).length > 1)
})
