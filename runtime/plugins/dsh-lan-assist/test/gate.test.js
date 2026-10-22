import { test } from 'node:test'
// Speech-hop gate tests are skipped: production preview only executes where/from/steps/no/patch.
import assert from 'node:assert/strict'
import { createLookup } from '../lookup.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'
import { createGate, createNocoWrite, kindsFromGraphNodes, stringList, SYSTEM_TABLES } from '../write.js'
import { withSpoken } from './ask-clue.js'

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

const VOCAB = withSpoken([
  { kind: '采购单', fields: ['单号', '状态'], can: ['过审', '现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo' },
  { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
])

function liveLookup(rows) {
  return createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      const hit = rows.find((row) => decoded.includes(row.resource) && decoded.includes(row.no))
      if (!hit) return { ok: true, status: 200, json: async () => ({ data: [] }) }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{
            [hit.field]: hit.no,
            status: hit.status,
            owner: hit.owner || 'emp_lin',
            updatedAt: hit.updatedAt || '1',
            remark: hit.remark || '',
          }],
        }),
      }
    },
  })
}

function gateOf(rows, extra = {}) {
  const lookup = liveLookup(rows)
  return createGate({
    vocab: extra.vocab || VOCAB,
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: extra.postWrite,
    now: extra.now || (() => 1_700_000_000_000),
  })
}

test('speech without a write verb cannot upgrade 现查 to 改行', async () => {
  const gate = gateOf([{ resource: 'biz_tickets', field: 'ticketNo', no: 'TK-1', status: '待审' }], {
    vocab: [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
  })
  const preview = await gate.preview({
    kind: '工单',
    no: 'TK-1',
    action: '现查',
    speech: '把故障类工单列出来',
    workspace: '/ws',
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.action, '现查')
  assert.equal(preview.preview_id, undefined)
})

test('preview of a registered purchase order issues a short-lived token', async () => {
  const gate = gateOf([{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }])
  const preview = await gate.preview({
    system: '采购',
    env: '测试',
    kind: '采购单',
    no: 'PO-12',
    action: '过审',
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.kind, '采购单')
  assert.equal(preview.no, 'PO-12')
  assert.equal(preview.action, '过审')
  assert.match(preview.from, /待审/)
  assert.match(preview.to, /已过/)
  assert.ok(preview.preview_id)
  assert.ok(preview.fingerprint)
  assert.ok(preview.expiresAt > 1_700_000_000_000)
  assert.ok(preview.expiresAt - 1_700_000_000_000 <= 120_000)
  assert.match(preview.speak, /将改采购单 PO-12/)
  assert.match(preview.speak, /待审/)
  assert.ok(preview.sheet)
  assert.equal(preview.sheet.canWrite, true)
  assert.equal(preview.sheet.rows.length, 1)
  assert.equal(preview.sheet.rows[0].no, 'PO-12')
})

test('preview speak still names the ticket and is not a post', async () => {
  const gate = gateOf([{
    resource: 'biz_purchase_orders',
    field: 'orderNo',
    no: 'PO-12',
    status: '待审',
    remark: '客户全称：上海某某贸易 金额 12000 元 电话 13800138000',
  }])
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  assert.equal(preview.ok, true)
  assert.match(preview.speak, /将改采购单 PO-12/)
  assert.match(preview.speak, /不是过账/)
})

test('改行 preview names old value to new value, not status to field', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          code: 'CUST-020',
          status: 'inactive',
          phone: '029-88880000',
          owner: 'emp_lin',
          updatedAt: '1',
        }],
      }),
    }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  })
  const preview = await gate.preview({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { phone: '12345678901' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  assert.match(preview.speak, /将改客户 CUST-020/)
  assert.match(preview.speak, /电话/)
  assert.match(preview.speak, /029-88880000/)
  assert.match(preview.speak, /12345678901/)
  assert.doesNotMatch(preview.speak, /inactive → phone|从inactive/)
  assert.equal(preview.from, '029-88880000')
  assert.match(preview.to, /12345678901/)
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
    gate,
  })
  await A.previewBiz({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { phone: '12345678901' },
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'preview')
  assert.match(dock.speak, /将改客户 CUST-020/)
  assert.match(dock.speak, /029-88880000/)
  assert.match(dock.speak, /12345678901/)
  assert.doesNotMatch(dock.speak, /从 inactive → phone/)
  assert.match(dock.prompt, /请到右边确认/)
  const snap = await A.snapshot()
  assert.equal(snap.pendingSheet.canWrite, true)
  assert.equal(snap.pendingSheet.rows[0].no, 'CUST-020')
})

test('write that does not change the field is a failure, not a silent receipt miss', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ code: 'CUST-020', status: 'inactive', phone: '029-88880000', owner: 'emp_lin', updatedAt: '1' }],
      }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: { id: 20 } }) }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: (spec) => writer.write(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  })
  const preview = await gate.preview({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { phone: '12345678901' },
    workspace: '/mail/nocobase-test',
  })
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'phone' })
  assert.equal(written.ok, false)
  assert.equal(written.failed, true)
  assert.doesNotMatch(written.speak || '', /写了但没回执/)
})

test('failed write keeps the 业务 sheet so the human can retry', async () => {
  const lookup = liveLookup([{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: async () => ({ ok: false, failed: true }),
    now: () => 1_700_000_000_000,
    vocab: VOCAB,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate,
  })
  const preview = await A.previewBiz({
    kind: '采购单',
    no: 'PO-12',
    action: '过审',
    sessionId: 'sess-gray',
    workspace: '/mail/buy',
  })
  assert.equal(preview.ok, true)
  assert.ok(preview.preview_id)
  const written = await A.commitWrite({ preview_id: preview.preview_id })
  assert.equal(written.ok, false)
  const snap = await A.snapshot('sess-gray')
  assert.ok(snap.pendingSheet)
  assert.equal(snap.pendingSheet.kind, '采购单')
  assert.equal(snap.pendingSheet.rows[0].no, 'PO-12')
})

test('现查 listing is not covered by a leftover 删除 preview', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK-1', status: 'processing', priority: 'urgent', category: 'incident', owner: 'emp_lin', updatedAt: '2' },
          { ticketNo: 'TK-2', status: 'processing', priority: 'urgent', category: 'complaint', owner: 'emp_lin', updatedAt: '1' },
        ],
      }),
    }),
  })
  const vocab = withSpoken([{ kind: '工单', fields: ['单号', '状态'], can: ['现查', '删除'], resource: 'biz_tickets', ticketField: 'ticketNo' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  await A.previewBiz({
    kind: '工单',
    no: 'TK-1',
    action: '删除',
    speech: '删一下工单 TK-1',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  const looked = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '故障类或投诉类的紧急工单发给我',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true, looked.error)
  assert.equal(looked.action, '现查')
  const snap = await A.snapshot('sess-nb')
  assert.equal(snap.pendingSheet.action, '现查')
  assert.notEqual(snap.pendingSheet.action, '删除')
  assert.ok((snap.pendingSheet.rows || []).length >= 1)
})

test('missing ticket field cannot pretend a remark write posted', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_tickets',
              title: '工单',
              fields: [{ name: 'ticketNo' }, { name: 'title' }, { name: 'status' }, { name: 'description' }],
            }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{
            ticketNo: 'TK20260305892',
            title: '系统无法登录',
            status: 'processing',
            description: '客户报障工单',
            owner: 'emp_lin',
            updatedAt: '1',
          }],
        }),
      }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, vocab) => lookup.fieldsOf(kind, vocab),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
  })
  const preview = await gate.preview({
    kind: '工单',
    no: 'TK20260305892',
    action: '改行',
    patch: { remark: '先看日志' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'NO_PATCH')
  assert.equal(preview.preview_id, undefined)
})

test('spoken 说明 does not guess description; 问题描述 maps from the schema title', async () => {
  const tickets = [
    { ticketNo: 'TK-1', status: 'processing', category: 'incident', title: '甲', description: '旧说明', owner: 'emp_lin', updatedAt: '2' },
    { ticketNo: 'TK-2', status: 'processing', category: 'incident', title: '乙', description: '旧说明', owner: 'emp_lin', updatedAt: '1' },
  ]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_tickets',
              title: '工单',
              fields: [
                { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                { name: 'title', uiSchema: { title: '工单标题' } },
                { name: 'status', uiSchema: { title: '工单状态' } },
                { name: 'description', uiSchema: { title: '问题描述' } },
              ],
            }],
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: tickets }) }
    },
  })
  const vocab = [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const guessed = await gate.preview({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '把故障类处理中的工单说明改成先看日志',
    patch: { 说明: '先看日志' },
    where: [{ keys: ['status'], values: ['processing'] }],
    workspace: '/mail/nocobase-test',
  })
  assert.equal(guessed.preview_id, undefined)
  assert.notEqual(guessed.error, 'PICK_FIELD')
  assert.ok((guessed.sheet.rows || []).every((row) => row.no === 'TK-1' || row.no === 'TK-2'))

  const titled = await gate.preview({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '把故障类处理中的工单问题描述改成先看日志',
    patch: { description: '先看日志' },
    where: [{ keys: ['status'], values: ['processing'] }],
    workspace: '/mail/nocobase-test',
  })
  assert.equal(titled.sheet.kind, '工单')
  assert.equal(titled.sheet.rows.length, 2)
  assert.equal(titled.patch.description, '先看日志')
  assert.ok(!titled.preview_id)
  assert.equal(titled.patch.remark, undefined)
})

test('停用客户恒通改成成交 lists matching customers instead of picking a column', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_customers',
              title: '客户',
              fields: [
                { name: 'code', uiSchema: { title: '客户编号' } },
                { name: 'name', uiSchema: { title: '客户名称' } },
                {
                  name: 'status',
                  uiSchema: {
                    title: '客户状态',
                    enum: [
                      { value: 'inactive', label: '停用' },
                      { value: 'active', label: '成交' },
                    ],
                  },
                },
              ],
            }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, code: 'CUST2056', name: '深圳恒通电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '4' },
            { id: 2, code: 'CUST2058', name: '苏州恒通科技有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '3' },
            { id: 3, code: 'CUST9999', name: '别家', status: 'inactive', owner: 'emp_lin', updatedAt: '2' },
            { id: 4, code: 'CUST3001', name: '杭州恒通', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查', '改行'], resource: 'biz_customers', ticketField: 'code' }]
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  }).preview({
    kind: '客户',
    no: '',
    action: '改行',
    speech: '把停用客户恒通改成成交',
    where: [
      { keys: ['status'], values: ['停用'] },
      { keys: ['name'], values: ['恒通'] },
    ],
    patch: { status: '成交' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.sheet.pickField, false)
  assert.notEqual(looked.error, 'PICK_FIELD')
  assert.equal(looked.sheet.kind, '客户')
  assert.equal(looked.sheet.action, '改行')
  assert.deepEqual((looked.sheet.rows || []).map((row) => row.no).sort(), ['CUST2056', 'CUST2058'])
  assert.equal(looked.patch.status, 'active')
  assert.ok(!looked.preview_id)
})

test('紧急工单改成已解决 hops that customer tickets, not a customer write', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'biz_customers',
                title: '客户',
                fields: [
                  { name: 'code', uiSchema: { title: '客户编号' } },
                  { name: 'name', uiSchema: { title: '客户名称' } },
                  {
                    name: 'status',
                    uiSchema: {
                      title: '客户状态',
                      enum: [
                        { value: 'suspended', label: '暂停合作' },
                        { value: 'inactive', label: '停用' },
                      ],
                    },
                  },
                ],
              },
              {
                name: 'biz_tickets',
                title: '工单',
                fields: [
                  { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                  { name: 'customerId', interface: 'integer' },
                  { name: 'customer', interface: 'm2o', target: 'biz_customers', uiSchema: { title: '客户名称' } },
                  {
                    name: 'priority',
                    uiSchema: { title: '优先级', enum: [{ value: 'urgent', label: '紧急' }] },
                  },
                  {
                    name: 'status',
                    uiSchema: {
                      title: '工单状态',
                      enum: [
                        { value: 'processing', label: '处理中' },
                        { value: 'resolved', label: '已解决' },
                      ],
                    },
                  },
                ],
              },
            ],
          }),
        }
      }
      if (decoded.includes('biz_tickets')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { ticketNo: 'TK-KEEP-1', status: 'processing', priority: 'urgent', customerId: 2047, owner: 'emp_lin', updatedAt: '3' },
              { ticketNo: 'TK-KEEP-2', status: 'processing', priority: 'urgent', customerId: 2047, owner: 'emp_lin', updatedAt: '2' },
              { ticketNo: 'TK-OTHER', status: 'processing', priority: 'urgent', customerId: 99, owner: 'emp_lin', updatedAt: '4' },
              { ticketNo: 'TK-DONE', status: 'resolved', priority: 'urgent', customerId: 2047, owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2047, code: 'CUST2047', name: '武汉云启电子有限公司', status: 'suspended', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查', '改行'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '工单', fields: ['单号', '状态'], can: ['现查', '改行'], resource: 'biz_tickets', ticketField: 'ticketNo' },
  ]
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  }).preview({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '把武汉云启电子的紧急工单改成已解决',
    from: {
      kind: '客户',
      where: [{ keys: ['name'], values: ['武汉云启电子'] }],
    },
    where: [{ keys: ['priority'], values: ['紧急'] }],
    patch: { status: '已解决' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.sheet.kind, '工单')
  assert.notEqual(looked.sheet.kind, '客户')
  assert.equal(looked.sheet.action, '改行')
  const nos = (looked.sheet.rows || []).map((row) => row.no).sort()
  assert.ok(nos.includes('TK-KEEP-1') && nos.includes('TK-KEEP-2'))
  assert.ok(!nos.includes('TK-OTHER'))
  assert.equal(looked.patch.status, 'resolved')
  assert.equal(looked.patch.tickets, undefined)
  assert.ok(!looked.preview_id)
})

