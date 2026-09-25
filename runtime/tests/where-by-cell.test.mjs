import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const { bindWhereRelationTerms } = await import(pathToFileURL(join(root, 'relation-bind.js')).href)
const { createLookup } = await import(pathToFileURL(join(root, 'lookup.js')).href)
const { enrichStructuredSlots } = await import(pathToFileURL(join(root, 'slots.js')).href)

const QUOTE = '客户胡文今天12点电脑故障紧急保修，现在已处理完成'

const customerCollection = {
  name: 'biz_customers',
  fields: [
    { name: 'name', interface: 'input', title: '客户名称' },
    { name: 'code', interface: 'input' },
  ],
}

const ticketFields = [
  { name: 'ticketNo', title: '单号', interface: 'input' },
  { name: 'description', title: '问题描述', interface: 'textarea' },
  { name: 'priority', title: '优先级', interface: 'select', enums: { urgent: '紧急', low: '低' } },
  { name: 'status', title: '状态', interface: 'select', enums: { pending: '待处理', approved: '已通过' } },
  { name: 'customer', title: '客户', interface: 'm2o', target: 'biz_customers', foreignKey: 'customerId' },
]

const expenseFields = [
  { name: 'expenseNo', title: '单号', interface: 'input' },
  {
    name: 'status',
    title: '状态',
    interface: 'select',
    enums: { 草稿: '草稿', 待审: '待审', 已通过: '已通过', 已驳回: '已驳回', 已付款: '已付款' },
  },
]

function lookupFor(vocab, collections, fetchImpl) {
  return createLookup({
    fetchImpl,
    resolve: async () => ({
      baseUrl: 'http://nb.local',
      token: 't',
      vocab,
      collections,
    }),
  })
}

function decodedFilters(urls) {
  return urls.map((url) => {
    const raw = String(url).split('filter=')[1] || ''
    const cut = raw.split('&')[0]
    return cut ? decodeURIComponent(cut) : ''
  }).filter(Boolean)
}

test('pending expense keeps status and would hit that list', async () => {
  const urls = []
  const lookup = lookupFor(
    [{ kind: '费用报销', resource: 'biz_expenses', fields: ['expenseNo'] }],
    [{ name: 'biz_expenses', title: '费用报销', fields: expenseFields }],
    async (url) => {
      urls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: '1', expenseNo: 'EXP20251224598', status: '待审' }],
          meta: { count: 97 },
        }),
      }
    },
  )
  const found = await lookup.lookupTodo({
    kind: '费用报销',
    where: [{ keys: ['状态', 'status'], values: ['待审', 'pending', 'submitted'] }],
  })
  assert.notEqual(found.error, 'WHERE_UNBOUND')
  assert.equal(found.ok, true)
  const lists = urls.filter((url) => url.includes('/api/biz_expenses:list'))
  assert.equal(lists.length > 0, true)
  const filters = decodedFilters(lists)
  assert.equal(filters.some((filter) => filter.includes('"status"') && filter.includes('待审')), true)
  assert.equal(filters.some((filter) => filter.includes('pending') || filter.includes('submitted')), false)
})

test('description text where survives relation bind and would hit that column', async () => {
  const fields = ticketFields
  const terms = await bindWhereRelationTerms(
    [{ keys: ['description', '问题描述'], values: [QUOTE], text: true, title: '问题描述' }],
    fields,
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    {
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl: async () => ({ ok: true, json: async () => ({ data: [], meta: { count: 0 } }) }),
      extra: { collections: [customerCollection] },
    },
  )
  assert.equal(terms.length, 1)
  assert.deepEqual(terms[0].values, [QUOTE])
  assert.equal(terms[0].text, true)
  assert.equal(terms[0].keys.includes('description'), true)
  assert.equal(JSON.stringify(terms).includes('WHERE_UNBOUND'), false)

  const urls = []
  const lookup = lookupFor(
    [{ kind: '工单', resource: 'biz_tickets', fields: ['ticketNo'] }],
    [{ name: 'biz_tickets', title: '工单', fields }],
    async (url) => {
      urls.push(String(url))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: '9', ticketNo: 'T-9', description: QUOTE }],
          meta: { count: 1 },
        }),
      }
    },
  )
  const found = await lookup.lookupTodo({
    kind: '工单',
    where: [{ keys: ['问题描述'], values: [QUOTE], text: true, title: '问题描述' }],
  })
  assert.notEqual(found.error, 'WHERE_UNBOUND')
  assert.equal(found.ok, true)
  const filters = decodedFilters(urls.filter((url) => url.includes('/api/biz_tickets:list')))
  assert.equal(filters.some((filter) => filter.includes('description') && filter.includes(QUOTE)), true)
})

