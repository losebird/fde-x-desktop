import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeRef, looksLikeTicket, pickNo, resolveRows } from '../resolve.js'
import { createLookup } from '../lookup.js'
import { createGate, createNocoWrite } from '../write.js'
import { speakLookup } from '../probe.js'
import { withSpoken } from './ask-clue.js'

const VOCAB = withSpoken([
  { kind: '采购单', resource: 'biz_purchase_orders', ticketField: 'orderNo' },
  { kind: '采购明细', resource: 'biz_purchase_order_items', ticketField: 'id' },
  { kind: '销售订单', resource: 'biz_sales_orders', ticketField: 'orderNo' },
  { kind: '客户', resource: 'biz_customers', ticketField: 'code' },
  { kind: '工单', resource: 'biz_tickets', ticketField: 'ticketNo' },
  { kind: '合同', resource: 'biz_contracts', ticketField: 'contractNo' },
  { kind: '供应商', resource: 'biz_suppliers', ticketField: 'code' },
  { kind: '联系人', resource: 'biz_contacts', ticketField: 'name' },
  { kind: '请假单', resource: 'biz_leave_requests', ticketField: 'requestNo' },
  { kind: '报销单', resource: 'biz_expenses', ticketField: 'expenseNo' },
])

function lookupOf(opts = {}) {
  return createLookup({ vocab: VOCAB, ...opts })
}

test('looksLikeRef treats a snowflake id as a row, not a name', () => {
  assert.equal(looksLikeTicket('384417162657792'), false)
  assert.equal(looksLikeRef('384417162657792'), true)
  assert.equal(looksLikeRef('TK20240510286'), true)
  assert.equal(looksLikeRef('胡文'), false)
})

test('pickNo uses id when ticket fields are empty', () => {
  assert.equal(pickNo({ title: '电脑故障紧急保修', status: 'resolved' }, ['ticketNo']), '')
  assert.equal(pickNo({ id: 88, title: '电脑故障紧急保修' }, ['ticketNo']), '88')
  assert.equal(pickNo({ ticketNo: 'TK-1', id: 88 }, ['ticketNo']), 'TK-1')
})