test('删除停用客户恒通 lists matches and does not pick a column', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_customers',
              title: '客户',
              fields: [
                { name: 'code', uiSchema: { title: '客户编号' } },
                { name: 'name', uiSchema: { title: '客户名称' } },
                {
                  name: 'status',
                  uiSchema: {
                    title: '客户状态',
                    enum: [
                      { value: 'inactive', label: '停用' },
                      { value: 'active', label: '成交' },
                    ],
                  },
                },
              ],
            }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, code: 'CUST2056', name: '深圳恒通电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '4' },
            { id: 2, code: 'CUST2058', name: '苏州恒通科技有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '3' },
            { id: 3, code: 'CUST9999', name: '别家', status: 'inactive', owner: 'emp_lin', updatedAt: '2' },
          ],
        }),
      }
    },
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查', '删除'], resource: 'biz_customers', ticketField: 'code' }]
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  }).preview({
    kind: '客户',
    no: '',
    action: '删除',
    speech: '删一下停用客户恒通',
    where: [
      { keys: ['status'], values: ['停用'] },
      { keys: ['name'], values: ['恒通'] },
    ],
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.sheet.pickField, false)
  assert.notEqual(looked.error, 'PICK_FIELD')
  assert.equal(looked.sheet.kind, '客户')
  assert.equal(looked.sheet.action, '删除')
  assert.deepEqual((looked.sheet.rows || []).map((row) => row.no).sort(), ['CUST2056', 'CUST2058'])
  assert.ok(!looked.preview_id)
})

test('empty action stays 现查 and does not default to 过审', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ code: 'CUST-1', name: '甲', status: 'active', owner: 'emp_lin', updatedAt: '1' }] }),
    }),
  })
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  }).preview({
    kind: '客户',
    no: '',
    speech: '查一下客户',
    workspace: '/ws',
  })
  assert.equal(looked.sheet.action, '现查')
  assert.notEqual(looked.sheet.action, '过审')
  assert.ok(!looked.preview_id)
})

test('speech rest 西安恒通 filters customers even when no is empty', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2105, code: 'CUST2105', name: '西安恒通数据服务有限公司', status: 'active', owner: 'emp_lin', updatedAt: '2' },
            { id: 2152, code: 'CUST2152', name: '西安恒通电子有限公司', status: 'active', owner: 'emp_lin', updatedAt: '1' },
            { id: 9999, code: 'CUST9999', name: '别家', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' },
    { kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '销售订单',
    no: '',
    action: '现查',
    speech: '西安恒通还有哪些销售订单？',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['西安恒通'] }] },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '客户')
  assert.deepEqual(looked.sheet.rows.map((row) => row.no).sort(), ['CUST2105', 'CUST2152'])
  assert.equal(looked.sheet.nextKind, '销售订单')
})

function inactiveCustomerLookup() {
  return createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'biz_tickets',
                title: '工单',
                fields: [
                  { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                  { name: 'customerId', uiSchema: { title: '客户' } },
                  { name: 'status', uiSchema: { title: '工单状态' } },
                ],
              },
              {
                name: 'biz_customers',
                title: '客户',
                fields: [
                  { name: 'code', uiSchema: { title: '客户编号' } },
                  { name: 'name', uiSchema: { title: '客户名称' } },
                  { name: 'status', uiSchema: { title: '状态' } },
                ],
              },
            ],
          }),
        }
      }
      if (decoded.includes('biz_tickets')) {
        const for2150 = decoded.includes('2150')
        const for2047 = decoded.includes('2047')
        if (!for2150 && !for2047) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { ticketNo: 'TK-LATEST', customerId: 1, status: 'processing', owner: 'emp_lin', updatedAt: '9' },
                { ticketNo: 'TK-OTHER', customerId: 2, status: 'processing', owner: 'emp_lin', updatedAt: '8' },
              ],
            }),
          }
        }
        const rows = [
          for2150 ? { ticketNo: 'TK-2150-OPEN', customerId: 2150, status: 'processing', owner: 'emp_lin', updatedAt: '3' } : null,
          for2150 ? { ticketNo: 'TK-2150-CLOSED', customerId: 2150, status: 'closed', owner: 'emp_lin', updatedAt: '2' } : null,
          for2047 ? { ticketNo: 'TK-2047-CLOSED', customerId: 2047, status: 'resolved', owner: 'emp_lin', updatedAt: '1' } : null,
        ].filter(Boolean)
        return { ok: true, status: 200, json: async () => ({ data: rows }) }
      }
      const many = !/CUST2150|2150/.test(decoded) || decoded.includes('$in')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: many
            ? [
              { id: 2150, code: 'CUST2150', name: '沈阳博远电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '3' },
              { id: 2047, code: 'CUST2047', name: '武汉云启电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '2' },
            ]
            : [{ id: 2150, code: 'CUST2150', name: '沈阳博远电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '3' }],
        }),
      }
    },
  })
}

const INACTIVE_CUSTOMER_VOCAB = [
  { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
  { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
]

test('停用客户还有哪些没关的工单 lists matching customers to pick before hopping', async () => {
  const lookup = inactiveCustomerLookup()
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
      now,
      loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
    }),
  })
  const looked = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    from: { kind: '客户', where: [{ keys: ['status'], values: ['inactive'] }] },
    where: [{ keys: ['status'], values: ['closed', 'resolved'], not: true }],
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '客户')
  assert.equal(looked.sheet.nextKind, '工单')
  assert.deepEqual((looked.sheet.rows || []).map((row) => row.no).sort(), ['CUST2047', 'CUST2150'])
  assert.ok(!(looked.sheet.rows || []).some((row) => row.no === 'TK-LATEST'))
  const picked = await A.pickSheetRow({ no: 'CUST2150' })
  assert.equal(picked.ok, true)
  assert.equal(picked.sheet.kind, '工单')
  assert.equal(picked.sheet.nextKind, '')
  assert.deepEqual((picked.sheet.rows || []).map((row) => row.no), ['TK-2150-OPEN'])
})

test('hop without a child foreign key lists the parent instead of the latest child page', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { name: 'biz_tickets', title: '工单', fields: [{ name: 'ticketNo' }] },
              { name: 'biz_customers', title: '客户', fields: [{ name: 'code' }] },
            ],
          }),
        }
      }
      if (decoded.includes('biz_tickets')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { ticketNo: 'TK-LATEST', status: 'processing', owner: 'emp_lin', updatedAt: '9' },
              { ticketNo: 'TK-OTHER', status: 'processing', owner: 'emp_lin', updatedAt: '8' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2150, code: 'CUST2150', name: '沈阳博远', status: 'inactive', owner: 'emp_lin', updatedAt: '3' },
            { id: 2047, code: 'CUST2047', name: '武汉云启', status: 'inactive', owner: 'emp_lin', updatedAt: '2' },
          ],
        }),
      }
    },
  })
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
  }).preview({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    from: { kind: '客户', where: [{ keys: ['status'], values: ['inactive'] }] },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.sheet.kind, '客户')
  assert.equal(looked.sheet.nextKind, '工单')
  assert.deepEqual((looked.sheet.rows || []).map((row) => row.no).sort(), ['CUST2047', 'CUST2150'])
  assert.ok(!(looked.sheet.rows || []).some((row) => /^TK-/.test(row.no)))
})

test('speech without from does not hop to the parent kind', async () => {
  const lookup = inactiveCustomerLookup()
  const preview = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
  }).preview({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.sheet.kind, '工单')
  assert.ok((preview.sheet.rows || []).some((row) => /^TK-/.test(row.no)))
  assert.ok(!(preview.sheet.rows || []).some((row) => /^CUST/.test(row.no)))
})

test('parent ticket-shaped code still hops when speech names the child kind', async () => {
  const lookup = inactiveCustomerLookup()
  const hopped = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
  }).preview({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '停用客户还有哪些没关的工单？',
    from: { kind: '客户', no: 'CUST2150' },
    where: [{ keys: ['status'], values: ['closed', 'resolved'], not: true }],
    workspace: '/mail/nocobase-test',
  })
  assert.equal(hopped.ok, true)
  assert.equal(hopped.sheet.kind, '工单')
  assert.notEqual(hopped.sheet.kind, '客户')
  assert.deepEqual((hopped.sheet.rows || []).map((row) => row.no), ['TK-2150-OPEN'])
})

test('preview with a kind fragment does not hop from the session line', async () => {
  const lookup = inactiveCustomerLookup()
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
      now,
      loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
    }),
  })
  await A.hearUserLine('sess-nb', '停用客户还有哪些没关的工单？', '/mail/nocobase-test')
  const looked = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '工单',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '工单')
  assert.ok((looked.sheet.rows || []).some((row) => /^TK-/.test(row.no)))
  assert.ok(!(looked.sheet.rows || []).some((row) => /^CUST/.test(row.no)))
})

test('a later parent preview replaces hopped tickets', async () => {
  const lookup = inactiveCustomerLookup()
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
      now,
      loadVocab: async () => INACTIVE_CUSTOMER_VOCAB,
    }),
  })
  const speech = '停用客户还有哪些没关的工单？'
  const listed = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech,
    from: { kind: '客户', where: [{ keys: ['status'], values: ['inactive'] }] },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(listed.sheet.kind, '客户')
  const hopped = await A.pickSheetRow({ no: 'CUST2150' })
  assert.equal(hopped.sheet.kind, '工单')
  const cover = await A.previewBiz({
    kind: '客户',
    no: '',
    action: '现查',
    speech,
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(cover.sheet.kind, '客户')
})

test('named owner before 的工单 hops even when 客户 is not spoken', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'biz_tickets',
                title: '工单',
                fields: [
                  { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                  { name: 'description', uiSchema: { title: '问题描述' } },
                  { name: 'customerId', uiSchema: { title: '客户' } },
                  { name: 'status', uiSchema: { title: '工单状态' } },
                ],
              },
              {
                name: 'biz_customers',
                title: '客户',
                fields: [
                  { name: 'code', uiSchema: { title: '客户编号' } },
                  { name: 'name', uiSchema: { title: '客户名称' } },
                ],
              },
            ],
          }),
        }
      }
      if (decoded.includes('biz_tickets')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { ticketNo: 'TK-A', customerId: 2151, status: 'processing', description: '旧', owner: 'emp_lin', updatedAt: '2' },
              { ticketNo: 'TK-B', customerId: 2151, status: 'processing', description: '更旧', owner: 'emp_lin', updatedAt: '1' },
              { ticketNo: 'TK-OTHER', customerId: 9, status: 'processing', description: '别家', owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2151, code: 'CUST2151', name: '深圳恒通电子有限公司', status: 'active', owner: 'emp_lin', updatedAt: '1' },
            { id: 2056, code: 'CUST2056', name: '深圳恒通数据服务有限公司', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const preview = await gate.preview({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '改一下深圳恒通的工单问题描述',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['深圳恒通'] }] },
    patch: { description: '先查日志' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'AMBIGUOUS')
  assert.equal(preview.sheet.kind, '客户')
  assert.equal(preview.sheet.nextKind, '工单')
  assert.deepEqual(preview.sheet.rows.map((row) => row.no).sort(), ['CUST2056', 'CUST2151'])
  assert.notEqual(preview.error, 'NOT_FOUND')
  assert.notEqual(preview.error, 'NO_REF')
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const listed = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '改一下深圳恒通的工单问题描述',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['深圳恒通'] }] },
    patch: { description: '先查日志' },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(listed.sheet.nextKind, '工单')
  const again = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '改一下深圳恒通的工单问题描述',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['深圳恒通'] }] },
    patch: { description: '先查日志' },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(again.sheet.kind, '客户')
  assert.deepEqual((again.sheet.rows || []).map((row) => row.no).sort(), ['CUST2056', 'CUST2151'])
  const picked = await A.pickSheetRow({ no: 'CUST2151' })
  assert.equal(picked.sheet.kind, '工单')
  assert.deepEqual((picked.sheet.rows || []).map((row) => row.no).sort(), ['TK-A', 'TK-B'])
})

test('hop back restores the parent sheet without looking up parents again', async () => {
  const hits = []
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      if (decoded.includes('biz_tickets')) {
        hits.push('ticket')
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { ticketNo: 'TK-A', customerId: 2151, status: 'processing', owner: 'emp_lin', updatedAt: '2' },
              { ticketNo: 'TK-B', customerId: 2151, status: 'processing', owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      hits.push('customer')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2151, code: 'CUST2151', name: '深圳恒通电子有限公司', status: 'active', owner: 'emp_lin', updatedAt: '2' },
            { id: 2056, code: 'CUST2056', name: '深圳恒通数据服务有限公司', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const listed = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '深圳恒通的工单发给我',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['深圳恒通'] }] },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(listed.sheet.kind, '客户')
  assert.equal(listed.sheet.canBack, false)
  const customerHits = hits.filter((row) => row === 'customer').length
  const hopped = await A.pickSheetRow({ no: 'CUST2151' })
  assert.equal(hopped.ok, true, hopped.error)
  assert.equal(hopped.sheet.kind, '工单')
  assert.equal(hopped.sheet.canBack, true)
  const afterHopCustomers = hits.filter((row) => row === 'customer').length
  const back = await A.backSheet()
  assert.equal(back.ok, true, back.error)
  assert.equal(back.pendingSheet.kind, '客户')
  assert.deepEqual((back.pendingSheet.rows || []).map((row) => row.no).sort(), ['CUST2056', 'CUST2151'])
  assert.equal(back.pendingSheet.canBack, false)
  assert.equal(hits.filter((row) => row === 'customer').length, afterHopCustomers)
  assert.equal(hits.filter((row) => row === 'customer').length, customerHits)
})

test('现查 named owner before 的工单 hops even when 客户 is not spoken', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'biz_tickets',
                title: '工单',
                fields: [
                  { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                  { name: 'customerId', uiSchema: { title: '客户' } },
                ],
              },
              {
                name: 'biz_customers',
                title: '客户',
                fields: [
                  { name: 'code', uiSchema: { title: '客户编号' } },
                  { name: 'name', uiSchema: { title: '客户名称' } },
                ],
              },
            ],
          }),
        }
      }
      if (decoded.includes('biz_tickets')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2151, code: 'CUST2151', name: '深圳恒通实业集团', status: 'potential', owner: 'emp_lin', updatedAt: '1' },
            { id: 2056, code: 'CUST2056', name: '深圳恒通电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '深圳恒通的工单发给我',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['深圳恒通'] }] },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '客户')
  assert.equal(looked.sheet.nextKind, '工单')
  assert.deepEqual(looked.sheet.rows.map((row) => row.no).sort(), ['CUST2056', 'CUST2151'])
})

