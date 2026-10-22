import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectionFields, createLookup, isWritePath, mapKind, registeredKinds, relatedChildId, relatedField, relatedFilterField, relatedHopId, termFitsCollection, withRelationAppends } from '../lookup.js'
import { packSheet, stampParentLabels } from '../write.js'
import { enumMap } from '../resolve.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'
import { withSpoken } from './ask-clue.js'

const VOCAB = withSpoken([
  { kind: '采购单', resource: 'biz_purchase_orders', ticketField: 'orderNo' },
  { kind: '销售数据', resource: 'biz_sales_orders', ticketField: 'orderNo' },
  { kind: '销售订单', resource: 'biz_sales_orders', ticketField: 'orderNo' },
  { kind: '客户', resource: 'biz_customers', ticketField: 'code' },
  { kind: '工单', resource: 'biz_tickets', ticketField: 'ticketNo' },
  { kind: '合同', resource: 'biz_contracts', ticketField: 'contractNo' },
  { kind: '供应商', resource: 'biz_suppliers', ticketField: 'code' },
])

function lookupOf(opts = {}) {
  return createLookup({ vocab: VOCAB, ...opts })
}

test('parent hop id is the parent row id, not a carried FK on the parent', () => {
  const extra = {
    vocab: VOCAB.concat([{
      kind: '回款单',
      resource: 'biz_payments',
      ticketField: 'paymentNo',
      relations: [{ from: '合同', to: '回款单', field: 'contractId' }],
    }]),
  }
  const id = relatedHopId('合同', '回款单', {
    contractNo: 'HT-1',
    id: '80',
    customerId: '20',
  }, extra)
  assert.equal(id, '80')
})

test('customer hop reads customerId, not another FK on the child', () => {
  const extra = {
    vocab: VOCAB.concat([{ kind: '联系人', resource: 'biz_contacts', ticketField: 'name' }]),
  }
  const id = relatedChildId('客户', '工单', {
    ticketNo: 'TK-1',
    customerId: '20',
    contactId: '99',
  }, extra)
  assert.equal(id, '20')
})

function memStore() {
  let state = emptyState()
  const secrets = {}
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
    async getSecret(key) { return secrets[key] || '' },
    async setSecret(key, value) {
      if (value) secrets[key] = String(value)
      else delete secrets[key]
      return secrets[key] || ''
    },
  }
}

test('relatedHopId never uses a parent row id as a different kind of FK', () => {
  const extra = { vocab: [
    { kind: '客户', resource: 'biz_customers' },
    { kind: '合同', resource: 'biz_contracts' },
    { kind: '供应商', resource: 'biz_suppliers' },
    { kind: '销售订单', resource: 'biz_sales_orders' },
    { kind: '工单', resource: 'biz_tickets' },
    { kind: '采购单', resource: 'biz_purchase_orders' },
    { kind: '商机', resource: 'biz_opportunities' },
    { kind: '仓库', resource: 'biz_warehouses' },
    { kind: '库存', resource: 'biz_inventories' },
  ] }
  assert.equal(relatedHopId('客户', '销售订单', { id: 2152 }, extra), '2152')
  assert.equal(relatedHopId('客户', '工单', { id: 3717, ownerId: 6, createdById: 1 }, extra), '3717')
  assert.equal(relatedFilterField('客户', '工单', { id: 3717, ownerId: 6 }, extra), 'customerId')
  assert.equal(relatedHopId('合同', '工单', { id: 7 }, extra), '7')
  assert.equal(relatedHopId('供应商', '采购单', { id: 9 }, extra), '9')
  assert.equal(relatedHopId('合同', '销售订单', { id: 1, customerId: 20 }, extra), '1')
  const viaCustomer = {
    vocab: extra.vocab.concat([{
      kind: '销售订单',
      resource: 'biz_sales_orders',
      relations: [{ from: '合同', to: '销售订单', field: 'customerId' }],
    }]),
  }
  assert.equal(relatedHopId('合同', '销售订单', { id: 1, customerId: 20 }, viaCustomer), '20')
  assert.equal(relatedHopId('合同', '销售订单', { id: 1, customer: { id: 20, name: '天和' } }, viaCustomer), '20')
  assert.equal(relatedHopId('合同', '订单', { id: 1 }, extra), '1')
  assert.equal(relatedFilterField('合同', '销售订单', { id: 1 }, extra), 'contractId')
  assert.equal(relatedFilterField('合同', '销售订单', { id: 1, customerId: 20 }, extra), 'customerId')
  assert.equal(relatedHopId('客户', '商机', { id: 3 }, extra), '3')
  assert.equal(relatedHopId('仓库', '库存', { id: 8 }, extra), '8')
})

