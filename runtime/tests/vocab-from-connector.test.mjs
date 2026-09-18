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
    assert.ok(child)
    assert.deepEqual(child.relations, [{ from: '父表', to: '子表', field: 'parentId' }])
    assert.deepEqual(built.relations, [{ from: '父表', to: '子表', field: 'parentId' }])
    assert.ok(child.can.includes('现查'))
    assert.equal(child.ticketField, 'code')
  })

  test('line-item kinds omit 金额 field to pass semantic kind gate', () => {
    const collections = [
      {
        name: 'biz_order_items',
        title: '采购订单明细',
        fields: [
          { name: 'id', interface: 'id' },
          { name: 'amount', interface: 'number', uiSchema: { title: '金额' } },
          { name: 'code', interface: 'input', uiSchema: { title: '编号' } },
        ],
      },
    ]
    const built = buildVocabFromNocoCollections(collections)
    assert.equal(built.concepts[0].ticketField, 'code')
    assert.ok(built.concepts[0].fields.includes('code'))
    assert.equal(built.concepts[0].fields.includes('金额'), false)
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
