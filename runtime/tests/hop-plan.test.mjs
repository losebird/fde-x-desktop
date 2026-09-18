import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePlan } from '../vendor-overlays/dsh-lan-assist/plan.js'
import { relatedField } from '../vendor-overlays/dsh-lan-assist/lookup.js'

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