test('graph 口语 clues without role still treat action/join as slots, not DB fields', async () => {
  const vocab = [{
    id: 'spoken',
    kind: '口语',
    spoken: true,
    fields: ['单号'],
    can: ['现查'],
    clues: [
      { say: ['发给我', '发我'], keys: ['action'], values: ['现查'] },
      { say: ['或者', '或'], keys: ['join'], values: ['or'] },
      { say: ['处理中'], keys: ['status', 'state', 'stage'], values: ['processing', '处理中'] },
      { say: ['紧急'], keys: ['priority'], values: ['urgent', '紧急'] },
    ],
  }, { kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }]
  const calls = []
  const lookup = createLookup({
    vocab,
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(decodeURIComponent(String(url)))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { ticketNo: 'TK-URG', status: 'processing', priority: 'urgent', owner: 'emp_lin', updatedAt: '2' },
            { ticketNo: 'TK-LOW', status: 'processing', priority: 'low', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({
    kind: '工单',
    no: '',
    where: [
      { keys: ['status'], values: ['processing'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
    vocab,
  })
  assert.equal(found.ok, true)
  assert.deepEqual(found.matches.map((row) => row.no), ['TK-URG'])
  assert.ok(calls.every((url) => !url.includes('"action":"现查"')))
})

test('lookup 处理中的紧急 keeps AND, not the latest ticket page', async () => {
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK-LOW', status: 'processing', priority: 'low', title: '咨询', owner: 'emp_lin', updatedAt: '3' },
          { ticketNo: 'TK-URG', status: 'processing', priority: 'urgent', title: '故障', owner: 'emp_lin', updatedAt: '2' },
          { ticketNo: 'TK-RES', status: 'resolved', priority: 'urgent', title: '权限', owner: 'emp_lin', updatedAt: '1' },
        ],
      }),
    }),
  })
  const found = await lookup.lookupTodo({
    kind: '工单',
    no: '',
    where: [
      { keys: ['status'], values: ['processing'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
  })
  assert.equal(found.ok, true)
  assert.equal(found.matches.length, 1)
  assert.equal(found.matches[0].no, 'TK-URG')
})

test('已完成的故障 is status AND category, not a name includes 故障', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(decodeURIComponent(String(url)))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { ticketNo: 'TK-INC', status: 'resolved', category: 'incident', title: '功能咨询', owner: 'emp_lin', updatedAt: '2' },
            { ticketNo: 'TK-CN', status: 'resolved', category: '咨询', title: '报表', owner: 'emp_lin', updatedAt: '1' },
            { ticketNo: 'TK-OPEN', status: 'processing', category: 'incident', title: '还在处理', owner: 'emp_lin', updatedAt: '3' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({
    kind: '工单',
    where: [
      { keys: ['status'], values: ['resolved'] },
      { keys: ['category'], values: ['incident'] },
    ],
  })
  assert.equal(found.ok, true)
  assert.deepEqual(found.matches.map((row) => row.no), ['TK-INC'])
  assert.ok(calls.some((url) => /category/.test(url)))
  assert.ok(calls.every((url) => !/"\$includes":"故障"/.test(url)))
})

test('fat filter LOOKUP falls back to a page and still ANDs locally', async () => {
  let n = 0
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      n += 1
      if (String(url).includes('filter=')) {
        return { ok: false, status: 400, json: async () => ({ message: 'bad filter' }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { ticketNo: 'TK-INC', status: 'resolved', category: 'incident', owner: 'emp_lin', updatedAt: '2' },
            { ticketNo: 'TK-OPEN', status: 'processing', category: 'incident', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({
    kind: '工单',
    where: [
      { keys: ['status'], values: ['resolved'] },
      { keys: ['category'], values: ['incident'] },
    ],
  })
  assert.equal(found.ok, true)
  assert.ok(n >= 2)
  assert.deepEqual(found.matches.map((row) => row.no), ['TK-INC'])
})

test('expired is a status, not a contract number', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(decodeURIComponent(String(url)))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, contractNo: 'HT-1', status: 'expired', customerId: 20, owner: 'emp_lin', updatedAt: '2' },
            { id: 2, contractNo: 'HT-2', status: 'active', customerId: 21, owner: 'emp_lin', updatedAt: '1' },
            { id: 3, contractNo: 'HT-3', status: 'active', endDate: '2020-01-01', customerId: 20, owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({
    kind: '合同',
    no: '',
    join: 'or',
    where: [{ keys: ['status'], values: ['expired'] }, { dateBefore: ['endDate'] }],
  })
  assert.equal(found.ok, true)
  assert.ok(calls.every((url) => !/"contractNo":"expired"/.test(url)))
  assert.deepEqual(found.matches.map((row) => row.no).sort(), ['HT-1', 'HT-3'])
})

test('expired dateBefore still matches when the remote status filter returns the latest page', async () => {
  const lookup = lookupOf({
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
      const filtered = decoded.includes('"status"')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: filtered
            ? [
                { id: 9, contractNo: 'HT20260119815', status: 'draft', title: '鼎盛服务采购合同', endDate: '2027-01-01', owner: 'emp_lin', updatedAt: '9' },
                { id: 8, contractNo: 'HT20240623556', status: 'signed', title: '天和项目采购合同', endDate: '2027-01-01', owner: 'emp_lin', updatedAt: '8' },
              ]
            : [
                { id: 1, contractNo: 'HT-KEEP', status: 'signed', endDate: '2020-01-01', customer: { id: 20, name: '杭州数澜' }, owner: 'emp_lin', updatedAt: '1' },
                { id: 2, contractNo: 'HT-FUTURE', status: 'signed', endDate: '2099-01-01', customerId: 21, owner: 'emp_lin', updatedAt: '2' },
                { id: 9, contractNo: 'HT20260119815', status: 'draft', title: '鼎盛服务采购合同', endDate: '2027-01-01', owner: 'emp_lin', updatedAt: '9' },
              ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({
    kind: '合同',
    no: '',
    where: [{ dateBefore: ['endDate'] }],
  })
  assert.equal(found.ok, true)
  assert.deepEqual(found.matches.map((row) => row.no), ['HT-KEEP'])
  assert.equal(found.matches[0].fields.customerId, '20')
})


test('lookup 处理中或紧急 is OR, not AND', async () => {
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticketNo: 'TK-LOW', status: 'processing', priority: 'low', owner: 'emp_lin', updatedAt: '3' },
          { ticketNo: 'TK-RES', status: 'resolved', priority: 'urgent', owner: 'emp_lin', updatedAt: '2' },
          { ticketNo: 'TK-MID', status: 'open', priority: 'medium', owner: 'emp_lin', updatedAt: '1' },
        ],
      }),
    }),
  })
  const found = await lookup.lookupTodo({
    kind: '工单',
    join: 'or',
    where: [
      { keys: ['status'], values: ['processing'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
  })
  assert.equal(found.ok, true)
  assert.deepEqual(found.matches.map((row) => row.no).sort(), ['TK-LOW', 'TK-RES'])
})

test('related customer id filters sales orders, not the customer code as order no', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      calls.push(decodeURIComponent(String(url)))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { orderNo: 'SO-OWN', customerId: 2152, status: 'confirmed', owner: 'emp_lin', updatedAt: '2' },
            { orderNo: 'SO-OTHER', customerId: 1, status: 'confirmed', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({
    kind: '销售订单',
    related: { kind: '客户', no: 'CUST2152', id: 2152 },
  })
  assert.equal(found.ok, true)
  assert.ok(calls.some((url) => /customerId/.test(url) && /2152/.test(url)))
  assert.ok(calls.every((url) => !/"orderNo":"CUST2152"/.test(url)))
  assert.equal(found.matches.length, 1)
  assert.equal(found.matches[0].no, 'SO-OWN')
})

test('names are clues; ticket-shaped values stay exact', () => {
  assert.equal(looksLikeTicket('CUST-020'), true)
  assert.equal(looksLikeTicket('西安天工'), false)
  assert.equal(looksLikeTicket('expired'), false)
  assert.equal(looksLikeTicket('active'), false)
  assert.equal(looksLikeTicket('incident'), false)
  assert.equal(looksLikeTicket('20260824'), false)
  assert.equal(looksLikeTicket('12000'), false)
  assert.equal(looksLikeTicket('13800138000'), false)
  const rows = [
    { code: 'CUST-020', name: '西安天工装备有限公司', status: 'inactive' },
    { code: 'CUST2036', name: '成都中天工业有限公司', status: 'active' },
  ]
  const one = resolveRows(rows, '西安天工', ['code', 'name'])
  assert.equal(one.ok, true)
  assert.equal(one.ambiguous, false)
  assert.equal(one.no, 'CUST-020')
  const many = resolveRows(rows, '天工', ['code', 'name'])
  assert.equal(many.ok, true)
  assert.equal(many.ambiguous, true)
  assert.equal(many.matches.length, 2)
  const none = resolveRows(rows, '没有这家', ['code', 'name'])
  assert.equal(none.ok, false)
  assert.equal(none.error, 'NOT_FOUND')
})

test('any this-seat field can be a clue', () => {
  const rows = [
    { code: 'CUST-020', name: '西安天工', address: '西安高新区', remark: '系统集成', status: 'inactive' },
    { code: 'CUST-021', name: '别家', address: '成都高新区', remark: '培训', status: 'active' },
  ]
  const byAddr = resolveRows(rows, '西安高新区', ['code'])
  assert.equal(byAddr.ok, true)
  assert.equal(byAddr.no, 'CUST-020')
  const byRemark = resolveRows(rows, '系统集成', ['code'])
  assert.equal(byRemark.ok, true)
  assert.equal(byRemark.no, 'CUST-020')
})

test('lookup speak includes this-seat fields', async () => {
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          code: 'CUST-020',
          name: '西安天工装备有限公司',
          phone: '13800138000',
          address: '西安高新区',
          status: 'inactive',
        }],
      }),
    }),
  })
  const found = await lookup.lookupTodo({ kind: '客户', no: 'CUST-020' })
  assert.equal(found.ok, true)
  assert.equal(found.fields.name, '西安天工装备有限公司')
  assert.equal(found.fields.phone, '13800138000')
  assert.match(speakLookup({ kind: '客户', no: 'CUST-020' }, found), /西安天工装备有限公司/)
  assert.match(speakLookup({ kind: '客户', no: 'CUST-020' }, found), /13800138000/)
})