test('status terms that are not in a collection enum are dropped for that lookup', () => {
  const po = collectionFields('biz_purchase_orders', [{
    name: 'biz_purchase_orders',
    fields: [{
      name: 'status',
      uiSchema: { enum: [{ value: '待审', label: '待审' }, { value: '已完成', label: '已完成' }] },
    }],
  }])
  const supplier = collectionFields('biz_suppliers', [{
    name: 'biz_suppliers',
    fields: [{
      name: 'status',
      uiSchema: { enum: [{ value: '停用', label: '停用' }, { value: '合作中', label: '合作中' }] },
    }],
  }])
  const idle = { keys: ['status'], values: ['inactive', '停用'] }
  const open = { keys: ['status'], values: ['已完成', 'resolved'], not: true }
  assert.equal(termFitsCollection(idle, supplier), true)
  assert.equal(termFitsCollection(open, supplier), false)
  assert.equal(termFitsCollection(idle, po), false)
  assert.equal(termFitsCollection(open, po), true)
  const urgent = { keys: ['priority'], values: ['urgent', '紧急'] }
  assert.equal(termFitsCollection(urgent, supplier), false)
  assert.equal(termFitsCollection(urgent, []), true)
})

test('hop does not overwrite a child row relation with the parent ticket no', () => {
  const extra = { vocab: VOCAB }
  const rows = stampParentLabels(
    '合同',
    [{ no: 'HT-OLD', fields: { id: 1, customerId: 20, contractNo: 'HT-OLD' } }],
    [{ no: 'SO-1', fields: { customerId: 20, contract: 'HT-REAL', contractId: '9' } }],
    '订单',
    extra,
  )
  assert.equal(rows[0].fields.contract, 'HT-REAL')
})

test('list appends m2o fields from the collection, not a hardcoded column list', () => {
  const collections = [{
    name: 'biz_sales_orders',
    fields: [
      { name: 'orderNo', uiSchema: { title: '订单编号' } },
      { name: 'customer', interface: 'm2o', target: 'biz_customers', uiSchema: { title: '客户' } },
      { name: 'warehouse', interface: 'm2o', target: 'biz_warehouses', uiSchema: { title: '发货仓库' } },
      { name: 'createdBy', interface: 'm2o', target: 'users', uiSchema: { title: 'Created by' } },
      { name: 'items', interface: 'o2m', target: 'biz_sales_order_items', uiSchema: { title: '订单明细' } },
    ],
  }]
  const path = withRelationAppends('/api/biz_sales_orders:list?pageSize=50&sort=-updatedAt', collections, 'biz_sales_orders')
  assert.match(path, /appends\[\]=customer/)
  assert.match(path, /appends\[\]=warehouse/)
  assert.doesNotMatch(path, /appends\[\]=createdBy/)
  assert.doesNotMatch(path, /appends\[\]=items/)
})

