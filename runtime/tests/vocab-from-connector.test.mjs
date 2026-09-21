import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVocabFromNocoCollections } from '../biz/adapters/nocobase-vocab.mjs'
import { generateWorkspaceVocabFromConnector } from '../biz/vocab-from-connector.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

describe('vocab from connector', () => {
  test('generic entrypoint is generateWorkspaceVocabFromConnector', () => {
    const source = readFileSync(join(repoRoot, 'runtime/biz/vocab-from-connector.mjs'), 'utf8')
    assert.match(source, /export async function generateWorkspaceVocabFromConnector/)
    const biz = readFileSync(join(repoRoot, 'runtime/routes/biz.mjs'), 'utf8')
    assert.match(biz, /generateWorkspaceVocabFromConnector/)
    assert.match(biz, /\/api\/v1\/biz\/vocab\/generate/)
  })

  test('buildVocabFromNocoCollections derives relations from m2o fields', () => {
    const collections = [
      {
        name: 'biz_parents',
        title: '父表',
        fields: [
          { name: 'id', interface: 'id' },
          { name: 'title', interface: 'input', uiSchema: { title: '标题' } },
        ],
      },
      {
        name: 'biz_children',
        title: '子表',
        fields: [
          { name: 'id', interface: 'id' },
          { name: 'parentId', interface: 'm2o', target: 'biz_parents', uiSchema: { title: '父表' } },
          { name: 'code', interface: 'input', uiSchema: { title: '编号' } },
        ],
      },
    ]
    const built = buildVocabFromNocoCollections(collections, { catalogVersion: 't1' })
    assert.equal(built.concepts.length, 2)
    const child = built.concepts.find((row) => row.resource === 'biz_children')
    assert.ok(child?.fieldLabels?.编号 === 'code')
    assert.ok(child)
    assert.deepEqual(child.relations, [{ from: '父表', to: '子表', field: 'parentId' }])
    assert.deepEqual(built.relations, [{ from: '父表', to: '子表', field: 'parentId' }])
    assert.ok(child.can.includes('现查'))
    assert.equal(child.ticketField, 'code')
  })

  test('concept fields come from writable scalar schema rows only', () => {
    const collections = [
      {
        name: 'biz_order_items',
        title: '采购订单明细',
        fields: [
          { name: 'id', interface: 'id' },
          { name: 'amount', interface: 'number', uiSchema: { title: '金额' } },
          { name: 'code', interface: 'input', uiSchema: { title: '编号' } },
          { name: 'parentId', interface: 'm2o', target: 'biz_parents', uiSchema: { title: '父表' } },
        ],
      },
      {
        name: 'biz_parents',
        title: '父表',
        fields: [{ name: 'id', interface: 'id' }],
      },
    ]
    const built = buildVocabFromNocoCollections(collections)
    const item = built.concepts.find((row) => row.resource === 'biz_order_items')
    assert.ok(item)
    assert.equal(item.label, '采购订单明细')
    assert.equal(item.ticketField, 'code')
    assert.ok(item.fields.includes('code'))
    assert.ok(item.fields.includes('金额'))
    assert.ok(item.fields.includes('parentId'))
    assert.equal(item.fields.includes('父表'), false)
    assert.ok(built.relations.some((rel) => rel.field === 'parentId'))
  })

  test('association column names stay on the concept next to relations', () => {
    const collections = [
      {
        name: 'biz_customers',
        title: '客户',
        fields: [
          { name: 'id', interface: 'id' },
          { name: 'code', interface: 'input', uiSchema: { title: '客户编号' } },
          { name: 'tickets', interface: 'o2m', type: 'hasMany', target: 'biz_tickets', uiSchema: { title: '工单' } },
        ],
      },
      {
        name: 'biz_tickets',
        title: '工单',
        fields: [
          { name: 'id', interface: 'id' },
          { name: 'ticketNo', interface: 'input', uiSchema: { title: '工单编号' } },
          { name: 'status', interface: 'select', uiSchema: { title: '工单状态', enum: [{ value: 'open' }] } },
          { name: 'customer', interface: 'm2o', type: 'belongsTo', target: 'biz_customers', uiSchema: { title: '客户' } },
          { name: 'createdBy', interface: 'createdBy', type: 'belongsTo', target: 'users' },
        ],
      },
    ]
    const built = buildVocabFromNocoCollections(collections)
    const ticket = built.concepts.find((row) => row.resource === 'biz_tickets')
    assert.ok(ticket)
    assert.ok(ticket.fields.includes('customer'))
    assert.equal(ticket.fields.includes('createdBy'), false)
    assert.ok(ticket.relations.some((rel) => rel.from === '客户' && rel.to === '工单' && rel.field === 'customer'))
    assert.ok(built.relations.some((rel) => rel.from === '客户' && rel.to === '工单' && rel.field === 'tickets'))
  })

  test('empty association schema yields zero relations', () => {
    const collections = [
      {
        name: 'solo',
        title: '独立',
        fields: [{ name: 'note', interface: 'input', uiSchema: { title: '备注' } }],
      },
    ]
    const built = buildVocabFromNocoCollections(collections)
    assert.equal(built.relations.length, 0)
    assert.equal(built.concepts[0].relations?.length || 0, 0)
  })

  test('generate still persists sibling collections when one concept hits NOT_A_KIND', async () => {
    const collections = [
      {
        name: 'biz_order_items',
        title: '采购订单明细',
        fields: [
          { name: 'amount', interface: 'number', uiSchema: { title: '金额' } },
          { name: 'parentId', interface: 'm2o', target: 'biz_parents' },
        ],
      },
      {
        name: 'biz_tickets',
        title: '工单',
        fields: [
          { name: 'ticketNo', interface: 'input', uiSchema: { title: '工单编号' } },
          { name: 'customer', interface: 'm2o', type: 'belongsTo', target: 'biz_customers' },
        ],
      },
      {
        name: 'biz_customers',
        title: '客户',
        fields: [{ name: 'code', interface: 'input', uiSchema: { title: '客户编号' } }],
      },
      {
        name: 'biz_parents',
        title: '父表',
        fields: [{ name: 'id', interface: 'id' }],
      },
    ]
    const persisted = []
    const result = await generateWorkspaceVocabFromConnector({
      workspace: '/tmp/fdex-vocab-test',
      dialect: 'nocobase',
      baseUrl: 'http://noco.test',
      token: 't',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: collections }),
      }),
      persistBatch: async (batch) => {
        const rows = Array.isArray(batch.concepts) ? batch.concepts : []
        persisted.push(rows)
        if (rows.some((row) => (row.fields || []).includes('金额'))) {
          return { ok: false, error: 'NOT_A_KIND' }
        }
        return { ok: true }
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.concepts, 4)
    assert.ok(result.relations.some((rel) => rel.from === '客户' && rel.to === '工单' && rel.field === 'customer'))
    const resources = persisted.flat().map((row) => row.resource)
    assert.ok(resources.includes('biz_tickets'))
    assert.ok(resources.includes('biz_customers'))
    assert.ok(resources.includes('biz_order_items'))
    const itemOk = persisted.find((group) => (
      group.length === 1
      && group[0].resource === 'biz_order_items'
      && !(group[0].fields || []).includes('金额')
    ))
    assert.ok(itemOk)
  })
})
