import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dictInnerUid, objectFieldEntries, rootObjectUid, schemaNode, unionConstOptions } from '../settings-schema.mjs'

const speech = {
  uid: 9,
  refs: {
    7: { type: 'string', meta: { required: true } },
    8: { type: 'string', meta: { default: 'auto' } },
    9: { type: 'object', meta: { default: {} }, dict: { defaultProvider: 7, language: 8 } },
  },
}

test('describe schema lists object fields from refs', () => {
  assert.equal(rootObjectUid(speech), 9)
  const fields = objectFieldEntries(speech, 9)
  assert.deepEqual(fields.map((row) => row.name), ['defaultProvider', 'language'])
  assert.equal(schemaNode(speech, 7).type, 'string')
})

test('array inner objects resolve through refs', () => {
  const schema = {
    uid: 5,
    refs: {
      1: { type: 'boolean', meta: { default: false } },
      2: { type: 'string', meta: { required: true } },
      3: { type: 'object', dict: { provider: 2, model: 2 } },
      4: { type: 'array', inner: 3 },
      5: { type: 'object', dict: { enabled: 1, allowedModels: 4 } },
    },
  }
  const fields = objectFieldEntries(schema, 5)
  assert.deepEqual(fields.map((row) => row.name), ['enabled', 'allowedModels'])
  const inner = schemaNode(schema, schemaNode(schema, 4).inner)
  assert.equal(inner.type, 'object')
})

test('dict inner uid and union const options', () => {
  const schema = {
    uid: 3,
    refs: {
      1: { type: 'const', value: 'light' },
      2: { type: 'const', value: 'dark' },
      3: { type: 'union', list: [1, 2] },
      4: { type: 'object', dict: { apiKey: 1 } },
      5: { type: 'dict', inner: 4 },
    },
  }
  assert.deepEqual(unionConstOptions(schema, 3), ['light', 'dark'])
  assert.equal(dictInnerUid(schemaNode(schema, 5)), 4)
})

test('scalar object, required strings, and catalog join', async () => {
  const { catalogRowKey, catalogRowLabel, dirtyTopLevelOps, isScalarNode, joinCatalog, objectFieldsAreScalar, requiredStringFields, secretSlot } = await import('../settings-schema.mjs')
  const schema = {
    uid: 5,
    refs: {
      1: { type: 'boolean', meta: { default: false } },
      2: { type: 'string', meta: { required: true } },
      3: { type: 'object', dict: { provider: 2, model: 2 } },
      4: { type: 'array', inner: 3 },
      5: { type: 'object', dict: { enabled: 1, allowedModels: 4 } },
      6: { type: 'string' },
      7: { type: 'object', dict: { provider: 2, model: 2, reasoningEffort: 6 } },
    },
  }
  assert.equal(isScalarNode(schema, 1), true)
  assert.equal(isScalarNode(schema, 4), false)
  assert.equal(objectFieldsAreScalar(schema, 3), true)
  assert.equal(objectFieldsAreScalar(schema, 5), false)
  assert.deepEqual(requiredStringFields(schema, 3).map((row) => row.name), ['provider', 'model'])
  const catalog = {
    keys: ['provider', 'model', 'providerName', 'modelName'],
    rows: [{ provider: 'grok2api', model: 'grok-4.6', providerName: 'Grok', modelName: 'grok-4.6' }],
  }
  assert.equal(joinCatalog(schema, 3, [catalog]), catalog)
  assert.equal(joinCatalog(schema, 7, [catalog]), catalog)
  assert.equal(joinCatalog(schema, 5, [catalog]), null)
  assert.equal(joinCatalog(schema, 3, [{ keys: ['id'], rows: [{ id: 'x' }] }]), null)
  assert.equal(catalogRowKey(catalog.rows[0], ['provider', 'model']), 'grok2api\0grok-4.6')
  assert.equal(catalogRowLabel(catalog.rows[0], ['provider', 'model']), 'Grok · grok-4.6')
  const ops = dirtyTopLevelOps({ enabled: true, allowedModels: [] }, { enabled: true, allowedModels: catalog.rows })
  assert.equal(ops.length, 1)
  assert.deepEqual(ops[0].path, ['allowedModels'])
  assert.deepEqual(secretSlot([{ path: ['apiKey'], set: true }], ['apiKey']), { path: ['apiKey'], set: true })
  assert.equal(secretSlot([{ path: ['apiKey'], set: true }], ['model']), null)
})