test('appended m2o objects become sheet columns by collection title', () => {
  const fields = collectionFields('biz_sales_orders', [{
    name: 'biz_sales_orders',
    fields: [
      { name: 'customer', interface: 'm2o', uiSchema: { title: '客户' } },
      { name: 'totalAmount', uiSchema: { title: '订单金额' } },
    ],
  }])
  const sheet = packSheet({
    kind: '订单',
    action: '现查',
    schemaFields: fields,
    matches: [{
      no: 'SO-1',
      status: 'confirmed',
      fields: { orderNo: 'SO-1', customer: '恒通', totalAmount: '1200', customerId: '9' },
    }],
  })
  const keys = sheet.columns.map((col) => col.key)
  assert.ok(keys.includes('customer'))
  assert.ok(keys.includes('totalAmount'))
  assert.equal(sheet.columns.find((col) => col.key === 'customer').label, '客户')
  assert.equal(sheet.columns.find((col) => col.key === 'totalAmount').label, '订单金额')
  assert.ok(!keys.includes('customerId'))
})

test('vocab-mapped list still loads collection schema so related names show', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      const decoded = decodeURIComponent(String(url))
      calls.push(decoded)
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
                { name: 'title', uiSchema: { title: '工单标题' } },
                { name: 'customer', interface: 'm2o', target: 'biz_customers', uiSchema: { title: '客户名称' } },
                { name: 'contact', interface: 'm2o', target: 'biz_contacts', uiSchema: { title: '姓名' } },
                { name: 'assignee', interface: 'm2o', target: 'users', uiSchema: { title: '昵称' } },
                { name: 'status', uiSchema: { title: '工单状态' } },
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
            ticketNo: 'TK-1',
            title: '数据同步异常',
            status: 'assigned',
            customerId: 9,
            customer: { id: 9, code: 'CUST2242', name: '杭州启明网络科技有限公司' },
            contact: { id: 2, name: '刘明' },
            assignee: { id: 6, nickname: '刘洋' },
            owner: 'emp_lin',
            updatedAt: '1',
          }],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '工单', no: '', speech: '工单' })
  assert.equal(found.ok, true)
  assert.ok(calls.some((url) => /collections:list/.test(url)))
  assert.ok(calls.some((url) => /appends\[\]=customer/.test(url)))
  assert.ok(calls.some((url) => /appends\[\]=contact/.test(url)))
  assert.ok(calls.some((url) => /appends\[\]=assignee/.test(url)))
  assert.equal(found.matches[0].fields.customer, '杭州启明网络科技有限公司')
  assert.equal(found.matches[0].fields.contact, '刘明')
  assert.equal(found.matches[0].fields.assignee, '刘洋')
  const schema = await lookup.fieldsOf('工单')
  const sheet = packSheet({
    kind: '工单',
    action: '现查',
    schemaFields: schema,
    matches: found.matches,
  })
  const keys = sheet.columns.map((col) => col.key)
  assert.ok(keys.includes('customer'))
  assert.ok(keys.includes('contact'))
  assert.ok(keys.includes('assignee'))
  assert.ok(!keys.includes('customerId'))
  assert.equal(sheet.columns.find((col) => col.key === 'customer').label, '客户名称')
  assert.equal(sheet.columns.find((col) => col.key === 'contact').label, '姓名')
  assert.equal(sheet.columns.find((col) => col.key === 'assignee').label, '昵称')
})

test('fieldsOf fetches collection enums when the cached connector schema has none', async () => {
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    collections: [{
      name: 'biz_tickets',
      title: '工单',
      fields: [{ name: 'status', title: '状态' }, { name: 'priority', title: '优先级' }],
    }],
    fetchImpl: async (url) => {
      if (/collections:list/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              name: 'biz_tickets',
              title: '工单',
              fields: [{
                name: 'status',
                uiSchema: { title: '状态', enum: [{ value: 'processing', label: '处理中' }] },
              }, {
                name: 'priority',
                enum: [{ value: 'urgent', label: '紧急' }],
              }],
            }],
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
  const fields = await lookup.fieldsOf('工单', VOCAB)
  assert.equal(fields.find((row) => row.name === 'status').enums.processing, '处理中')
  assert.equal(fields.find((row) => row.name === 'priority').enums.urgent, '紧急')
})