test('latest sales order remark lists rows instead of NO_REF', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_sales_orders',
              title: '销售订单',
              fields: [
                { name: 'orderNo', uiSchema: { title: '订单编号' } },
                { name: 'remarks', uiSchema: { title: '备注' } },
                { name: 'status', uiSchema: { title: '状态' } },
              ],
            }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { orderNo: 'SO-NEW', remarks: '旧', status: 'confirmed', owner: 'emp_lin', updatedAt: '2' },
            { orderNo: 'SO-OLD', remarks: '更旧', status: 'confirmed', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, vocab) => lookup.fieldsOf(kind, vocab),
    now: () => 1_700_000_000_000,
    loadVocab: async () => withSpoken([{ kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders', ticketField: 'orderNo' }]),
  })
  const preview = await gate.preview({
    kind: '销售订单',
    no: '',
    action: '改行',
    speech: '把销售订单最新一张的备注改成跨表联调',
    patch: { remarks: '跨表联调' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.sheet.kind, '销售订单')
  assert.equal(preview.sheet.rows.length, 2)
  assert.equal(preview.patch.remarks, '跨表联调')
  assert.equal(preview.preview_id, undefined)
})

test('spoken 职位 lists schema titles so the human can pick 职务', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_contacts',
              title: '联系人',
              fields: [
                { name: 'name', uiSchema: { title: '姓名' } },
                { name: 'position', uiSchema: { title: '职务' } },
                { name: 'mobile', uiSchema: { title: '手机' } },
              ],
            }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ name: '王敏', position: '技术总监', mobile: '13700003333', owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [{ kind: '联系人', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contacts', ticketField: 'name' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const guessed = await A.previewBiz({
    kind: '联系人',
    no: '王敏',
    action: '改行',
    speech: '改一下联系人 王敏 的职位，写成交付总监',
    patch: { position: '交付总监' },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(guessed.ok, true, guessed.error)
  assert.equal(guessed.patch.position, '交付总监')
  assert.ok(guessed.preview_id)
  assert.equal((guessed.sheet.changes || []).length, 1)
  assert.equal(guessed.sheet.changes[0].field, 'position')
  assert.equal(guessed.sheet.changes[0].to, '交付总监')
})

test('successful write of one row keeps the rest of the 业务 sheet', async () => {
  const rows = {
    'TK-1': { ticketNo: 'TK-1', status: 'processing', title: '甲', owner: 'emp_lin', updatedAt: '1' },
    'TK-2': { ticketNo: 'TK-2', status: 'processing', title: '乙', owner: 'emp_lin', updatedAt: '1' },
  }
  async function lookupTodo(spec) {
    const no = String(spec.no || '').trim()
    if (!no) {
      return {
        ok: true,
        ambiguous: true,
        matches: [
          { no: 'TK-1', status: 'processing', fields: rows['TK-1'] },
          { no: 'TK-2', status: 'processing', fields: rows['TK-2'] },
        ],
        fingerprint: 'many',
      }
    }
    const row = rows[no]
    if (!row) return { ok: false, error: 'NOT_FOUND' }
    return { ok: true, no, status: row.status, fields: { ...row, title: no === 'TK-1' && spec.kind ? row.title : row.title }, fingerprint: `${no}:${row.title}`, matches: [{ no, status: row.status, fields: row }] }
  }
  const gate = createGate({
    lookupTodo,
    postWrite: async (spec) => {
      if (spec.no === 'TK-1' && spec.patch && spec.patch.title) rows['TK-1'].title = spec.patch.title
      return { ok: true, receiptId: 'rcpt_1' }
    },
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo,
    loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
    gate,
  })
  const listed = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '把处理中的工单备注改成先看日志',
    patch: { title: '先看日志' },
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(listed.sheet.rows.length, 2)
  assert.ok(!listed.preview_id)
  const one = await A.previewBiz({
    kind: '工单',
    no: 'TK-1',
    action: '改行',
    patch: { title: '先看日志' },
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(one.ok, true)
  const written = await A.commitWrite({ preview_id: one.preview_id, trace_id: 'keep-rest' })
  assert.equal(written.ok, true)
  const snap = await A.snapshot('sess-gray')
  assert.ok(snap.pendingSheet)
  assert.equal(snap.pendingSheet.kind, '工单')
  assert.deepEqual(snap.pendingSheet.rows.map((row) => row.no), ['TK-2'])
  assert.equal(snap.pendingSheet.canWrite, false)
})

test('write after hopping from customers keeps remaining tickets, not customer rows', async () => {
  const tickets = [
    { ticketNo: 'TK-1', customerId: 2151, status: 'processing', description: '旧', owner: 'emp_lin', updatedAt: '2' },
    { ticketNo: 'TK-2', customerId: 2151, status: 'processing', description: '更旧', owner: 'emp_lin', updatedAt: '1' },
  ]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'biz_tickets',
                title: '工单',
                fields: [
                  { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                  { name: 'description', uiSchema: { title: '问题描述' } },
                  { name: 'customerId', uiSchema: { title: '客户' } },
                ],
              },
              {
                name: 'biz_customers',
                title: '客户',
                fields: [
                  { name: 'code', uiSchema: { title: '客户编号' } },
                  { name: 'name', uiSchema: { title: '客户名称' } },
                ],
              },
            ],
          }),
        }
      }
      if (decoded.includes('biz_tickets')) {
        return { ok: true, status: 200, json: async () => ({ data: tickets.map((row) => ({ ...row })) }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2151, code: 'CUST2151', name: '深圳恒通实业集团', status: 'potential', owner: 'emp_lin', updatedAt: '1' },
            { id: 2056, code: 'CUST2056', name: '深圳恒通电子有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    postWrite: async (spec) => {
      if (spec.no === 'TK-1' && spec.patch && spec.patch.description) {
        tickets[0].description = spec.patch.description
      }
      return { ok: true, receiptId: 'rcpt_hop' }
    },
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  await A.previewBiz({
    kind: '工单',
    no: '',
    action: '改行',
    speech: '改一下深圳恒通的工单问题描述',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['深圳恒通'] }] },
    patch: { description: '先查日志' },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  const hopped = await A.pickSheetRow({ no: 'CUST2151' })
  assert.equal(hopped.sheet.kind, '工单')
  const one = await A.previewBiz({
    kind: '工单',
    no: 'TK-1',
    action: '改行',
    patch: { description: '先查日志' },
    speech: '改一下深圳恒通的工单问题描述',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(one.ok, true)
  const written = await A.commitWrite({ preview_id: one.preview_id, trace_id: 'hop-keep' })
  assert.equal(written.ok, true)
  const snap = await A.snapshot('sess-nb')
  assert.ok(snap.pendingSheet)
  assert.equal(snap.pendingSheet.kind, '工单')
  assert.deepEqual(snap.pendingSheet.rows.map((row) => row.no), ['TK-2'])
  assert.ok(!snap.pendingSheet.rows.some((row) => /^CUST/.test(row.no)))
})

test('execute receipt stays on the preview session, not the incoming letter or another session', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ code: 'CUST-019', status: 'active', phone: '136000705451', owner: 'emp_lin', updatedAt: '1' }],
      }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: { id: 19 } }) }),
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
  const { A, B, peer } = await pairedMail(
    {},
    {
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        postWrite: (spec) => writer.write(spec),
        now: () => 1_700_000_000_000,
        loadVocab: async () => vocab,
      }),
    },
  )
  const composed = await A.compose({
    excerpt: '改一下客户 CUST-019',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  await A.confirmSend(composed.requestId)
  assert.equal((await B.dock('sess-lin')).mode, 'asked')
  const preview = await B.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  assert.equal((await B.dock('sess-lin')).mode, 'preview')
  const written = await B.commitWrite({ preview_id: preview.preview_id, trace_id: 'phone-stay' })
  assert.equal(written.failed, true)
  const here = await B.dock('sess-lin')
  assert.equal(here.mode, 'compensate')
  assert.match(here.speak, /字段还是旧的|没写成/)
  const other = await B.dock('sess-other')
  assert.notEqual(other && other.mode, 'compensate')
})

test('same opening merges several biz.preview calls into one card; another opening replaces and says so', async () => {
  const rows = [{
    code: 'CUST-019',
    status: 'active',
    phone: '13600705451',
    address: '旧址',
    owner: 'emp_lin',
    updatedAt: '1',
  }]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: rows.map((row) => ({ ...row })) }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (_url, init) => {
      if (init && init.body) Object.assign(rows[0], JSON.parse(init.body))
      return { ok: true, json: async () => ({ data: [{ id: 19, ...rows[0] }] }) }
    },
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' }]
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      postWrite: (spec) => writer.write(spec),
      now,
      loadVocab: async () => vocab,
    }),
  })
  const first = await A.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
    openingId: 'open-1',
  })
  const second = await A.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { address: '新址' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
    openingId: 'open-1',
  })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  const dock = await A.dock('sess-lin')
  assert.equal(dock.mode, 'preview')
  assert.equal((dock.preview.lines || []).length, 2)
  assert.match(dock.speak, /电话/)
  assert.match(dock.speak, /地址|新址/)
  assert.doesNotMatch(dock.speak, /从 inactive → phone|从 旧址 → 新址$/)
  const written = await A.commitWrite({ preview_id: dock.preview.preview_id, trace_id: 'bundle-1' })
  assert.equal(written.ok, true)
  assert.match(written.speak, /库里已改上/)
  assert.match(written.speak, /电话|13323277896/)
  assert.match(written.speak, /地址|新址/)
  const receipt = await A.dock('sess-lin')
  assert.equal(receipt.mode, 'receipt')
  assert.match(receipt.speak, /库里已改上/)
  assert.match(receipt.speak, /13323277896|新址/)
  assert.doesNotMatch(receipt.speak, /现在查不到|没连业务/)
  assert.equal((receipt.speak.match(/库里已改上/g) || []).length, 2)

  const later = await A.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { notes: '跟进' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
    openingId: 'open-2',
  })
  assert.equal(later.ok, true)
  const nextDock = await A.dock('sess-lin')
  assert.equal(nextDock.mode, 'preview')
  assert.equal((nextDock.preview.lines || []).length, 1)
  assert.doesNotMatch(nextDock.speak, /没写|换掉|上一笔/)
  assert.match(nextDock.speak, /跟进|备注/)
  const third = await A.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { notes: '再跟' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
    openingId: 'open-3',
  })
  assert.equal(third.ok, true)
  const swapped = await A.dock('sess-lin')
  assert.equal(swapped.mode, 'preview')
  assert.equal((swapped.preview.lines || []).length, 1)
  assert.match(swapped.speak, /没写|换掉|上一笔/)
  assert.match(swapped.speak, /再跟/)
})

test('ambiguous row stays on the same card and in the wrote letter', async () => {
  const customers = [{
    code: 'CUST-014',
    status: 'active',
    phone: '13600519806',
    owner: 'emp_lin',
    updatedAt: '1',
  }]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_opportunities')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { name: '智能制造升级项目57', stage: 'negotiation', owner: 'emp_lin', updatedAt: '1' },
              { name: '智能制造升级项目57', stage: 'discovery', owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: customers.map((row) => ({ ...row })) }),
      }
    },
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (_url, init) => {
      if (init && init.body) Object.assign(customers[0], JSON.parse(init.body))
      return { ok: true, json: async () => ({ data: [{ id: 14, ...customers[0] }] }) }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' },
    { kind: '商机', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_opportunities' },
  ]
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    catalog: () => [{ name: 'biz_preview' }, { name: 'search_text' }],
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      postWrite: (spec) => writer.write(spec),
      now,
      loadVocab: async () => vocab,
    }),
  })
  await A.previewBiz({
    kind: '客户',
    no: 'CUST-014',
    action: '改行',
    patch: { phone: '13900001111' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
    openingId: 'open-mix',
  })
  const missed = await A.previewBiz({
    kind: '商机',
    no: '智能制造升级项目57',
    action: '改行',
    patch: { stage: 'negotiation' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
    openingId: 'open-mix',
  })
  const missedLine = (missed.lines || []).find((row) => row && row.kind === '商机')
  assert.ok(missedLine)
  assert.equal(missedLine.preview_id, undefined)
  const dock = await A.dock('sess-lin')
  assert.equal(dock.mode, 'preview')
  assert.equal((dock.preview.lines || []).length, 2)
  assert.match(dock.speak, /CUST-014|电话/)
  assert.match(dock.speak, /2 条|最近一页|对上|多条/)
  const written = await A.commitWrite({ preview_id: dock.preview.preview_id, trace_id: 'mix-1' })
  assert.equal(written.ok, true)
  assert.match(written.speak, /库里已改上/)
  assert.ok(written.followup)
})

test('successful write followups the live session with the new values, not the old letter', async () => {
  const rows = [{
    code: 'CUST-019',
    status: 'active',
    phone: '13600705451',
    owner: 'emp_lin',
    updatedAt: '1',
  }]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: rows.map((row) => ({ ...row })) }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (_url, init) => {
      if (init && init.body) {
        Object.assign(rows[0], JSON.parse(init.body))
        rows[0].updatedAt = '2'
      }
      return { ok: true, json: async () => ({ data: [{ id: 19, phone: rows[0].phone }] }) }
    },
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' }]
  const { A, B, peer } = await pairedMail(
    {},
    {
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      catalog: () => [{ name: 'biz_preview' }, { name: 'search_text' }],
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        postWrite: (spec) => writer.write(spec),
        now: () => 1_700_000_000_000,
        loadVocab: async () => vocab,
      }),
    },
  )
  const composed = await A.compose({
    excerpt: '帮我把武汉光谷的电话改成13323277896',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin', '/mail/nocobase-test')
  const preview = await B.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    sessionId: 'sess-lin',
    workspace: '/mail/nocobase-test',
  })
  const written = await B.commitWrite({ preview_id: preview.preview_id, trace_id: 'wrote-now' })
  assert.equal(written.ok, true)
  assert.match(written.speak, /库里已改上/)
  assert.match(written.speak, /13323277896/)
  assert.ok(written.followup)
  assert.equal(written.followup.sessionId, 'sess-lin')
  assert.match(written.followup.text, /13323277896/)
  assert.match(written.followup.text, /库里已改上|现查/)
  assert.match(written.followup.text, /回信/)
})

test('session biz.preview covers the incoming letter even when the tool session id does not match', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          code: 'CUST-019',
          status: 'active',
          phone: '136000705451',
          owner: 'emp_other',
          updatedAt: '1',
        }],
      }),
    }),
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
  const { A, B, peer } = await pairedMail(
    {},
    {
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        now: () => 1_700_000_000_000,
        loadVocab: async () => vocab,
      }),
    },
  )
  const composed = await A.compose({
    excerpt: '帮我把武汉光谷的电话改成13323277896',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin', '/mail/nocobase-test')
  assert.equal((await B.dock('sess-lin')).mode, 'asked')
  const preview = await B.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    sessionId: 'agent-not-the-dock',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  const here = await B.dock('sess-lin')
  assert.equal(here.mode, 'preview')
  assert.equal(here.preview && here.preview.preview_id, preview.preview_id)
  assert.match(here.speak, /CUST-019/)
  assert.notEqual((await B.dock('sess-other')) && (await B.dock('sess-other')).mode, 'preview')
})