test('NocoBase name clue uses includes; empty list is not yours', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url) => {
      calls.push(String(url))
      const decoded = decodeURIComponent(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ code: 'CUST-020', name: '西安天工装备有限公司', status: 'inactive' }] }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '客户', no: '西安天工' })
  assert.equal(found.ok, true)
  assert.equal(found.no, 'CUST-020')
  const listed = calls.find((url) => url.includes('biz_customers:list'))
  assert.match(listed, /biz_customers:list/)
  assert.match(decodeURIComponent(listed), /\$includes/)
  assert.doesNotMatch(decodeURIComponent(listed), /单号/)
  assert.equal((await lookup.lookupTodo({ kind: '客户', no: '没有这家' })).error, 'NOT_FOUND')
  assert.match(speakLookup({ kind: '客户', no: '没有这家' }, { ok: false, error: 'NOT_FOUND' }), /没有/)
})

test('NocoBase name clue asks the business system, not only the latest pages', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url) => {
      calls.push(String(url))
      const decoded = decodeURIComponent(String(url))
      assert.match(decoded, /\$includes/)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ code: 'CUST9999', name: '很靠后的西安恒通', status: 'active' }],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '客户', no: '西安恒通' })
  assert.equal(found.ok, true)
  assert.equal(found.no, 'CUST9999')
  assert.equal(calls.filter((url) => url.includes('filter=')).length, 1)
})