test('collection field enums ride onto sheet columns for display labels', () => {
  const fields = collectionFields('biz_tickets', [{
    name: 'biz_tickets',
    fields: [{
      name: 'status',
      uiSchema: { title: '状态', enum: [{ value: 'processing', label: '处理中' }] },
    }, {
      name: 'priority',
      enum: [{ value: 'urgent', label: '紧急' }],
    }],
  }])
  assert.equal(enumMap(fields.find((row) => row.name === 'status')).processing, '处理中')
  const sheet = packSheet({
    kind: '工单',
    action: '现查',
    schemaFields: fields,
    matches: [{
      no: 'TK-1',
      status: 'processing',
      fields: { ticketNo: 'TK-1', status: 'processing', priority: 'urgent' },
    }],
  })
  const status = sheet.columns.find((col) => col.key === 'status')
  const priority = sheet.columns.find((col) => col.key === 'priority')
  assert.equal(status.enums.processing, '处理中')
  assert.equal(priority.enums.urgent, '紧急')
  const raw = packSheet({
    kind: '工单',
    action: '现查',
    schemaFields: [{
      name: 'status',
      uiSchema: { enum: [{ value: 'processing', label: '处理中' }] },
    }],
    matches: [{ no: 'TK-2', status: 'processing', fields: { ticketNo: 'TK-2', status: 'processing' } }],
  })
  assert.equal(raw.columns.find((col) => col.key === 'status').enums.processing, '处理中')
})

test('mapKind prefers vocab and discovery over the builtin catalog', () => {
  assert.deepEqual(mapKind('客户台账', {
    vocab: [{ kind: '客户台账', resource: 'crm_accounts', ticketField: 'code', can: ['现查'] }],
  }), { resource: 'crm_accounts', fields: ['code'] })
  assert.deepEqual(mapKind('客户台账', {
    collections: [{ name: 'crm_accounts', title: '客户台账', fields: ['code', 'name'] }],
  }), { resource: 'crm_accounts', fields: ['code', 'name'] })
  assert.equal(mapKind('便签', { vocab: [], collections: [] }), null)
  assert.ok(registeredKinds(['客户台账']).includes('客户台账'))
  assert.equal(registeredKinds([{ kind: '客户台账' }]).includes('采购单'), false)
})

test('mapKind does not treat vocab 单号/状态 as ticket columns', () => {
  assert.deepEqual(mapKind('客户', {
    vocab: [{ kind: '客户', resource: 'biz_customers', fields: ['单号', '状态'], can: ['现查'] }],
  }), { resource: 'biz_customers', fields: ['code', 'no', 'name', 'title', 'id'] })
  assert.deepEqual(mapKind('客户', {
    vocab: [{ kind: '客户', resource: 'biz_customers', ticketField: 'code', fields: ['单号', '状态'], can: ['现查'] }],
  }), { resource: 'biz_customers', fields: ['code'] })
  assert.deepEqual(mapKind('采购明细', {
    vocab: [{ kind: '采购明细', resource: 'biz_purchase_order_items', fields: ['单号', '状态'], can: ['现查'] }],
  }), { resource: 'biz_purchase_order_items', fields: ['code', 'no', 'name', 'title', 'id'] })
})

test('NocoBase discovery maps a kind that is not in the builtin table', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url) => {
      calls.push(String(url))
      if (/collections:list/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ name: 'crm_accounts', title: '客户台账', fields: [{ name: 'code' }, { name: 'title' }] }] }),
        }
      }
      if (/crm_accounts:list/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ code: 'A-1', title: '台账甲', status: 'active' }] }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
  const found = await lookup.lookupTodo({ kind: '客户台账', no: 'A-1' })
  assert.equal(found.ok, true)
  assert.equal(found.no, 'A-1')
  assert.ok(calls.some((url) => /collections:list/.test(url)))
  assert.ok(calls.some((url) => /crm_accounts:list/.test(url)))
})