test('typed 现查 stays on the typing session even if a letter draft is pending', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK-NEW', status: 'processing', owner: 'emp_lin', updatedAt: '2' },
          { ticketNo: 'TK-OLD', status: 'resolved', owner: 'emp_lin', updatedAt: '1' },
        ],
      }),
    }),
  })
  const vocab = [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }]
  const { A, B, peer } = await pairedMail(
    {},
    {
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        now: () => 1_700_000_000_000,
        loadVocab: async () => vocab,
      }),
    },
  )
  const composed = await A.compose({
    excerpt: '帮我改电话',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.draftReply(incoming.id, 'sess-lin', '/mail/nocobase-test')
  const looked = await B.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '最新工单是哪个用户的？状态是什么？',
    sessionId: 'sess-type',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true, looked.error)
  const typed = await B.snapshot('sess-type')
  assert.ok(typed.pendingSheet)
  assert.equal(typed.pendingSheet.action, '现查')
  assert.ok((typed.pendingSheet.rows || []).length >= 1)
  const letter = await B.snapshot('sess-lin')
  assert.equal(letter.pendingSheet, null)
  const overlay = await B.hall('')
  assert.ok(overlay.pendingSheet)
  assert.ok((overlay.pendingSheet.rows || []).length >= 1)
})

test('改行 posts the ticket code, not id, when vocab only lists 单号', async () => {
  const rows = [{
    code: 'CUST-019',
    status: 'active',
    phone: '136000705451',
    owner: 'emp_lin',
    updatedAt: '1',
  }]
  const writes = []
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: rows.map((row) => ({ ...row })) }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (url, init) => {
      writes.push({ url: String(url), body: init && init.body })
      if (init && init.body) {
        const parsed = JSON.parse(init.body)
        const values = parsed.values && typeof parsed.values === 'object' ? parsed.values : parsed
        Object.assign(rows[0], values)
      }
      return { ok: true, json: async () => ({ data: { id: 19 } }) }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: (spec) => writer.write(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{
      kind: '客户',
      fields: ['单号', '状态'],
      can: ['现查'],
      resource: 'biz_customers',
    }],
  })
  const preview = await gate.preview({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'code-filter' })
  assert.equal(written.ok, true)
  assert.match(decodeURIComponent(writes[0].url), /"code":"CUST-019"/)
  assert.doesNotMatch(decodeURIComponent(writes[0].url), /"id":"CUST-019"|"单号":"CUST-019"/)
  assert.match(writes[0].body, /13323277896/)
  assert.doesNotMatch(writes[0].body, /"values"/)
  const sent = JSON.parse(writes[0].body)
  assert.equal(sent.phone, '13323277896')
})

test('write without a token is refused', async () => {
  const gate = gateOf([{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }])
  const written = await gate.write({ kind: '采购单', no: 'PO-12', action: '过审' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'NEED_PREVIEW')
  assert.match(written.hint, /先预览/)
})

test('stale fingerprint refuses write and asks for a new preview', async () => {
  const rows = [{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审', updatedAt: '1' }]
  const gate = gateOf(rows)
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  assert.equal(preview.ok, true)
  rows[0].status = '已过'
  rows[0].updatedAt = '2'
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 't1' })
  assert.equal(written.ok, false)
  assert.equal(written.error, 'STALE')
  assert.match(written.hint, /不是现在这版/)
})

test('a used or expired token cannot write again', async () => {
  let t = 1_700_000_000_000
  const gate = gateOf(
    [{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }],
    {
      now: () => t,
      postWrite: async () => ({ ok: true, receiptId: 'rcpt_1' }),
    },
  )
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  const first = await gate.write({ preview_id: preview.preview_id, trace_id: 'once' })
  assert.equal(first.ok, true)
  const reused = await gate.write({ preview_id: preview.preview_id, trace_id: 'again' })
  assert.equal(reused.ok, false)
  assert.equal(reused.error, 'USED')

  t += 130_000
  const late = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  t += 130_000
  const expired = await gate.write({ preview_id: late.preview_id, trace_id: 'late' })
  assert.equal(expired.ok, false)
  assert.equal(expired.error, 'EXPIRED')
})

test('same trace_id succeeds only once', async () => {
  const gate = gateOf(
    [{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }],
    { postWrite: async () => ({ ok: true, receiptId: 'rcpt_dup' }) },
  )
  const firstPreview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  const first = await gate.write({ preview_id: firstPreview.preview_id, trace_id: 'same' })
  assert.equal(first.ok, true)
  const secondPreview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  const second = await gate.write({ preview_id: secondPreview.preview_id, trace_id: 'same' })
  assert.equal(second.ok, false)
  assert.equal(second.error, 'DUP_TRACE')
})

test('NocoBase list-shaped update is a receipt, not a missing receipt', async () => {
  const rows = [{
    code: 'CUST-019',
    status: 'active',
    phone: '13600705451',
    owner: 'emp_lin',
    updatedAt: '1',
  }]
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (_url, init) => {
      if (init && init.body) {
        const parsed = JSON.parse(init.body)
        Object.assign(rows[0], parsed)
        rows[0].updatedAt = '2'
      }
      return {
        ok: true,
        json: async () => ({
          data: [{ id: 371066454802432, code: 'CUST-019', phone: rows[0].phone }],
        }),
      }
    },
  })
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: rows.map((row) => ({ ...row })) }),
    }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: (spec) => writer.write(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' }],
  })
  const preview = await gate.preview({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    workspace: '/mail/nocobase-test',
  })
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'list-receipt' })
  assert.equal(written.ok, true)
  assert.equal(written.receiptId, '371066454802432')
  assert.match(written.speak, /库里已改上/)
  assert.doesNotMatch(written.speak, /写了但没回执/)
})

test('NocoBase create, approve and destroy share the same body and receipt rules', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), body: init && init.body })
      if (String(url).includes(':create')) {
        return { ok: true, json: async () => ({ data: { id: 88, code: 'NEW-1' } }) }
      }
      if (String(url).includes(':destroy')) {
        return { ok: true, json: async () => ({ data: 1 }) }
      }
      return { ok: true, json: async () => ({ data: [{ id: 99, stage: '已过' }] }) }
    },
  })
  const created = await writer.write({
    kind: '客户',
    no: 'NEW-1',
    action: '新建',
    patch: { code: 'NEW-1', name: '新客' },
    mapped: { resource: 'biz_customers', fields: ['code'] },
  })
  assert.equal(created.ok, true)
  assert.equal(created.receiptId, '88')
  assert.doesNotMatch(posts[0].body, /"values"/)
  assert.equal(JSON.parse(posts[0].body).code, 'NEW-1')

  const approved = await writer.write({
    kind: '商机',
    no: '华东智造',
    action: '过审',
    to: '已过',
    mapped: { resource: 'biz_opportunities', fields: ['name'] },
  })
  assert.equal(approved.ok, true)
  assert.equal(approved.receiptId, '99')
  assert.match(posts[1].body, /"stage":"已过"/)
  assert.doesNotMatch(posts[1].body, /"status":"已过"/)

  const removed = await writer.write({
    kind: '客户',
    no: 'CUST-019',
    action: '删除',
    mapped: { resource: 'biz_customers', fields: ['code'] },
  })
  assert.equal(removed.ok, true)
  assert.equal(removed.receiptId, '1')
})

test('no receipt cannot pretend posted', async () => {
  const gate = gateOf(
    [{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }],
    { postWrite: async () => ({ ok: true }) },
  )
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'nr' })
  assert.equal(written.ok, true)
  assert.equal(written.receiptId, '')
  assert.match(written.speak, /不能记已处理/)
  assert.doesNotMatch(written.speak, /业务回了/)
})

test('another owner still previews and writes; staff id is not ACL', async () => {
  const gate = gateOf([{
    resource: 'biz_purchase_orders',
    field: 'orderNo',
    no: 'PO-12',
    status: '待审',
    owner: 'emp_ace',
  }], { postWrite: async () => ({ ok: true, receiptId: 'rcpt_other' }) })
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  assert.equal(preview.ok, true)
  assert.ok(preview.preview_id)
  assert.match(preview.speak, /将改采购单 PO-12/)
  assert.match(preview.speak, /负责人不是这台号/)
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'other-owner' })
  assert.equal(written.ok, true)
  assert.equal(written.receiptId, 'rcpt_other')
})

test('gate without vocab cannot pretend the builtin kinds are registered', async () => {
  const gate = createGate({
    lookupTodo: async () => ({ ok: true, no: 'PO-12', status: '待审', fingerprint: 'x' }),
    now: () => 1,
  })
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审', workspace: '/ws' })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'NO_VOCAB')
})

test('unregistered kind and system tables are refused', async () => {
  const gate = gateOf([{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }])
  const unknown = await gate.preview({ kind: '便签', no: 'N-1', action: '过审' })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.error, 'UNKNOWN_KIND')
  assert.match(unknown.hint, /没登记/)
  assert.equal(unknown.preview_id, undefined)
  for (const kind of SYSTEM_TABLES) {
    const blocked = await gate.preview({ kind, no: 'X-1', action: '改行' })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.error, 'SYSTEM_TABLE')
    assert.match(blocked.hint, /系统表/)
  }
})

test('gate is generic: work order uses the same path as purchase order', async () => {
  const gate = gateOf([
    { resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' },
    { resource: 'biz_tickets', field: 'ticketNo', no: 'WO-3', status: '待审' },
  ])
  const approveTicket = await gate.preview({ kind: '工单', no: 'WO-3', action: '过审' })
  assert.equal(approveTicket.ok, false)
  assert.equal(approveTicket.error, 'ACTION_DENIED')
  assert.match(approveTicket.hint, /过审/)
  const patch = await gate.preview({ kind: '工单', no: 'WO-3', action: '改行', patch: { remark: '加急' } })
  assert.equal(patch.ok, true)
  assert.equal(patch.kind, '工单')
  assert.equal(patch.no, 'WO-3')
  assert.ok(patch.preview_id)
  const purchase = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  assert.equal(purchase.ok, true)
  assert.equal(purchase.kind, '采购单')
})

test('gate reads kinds from the letter workspace, not the hardcoded table', async () => {
  const rows = [{ resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' }]
  const seen = []
  const lookup = liveLookup(rows)
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async (workspace) => {
      seen.push(workspace)
      if (workspace !== '/mail/nocobase-test') return []
      return [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
    },
  })
  const missingCwd = await gate.preview({ kind: '客户', no: 'CUST-020', action: '改行', patch: { remark: '跟进' } })
  assert.equal(missingCwd.ok, false)
  assert.equal(missingCwd.error, 'NO_CWD')
  assert.equal(missingCwd.preview_id, undefined)
  const other = await gate.preview({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { remark: '跟进' },
    workspace: '/open/other',
  })
  assert.equal(other.ok, false)
  assert.equal(other.error, 'UNKNOWN_KIND')
  const ok = await gate.preview({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { remark: '跟进' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.kind, '客户')
  assert.equal(ok.no, 'CUST-020')
  assert.ok(ok.preview_id)
  assert.deepEqual(seen, ['/open/other', '/mail/nocobase-test'])
})

test('a forbidden vocab load is not spoken as 客户没登记', async () => {
  const lookup = liveLookup([{ resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => {
      const err = new Error('forbidden')
      err.code = 'NO_VOCAB'
      throw err
    },
  })
  const preview = await gate.preview({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { remark: '跟进' },
    workspace: '/Users/zxz/Documents/ai-project/nocobase-test',
  })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'NO_VOCAB')
  assert.match(preview.hint, /词表没读成/)
  assert.doesNotMatch(preview.hint || '', /客户没登记/)
})

test('failed preview does not cover the 拟回 card', async () => {
  const store = memStore()
  const A = createSecretary({
    store,
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    gate: {
      preview: async () => ({
        ok: false,
        error: 'UNKNOWN_KIND',
        hint: '客户没登记。词表和连接器都要有，不能装成能写。',
        speak: '客户没登记。词表和连接器都要有，不能装成能写。',
      }),
      tokens: new Map(),
    },
  })
  await store.update((s) => {
    s.requests.req1 = {
      id: 'req1',
      kind: 'incoming',
      status: 'open',
      sessionId: 'sess-gray',
      workspace: '/Users/zxz/Documents/ai-project/nocobase-test',
      excerpt: '改一下客户 CUST-020 的电话',
      body: '改一下客户 CUST-020 的电话',
      from: 'peer',
      fromName: '林督',
      to: ['self'],
      visible: ['self'],
    }
    s.self = { id: 'self', displayName: 'Ace' }
  })
  await A.previewBiz({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    sessionId: 'sess-gray',
    workspace: '/Users/zxz/Documents/ai-project/nocobase-test',
  })
  const dock = await A.dock('sess-gray')
  assert.notEqual(dock && dock.mode, 'preview')
})

test('gate writes a vocab kind that is not in the builtin catalog', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/crm_accounts:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ code: 'A-1', title: '台账甲', status: 'active', owner: 'emp_lin', updatedAt: '1' }] }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    loadVocab: async () => [{ kind: '客户台账', resource: 'crm_accounts', fields: ['code'], can: ['现查'] }],
  })
  const preview = await gate.preview({
    kind: '客户台账',
    no: 'A-1',
    action: '改行',
    patch: { remark: '跟进' },
    workspace: '/ws',
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.kind, '客户台账')
  assert.equal(preview.no, 'A-1')
  assert.equal(preview.mapped.resource, 'crm_accounts')
})

test('kindsFromGraphNodes reads fields and can from top-level or string lists', () => {
  assert.deepEqual(stringList('现查、过审'), ['现查', '过审'])
  assert.deepEqual(kindsFromGraphNodes([
    {
      type: 'skos:Concept',
      content: '客户台账',
      fields: 'code, name',
      can: '现查',
      resource: 'crm_accounts',
      ticketField: 'code',
    },
    {
      type: 'skos:Concept',
      properties: {
        content: '供应商',
        fields: ['单号', '状态'],
        can: '现查',
      },
    },
  ]), [
    { kind: '客户台账', fields: ['code', 'name'], can: ['现查'], resource: 'crm_accounts', ticketField: 'code' },
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'] },
  ])
})

test('kindsFromGraphNodes keeps clues for workspace terms', () => {
  const kinds = kindsFromGraphNodes([
    {
      type: 'skos:Concept',
      content: '工单',
      fields: ['单号', '状态'],
      can: '现查',
      resource: 'biz_tickets',
      clues: [{ say: ['暂停'], keys: ['status'], values: ['paused'] }],
    },
  ])
  assert.equal(kinds[0].kind, '工单')
  assert.ok(Array.isArray(kinds[0].clues))
  assert.equal(kinds[0].clues[0].values[0], 'paused')
})