test('NocoBase name clue finds a contact past the first page', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url) => {
      calls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 1, name: '其他人0' },
            { id: 371712738328591, name: '王敏', mobile: '19438274943', position: '技术总监' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '联系人', no: '王敏' })
  assert.equal(found.ok, true)
  assert.equal(found.no, '王敏')
  assert.equal(found.ambiguous, undefined)
  const listed = calls.find((url) => url.includes('biz_contacts:list'))
  assert.match(decodeURIComponent(listed), /biz_contacts:list/)
  assert.match(decodeURIComponent(listed), /\$includes/)
  assert.match(decodeURIComponent(listed), /王敏/)
})

test('REST dialect still resolves names on this machine', async () => {
  const calls = []
  const lookup = lookupOf({
    resolve: async () => ({
      connections: [{
        id: 'oa',
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        token: 'oa-tok',
        listPath: '/v1/customers?q={q}',
        ticketField: 'code',
        statusField: 'state',
      }],
    }),
    fetchImpl: async (url) => {
      calls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { code: 'CUST-020', name: '西安天工装备有限公司', state: 'inactive' },
            { code: 'CUST2036', name: '成都中天工业有限公司', state: 'active' },
          ],
        }),
      }
    },
  })
  const one = await lookup.lookupTodo({ kind: '客户', no: '西安天工' })
  assert.equal(one.ok, true)
  assert.equal(one.no, 'CUST-020')
  assert.equal(one.ambiguous, undefined)
  assert.match(calls[0], /q=%E8%A5%BF%E5%AE%89%E5%A4%A9%E5%B7%A5/)
  const many = await lookup.lookupTodo({ kind: '客户', no: '天工' })
  assert.equal(many.ok, true)
  assert.equal(many.ambiguous, true)
  assert.equal(many.matches.length, 2)
  assert.match(speakLookup({ kind: '客户', no: '天工' }, many), /对上2条/)
})

test('REST dialect speak includes this-seat fields', async () => {
  const lookup = lookupOf({
    resolve: async () => ({
      connections: [{
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        listPath: '/v1/customers?q={q}',
        ticketField: 'code',
        statusField: 'state',
      }],
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{
          code: 'CUST-020',
          name: '西安天工装备有限公司',
          phone: '029-88880000',
          address: '西安高新区',
          state: 'inactive',
        }],
      }),
    }),
  })
  const found = await lookup.lookupTodo({ kind: '客户', no: '西安天工' })
  assert.equal(found.ok, true)
  assert.equal(found.dialect, 'rest')
  assert.equal(found.fields.name, '西安天工装备有限公司')
  assert.equal(found.fields.phone, '029-88880000')
  assert.match(speakLookup({ kind: '客户', no: 'CUST-020' }, found), /西安天工装备有限公司/)
  assert.match(speakLookup({ kind: '客户', no: 'CUST-020' }, found), /029-88880000/)
})

test('write preview resolves a name then posts the unique ticket', async () => {
  const posts = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ orderNo: 'PO-12', name: '西安天工急件', status: 'pending', owner: 'emp_lin', updatedAt: '1' }] }),
    }),
  })
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }], vocab: VOCAB }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), method: init.method, body: init.body })
      return { ok: true, json: async () => ({ receiptId: 'rcpt_1' }) }
    },
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    postWrite: (spec) => writer.write(spec),
    now: () => 1,
    vocab: [{ kind: '采购单', fields: ['单号', '状态'], can: ['过审', '现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo' }],
  })
  const preview = await gate.preview({ kind: '采购单', no: '天工急件', action: '过审' })
  assert.equal(preview.ok, true)
  assert.equal(preview.no, 'PO-12')
  const written = await gate.write({ preview_id: preview.preview_id, trace_id: 't1' })
  assert.equal(written.ok, true)
  assert.match(posts[0].url, /orderNo.*PO-12/)
  assert.doesNotMatch(posts[0].url, /天工/)
})