test('empty kind is UNKNOWN_KIND, not purchase orders', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url) => {
      calls.push(String(url))
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
  const found = await lookup.lookupTodo({ no: 'PO-12' })
  assert.equal(found.ok, false)
  assert.equal(found.error, 'UNKNOWN_KIND')
  assert.ok(calls.every((url) => !/biz_purchase_orders/.test(url)))
})

test('unregistered kind is not silently mapped to purchase orders', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url) => {
      calls.push(String(url))
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    },
  })
  const found = await lookup.lookupTodo({ kind: '便签', no: 'N-1' })
  assert.equal(found.ok, false)
  assert.equal(found.error, 'UNKNOWN_KIND')
  assert.ok(calls.every((url) => /collections:list/.test(url)))
  assert.ok(calls.every((url) => !/biz_purchase_orders/.test(url)))
})

test('write paths are refused before any network call', () => {
  assert.equal(isWritePath('/api/orders:create'), true)
  assert.equal(isWritePath('/api/orders:update'), true)
  assert.equal(isWritePath('/api/orders:destroy'), true)
  assert.equal(isWritePath('/api/workflow:execute'), true)
  assert.equal(isWritePath('/api/orders:list'), false)
  assert.equal(isWritePath('/api/auth:check'), false)
})

test('missing base url is NO_CONNECTOR, not a pretend todo', async () => {
  const lookup = lookupOf({ baseUrl: '', token: 'secret' })
  const found = await lookup.lookupTodo({ kind: '采购单', no: 'PO-12' })
  assert.equal(found.ok, false)
  assert.equal(found.error, 'NO_CONNECTOR')
  assert.equal(await lookup.configured(), false)
})

test('GET list maps pending / forbidden / expired; never POSTs', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example/api'.replace(/\/api$/, ''),
    token: 'tok',
    staffId: 'emp_lin',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers })
      if (/biz_purchase_orders:list/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ no: 'PO-12', status: 'pending', owner: 'emp_lin', updatedAt: '1' }] }),
        }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    },
  })
  const found = await lookup.lookupTodo({ kind: '采购单', no: 'PO-12' })
  assert.equal(found.ok, true)
  assert.equal(found.status, '待审')
  assert.equal(found.mine, true)
  assert.ok(calls.length >= 1)
  assert.ok(calls.every((row) => row.method === 'GET'))
  assert.ok(calls.some((row) => /biz_purchase_orders:list/.test(row.url)))
  assert.ok(calls.every((row) => !/create|update|destroy/.test(row.url)))
})

test('lookup without a ticket lists a page and does not issue a unique row', async () => {
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async (url) => {
      assert.match(String(url), /biz_sales_orders:list/)
      assert.match(String(url), /pageSize=20/)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { orderNo: 'SO-1', status: 'confirmed', owner: 'emp_lin', updatedAt: '2' },
            { orderNo: 'SO-2', status: 'draft', owner: 'emp_lin', updatedAt: '1' },
          ],
        }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '销售数据', no: '' })
  assert.equal(found.ok, true)
  assert.equal(found.listed, true)
  assert.equal(found.matches.length, 2)
  assert.equal(found.matches[0].no, 'SO-1')
})

test('最新工单是哪个用户的 lists after asAsk, not by name-filtering the leftover', async () => {
  const rows = [
    { ticketNo: 'TK-NEW', status: '处理中', owner: 'emp_lin', updatedAt: '2', assignee: { name: 'Ace' } },
    { ticketNo: 'TK-OLD', status: '已关闭', owner: 'emp_lin', updatedAt: '1' },
  ]
  const speech = '最新工单是哪个用户的？状态是什么？'
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    staffId: 'emp_lin',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: rows }) }),
  })
  const found = await lookup.lookupTodo({ kind: '工单', no: '', asAsk: true })
  assert.equal(found.ok, true, found.error)
  assert.deepEqual((found.matches || []).map((row) => row.no), ['TK-NEW', 'TK-OLD'])
  const byRecencyNo = await lookup.lookupTodo({ kind: '工单', no: '' })
  assert.equal(byRecencyNo.ok, true, byRecencyNo.error)
  assert.deepEqual((byRecencyNo.matches || []).map((row) => row.no), ['TK-NEW', 'TK-OLD'])
})