test('spoken foreign key still becomes an id', async () => {
  const terms = await bindWhereRelationTerms(
    [{ keys: ['customer'], values: ['恒通'] }],
    ticketFields,
    { kind: '工单', mapped: { resource: 'biz_tickets' } },
    {
      conn: { baseUrl: 'http://nb.local', token: 't' },
      fetchImpl: async (url) => {
        if (String(url).includes('biz_customers:list')) {
          return { ok: true, json: async () => ({ data: [{ id: 99, name: '恒通', code: 'CUST-HT' }], meta: { count: 1 } }) }
        }
        return { ok: true, json: async () => ({ data: [], meta: { count: 0 } }) }
      },
      extra: { collections: [customerCollection] },
    },
  )
  assert.equal(terms.length, 1)
  assert.equal(terms[0].values[0], '99')
})

test('a failed foreign key does not dump an unfiltered list', async () => {
  const urls = []
  const lookup = lookupFor(
    [{ kind: '工单', resource: 'biz_tickets', fields: ['ticketNo'] }],
    [
      { name: 'biz_tickets', title: '工单', fields: ticketFields },
      customerCollection,
    ],
    async (url) => {
      urls.push(String(url))
      return { ok: true, status: 200, json: async () => ({ data: [], meta: { count: 0 } }) }
    },
  )
  const found = await lookup.lookupTodo({
    kind: '工单',
    where: [{ keys: ['customer', '客户'], values: ['没有这个客户'] }],
  })
  assert.equal(found.ok, false)
  const ticketLists = urls.filter((url) => url.includes('/api/biz_tickets:list'))
  assert.equal(ticketLists.length, 0)
  assert.equal(ticketLists.some((url) => !url.includes('filter=')), false)
})

test('a failed foreign key unbinds only that cell', async () => {
  const urls = []
  const lookup = lookupFor(
    [{ kind: '工单', resource: 'biz_tickets', fields: ['ticketNo'] }],
    [
      { name: 'biz_tickets', title: '工单', fields: ticketFields },
      customerCollection,
    ],
    async (url) => {
      urls.push(String(url))
      if (String(url).includes('/api/biz_tickets:list')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: '3', ticketNo: 'T-3', status: 'pending' }],
            meta: { count: 1 },
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ data: [], meta: { count: 0 } }) }
    },
  )
  const found = await lookup.lookupTodo({
    kind: '工单',
    where: [
      { keys: ['status'], values: ['待处理'] },
      { keys: ['customer'], values: ['没有这个客户'] },
    ],
  })
  assert.notEqual(found.error, 'WHERE_UNBOUND')
  assert.equal(found.ok, true)
  const filters = decodedFilters(urls.filter((url) => url.includes('/api/biz_tickets:list')))
  assert.equal(filters.some((filter) => filter.includes('pending') || filter.includes('待处理')), true)
  assert.equal(filters.some((filter) => filter.includes('没有这个客户')), false)
  assert.equal(filters.some((filter) => filter === '{}' || filter === ''), false)
})

test('enum column still requires an enum option', async () => {
  const missedCell = await bindWhereRelationTerms(
    [{ keys: ['priority'], values: ['not-real'] }],
    ticketFields,
    { kind: '工单' },
    {},
  )
  assert.equal(missedCell.some((term) => (term.values || []).includes('not-real')), false)

  const hitCell = await bindWhereRelationTerms(
    [{ keys: ['优先级'], values: ['紧急'] }],
    ticketFields,
    { kind: '工单' },
    {},
  )
  assert.equal(hitCell.length, 1)
  assert.deepEqual(hitCell[0].values, ['urgent'])
  assert.equal(hitCell[0].text, undefined)

  const vocab = [
    {
      kind: '工单',
      resource: 'biz_tickets',
      can: ['现查', '删除', '过审'],
    },
  ]
  const extra = { vocab, schemaByKind: { 工单: ticketFields } }
  const missed = enrichStructuredSlots({
    kind: '工单',
    action: '过审',
    speech: '把优先级那笔工单过审',
    where: [{ keys: ['priority', '优先级'], values: ['整句不是枚举'] }],
  }, vocab, extra)
  const values = (Array.isArray(missed.where) ? missed.where : []).flatMap((term) => term.values || [])
  assert.equal(values.includes('整句不是枚举'), false)
  assert.equal(values.includes('urgent'), false)

  const hit = enrichStructuredSlots({
    kind: '工单',
    action: '删除',
    speech: '把优先级是紧急的那笔工单删除',
    where: [
      { keys: ['priority'], values: ['not-real'] },
      { keys: ['priority'], values: ['urgent'] },
    ],
  }, vocab, extra)
  const kept = (Array.isArray(hit.where) ? hit.where : []).flatMap((term) => term.values || [])
  assert.equal(kept.includes('urgent'), true)
  assert.equal(kept.includes('not-real'), false)
  assert.equal((hit.where || []).some((term) => term && term.text === true), false)
})
