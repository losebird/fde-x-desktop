import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePlan } from '../vendor-overlays/dsh-lan-assist/plan.js'
import { relatedField, relatedHopId, relatedIdBatches } from '../vendor-overlays/dsh-lan-assist/lookup.js'

test('nested from expands to more than two hop steps', () => {
  const plan = normalizePlan({
    kind: 'ChildC',
    action: '现查',
    from: {
      kind: 'ParentA',
      where: [{ keys: ['status'], values: ['pending'] }],
      from: {
        kind: 'MidB',
        where: [{ keys: ['status'], values: ['open'] }],
      },
    },
    where: [{ keys: ['status'], values: ['expired'] }],
  })
  assert.equal(plan.steps.length, 3)
  assert.deepEqual(plan.steps.map((row) => row.kind), ['ParentA', 'MidB', 'ChildC'])
  assert.equal(plan.steps[1].from, 'ParentA')
  assert.equal(plan.steps[2].from, 'MidB')
  assert.equal(plan.targetIndex, 2)
})

test('explicit steps are not capped at a pair', () => {
  const plan = normalizePlan({
    kind: 'LeafD',
    action: '改行',
    steps: [
      { kind: 'RootA', where: [{ keys: ['status'], values: ['a'] }] },
      { kind: 'MidB', where: [{ keys: ['status'], values: ['b'] }] },
      { kind: 'MidC', where: [{ keys: ['status'], values: ['c'] }] },
      { kind: 'LeafD', where: [{ keys: ['status'], values: ['d'] }] },
    ],
    patch: { remark: 'x' },
  })
  assert.equal(plan.steps.length, 4)
  assert.equal(plan.steps[3].kind, 'LeafD')
})

test('relatedField prefers schema FK id over vocab relation name', () => {
  const extra = {
    vocab: [
      { kind: 'ParentA', resource: 'parent_a', can: ['现查'] },
      {
        kind: 'ChildB',
        resource: 'child_b',
        can: ['现查'],
        relations: [{ from: 'ParentA', to: 'ChildB', field: 'parent' }],
      },
    ],
    collections: [{
      name: 'child_b',
      fields: [
        { name: 'parent', target: 'parent_a', interface: 'm2o' },
        { name: 'parentId' },
      ],
    }],
  }
  assert.equal(relatedField('ParentA', 'ChildB', extra), 'parentId')
})

test('belongs-to filter key is the id column when the shadow field is unlisted', () => {
  const extra = {
    vocab: [
      { kind: 'ParentA', resource: 'parent_a', can: ['现查'] },
      { kind: 'ChildB', resource: 'child_b', can: ['现查'] },
    ],
    collections: [{
      name: 'child_b',
      fields: [
        { name: 'link', target: 'parent_a', interface: 'm2o' },
      ],
    }],
  }
  assert.equal(relatedField('ParentA', 'ChildB', extra), 'linkId')
})

test('many-to-many uses the association name when the child has no belongs-to id', () => {
  const extra = {
    vocab: [
      { kind: 'SideA', resource: 'side_a', can: ['现查'] },
      {
        kind: 'SideB',
        resource: 'side_b',
        can: ['现查'],
        relations: [{ from: 'SideA', to: 'SideB', field: 'members' }],
      },
    ],
    collections: [{
      name: 'side_b',
      fields: [{ name: 'members', target: 'side_a', interface: 'belongsToMany' }],
    }],
  }
  assert.equal(relatedField('SideA', 'SideB', extra), 'members')
})

test('a parent row without id is linked by its name', () => {
  const extra = {
    vocab: [
      { kind: 'SideA', resource: 'side_a', can: ['现查'] },
      {
        kind: 'SideB',
        resource: 'side_b',
        can: ['现查'],
        relations: [{ from: 'SideA', to: 'SideB', field: 'members' }],
      },
    ],
    collections: [{
      name: 'side_b',
      fields: [{ name: 'members', target: 'side_a', interface: 'belongsToMany' }],
    }],
  }
  assert.equal(relatedHopId('SideA', 'SideB', { name: 'alpha' }, extra), 'alpha')
  assert.equal(relatedHopId('SideA', 'SideB', { id: '9', name: 'alpha' }, extra), '9')
})

test('belongs-to id still wins when a many-to-many is also present', () => {
  const extra = {
    vocab: [
      { kind: 'ParentA', resource: 'parent_a', can: ['现查'] },
      { kind: 'ChildB', resource: 'child_b', can: ['现查'] },
    ],
    collections: [{
      name: 'child_b',
      fields: [
        { name: 'members', target: 'parent_a', interface: 'belongsToMany' },
        { name: 'link', target: 'parent_a', interface: 'm2o' },
      ],
    }],
  }
  assert.equal(relatedField('ParentA', 'ChildB', extra), 'linkId')
})

test('parent ids are split before a child filter outgrows one request', () => {
  const ids = Array.from({ length: 40 }, (_, i) => `id-${String(i).padStart(8, '0')}`)
  const batches = relatedIdBatches(ids, 'parentId', 180)
  assert.ok(batches.length > 1)
  assert.equal(batches.flat().length, ids.length)
  for (const batch of batches) {
    const clause = { parentId: { $in: batch } }
    assert.ok(encodeURIComponent(JSON.stringify(clause)).length <= 180 || batch.length === 1)
  }
})