test('ambiguous clue cannot preview a write on any dialect', async () => {
  const lookup = lookupOf({
    resolve: async () => ({
      connections: [{
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        listPath: '/v1/orders?q={q}',
        ticketField: 'orderNo',
        writePath: '/v1/orders/{no}',
      }],
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { orderNo: 'PO-12', name: '天工甲' },
          { orderNo: 'PO-13', name: '天工乙' },
        ],
      }),
    }),
  })
  const gate = createGate({
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    now: () => 1,
    vocab: [{ kind: '采购单', fields: ['单号', '状态'], can: ['过审', '现查'], resource: 'biz_purchase_orders', ticketField: 'orderNo' }],
  })
  const preview = await gate.preview({ kind: '采购单', no: '天工', action: '过审' })
  assert.equal(preview.preview_id, undefined)
  assert.equal((preview.sheet && preview.sheet.rows || []).length, 2)
  assert.deepEqual((preview.sheet.rows || []).map((row) => row.no).sort(), ['PO-12', 'PO-13'])
})

test('REST write uses the configured path after resolve', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({
      connections: [{
        id: 'oa',
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        token: 'oa',
        writePath: '/v1/orders/{no}',
      }],
      vocab: VOCAB,
    }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), method: init.method })
      return { ok: true, json: async () => ({ id: 'rcpt_oa' }) }
    },
  })
  const written = await writer.write({ kind: '采购单', no: 'PO-12', action: '过审', to: '已过', connectionId: 'oa', vocab: VOCAB })
  assert.equal(written.ok, true)
  assert.equal(posts[0].url, 'https://oa.example/v1/orders/PO-12')
  assert.equal(posts[0].method, 'POST')
})

test('REST write field placeholder is not vocab 单号 and line items keep id', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({
      connections: [{
        id: 'oa',
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        token: 'oa',
        writePath: '/v1/{kind}/{field}/{no}',
      }],
      vocab: VOCAB,
    }),
    fetchImpl: async (url) => {
      posts.push(String(url))
      return { ok: true, json: async () => ({ id: 'rcpt_oa' }) }
    },
  })
  await writer.write({
    kind: '采购单',
    no: 'PO-12',
    action: '过审',
    mapped: { resource: 'orders', fields: ['单号', '状态'] },
    connectionId: 'oa',
  })
  assert.match(posts[0], /\/v1\/orders\/orderNo\/PO-12$/)
  assert.doesNotMatch(posts[0], /%E5%8D%95%E5%8F%B7|\/id\/|\/code\//)
  await writer.write({
    kind: '采购明细',
    no: '88',
    action: '改行',
    patch: { qty: 2 },
    mapped: { resource: 'biz_purchase_order_items', fields: ['id'] },
    connectionId: 'oa',
  })
  assert.match(posts[1], /\/v1\/biz_purchase_order_items\/id\/88$/)
})

test('customer code or name becomes numeric customerId, never CUST- as bigint', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }] }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), body: init && init.body })
      if (String(url).includes('biz_customers:list')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 16, code: 'CUST-016', name: '南京智航交通' }] }),
        }
      }
      return { ok: true, json: async () => ({ data: { id: 99 } }) }
    },
  })
  const written = await writer.write({
    kind: '工单',
    no: '新单',
    action: '新建',
    patch: { title: '电脑故障紧急保修', customer: 'CUST-016', customerId: 'CUST-016' },
    mapped: { resource: 'biz_tickets', fields: ['ticketNo'] },
    vocab: VOCAB,
  })
  assert.equal(written.ok, true, written.error)
  const create = posts.find((row) => String(row.url).includes('biz_tickets:create'))
  const body = JSON.parse(create.body)
  assert.equal(String(body.customerId), '16')
  assert.equal(body.customer, undefined)
  assert.doesNotMatch(JSON.stringify(body), /CUST-016/)
})

test('NocoBase relation patch writes customerId, not customer code, and keeps other fields', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }], vocab: VOCAB }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), body: init && init.body })
      if (String(url).includes('biz_customers:list')) {
        return { ok: true, json: async () => ({ data: [{ id: 3717, code: 'CUST2047' }] }) }
      }
      return { ok: true, json: async () => ({ data: [{ id: 77, status: 'processing' }] }) }
    },
  })
  const written = await writer.write({
    kind: '工单',
    no: 'TK20251226865',
    action: '改行',
    patch: { status: 'processing', customerPhone: '13333112123', customer: 'CUST2047' },
    mapped: { resource: 'biz_tickets', fields: ['ticketNo'] },
  })
  assert.equal(written.ok, true)
  const update = posts.find((row) => row.body)
  const body = JSON.parse(update.body)
  assert.equal(body.status, 'processing')
  assert.equal(String(body.customerId), '3717')
  assert.equal(body.customer, undefined)
  assert.equal(body.customerPhone, undefined)
})

