import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAppSpec } from '../apps/spec.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'

describe('apps spec validator', () => {
  test('accepts fixture spec', () => {
    const r = validateAppSpec(SUPPLIER_VISITS_SPEC)
    assert.equal(r.ok, true)
  })

  test('rejects wrong spec version', () => {
    const r = validateAppSpec({ ...SUPPLIER_VISITS_SPEC, spec: 'v0' })
    assert.equal(r.ok, false)
  })

  test('rejects bad slug', () => {
    const r = validateAppSpec({ ...SUPPLIER_VISITS_SPEC, slug: 'X' })
    assert.equal(r.ok, false)
  })

  test('rejects empty entities', () => {
    const r = validateAppSpec({ ...SUPPLIER_VISITS_SPEC, entities: [] })
    assert.equal(r.ok, false)
  })

  test('rejects reserved field id', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities[0].fields.push({ name: 'id', type: 'text' })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects unknown view entity', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.views[0].entity = 'missing'
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects kanban groupBy non-enum', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.views.push({ id: 'k2', type: 'kanban', entity: 'visit', groupBy: 'supplier' })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects enum without options', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities[0].fields.push({ name: 'x', type: 'enum' })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects invalid field type', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities[0].fields[0].type = 'file'
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects extra root key', () => {
    const r = validateAppSpec({ ...SUPPLIER_VISITS_SPEC, extra: true })
    assert.equal(r.ok, false)
  })

  test('rejects invalid action kind', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.actions[0].kind = 'run'
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('auto requires approval on biz action', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.actions.push({
      name: 'biz-1',
      label: '过账',
      entity: 'visit',
      kind: 'biz',
      biz: { kind: '客户', action: '现查' },
    })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, true)
    assert.equal(r.spec.actions.find((a) => a.name === 'biz-1').approval, 'required')
  })

  test('rejects set on unknown field', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.actions[0].set = { unknown: 'x' }
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects set type mismatch', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.actions[0].set = { status: 123 }
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects invalid ref entity', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities[0].fields.push({ name: 'link', type: 'ref', ref: 'entity:nope' })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('accepts ref biz', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities[0].fields.push({ name: 'cust', type: 'ref', ref: 'biz:customer' })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, true)
  })

  test('rejects unknown column', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.views[0].columns.push('nope')
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects slug taken flag', () => {
    const r = validateAppSpec(SUPPLIER_VISITS_SPEC, { slugTaken: true })
    assert.equal(r.ok, false)
  })

  test('rejects too many entities', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities = Array.from({ length: 13 }, (_, i) => ({
      name: `e${i}`,
      label: 'x',
      fields: [{ name: 'a', type: 'text' }],
    }))
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects agent without preset', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.actions.push({ name: 'ai', label: 'AI', entity: 'visit', kind: 'agent', agent: { prompt: 'hi' } })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects invalid metric fn', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.views.push({ id: 's1', type: 'stat', entity: 'visit', metric: { fn: 'max' } })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })

  test('rejects duplicate entity names', () => {
    const spec = JSON.parse(JSON.stringify(SUPPLIER_VISITS_SPEC))
    spec.entities.push({ ...spec.entities[0] })
    const r = validateAppSpec(spec)
    assert.equal(r.ok, false)
  })
})