test('kindsFromGraphNodes keeps catalogVersion and executable relations', () => {
  const kinds = kindsFromGraphNodes([
    {
      type: 'skos:Concept',
      content: '工单',
      fields: ['单号'],
      can: ['现查'],
      resource: 'biz_tickets',
      catalogVersion: 'v3',
      relations: [{ from: '客户', to: '工单', field: 'customerId' }],
    },
  ])
  assert.equal(kinds[0].catalogVersion, 'v3')
  assert.deepEqual(kinds[0].relations, [{ from: '客户', to: '工单', field: 'customerId' }])
})

test('kindsFromGraphNodes keeps a labeled kind that the connector already maps', () => {
  const kinds = kindsFromGraphNodes([
    {
      type: 'skos:Concept',
      properties: { 'rdfs:label': '联系人', content: '联系人', resource: 'biz_contacts', can: ['现查'] },
    },
    {
      type: 'skos:Concept',
      properties: { content: 'nocobase-test' },
    },
  ])
  assert.deepEqual(kinds.map((row) => row.kind), ['联系人'])
  assert.ok(kinds[0].can.includes('现查'))
})

test('kindsFromGraphNodes keeps can from a skos concept', () => {
  const kinds = kindsFromGraphNodes([
    {
      type: 'skos:Concept',
      content: '客户',
      properties: { fields: ['单号', '状态'], can: ['现查'] },
    },
    { type: 'Document', content: '一段会话' },
  ])
  assert.deepEqual(kinds, [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'] }])
})

test('kindsFromGraphNodes reads label from properties.content like the live graph', async () => {
  const nodes = [
    {
      id: 'https://dsh.local/vocab/ws/6fb255ac44f0#customer',
      type: 'skos:Concept',
      properties: {
        source: 'auto-workspace-vocab',
        fields: ['单号', '状态'],
        can: ['现查'],
        content: '客户',
        resource: 'biz_customers',
        ticketField: 'code',
      },
    },
  ]
  assert.deepEqual(kindsFromGraphNodes(nodes), [{ kind: '客户', fields: ['code', '单号', '状态'], can: ['现查'], id: 'customer', resource: 'biz_customers', ticketField: 'code' }])
  const lookup = liveLookup([{ resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => kindsFromGraphNodes(nodes),
  })
  const preview = await gate.preview({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    patch: { remark: '跟进' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.kind, '客户')
  assert.equal(preview.no, 'CUST-020')
})

test('live-graph vocab shape registers every business kind, not only 客户', async () => {
  const live = (kind, fields, can, resource, ticketField) => ({
    type: 'skos:Concept',
    properties: { source: 'auto-workspace-vocab', fields, can, content: kind, resource, ticketField },
  })
  const nodes = [
    live('采购单', ['单号', '状态'], ['现查', '过审'], 'biz_purchase_orders', 'orderNo'),
    live('销售订单', ['单号', '状态'], ['现查'], 'biz_sales_orders', 'orderNo'),
    live('客户', ['单号', '状态'], ['现查'], 'biz_customers', 'code'),
    live('供应商', ['单号', '状态'], ['现查'], 'biz_suppliers', 'code'),
    live('商品分类', ['单号'], ['现查'], 'biz_product_categories', 'code'),
    live('nocobase-test', [], []),
    {
      type: 'skos:Concept',
      properties: { 'skos:prefLabel': '联系人', fields: ['单号'], can: ['现查'], resource: 'biz_contacts', ticketField: 'name' },
    },
    {
      type: 'skos:Concept',
      properties: { 'rdfs:label': '仓库', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_warehouses', ticketField: 'code' },
    },
  ]
  const kinds = kindsFromGraphNodes(nodes)
  assert.deepEqual(kinds.map((row) => row.kind), ['采购单', '销售订单', '客户', '供应商', '商品分类', '联系人', '仓库'])
  const lookup = liveLookup([
    { resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' },
    { resource: 'biz_sales_orders', field: 'orderNo', no: 'SO-9', status: '待审' },
    { resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' },
    { resource: 'biz_suppliers', field: 'code', no: 'SUP-1', status: 'active' },
    { resource: 'biz_product_categories', field: 'code', no: 'CAT-1', status: 'open' },
    { resource: 'biz_contacts', field: 'name', no: 'CT-1', status: 'active' },
    { resource: 'biz_warehouses', field: 'code', no: 'WH-1', status: 'open' },
  ])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => kinds,
  })
  for (const spec of [
    { kind: '采购单', no: 'PO-12', action: '过审' },
    { kind: '销售订单', no: 'SO-9', action: '改行', patch: { remark: '跟进' } },
    { kind: '客户', no: 'CUST-020', action: '改行', patch: { remark: '跟进' } },
    { kind: '供应商', no: 'SUP-1', action: '改行', patch: { remark: '跟进' } },
    { kind: '商品分类', no: 'CAT-1', action: '改行', patch: { remark: '跟进' } },
    { kind: '联系人', no: 'CT-1', action: '改行', patch: { remark: '跟进' } },
    { kind: '仓库', no: 'WH-1', action: '改行', patch: { remark: '跟进' } },
  ]) {
    const preview = await gate.preview({ ...spec, workspace: '/mail/nocobase-test' })
    assert.equal(preview.ok, true, `${spec.kind} ${preview.error || ''} ${preview.hint || ''}`)
    assert.equal(preview.kind, spec.kind)
    assert.equal(preview.no, spec.no)
  }
})

test('no connector degrades in human words and issues no token', async () => {
  const lookup = createLookup({ baseUrl: '' })
  const gate = createGate({
    vocab: VOCAB,
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
  })
  const preview = await gate.preview({ kind: '采购单', no: 'PO-12', action: '过审' })
  assert.equal(preview.ok, false)
  assert.equal(preview.error, 'NO_CONNECTOR')
  assert.match(preview.hint, /没连业务/)
  assert.equal(preview.preview_id, undefined)
  assert.doesNotMatch(preview.hint, /业务回了|已经过账/)
})

test('restarted process does not keep a preview card without a live token', async () => {
  const store = memStore()
  await store.update((s) => {
    s.pendingWrite = {
      ok: true,
      preview_id: 'pv_old',
      kind: '采购单',
      no: 'PO-12',
      from: '待审',
      to: '已过',
      sessionId: 'sess-gray',
    }
  })
  const A = createSecretary({
    store,
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    gate: {
      preview: async () => ({ ok: false }),
      write: async () => ({ ok: false, error: 'NEED_PREVIEW' }),
      tokens: new Map(),
    },
  })
  const dock = await A.dock('sess-gray')
  assert.notEqual(dock && dock.mode, 'preview')
})

test('typed chat and secretary followup share the same gate', async () => {
  const rows = [{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }]
  const lookup = liveLookup(rows)
  const gate = createGate({
    vocab: VOCAB,
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: async () => ({ ok: true, receiptId: 'rcpt_s' }),
    now: () => 1_700_000_000_000,
  })
  const store = memStore()
  const A = createSecretary({
    store,
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate,
  })
  const typed = await A.hearUserLine('sess-gray', '过一下采购单 PO-12', '/mail/buy')
  assert.notEqual(typed.heard, 'preview')
  assert.notEqual(typed.heard, 'lookup')
  const previewed = await A.previewBiz({
    kind: '采购单',
    no: 'PO-12',
    action: '过审',
    speech: '过一下采购单 PO-12',
    sessionId: 'sess-gray',
    workspace: '/mail/buy',
  })
  assert.equal(previewed.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'preview')
  assert.match(dock.speak, /将改采购单 PO-12/)
  assert.match(dock.speak, /待审/)
  assert.equal(dock.primary, '执行')
  assert.equal(dock.secondary, '算了')
  const noToken = await A.commitWrite({})
  assert.equal(noToken.ok, false)
  assert.equal(noToken.error, 'NEED_PREVIEW')
  const done = await A.commitWrite({ preview_id: dock.preview.preview_id, trace_id: 'chat' })
  assert.equal(done.ok, true)
  assert.match(done.speak, /库里已改上|业务回了/)
})

test('typed chat preview uses the session workspace vocab', async () => {
  const rows = [{ resource: 'biz_purchase_orders', field: 'orderNo', no: 'PO-12', status: '待审' }]
  const seen = []
  const lookup = liveLookup(rows)
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async (workspace) => {
      seen.push(workspace)
      return workspace === '/mail/nocobase-test'
        ? [{ kind: '采购单', fields: ['单号', '状态'], can: ['过审'], resource: 'biz_purchase_orders', ticketField: 'orderNo' }]
        : []
    },
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate,
  })
  const missing = await A.previewBiz({
    kind: '采购单',
    no: 'PO-12',
    action: '过审',
    speech: '过一下采购单 PO-12',
  })
  assert.equal(missing.error, 'NO_CWD')
  assert.deepEqual(seen, [])
  const typed = await A.previewBiz({
    kind: '采购单',
    no: 'PO-12',
    action: '过审',
    speech: '过一下采购单 PO-12',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(typed.ok, true)
  assert.equal(typed.kind, '采购单')
  assert.deepEqual(seen, ['/mail/nocobase-test'])
})

test('typed chat recognizes a registered customer ticket', async () => {
  const rows = [{ resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' }]
  const lookup = liveLookup(rows)
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate,
  })
  const heard = await A.hearUserLine('sess-gray', '改一下客户 CUST-020', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'preview')
  const typed = await A.previewBiz({
    kind: '客户',
    no: 'CUST-020',
    action: '现查',
    speech: '改一下客户 CUST-020',
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(typed.ok, true)
  assert.equal(typed.kind, '客户')
  assert.equal(typed.no, 'CUST-020')
  assert.equal(typed.action, '现查')
})

test('typed lookup and ambiguous preview land on the 业务 sheet without a write token', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (!decoded.includes('biz_customers')) return { ok: true, status: 200, json: async () => ({ data: [] }) }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { code: 'CUST-020', name: '智能制造升级项目57', status: 'inactive', owner: 'emp_lin', updatedAt: '1' },
            { code: 'CUST-021', name: '智能制造升级项目57', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const heard = await A.hearUserLine('sess-gray', '查一下客户 智能制造升级项目57', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  assert.notEqual(heard.heard, 'preview')
  const looked = await A.previewBiz({
    kind: '客户',
    no: '',
    action: '现查',
    speech: '查一下客户 智能制造升级项目57',
    where: [{ keys: ['name'], values: ['智能制造升级项目57'] }],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.canWrite, false)
  assert.equal(looked.sheet.rows.length, 2)
  assert.ok(looked.sheet.columns.some((col) => col.key === 'name' || col.label === 'name'))
  const dockLookup = await A.dock('sess-gray')
  assert.notEqual(dockLookup && dockLookup.mode, 'preview')
  const preview = await A.previewBiz({
    kind: '客户',
    no: '',
    action: '改行',
    patch: { phone: '13900001111' },
    where: [{ keys: ['name'], values: ['智能制造升级项目57'] }],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.sheet.canWrite, false)
  assert.equal(preview.sheet.rows.length, 2)
  assert.ok(!preview.preview_id)
  const afterPreview = await A.snapshot()
  assert.equal(afterPreview.pendingSheet.rows.length, 2)
  assert.equal(afterPreview.pendingSheet.canWrite, false)
  assert.ok(!afterPreview.pendingWrite || afterPreview.pendingWrite.ok === false)
})

test('name clue 西安恒通 lists every matching customer on the sheet', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: decoded.includes('2152')
              ? [{ orderNo: 'SO-OWN', customerId: 2152, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }]
              : [{ orderNo: 'SO-OTHER', customerId: 1, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 2105, code: 'CUST2105', name: '西安恒通数据服务有限公司', status: 'active', owner: 'emp_lin', updatedAt: '1' },
            { id: 2152, code: 'CUST2152', name: '西安恒通电子有限公司', status: 'potential', owner: 'emp_lin', updatedAt: '1' },
            { id: 2183, code: 'CUST2183', name: '西安恒通智能装备有限公司', status: 'active', owner: 'emp_lin', updatedAt: '1' },
            { id: 9999, code: 'CUST9999', name: '别家', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' },
    { kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const heard = await A.hearUserLine('sess-nb', '帮我查西安恒通客户的最新一条订单', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  const looked = await A.previewBiz({
    kind: '销售订单',
    no: '',
    action: '现查',
    speech: '帮我查西安恒通客户的最新一条订单',
    from: { kind: '客户', where: [{ keys: ['name'], values: ['西安恒通'] }] },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.rows.length, 3)
  assert.deepEqual(looked.sheet.rows.map((row) => row.no).sort(), ['CUST2105', 'CUST2152', 'CUST2183'])
  assert.ok(looked.sheet.rows.every((row) => row.fields && row.fields.name))
  const snap = await A.snapshot()
  assert.equal(snap.pendingSheet.rows.length, 3)
  assert.equal(snap.pendingSheet.kind, '客户')
  assert.equal(snap.pendingSheet.nextKind, '销售订单')
})

test('故障类工单发给我 lists tickets instead of using 发给我 as a ticket', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK20260629349', status: 'open', owner: 'emp_lin', updatedAt: '2', category: '故障' },
          { ticketNo: 'TK-2026-018', status: 'assigned', owner: 'emp_lin', updatedAt: '1', category: '故障' },
        ],
      }),
    }),
  })
  const vocab = [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const heard = await A.hearUserLine('sess-nb', '故障类工单发给我', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  const looked = await A.previewBiz({
    kind: '工单',
    no: '故障类',
    action: '现查',
    speech: '故障类工单发给我',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.ok(looked.sheet.rows.length >= 2)
  assert.ok(looked.sheet.rows.some((row) => row.no === 'TK20260629349'))
  assert.equal(looked.sheet.canWrite, false)
})

test('哪家客户 is a question, not a customer name that covers the ticket list', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (/collections:list/.test(decoded)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_tickets',
              title: '工单',
              fields: [
                { name: 'ticketNo', uiSchema: { title: '工单编号' } },
                { name: 'customer', interface: 'm2o', target: 'biz_customers', uiSchema: { title: '客户名称' } },
                { name: 'category', uiSchema: { title: '工单类型', enum: [{ value: 'incident', label: '故障' }] } },
                { name: 'priority', uiSchema: { title: '优先级', enum: [{ value: 'urgent', label: '紧急' }] } },
                { name: 'status', uiSchema: { title: '工单状态' } },
              ],
            }],
          }),
        }
      }
      if (decoded.includes('biz_customers')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              ticketNo: 'TK20240510148',
              status: 'assigned',
              category: 'incident',
              priority: 'urgent',
              customer: { id: 9, code: 'CUST2242', name: '杭州启明网络科技有限公司' },
              owner: 'emp_lin',
              updatedAt: '2',
            },
            {
              ticketNo: 'TK20250317500',
              status: 'processing',
              category: 'incident',
              priority: 'urgent',
              customer: { id: 8, code: 'CUST2208', name: '东莞卓越网络科技有限公司' },
              owner: 'emp_lin',
              updatedAt: '1',
            },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
  ]
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  }).preview({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '故障类而且紧急、还没关的工单是哪家客户',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.sheet.kind, '工单')
  assert.notEqual(looked.sheet.kind, '客户')
  assert.ok((looked.sheet.rows || []).length >= 2)
  assert.ok(!(looked.speak || '').includes('还哪家'))
  assert.equal(looked.sheet.rows[0].fields.customer, '杭州启明网络科技有限公司')
})

test('pending receipts with expired contracts stay on receipts until a row is picked', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_contracts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { contractNo: 'HT-LATEST', status: '已签署', owner: 'emp_lin', updatedAt: '3' },
              { contractNo: 'HT-EXPIRED', status: '已到期', owner: 'emp_lin', updatedAt: '2' },
              { contractNo: 'HT-DRAFT', status: '起草', owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { paymentNo: 'PAY-1', status: '待审', contractId: 11, owner: 'emp_lin', updatedAt: '2' },
            { paymentNo: 'PAY-2', status: '待审', contractId: 12, owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    {
      kind: '回款单',
      fields: ['单号', '状态'],
      can: ['现查'],
      resource: 'biz_payments',
      ticketField: 'paymentNo',
      clues: [{ role: '型', say: ['回款'], keys: ['role'], values: ['型'] }],
    },
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts', ticketField: 'contractNo' },
  ]
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now: () => 1_700_000_000_000,
      loadVocab: async () => vocab,
    }),
  })
  const speech = '待审回款挂在哪些合同上？把已到期的那些摊出来。'
  const looked = await A.previewBiz({
    kind: '合同',
    no: '',
    action: '现查',
    speech,
    from: { kind: '回款单', where: [{ keys: ['status'], values: ['待审'] }] },
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '回款单')
  assert.equal(looked.sheet.nextKind, '合同')
  assert.deepEqual((looked.sheet.rows || []).map((row) => row.no).sort(), ['PAY-1', 'PAY-2'])
  assert.ok(!(looked.sheet.rows || []).some((row) => /^HT-/.test(row.no)))
  const asked = await A.fileAskClue({ rest: looked.sheet.askRest || '挂在' })
  assert.equal(asked.sheet.kind, '回款单')
  assert.ok((asked.sheet.rows || []).some((row) => row.no === 'PAY-1'))
})

