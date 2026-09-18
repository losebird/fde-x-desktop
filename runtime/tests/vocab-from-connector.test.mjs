import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVocabFromNocoCollections } from '../biz/adapters/nocobase-vocab.mjs'

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
    assert.equal(item.fields.includes('父表'), false)
    assert.ok(built.relations.some((rel) => rel.field === 'parentId'))
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
})