test('新建 does not post placeholder 单号 or unresolved relation text', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }], vocab: VOCAB }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), body: init && init.body })
      if (String(url).includes('biz_customers:list') || String(url).includes('biz_contacts:list')) {
        return { ok: true, json: async () => ({ data: [] }) }
      }
      return { ok: true, json: async () => ({ data: { id: 99, title: '电脑故障紧急保修' } }) }
    },
  })
  const written = await writer.write({
    kind: '工单',
    no: '新单',
    action: '新建',
    patch: {
      no: '新单',
      ticketNo: '新单',
      title: '电脑故障紧急保修',
      customer: '南京智航交',
      contact: 'c256@client.com',
      status: 'resolved',
    },
    mapped: { resource: 'biz_tickets', fields: ['ticketNo'] },
  })
  assert.equal(written.ok, true, written.error)
  const create = posts.find((row) => String(row.url).includes('biz_tickets:create'))
  const body = JSON.parse(create.body)
  assert.equal(body.no, undefined)
  assert.equal(body.ticketNo, undefined)
  assert.equal(body.customer, undefined)
  assert.equal(body.customerId, undefined)
  assert.equal(body.contact, undefined)
  assert.equal(body.contactId, undefined)
  assert.equal(body.title, '电脑故障紧急保修')
  assert.equal(body.status, 'resolved')
})

test('write failure speaks the business error, not only 工单 新单', async () => {
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }], vocab: VOCAB }),
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ message: 'customer must be an object or id' }),
    }),
  })
  const written = await writer.write({
    kind: '工单',
    no: '新单',
    action: '新建',
    patch: { title: '电脑故障紧急保修' },
    mapped: { resource: 'biz_tickets', fields: ['ticketNo'] },
  })
  assert.equal(written.ok, false)
  assert.match(written.hint, /customer must be an object or id/)
})

test('contact write keeps mobile; sales-order remark lands on remarks', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }], vocab: VOCAB }),
    fetchImpl: async (url, init) => {
      posts.push({ url: String(url), body: init && init.body })
      return { ok: true, json: async () => ({ data: [{ id: 1 }] }) }
    },
  })
  const contact = await writer.write({
    kind: '联系人',
    no: '王敏',
    action: '改行',
    patch: { mobile: '13700003333', position: '交付总监' },
    mapped: { resource: 'biz_contacts', fields: ['name'] },
  })
  assert.equal(contact.ok, true)
  const contactBody = JSON.parse(posts.find((row) => row.body && String(row.url).includes('biz_contacts')).body)
  assert.equal(contactBody.mobile, '13700003333')
  assert.equal(contactBody.position, '交付总监')

  const order = await writer.write({
    kind: '销售订单',
    no: 'SO20260108975',
    action: '改行',
    patch: { status: 'confirmed', 备注: '跨表联调：跟合同 HT20251211557' },
    mapped: { resource: 'biz_sales_orders', fields: ['orderNo'] },
  })
  assert.equal(order.ok, true)
  const orderBody = JSON.parse(posts.filter((row) => row.body && String(row.url).includes('biz_sales_orders')).pop().body)
  assert.equal(orderBody.status, 'confirmed')
  assert.equal(orderBody.remarks, '跨表联调：跟合同 HT20251211557')
  assert.equal(orderBody.备注, undefined)
})

test('NocoBase line-item write filters on id, not code', async () => {
  const posts = []
  const writer = createNocoWrite({
    resolve: async () => ({ connections: [{ id: 'nb', baseUrl: 'https://nb.example', token: 't' }], vocab: VOCAB }),
    fetchImpl: async (url) => {
      posts.push(String(url))
      return { ok: true, json: async () => ({ data: { id: 88 } }) }
    },
  })
  await writer.write({
    kind: '采购明细',
    no: '88',
    action: '改行',
    patch: { qty: 2 },
    mapped: { resource: 'biz_purchase_order_items', fields: ['id'] },
  })
  assert.match(decodeURIComponent(posts[0]), /"id":"88"/)
  assert.doesNotMatch(decodeURIComponent(posts[0]), /"code":"88"/)
})