test('401 is expired; empty list is not yours', async () => {
  const expired = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Auth required' }) }),
  })
  assert.equal((await expired.lookupTodo({ kind: '采购单', no: 'PO-1' })).error, 'EXPIRED')
  const empty = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }),
  })
  assert.equal((await empty.lookupTodo({ kind: '采购单', no: 'PO-9' })).error, 'NOT_FOUND')
})

test('secretary uses the adapter on receive without writing', async () => {
  const calls = []
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async (url, init) => {
      calls.push(init.method + ' ' + url)
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ no: 'PO-12', status: 'submitted', owner: 'emp_lin' }] }),
      }
    },
  })
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  const loadVocab = async () => VOCAB
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true }), loadVocab })
  box.B = createSecretary({
    store: memStore(),
    now,
    send: sendB,
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab,
  })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.A.mintPairCode()
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  const lin = (await afterHandshake(box.A, box.B, hs)).peers[0]
  const composed = await box.A.compose({ excerpt: '请过采购单 PO-12', to: [lin.id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  const asked = await box.B.dock('sess-lin')
  assert.match(asked.speak, /待审/)
  assert.ok(calls.every((line) => line.startsWith('GET ')))
})

test('this-seat staff id marks another owner as not mine', async () => {
  const lookup = lookupOf({
    baseUrl: 'https://nb.example',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ no: 'PO-12', status: 'pending', owner: 'emp_ace' }] }),
    }),
  })
  const found = await lookup.lookupTodo({ kind: '采购单', no: 'PO-12', staffId: 'emp_lin' })
  assert.equal(found.ok, true)
  assert.equal(found.mine, false)

  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  const loadVocab = async () => VOCAB
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true }), loadVocab })
  box.B = createSecretary({
    store: memStore(),
    now,
    send: sendB,
    writeSlip: async () => ({ ok: true }),
    lookupTodo: (spec) => lookup.lookupTodo(spec),
    loadVocab,
  })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.B.switchSeat('emp_lin', '林督')
  await box.A.mintPairCode()
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  const lin = (await afterHandshake(box.A, box.B, hs)).peers[0]
  const composed = await box.A.compose({ excerpt: '请过采购单 PO-12', to: [lin.id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  const asked = await box.B.dock('sess-lin')
  assert.match(asked.speak, /不在你名下/)
})

test('assist-page lookup stays on this machine and never ships in export', async () => {
  const store = memStore()
  const A = createSecretary({ store, now: () => 1, send: async () => ({ ok: false }), writeSlip: async () => ({ ok: true }) })
  const saved = await A.setLookup({ baseUrl: 'https://nb.example', token: 'secret-ticket' })
  assert.equal(saved.lookup.baseUrl, 'https://nb.example')
  assert.equal(saved.lookup.hasToken, true)
  assert.equal(saved.lookup.token, undefined)
  assert.equal((saved.lookups || []).length, 1)
  const dumped = await A.exportLedger()
  assert.doesNotMatch(JSON.stringify(dumped), /secret-ticket/)
  assert.equal(dumped.lookup, undefined)
  const live = await store.get()
  assert.equal((live.lookup && live.lookup.token) || '', '')
  if (typeof store.getSecret === 'function') {
    assert.equal(await store.getSecret('lookupToken'), 'secret-ticket')
  }
  await A.wipeRefs()
  assert.equal((await store.get()).lookup.baseUrl, 'https://nb.example')
  if (typeof store.getSecret === 'function') {
    assert.equal(await store.getSecret('lookupToken'), '')
  }
})

test('assist-page system name shows up as production not test', async () => {
  const store = memStore()
  const A = createSecretary({
    store,
    now: () => 1,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    lookupTodo: async () => ({ ok: true, status: '待审' }),
    brief: async () => ({ speak: '图' }),
  })
  await A.setLookup({ baseUrl: 'https://nb.example', system: '采购', env: '生产' })
  const view = await A.snapshot()
  assert.equal(view.lookup.system, '采购')
  assert.equal(view.lookup.env, '生产')
  const named = (view.catalog || []).find((row) => row.name === 'lookup_todo')
  assert.ok(named)
  assert.match(named.speak, /生产采购/)
  assert.match(named.speak, /不是测试库/)
})

test('rest dialect uses the configured GET path and never posts', async () => {
  const calls = []
  const lookup = lookupOf({
    resolve: async () => ({
      staffId: 'u1',
      connections: [{
        id: 'ding',
        dialect: 'rest',
        baseUrl: 'https://oa.example',
        token: 'oa-tok',
        system: '钉钉审批',
        env: '生产',
        listPath: '/v1/approvals?bizNo={no}',
        ticketField: 'bizNo',
        statusField: 'state',
        ownerField: 'assignee',
      }],
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init.method })
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [{ bizNo: 'SP-9', state: 'pending', assignee: 'u1', updatedAt: '2' }] }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '审批单', no: 'SP-9', staffId: 'u1' })
  assert.equal(found.ok, true)
  assert.equal(found.status, '待审')
  assert.equal(found.system, '钉钉审批')
  assert.equal(found.dialect, 'rest')
  assert.equal(calls[0].method, 'GET')
  assert.match(calls[0].url, /\/v1\/approvals\?bizNo=SP-9/)
  assert.doesNotMatch(calls[0].url, /biz_purchase_orders|:create/)
})