test('这是问句 saves leftover say and lists the latest tickets', async () => {
  const rows = [
    { ticketNo: 'TK-NEW', status: '处理中', owner: 'emp_lin', updatedAt: '2', assignee: { name: 'Ace' } },
    { ticketNo: 'TK-OLD', status: '已关闭', owner: 'emp_lin', updatedAt: '1' },
  ]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: rows }) }),
  })
  const vocab = withSpoken([{ id: 'ticket', kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }])
  const saved = []
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
    saveVocab: async (workspace, concept) => {
      saved.push([workspace, concept])
      vocab[0] = { ...vocab[0], clues: concept.clues }
      return { ok: true }
    },
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const listed = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '最新工单是哪个经办人的？',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(listed.ok, true, listed.error)
  assert.ok(listed.sheet.rows.length >= 1)
  const asked = await A.fileAskClue({ rest: '经办人' })
  assert.equal(asked.ok, true, asked.error)
  assert.deepEqual(asked.sheet.rows.map((row) => row.no), ['TK-NEW', 'TK-OLD'])
  assert.equal(saved.length, 1)
  assert.equal(saved[0][0], '/mail/nocobase-test')
})

test('这是问句 still lists when the graph refuses the vocab write', async () => {
  const rows = [
    { ticketNo: 'TK-NEW', status: '处理中', owner: 'emp_lin', updatedAt: '2' },
    { ticketNo: 'TK-OLD', status: '已关闭', owner: 'emp_lin', updatedAt: '1' },
  ]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: rows }) }),
  })
  const vocab = withSpoken([{ id: 'ticket', kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
    saveVocab: async () => ({ ok: false, error: 'USE_HOST_TOOL' }),
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '最新工单是哪个经办人的？',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  const listed = await A.fileAskClue({ rest: '经办人' })
  assert.equal(listed.ok, true, listed.error || listed.hint)
  assert.ok((listed.sheet.rows || []).length >= 1)
  assert.notEqual(listed.hint, '问句没记上。')
})

test('改行 miss with leftover rest lands on the sheet so 这是问句 can retry the write', async () => {
  const rows = [
    { ticketNo: 'TK-NEW', status: '处理中', owner: 'emp_lin', updatedAt: '2', remarks: '旧' },
    { ticketNo: 'TK-OLD', status: '已关闭', owner: 'emp_lin', updatedAt: '1', remarks: '更旧' },
  ]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: rows }) }),
  })
  const vocab = withSpoken([{ id: 'ticket', kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const speech = '把最新工单是哪个经办人的备注改成联调'
  const missed = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '改行',
    speech,
    patch: { remarks: '联调' },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(missed.sheet.action, '改行')
  assert.equal(missed.sheet.rows.length, 2)
  assert.ok(!missed.preview_id)
  const snap = await A.snapshot('sess-nb')
  assert.ok(snap.pendingSheet)
  assert.equal(snap.pendingSheet.action, '改行')
  assert.equal(snap.pendingSheet.rows.length, 2)
})

test('紧急工单 that matches no field does not dump the latest ticket page', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK-LOW', status: 'open', owner: 'emp_lin', updatedAt: '2', priority: '低' },
          { ticketNo: 'TK-MID', status: 'open', owner: 'emp_lin', updatedAt: '1', priority: '中' },
        ],
      }),
    }),
  })
  const vocab = [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const heard = await A.hearUserLine('sess-nb', '紧急工单发给我', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  const looked = await A.previewBiz({
    kind: '工单',
    no: '紧急',
    action: '现查',
    speech: '紧急工单发给我',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, false)
  assert.equal(looked.error, 'NOT_FOUND')
  const snap = await A.snapshot()
  const rows = (snap.pendingSheet && snap.pendingSheet.rows) || []
  assert.ok(rows.every((row) => row.no !== 'TK-LOW' && row.no !== 'TK-MID'))
})

test('到期合同 hops to those customers orders, not contractNo=expired', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: decoded.includes('20')
              ? [{ orderNo: 'SO-KEEP', customerId: 20, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }]
              : [{ orderNo: 'SO-DROP', customerId: 99, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, contractNo: 'HT-1', status: 'expired', customerId: 20, owner: 'emp_lin', updatedAt: '2' },
            { id: 2, contractNo: 'HT-2', status: 'active', customerId: 21, owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' },
    { kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders', ticketField: 'orderNo', relations: [{ from: '合同', to: '销售订单', field: 'customerId' }] },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const looked = await A.previewBiz({
    kind: '销售订单',
    no: '',
    action: '现查',
    speech: '合同已到期的客户还有哪些订单',
    from: { kind: '合同', where: [{ keys: ['status'], values: ['expired'] }] },
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '销售订单')
  assert.equal(looked.sheet.rows.length, 1)
  assert.equal(looked.sheet.rows[0].no, 'SO-KEEP')
  const askedAsCustomer = await gate.preview({
    kind: '销售订单',
    no: '',
    action: '现查',
    speech: '合同已到期的客户还有哪些订单',
    from: { kind: '合同', where: [{ keys: ['status'], values: ['expired'] }] },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(askedAsCustomer.ok, true)
  assert.equal(askedAsCustomer.sheet.kind, '销售订单')
  assert.deepEqual(askedAsCustomer.sheet.rows.map((row) => row.no), ['SO-KEEP'])
  assert.notEqual(askedAsCustomer.sheet.kind, '客户')
})

test('多名到期合同 hops to those customers orders, not a mixed contract list', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        const rows = [
          { orderNo: 'SO-20', customerId: 20, status: 'confirmed', owner: 'emp_lin', updatedAt: '3' },
          { orderNo: 'SO-21', customerId: 21, status: 'delivering', owner: 'emp_lin', updatedAt: '2' },
          { orderNo: 'SO-99', customerId: 99, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' },
        ]
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: decoded.includes('$in')
              ? rows.filter((row) => decoded.includes(String(row.customerId)))
              : rows.filter((row) => decoded.includes(String(row.customerId))),
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, contractNo: 'HT-1', status: 'expired', customerId: 20, owner: 'emp_lin', updatedAt: '3' },
            { id: 2, contractNo: 'HT-2', status: 'signed', endDate: '2020-01-01', customerId: 21, owner: 'emp_lin', updatedAt: '2' },
            { id: 3, contractNo: 'HT-FUTURE', status: 'signed', endDate: '2099-01-01', customerId: 99, owner: 'emp_lin', updatedAt: '1' },
            { id: 4, contractNo: 'HT-DRAFT', status: 'draft', endDate: '2020-01-01', customerId: 21, owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts', ticketField: 'contractNo' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' },
    { kind: '订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders', ticketField: 'orderNo', relations: [{ from: '合同', to: '订单', field: 'customerId' }] },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const looked = await A.previewBiz({
    kind: '订单',
    no: '',
    action: '现查',
    speech: '合同已到期的客户还有哪些订单',
    from: { kind: '合同', join: 'or', where: [{ keys: ['status'], values: ['expired'] }, { dateBefore: ['endDate'] }] },
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '合同')
  assert.equal(looked.sheet.nextKind, '订单')
  assert.ok((looked.sheet.rows || []).every((row) => row.no !== 'SO-99'))
  const picked = await A.pickSheetRow({ no: 'HT-1' })
  assert.equal(picked.sheet.kind, '订单')
  assert.deepEqual((picked.sheet.rows || []).map((row) => row.no), ['SO-20'])
})

test('many parent hop lists one page of 20, not the whole matching set', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_payments')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            contractNo: `HT-${String(i + 1).padStart(2, '0')}`,
            status: 'expired',
            customerId: i + 1,
            owner: 'emp_lin',
            updatedAt: String(100 - i),
          })),
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts', ticketField: 'contractNo' },
    { kind: '回款单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_payments', ticketField: 'paymentNo', relations: [{ from: '合同', to: '回款单', field: 'contractId' }] },
  ]
  const looked = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    loadVocab: async () => vocab,
  }).preview({
    kind: '回款单',
    no: '',
    action: '现查',
    from: { kind: '合同', where: [{ keys: ['status'], values: ['expired'] }] },
    workspace: '/ws',
  })
  assert.equal(looked.sheet.kind, '合同')
  assert.equal(looked.sheet.nextKind, '回款单')
  assert.equal((looked.sheet.rows || []).length, 20)
  assert.match(looked.speak || looked.sheet.speak || '', /20 条/)
})

test('到期合同 without customerId stays on the order page, not the contract page', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ orderNo: 'SO-WRONG', customerId: 1, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, contractNo: 'HT20251101830', status: 'expired', title: '天和服务采购合同', endDate: '2026-08-23', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts' },
    { kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '合同',
    no: '',
    action: '现查',
    speech: '合同已到期的客户还有哪些订单',
    workspace: '/ws',
  })
  assert.ok(!(looked.sheet.rows || []).some((row) => row.no === 'SO-WRONG'))
  assert.notEqual(looked.sheet.kind, '销售订单')
})

test('hop 合同 to 回款 uses contractId, not customerId on the contract', async () => {
  const calls = []
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      calls.push(decoded)
      if (decoded.includes('biz_payments')) {
        const keep = decoded.includes('"contractId":"80"') || decoded.includes('"contractId":80')
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: keep
              ? [{ paymentNo: 'PAY-KEEP', contractId: 80, customerId: 20, owner: 'emp_lin', updatedAt: '1' }]
              : [{ paymentNo: 'PAY-DROP', contractId: 1, customerId: 20, owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 80, contractNo: 'HT-1', status: 'expired', customerId: 20, owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts', ticketField: 'contractNo' },
    { kind: '客户', fields: ['单号'], can: ['现查'], resource: 'biz_customers' },
    { kind: '回款单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_payments', ticketField: 'paymentNo', relations: [{ from: '合同', to: '回款单', field: 'contractId' }] },
  ]
  const hopped = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    loadVocab: async () => vocab,
  }).preview({
    kind: '回款单',
    no: '',
    action: '现查',
    from: { kind: '合同', no: 'HT-1' },
    workspace: '/ws',
  })
  assert.equal(hopped.ok, true, hopped.error || hopped.speak)
  assert.deepEqual((hopped.sheet.rows || []).map((row) => row.no), ['PAY-KEEP'])
  assert.ok(calls.some((url) => /contractId/.test(url) && /80/.test(url)))
})

test('勾选无客户号的到期合同 stays on the order page, does not hop with contract id', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ orderNo: 'SO-WRONG', customerId: 1, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, contractNo: 'HT20251101830', status: 'expired', title: '天和服务采购合同', endDate: '2026-08-23', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts' },
    { kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders' },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const looked = await A.previewBiz({
    kind: '合同',
    no: '',
    action: '现查',
    speech: '合同已到期的客户还有哪些订单',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.ok(!(looked.sheet.rows || []).some((row) => row.no === 'SO-WRONG'))
  assert.notEqual(looked.sheet.kind, '销售订单')
  const after = await A.snapshot('sess-nb')
  assert.ok(!(after.pendingSheet.rows || []).some((row) => row.no === 'SO-WRONG'))
  assert.notEqual(after.pendingSheet.kind, '销售订单')
})

