import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { planReceipt } from '../vendor-overlays/dsh-lan-assist/plan-receipt.mjs'
import {
  bindWhereKeys,
  rowsMatchingWhere,
  termFilterPart,
} from '../vendor-overlays/dsh-lan-assist/where-pass.js'
import { createLookup, termFitsCollection } from '../vendor-overlays/dsh-lan-assist/lookup.js'
import { rowMatchesAll } from '../vendor-overlays/dsh-lan-assist/resolve.js'
import { unboundWhereSpeak } from '../vendor-overlays/dsh-lan-assist/relation-bind.js'

const kind = '工单'
const vocab = [{
  kind,
  resource: 'biz_tickets',
  ticketField: 'ticketNo',
  fields: ['ticketNo', '单号', '状态'],
}]
const schema = [
  { name: 'ticketNo', title: '单号', interface: 'input' },
  { name: 'status', title: '状态', interface: 'select', enums: { open: '打开' } },
  { name: 'openedAt', title: '发生日期', interface: 'date' },
  { name: 'dueAt', title: '截止日', interface: 'date' },
]
const rowInYear = { ticketNo: 'TK-2026-001', status: 'open', openedAt: '2026-06-28', dueAt: '2026-07-15' }
const rowOutYear = { ticketNo: 'TK-2025-009', status: 'open', openedAt: '2025-12-31', dueAt: '2026-01-20' }

test('ISO literals in date slots stay unbound', () => {
  const bound = bindWhereKeys(
    [{ dateAfter: ['2026-01-01'], dateBefore: ['2027-01-01'] }],
    kind,
    vocab,
    schema,
  )
  assert.equal(termFitsCollection(bound[0], schema, vocab[0]), false)
  assert.equal(termFilterPart(bound[0], '2026-10-05', schema), null)
  const speak = unboundWhereSpeak(kind, bound, schema, vocab)
  assert.match(speak, /日期条件没对上列名/)
  assert.match(speak, /发生日期/)
  assert.match(speak, /openedAt/)
})

test('year on a date title expands onto that column', () => {
  const bound = bindWhereKeys(
    [{ dateAfter: ['发生日期'], values: ['2026'] }],
    kind,
    vocab,
    schema,
  )
  assert.deepEqual(bound, [
    { dateAfter: ['openedAt'], values: ['2026-01-01'] },
    { dateBefore: ['openedAt'], values: ['2027-01-01'] },
  ])
  assert.equal(bound.every((term) => termFitsCollection(term, schema, vocab[0])), true)
  assert.deepEqual(termFilterPart(bound[0], '2026-10-05', schema), { openedAt: { $gte: '2026-01-01' } })
  assert.deepEqual(termFilterPart(bound[1], '2026-10-05', schema), { openedAt: { $lt: '2027-01-01' } })
  assert.equal(rowMatchesAll(rowInYear, bound), true)
  assert.equal(rowMatchesAll(rowOutYear, bound), false)
  const hit = rowsMatchingWhere([rowInYear, rowOutYear], bound, schema)
  assert.equal(hit.length, 1)
  assert.equal(hit[0].ticketNo, 'TK-2026-001')
})

test('ISO bound on a date title resolves to the column name', () => {
  const bound = bindWhereKeys(
    [{ dateAfter: ['发生日期'], values: ['2026-01-01'] }, { dateBefore: ['openedAt'], values: ['2027-01-01'] }],
    kind,
    vocab,
    schema,
  )
  assert.deepEqual(bound[0], { dateAfter: ['openedAt'], values: ['2026-01-01'] })
  assert.deepEqual(bound[1], { dateBefore: ['openedAt'], values: ['2027-01-01'] })
  assert.equal(rowMatchesAll(rowInYear, bound), true)
  assert.deepEqual(
    rowsMatchingWhere([rowInYear], bound, schema).map((item) => item.ticketNo),
    ['TK-2026-001'],
  )
})

test('year on a ticket key stays on the ticket column', () => {
  const bound = bindWhereKeys(
    [{ keys: ['ticketNo'], values: ['2026'] }],
    kind,
    vocab,
    schema,
  )
  assert.deepEqual(bound, [{ keys: ['ticketNo'], values: ['2026'] }])
  assert.equal(bound[0].dateAfter, undefined)
})

test('bound year with no matching rows is an empty hit set', () => {
  const bound = bindWhereKeys(
    [{ keys: ['发生日期'], values: ['2024'] }],
    kind,
    vocab,
    schema,
  )
  assert.equal(rowsMatchingWhere([rowInYear, rowOutYear], bound, schema).length, 0)
  assert.equal(rowMatchesAll(rowInYear, bound), false)
})

test('WHERE_UNBOUND receipt continues', () => {
  const receipt = planReceipt({
    ok: false,
    error: 'WHERE_UNBOUND',
    hint: '工单的日期条件没对上列名，日期列有 发生日期(openedAt)、截止日(dueAt)。不能整表现查。',
    kind,
    action: '现查',
    speak: '工单的日期条件没对上列名，日期列有 发生日期(openedAt)、截止日(dueAt)。不能整表现查。',
  })
  assert.equal(receipt.ok, false)
  assert.equal(receipt.error, 'WHERE_UNBOUND')
  assert.equal(receipt.next, 'continue')
})

test('inverted date slots do not hit the connector list', async () => {
  const urls = []
  const lookup = createLookup({
    fetchImpl: async (url) => {
      urls.push(String(url))
      return { ok: true, status: 200, json: async () => ({ data: [rowInYear], meta: { count: 1 } }) }
    },
    resolve: async () => ({
      baseUrl: 'http://nb.local',
      token: 't',
      vocab,
      collections: [{ name: 'biz_tickets', title: '工单', fields: schema }],
    }),
  })
  const found = await lookup.lookupTodo({
    kind,
    where: [{ dateAfter: ['2026-01-01'], dateBefore: ['2027-01-01'] }],
  })
  assert.equal(found.ok, false)
  assert.equal(found.error, 'WHERE_UNBOUND')
  assert.equal(urls.length, 0)
})

test('bound year filter is sent on the date column', async () => {
  const urls = []
  const lookup = createLookup({
    fetchImpl: async (url) => {
      urls.push(String(url))
      return { ok: true, status: 200, json: async () => ({ data: [rowInYear], meta: { count: 1 } }) }
    },
    resolve: async () => ({
      baseUrl: 'http://nb.local',
      token: 't',
      vocab,
      collections: [{ name: 'biz_tickets', title: '工单', fields: schema }],
    }),
  })
  const found = await lookup.lookupTodo({
    kind,
    where: [{ dateAfter: ['发生日期'], values: ['2026'] }],
  })
  assert.notEqual(found.error, 'WHERE_UNBOUND')
  assert.equal(found.ok, true)
  const filters = urls.map((url) => {
    const raw = String(url).split('filter=')[1] || ''
    return raw ? decodeURIComponent(raw.split('&')[0]) : ''
  }).filter(Boolean)
  assert.ok(filters.some((text) => text.includes('openedAt') && text.includes('2026-01-01')))
})