test('two connections try in order and name the hit', async () => {
  const calls = []
  const lookup = lookupOf({
    resolve: async () => ({
      staffId: '10',
      connections: [
        { id: 'erp', baseUrl: 'https://erp.example', token: 'erp-tok', system: 'ERP', env: '测试' },
        { id: 'nb', baseUrl: 'https://nb.example', token: 'nb-tok', system: 'NocoBase', env: '生产' },
      ],
    }),
    fetchImpl: async (url, init) => {
      calls.push(String(url))
      if (/erp\.example/.test(url)) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ orderNo: 'PO20241125741', status: '待审', ownerId: '10', updatedAt: '1' }] }),
      }
    },
  })
  const found = await lookup.lookupTodo({ kind: '采购单', no: 'PO20241125741', staffId: '10' })
  assert.equal(found.ok, true)
  assert.equal(found.status, '待审')
  assert.equal(found.system, 'NocoBase')
  assert.equal(found.env, '生产')
  assert.ok(calls.some((url) => /erp\.example/.test(url)))
  assert.ok(calls.some((url) => /nb\.example/.test(url)))
})

test('resolve() prefers assist-page url over empty env', async () => {
  const calls = []
  const lookup = lookupOf({
    resolve: async () => ({ baseUrl: 'https://from-page', token: 'page-tok', staffId: 'emp_lin' }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), auth: init.headers.authorization })
      return { ok: true, status: 200, json: async () => ({ data: [{ no: 'PO-1', status: 'pending', owner: 'emp_lin' }] }) }
    },
  })
  const found = await lookup.lookupTodo({ kind: '采购单', no: 'PO-1' })
  assert.equal(found.ok, true)
  assert.match(calls[0].url, /from-page/)
  assert.equal(calls[0].auth, 'Bearer page-tok')
  assert.equal(await lookup.configured(), true)
})

test('relatedField prefers catalog relations over inferred self-fk', () => {
  const extra = {
    vocab: [{
      kind: '采购单',
      resource: 'biz_purchase_orders',
      relations: [{ from: '供应商', to: '采购单', field: 'supplierId' }],
    }],
  }
  assert.equal(relatedField('供应商', '采购单', extra), 'supplierId')
})