test('停用供应商 hops to open purchase orders, not 停用 as a supplier name', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_purchase_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { orderNo: 'PO-OPEN', supplierId: 10, status: '待审', owner: 'emp_lin', updatedAt: '2' },
              { orderNo: 'PO-DONE', supplierId: 10, status: '已完成', owner: 'emp_lin', updatedAt: '1' },
              { orderNo: 'PO-OTHER', supplierId: 99, status: '待审', owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 10, code: 'SUP1010', name: '昆明精密机电贸易有限公司', status: '停用', owner: 'emp_lin', updatedAt: '1' },
            { id: 11, code: 'SUP1011', name: '在用供应商', status: 'active', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用供应商还有哪些未完成的采购单',
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.kind, '采购单')
  assert.equal(looked.sheet.kind, '采购单')
  assert.deepEqual(looked.sheet.rows.map((row) => row.no), ['PO-OPEN'])
  const askedAsPurchase = await gate.preview({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用的供应商还有哪些采购单未完成',
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    workspace: '/ws',
  })
  assert.equal(askedAsPurchase.ok, true)
  assert.equal(askedAsPurchase.kind, '采购单')
  assert.deepEqual(askedAsPurchase.sheet.rows.map((row) => row.no), ['PO-OPEN'])
  assert.ok(askedAsPurchase.sheet.columns.some((col) => col.key === 'index' && col.label === '序号'))
  assert.equal(askedAsPurchase.sheet.rows[0].fields.supplier, 'SUP1010')
  assert.ok(!askedAsPurchase.sheet.columns.some((col) => /Id$/.test(col.key) || col.key === 'supplierId'))
  const byCode = await gate.preview({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用供应商还有哪些未完成的采购单',
    from: { kind: '供应商', no: 'SUP1010' },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    workspace: '/ws',
  })
  assert.equal(byCode.ok, true)
  assert.equal(byCode.sheet.kind, '采购单')
  assert.deepEqual(byCode.sheet.rows.map((row) => row.no), ['PO-OPEN'])
})

test('sheet keeps hop ids on the row but does not show them as columns', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      if (/collections:list/.test(String(url))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_purchase_orders',
              title: '采购单',
              fields: [
                { name: 'orderNo', uiSchema: { title: '订单编号' } },
                { name: 'status', uiSchema: { title: '状态' } },
                { name: 'expectedDate', uiSchema: { title: '预计到货' } },
                { name: 'totalAmount', uiSchema: { title: '合计金额' } },
                { name: 'amount', uiSchema: { title: '未税金额' } },
                { name: 'warehouseId', uiSchema: { title: '仓库' } },
                { name: 'supplierId', uiSchema: { title: '供应商' } },
              ],
            }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{
            id: 88,
            orderNo: 'PO-OPEN',
            status: '待审',
            expectedDate: '2026-03-02T00:00:00.000Z',
            totalAmount: 1979736.54,
            amount: 257365.75,
            warehouseId: 371712530710542,
            supplierId: 10,
            supplier: 'SUP1010',
            owner: 'emp_lin',
            updatedAt: '1',
          }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const preview = await createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    fieldsOf: (kind, loaded) => lookup.fieldsOf(kind, loaded),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  }).preview({
    kind: '采购单',
    no: 'PO-OPEN',
    action: '现查',
    workspace: '/ws',
  })
  assert.equal(preview.ok, true)
  const keys = preview.sheet.columns.map((col) => col.key)
  const labels = preview.sheet.columns.map((col) => col.label)
  assert.ok(!keys.includes('supplierId'))
  assert.ok(!keys.includes('warehouseId'))
  assert.ok(!keys.includes('id'))
  assert.ok(!labels.includes('expectedDate'))
  assert.ok(labels.includes('预计到货') || keys.includes('expectedDate') === false)
  assert.ok(preview.sheet.rows[0].fields.supplierId || preview.sheet.rows[0].fields.id)
})

test('many inactive suppliers list for pick then hop open purchase orders', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_purchase_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { orderNo: 'PO-A', supplierId: 10, status: '待审', owner: 'emp_lin', updatedAt: '2' },
              { orderNo: 'PO-DONE', supplierId: 10, status: '已完成', owner: 'emp_lin', updatedAt: '3' },
              { orderNo: 'PO-B', supplierId: 11, status: '草稿', owner: 'emp_lin', updatedAt: '1' },
            ],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 10, code: 'SUP1010', name: '昆明精密', status: '停用', owner: 'emp_lin', updatedAt: '2' },
            { id: 11, code: 'SUP1013', name: '太原工贸', status: '停用', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now,
      loadVocab: async () => vocab,
    }),
  })
  const looked = await A.previewBiz({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用的供应商还有哪些采购单未完成',
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '供应商')
  assert.equal(looked.sheet.nextKind, '采购单')
  assert.deepEqual(looked.sheet.rows.map((row) => row.no).sort(), ['SUP1010', 'SUP1013'])
  const picked = await A.pickSheetRow({ no: 'SUP1010' })
  assert.equal(picked.sheet.kind, '采购单')
  assert.deepEqual((picked.sheet.rows || []).map((row) => row.no).sort(), ['PO-A'])
  const after = await A.snapshot('sess-nb')
  assert.equal(after.pendingSheet.kind, '采购单')
})

test('expired contracts hop to those customers orders without picking a row', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_sales_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ orderNo: 'SO-KEEP', customerId: 20, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, contractNo: 'HT-1', status: 'expired', customerId: 20, owner: 'emp_lin', updatedAt: '2' },
            { id: 2, contractNo: 'HT-2', status: 'signed', endDate: '2020-01-01', customerId: 21, owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const vocab = [
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers' },
    { kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders', ticketField: 'orderNo', relations: [{ from: '合同', to: '销售订单', field: 'customerId' }] },
  ]
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now,
      loadVocab: async () => vocab,
    }),
  })
  const looked = await A.previewBiz({
    kind: '销售订单',
    no: '',
    action: '现查',
    speech: '合同已到期的客户还有哪些订单',
    from: { kind: '合同', where: [{ keys: ['status'], values: ['expired'] }] },
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '销售订单')
  assert.deepEqual((looked.sheet.rows || []).map((row) => row.no), ['SO-KEEP'])
})

test('parent hop pages past the first 50 child rows', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_purchase_orders')) {
        const page = /[?&]page=(\d+)/.test(decoded) ? Number(RegExp.$1) : 1
        const data = page === 1
          ? Array.from({ length: 50 }, (_, i) => ({
            orderNo: `PO-OTHER-${i}`,
            supplierId: 99,
            status: '待审',
            owner: 'emp_lin',
            updatedAt: String(200 - i),
          }))
          : [
            { orderNo: 'PO-HIT', supplierId: 10, status: '部分收货', owner: 'emp_lin', updatedAt: '1' },
            { orderNo: 'PO-DONE', supplierId: 10, status: '已完成', owner: 'emp_lin', updatedAt: '1' },
          ]
        return {
          ok: true,
          status: 200,
          json: async () => ({ data, meta: { count: 52, page, pageSize: 50, totalPage: 2 } }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 10, code: 'SUP1010', name: '昆明精密', status: '停用', owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用的供应商还有哪些采购单未完成',
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.kind, '采购单')
  assert.deepEqual(looked.sheet.rows.map((row) => row.no), ['PO-HIT'])
})

test('parent hop follows the connector page count past twenty pages', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_purchase_orders')) {
        const page = /[?&]page=(\d+)/.test(decoded) ? Number(RegExp.$1) : 1
        const data = page < 21
          ? Array.from({ length: 50 }, (_, i) => ({
            orderNo: `PO-OTHER-${page}-${i}`,
            supplierId: 99,
            status: '待审',
            owner: 'emp_lin',
            updatedAt: '2',
          }))
          : [{ orderNo: 'PO-DEEP', supplierId: 10, status: '待审', owner: 'emp_lin', updatedAt: '1' }]
        return {
          ok: true,
          status: 200,
          json: async () => ({ data, meta: { count: 1001, page, pageSize: 50, totalPage: 21 } }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 10, code: 'SUP1010', name: '昆明精密', status: '停用', owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用的供应商还有哪些采购单未完成',
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  assert.deepEqual(looked.sheet.rows.map((row) => row.no), ['PO-DEEP'])
})

test('filtered hop asks for a large page after the filter, not a bare latest page', async () => {
  const calls = []
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(decodeURIComponent(String(url)))
      if (String(url).includes('biz_purchase_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ orderNo: 'PO-OPEN', supplierId: 10, status: '待审', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 10, code: 'SUP1010', name: '昆明精密', status: '停用', owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const looked = await gate.preview({
    kind: '采购单',
    no: '',
    action: '现查',
    speech: '停用的供应商还有哪些采购单未完成',
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    workspace: '/ws',
  })
  assert.equal(looked.ok, true)
  const child = calls.find((url) => url.includes('biz_purchase_orders'))
  assert.match(child, /filter=/)
  assert.match(child, /pageSize=20/)
  assert.match(child, /supplierId/)
  assert.match(child, /\$notIn|\$ne/)
})

test('same-speech shallower preview cannot cover the hopped sheet', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_purchase_orders')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ orderNo: 'PO-OPEN', supplierId: 10, status: '待审', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 10, code: 'SUP1010', name: '昆明精密', status: '停用', owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now,
      loadVocab: async () => vocab,
    }),
  })
  const speech = '停用的供应商还有哪些采购单未完成'
  const hopped = await A.previewBiz({
    kind: '采购单',
    no: '',
    action: '现查',
    speech,
    from: { kind: '供应商', where: [{ keys: ['status'], values: ['停用'] }] },
    where: [{ keys: ['status'], values: ['已完成'], not: true }],
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(hopped.ok, true)
  assert.equal(hopped.sheet.kind, '采购单')
  const cover = await A.previewBiz({
    kind: '供应商',
    no: '',
    action: '现查',
    speech,
    where: [{ keys: ['status'], values: ['停用'] }],
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(cover.sheet.kind, '供应商')
  const snap = await A.snapshot()
  assert.equal(snap.pendingSheet.kind, '供应商')
})

test('empty hop sheet replaces the parent list', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_purchase_orders')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 10, code: 'SUP1010', name: '昆明精密', status: '停用', owner: 'emp_lin', updatedAt: '1' }],
        }),
      }
    },
  })
  const vocab = [
    { kind: '供应商', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_suppliers' },
    { kind: '采购单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo', relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }] },
  ]
  const now = () => 1_700_000_000_000
  const A = createSecretary({
    store: memStore(),
    now,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now,
      loadVocab: async () => vocab,
    }),
  })
  const speech = '停用的供应商还有哪些采购单未完成'
  const hopped = await A.previewBiz({
    kind: '采购单',
    no: '',
    action: '现查',
    speech,
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  assert.equal(hopped.sheet.kind, '采购单')
  assert.equal((hopped.sheet.rows || []).length, 0)
  await A.previewBiz({
    kind: '供应商',
    no: '',
    action: '现查',
    speech: '列出停用供应商',
    sessionId: 'sess-nb',
    workspace: '/ws',
  })
  const snap = await A.snapshot()
  assert.equal(snap.pendingSheet.kind, '供应商')
  assert.deepEqual((snap.pendingSheet.rows || []).map((row) => row.no), ['SUP1010'])
})

test('现查 处理中的紧急 only lists processing AND urgent tickets', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK-RES', status: 'resolved', priority: 'urgent', title: '权限', owner: 'emp_lin', updatedAt: '4' },
          { ticketNo: 'TK-MID', status: 'processing', priority: 'medium', title: '系统', owner: 'emp_lin', updatedAt: '3' },
          { ticketNo: 'TK-URG', status: 'processing', priority: 'urgent', title: '故障', owner: 'emp_lin', updatedAt: '2' },
          { ticketNo: 'TK-HIGH', status: 'processing', priority: 'high', title: '投诉', owner: 'emp_lin', updatedAt: '1' },
        ],
      }),
    }),
  })
  const vocab = [{ kind: '工单', fields: ['单号', '状态'], can: ['现查', '过审'], resource: 'biz_tickets' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const looked = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '处理中的紧急工单发给我',
    where: [
      { keys: ['status'], values: ['processing'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.rows.length, 1)
  assert.equal(looked.sheet.rows[0].no, 'TK-URG')
  const approve = await A.previewBiz({
    kind: '工单',
    no: '',
    action: '过审',
    speech: '处理中的紧急工单过一下',
    where: [
      { keys: ['status'], values: ['processing'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
    merge: false,
  })
  assert.equal(approve.ok, true)
  assert.equal(approve.no, 'TK-URG')
  assert.equal(approve.action, '过审')
})

test('biz_preview 现查 lands on the sheet with no write token', async () => {
  const rows = [{ resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' }]
  const lookup = liveLookup(rows)
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const preview = await A.previewBiz({
    kind: '客户',
    no: 'CUST-020',
    action: '现查',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.action, '现查')
  assert.equal(preview.preview_id, undefined)
  assert.equal(preview.sheet.canWrite, false)
  assert.equal(preview.sheet.rows[0].no, 'CUST-020')
  const snap = await A.snapshot('sess-nb')
  assert.equal(snap.pendingSheet.action, '现查')
  assert.equal(snap.pendingSheet.canWrite, false)
  assert.equal(snap.pendingSheet.vocab, undefined)
  assert.equal(preview.vocab, undefined)
  assert.equal(snap.pendingWrite, null)
  const dock = await A.dock('sess-nb')
  assert.notEqual(dock && dock.mode, 'preview')
  const written = await A.commitWrite({ preview_id: 'pv_none' })
  assert.equal(written.ok, false)
})

test('typed 查询 compact sales ticket lands on the 业务 sheet', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          orderNo: 'SO20260623803',
          status: 'confirmed',
          owner: 'emp_lin',
          updatedAt: '1',
          amount: '741096.54',
        }],
      }),
    }),
  })
  const vocab = [{ kind: '销售订单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders', ticketField: 'orderNo' }]
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const heard = await A.hearUserLine('sess-nb', '查询SO20260623803这张单子的所有信息', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  const looked = await A.previewBiz({
    kind: '销售订单',
    no: 'SO20260623803',
    action: '现查',
    speech: '查询SO20260623803这张单子的所有信息',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.no, 'SO20260623803')
  assert.equal(looked.sheet.rows[0].no, 'SO20260623803')
  const snap = await A.snapshot()
  assert.equal(snap.pendingSheet.rows[0].no, 'SO20260623803')
})

test('typed 查一下最新的销售数据 lists onto the 业务 sheet', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { orderNo: 'SO-1', status: 'confirmed', owner: 'emp_lin', updatedAt: '2', amount: '100' },
          { orderNo: 'SO-2', status: 'draft', owner: 'emp_lin', updatedAt: '1', amount: '80' },
        ],
      }),
    }),
  })
  const vocab = withSpoken([{ kind: '销售数据', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_sales_orders' }])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => vocab,
    gate,
  })
  const heard = await A.hearUserLine('sess-nb', '查一下最新的销售数据', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  const looked = await A.previewBiz({
    kind: '销售数据',
    no: '',
    action: '现查',
    speech: '查一下最新的销售数据',
    sessionId: 'sess-nb',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true)
  assert.equal(looked.sheet.canWrite, false)
  assert.equal(looked.sheet.rows.length, 2)
  const snap = await A.snapshot()
  assert.equal(snap.pendingSheet.rows.length, 2)
  const dock = await A.dock('sess-nb')
  assert.notEqual(dock && dock.mode, 'preview')
})

test('typed 改删建 still reach the gate when vocab load fails', async () => {
  const lookup = liveLookup([
    { resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' },
    { resource: 'biz_tickets', field: 'ticketNo', no: 'WO-3', status: '待审' },
  ])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => {
      const err = new Error('forbidden')
      err.code = 'NO_VOCAB'
      throw err
    },
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => {
      const err = new Error('forbidden')
      err.code = 'NO_VOCAB'
      throw err
    },
    gate,
  })
  for (const [speech, action] of [
    ['改一下客户 CUST-020', '改行'],
    ['删一下工单 WO-3', '删除'],
    ['新建客户 新客', '新建'],
  ]) {
    const heard = await A.hearUserLine('sess-gray', speech, '/mail/nocobase-test')
    assert.notEqual(heard.heard, 'preview', speech)
    const typed = await A.previewBiz({
      kind: speech.includes('工单') ? '工单' : '客户',
      no: speech.includes('WO-3') ? 'WO-3' : (speech.includes('CUST-020') ? 'CUST-020' : '新客'),
      action,
      speech,
      sessionId: 'sess-gray',
      workspace: '/mail/nocobase-test',
    })
    assert.equal(typed.ok, false, speech)
    assert.equal(typed.error, 'NO_VOCAB', speech)
  }
})

test('这个客户 uses the explicit focus ticket, not a phone number', async () => {
  const rows = [{ resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' }]
  const lookup = liveLookup(rows)
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
    catalog: () => [{ name: 'biz_preview' }, { name: 'search_text' }],
    gate,
  })
  const seen = await A.previewBiz({
    kind: '客户',
    no: 'CUST-020',
    action: '现查',
    speech: '查一下客户 CUST-020',
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(seen.ok, true)
  const dock = await A.dock('sess-gray')
  assert.notEqual(dock && dock.mode, 'preview')
  const change = await A.previewBiz({
    kind: '客户',
    no: 'CUST-020',
    action: '改行',
    speech: '帮我把这个客户的电话号码改成1234567890',
    patch: { phone: '1234567890' },
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(change.ok, true)
  assert.equal(change.kind, '客户')
  assert.equal(change.no, 'CUST-020')
  assert.equal(change.action, '改行')
  assert.notEqual(change.no, '1234567890')
})

test('typed chat preview resolves a name clue then keeps the unique ticket', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ code: 'CUST-020', name: '西安天工装备有限公司', status: 'inactive', owner: 'emp_lin', updatedAt: '1' }],
      }),
    }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate,
  })
  const heard = await A.hearUserLine('sess-gray', '改一下客户 西安天工', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'preview')
  const typed = await A.previewBiz({
    kind: '客户',
    no: '',
    action: '现查',
    speech: '改一下客户 西安天工',
    where: [{ keys: ['name'], values: ['西安天工'] }],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(typed.ok, true)
  assert.equal(typed.kind, '客户')
  assert.equal(typed.no, 'CUST-020')
})

test('typed lookup speaks and does not leave an execute card', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ ticketNo: 'WO-3', title: '灰度告警', status: 'open', owner: 'emp_lin' }],
      }),
    }),
  })
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    gate: createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now: () => 1_700_000_000_000,
      loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
    }),
  })
  const heard = await A.hearUserLine('sess-gray', '查一下工单 灰度告警', '/mail/nocobase-test')
  assert.notEqual(heard.heard, 'lookup')
  const typed = await A.previewBiz({
    kind: '工单',
    no: '灰度告警',
    action: '现查',
    speech: '查一下工单 灰度告警',
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(typed.ok, true)
  assert.match(typed.speak || typed.sheet.speak || '', /WO-3|灰度告警|待审|现在是/)
  const dock = await A.dock('sess-gray')
  assert.notEqual(dock && dock.mode, 'preview')
})

test('delete preview of any registered kind consumes a token', async () => {
  const gate = gateOf(
    [{ resource: 'biz_tickets', field: 'ticketNo', no: 'WO-3', status: '待审' }],
    { vocab: [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }] },
  )
  const preview = await gate.preview({ kind: '工单', no: 'WO-3', action: '删除', workspace: '/ws' })
  assert.equal(preview.ok, true)
  assert.equal(preview.action, '删除')
  assert.match(preview.speak, /将删|工单 WO-3/)
})

test('create preview does not need an existing row', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }],
  })
  const preview = await gate.preview({
    kind: '客户',
    no: '西安天工',
    action: '新建',
    patch: { remark: '新客' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true)
  assert.equal(preview.action, '新建')
  assert.match(preview.speak, /将新建/)
  assert.ok(preview.preview_id)
})

test('新建 fills speech slots and does not hop a write-field kind', async () => {
  const posted = []
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 9, code: 'CUST-HU', name: '胡文', status: 'active', owner: 'emp_lin', updatedAt: '1' }],
      }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (url, init) => {
      posted.push([String(url), init && init.body])
      return { ok: true, json: async () => ({ data: { id: 77, title: '电脑故障紧急保修' } }) }
    },
  })
  const vocab = withSpoken([
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
    { kind: '联系人', fields: ['单号'], can: ['现查'], resource: 'biz_contacts', ticketField: 'name' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
  ])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: (spec) => writer.write(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
    fieldsOf: async () => [
      { name: 'title', title: '工单标题' },
      { name: 'customer', title: '客户' },
      { name: 'ticketNo', title: '工单编号' },
    ],
  })
  const speech = '新建一张工单，工单标题写成电脑故障紧急保修，联系人写成 c256@client.com'
  const preview = await gate.preview({
    kind: '工单',
    action: '新建',
    speech,
    patch: { title: '电脑故障紧急保修' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true, preview.error)
  assert.equal(preview.kind, '工单')
  assert.equal(preview.patch.title, '电脑故障紧急保修')
  assert.notEqual(preview.kind, '联系人')
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 'new-1' })
  assert.equal(written.ok, true, written.error)
  assert.equal(written.no || preview.no, '77')
  assert.match(String(posted[0] && posted[0][0]), /biz_tickets:create/)
})

test('现查 lists a row that only has id', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 77, title: '电脑故障紧急保修', status: 'resolved', owner: 'emp_lin', updatedAt: '9' }],
      }),
    }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
  })
  const looked = await gate.preview({
    kind: '工单',
    no: '',
    action: '现查',
    speech: '最新工单',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true, looked.error)
  assert.equal(looked.sheet.rows[0].no, '77')
})

test('新建 客户胡文 binds the customer name, not the whole sentence', async () => {
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      if (decoded.includes('biz_customers')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 3, code: 'CUST-HU', name: '胡文', status: 'active', owner: 'emp_lin', updatedAt: '1' }],
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
  const vocab = withSpoken([
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
  ])
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
    fieldsOf: async () => [
      { name: 'title', title: '工单标题' },
      { name: 'customer', title: '客户' },
      { name: 'description', title: '问题描述' },
    ],
  })
  const preview = await gate.preview({
    kind: '工单',
    action: '新建',
    speech: '客户胡文今天12点电脑故障紧急保修，现在已处理完成。新增一笔工单',
    patch: { customer: '胡文' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true, preview.error)
  assert.equal(preview.kind, '工单')
  assert.equal(preview.patch.customer, '胡文')
})

test('新建 leftover description is not dumped into the relation column', async () => {
  const vocab = withSpoken([
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '联系人', fields: ['单号'], can: ['现查'], resource: 'biz_contacts', ticketField: 'name' },
  ])
  const gate = createGate({
    lookupTodo: async () => ({ ok: false, error: 'NOT_FOUND', matches: [] }),
    now: () => 1_700_000_000_000,
    loadVocab: async () => vocab,
    fieldsOf: async () => [
      { name: 'title', title: '工单标题' },
      { name: 'customer', title: '客户' },
      { name: 'description', title: '描述' },
    ],
  })
  const preview = await gate.preview({
    kind: '工单',
    action: '新建',
    speech: '新建一张工单，客户胡文今天12点电脑故障紧急保修，联系人写成 c256@client.com',
    patch: { customer: '胡文' },
    workspace: '/mail/nocobase-test',
  })
  assert.equal(preview.ok, true, preview.error)
  assert.equal(preview.kind, '工单')
  assert.equal(preview.patch.customer, '胡文')
  assert.notEqual(String(preview.patch.customer), String(preview.patch.description || ''))
  assert.ok((preview.sheet.columns || []).some((col) => col.key === 'customer' || col.label === '客户'))
})

test('现查 with a numeric id stays on the ticket even if speech names 客户', async () => {
  const calls = []
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 384417162657792, title: '电脑故障紧急保修', status: 'resolved', owner: 'emp_lin', updatedAt: '9' }],
        }),
      }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1_700_000_000_000,
    loadVocab: async () => withSpoken([
      { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
      { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    ]),
  })
  const looked = await gate.preview({
    kind: '工单',
    no: '384417162657792',
    action: '现查',
    speech: '现查工单 384417162657792，客户胡文还对不上',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(looked.ok, true, looked.error)
  assert.equal(looked.kind, '工单')
  assert.equal(looked.sheet.kind, '工单')
  assert.equal(looked.sheet.rows[0].no, '384417162657792')
  assert.ok(calls.some((url) => url.includes('biz_tickets')))
  assert.equal(calls.some((url) => url.includes('biz_customers')), false)
})

function connectMail(extraA = {}, extraB = {}) {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip, ...extraA })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip, ...extraB })
  return box
}

async function pairedMail(extraA = {}, extraB = {}) {
  const { A, B } = connectMail(extraA, extraB)
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  const done = await afterHandshake(A, B, hs)
  return { A, B, peer: done.peers[0] }
}

test('拟回 and 采纳 of a write letter followup the session, no auto preview', async () => {
  const rows = [
    { resource: 'biz_customers', field: 'code', no: 'CUST-020', status: 'inactive' },
    { resource: 'biz_tickets', field: 'ticketNo', no: 'WO-3', status: '待审' },
    { resource: 'biz_contracts', field: 'contractNo', no: 'HT-1', status: 'reviewing' },
  ]
  const vocab = [
    { kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' },
    { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' },
    { kind: '合同', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_contracts', ticketField: 'contractNo' },
  ]
  const letters = [
    ['改一下客户 CUST-020', '客户', 'CUST-020', '改行'],
    ['删一下工单 WO-3', '工单', 'WO-3', '删除'],
    ['新建客户 西安天工', '客户', '西安天工', '新建'],
    ['删一下合同 HT-1', '合同', 'HT-1', '删除'],
  ]
  for (const [excerpt, kind, no, action] of letters) {
    const lookup = liveLookup(rows)
    const gateA = createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now: () => 1_700_000_000_000,
      loadVocab: async () => vocab,
    })
    const gateB = createGate({
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      now: () => 1_700_000_000_000,
      loadVocab: async () => vocab,
    })
    const { A, B, peer } = await pairedMail(
      {
        gate: gateA,
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        loadVocab: async () => vocab,
      },
      {
        gate: gateB,
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        loadVocab: async () => vocab,
      },
    )
    const composed = await A.compose({
      excerpt,
      to: [peer.id],
      sessionId: 'sess-gray',
      workspace: '/mail/nocobase-test',
    })
    await A.confirmSend(composed.requestId)
    const incoming = (await B.snapshot()).requests[0]
    const drafted = await B.draftReply(incoming.id, 'sess-lin', '/mail/nocobase-test')
    assert.equal(drafted.ok, true, `${excerpt} ${drafted.error || ''} ${drafted.hint || ''}`)
    assert.ok(!drafted.preview || !drafted.preview.preview_id, excerpt)
    assert.ok(drafted.followup, excerpt)

    await B.reply({ requestId: incoming.id, body: '可以。' })
    const adopted = await A.adopt(composed.requestId)
    assert.ok(!adopted.preview || !adopted.preview.preview_id, excerpt)
    assert.notEqual(adopted.heard, 'preview', excerpt)
  }
})

test('采纳后模型连调两次 preview 并进同一张卡', async () => {
  const rows = [{
    code: 'CUST-019',
    status: 'active',
    phone: '13600705451',
    address: '旧址',
    owner: 'emp_lin',
    updatedAt: '1',
  }]
  const lookup = createLookup({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: rows.map((row) => ({ ...row })) }),
    }),
  })
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
  const now = () => 1_700_000_000_000
  const { A, B, peer } = await pairedMail(
    {
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      catalog: () => [{ name: 'biz_preview' }, { name: 'search_text' }],
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        now,
        loadVocab: async () => vocab,
      }),
    },
    {
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        now,
        loadVocab: async () => vocab,
      }),
    },
  )
  const composed = await A.compose({
    excerpt: '帮我把武汉光谷的电话改成13323277896，地址改成新址',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '可以，按这个改。' })
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
  assert.match(adopted.followup.text, /同一笔改单只出一张预览卡/)
  const first = await A.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { phone: '13323277896' },
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  const second = await A.previewBiz({
    kind: '客户',
    no: 'CUST-019',
    action: '改行',
    patch: { address: '新址' },
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'preview')
  assert.equal((dock.preview.lines || []).length, 2)
  assert.match(dock.speak, /电话/)
  assert.match(dock.speak, /地址|新址/)
})

test('拟回 a named change without 改一下 still asks the session to preview', async () => {
  const lookup = liveLookup([
    { resource: 'biz_customers', field: 'code', no: 'CUST-019', status: 'active' },
  ])
  const vocab = [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_customers', ticketField: 'code' }]
  const { B, A, peer } = await pairedMail(
    {
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        now: () => 1_700_000_000_000,
        loadVocab: async () => vocab,
      }),
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
    },
    {
      gate: createGate({
        lookupTodo: (spec) => lookup.lookupTodo(spec),
        now: () => 1_700_000_000_000,
        loadVocab: async () => vocab,
      }),
      lookupTodo: (spec) => lookup.lookupTodo(spec),
      loadVocab: async () => vocab,
      catalog: () => [{ name: 'biz_preview' }, { name: 'search_text' }],
    },
  )
  const composed = await A.compose({
    excerpt: '帮我把武汉光谷的电话改成13323277896',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/mail/nocobase-test',
  })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  const drafted = await B.draftReply(incoming.id, 'sess-lin', '/mail/nocobase-test')
  assert.equal(drafted.ok, true)
  assert.equal(drafted.heard, 'intent')
  assert.ok(drafted.followup)
  assert.match(drafted.followup.text, /biz_preview/)
  assert.match(drafted.followup.text, /武汉光谷/)
  assert.match(drafted.followup.text, /不能只写信/)
  assert.notEqual((await B.dock('sess-lin')) && (await B.dock('sess-lin')).mode, 'preview')
})
