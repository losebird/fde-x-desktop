import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HOST_DUP_KIND,
  HOST_UNSOURCED_KIND,
  attachHealthItem,
  buildHealthSheet,
  dupIssuesFromEnrich,
  dupPairOp,
  filterSourceActions,
  groupActionsOf,
  healthItemKey,
  healthWritePlan,
  itemHasOrigin,
  mergeHealthGroups,
  reshapeUnsoursedGroup,
  retireGroupIds,
} from '../memory/health.mjs'

test('session origin drops 无出处; receipt origin stays', () => {
  const originMap = new Map([
    ['memory:a', 'biz:trace_1'],
    ['memory:b', 'session:s1'],
  ])
  const group = reshapeUnsoursedGroup({
    kind: HOST_UNSOURCED_KIND,
    count: 3,
    has_more: false,
    items: [
      { id: 'memory:a', kind: HOST_UNSOURCED_KIND, label: '过账', actions: [{ op: 'open' }, { op: 'source' }, { op: 'retire' }] },
      { id: 'memory:b', kind: HOST_UNSOURCED_KIND, label: '会话', actions: [{ op: 'open' }, { op: 'source' }, { op: 'retire' }] },
      { id: 'memory:c', kind: HOST_UNSOURCED_KIND, label: '孤儿', actions: [{ op: 'open' }, { op: 'source' }, { op: 'retire' }] },
    ],
  }, originMap, 0, 0, 80)
  assert.equal(group.items.length, 2)
  assert.deepEqual(group.items.map((row) => row.id).sort(), ['memory:a', 'memory:c'])
  assert.equal(group.count, 2)
  assert.equal(itemHasOrigin(group.items.find((row) => row.id === 'memory:a')), false)
  assert.deepEqual(group.actions, ['retire_group', 'mute'])
})

test('same cue in 无出处 folds; retire_group takes every folded id', () => {
  const group = reshapeUnsoursedGroup({
    kind: HOST_UNSOURCED_KIND,
    count: 2,
    has_more: false,
    items: [
      { id: 'memory:a', kind: HOST_UNSOURCED_KIND, label: '同一句足够长的正文', origin: 'biz:trace_1', actions: [{ op: 'open' }, { op: 'retire' }] },
      { id: 'memory:b', kind: HOST_UNSOURCED_KIND, label: '同一句足够长的正文', origin: 'biz:trace_1', actions: [{ op: 'open' }, { op: 'retire' }] },
    ],
  }, new Map(), 0, 0, 80)
  assert.equal(group.items.length, 1)
  assert.deepEqual(group.items[0].ids, ['memory:a', 'memory:b'])
  assert.deepEqual(retireGroupIds(group.items), ['memory:a', 'memory:b'])
  const plan = healthWritePlan({ op: 'retire_group', ids: group.items[0].ids, nodded: true })
  assert.deepEqual(plan.ids, ['memory:a', 'memory:b'])
})

test('session origin keeps source action', () => {
  const row = attachHealthItem({
    id: 'memory:b',
    actions: [{ op: 'open' }, { op: 'source' }, { op: 'retire' }],
  }, new Map([['memory:b', 'session:s1']]))
  assert.equal(itemHasOrigin(row), true)
  assert.deepEqual(row.actions.map((item) => item.op), ['open', 'source', 'retire'])
})

test('biz origin strips source action', () => {
  const row = filterSourceActions({
    id: 'memory:a',
    origin: 'biz:trace_1',
    actions: [{ op: 'open' }, { op: 'source' }, { op: 'retire' }],
  })
  assert.deepEqual(row.actions.map((item) => item.op), ['open', 'retire'])
})

test('duplicate memory cards link; mixed types skip; same type merge', () => {
  assert.equal(dupPairOp({ id: 'memory:a' }, { id: 'memory:b' }), 'link')
  assert.equal(dupPairOp({ id: 'org:1', type: 'Org' }, { id: 'org:2', type: 'Person' }), '')
  assert.equal(dupPairOp({ id: 'org:1', type: 'Org' }, { id: 'org:2', type: 'Org' }), 'merge')
})

test('enrich pairs page past eight and keep distinct left-id rows', () => {
  const duplicates = Array.from({ length: 10 }, (_, i) => ({
    entity_a: { id: 'memory:left', label: '同一口径', type: '记忆卡片' },
    entity_b: { id: `memory:r${i}`, label: '同一口径', type: '记忆卡片' },
  }))
  const issues = dupIssuesFromEnrich({ duplicates }, HOST_DUP_KIND)
  assert.equal(issues.length, 10)
  const sheet = buildHealthSheet({
    health: { groups: [{ kind: HOST_DUP_KIND, items: [], count: 8 }], muted: [] },
    dups: { duplicates },
    originMap: new Map(),
    dupOffset: 8,
    page: 8,
  })
  const dup = sheet.groups.find((row) => row.kind === HOST_DUP_KIND)
  assert.equal(dup.count, 10)
  assert.equal(dup.items.length, 2)
  assert.equal(dup.items[0].other, 'memory:r8')
  assert.equal(dup.has_more, false)
})

test('merge keeps duplicate pairs that share a left id', () => {
  const first = [{ id: 'memory:left', kind: HOST_DUP_KIND, other: 'memory:a', label: 'a' }]
  const second = [
    { id: 'memory:left', kind: HOST_DUP_KIND, other: 'memory:a', label: 'a' },
    { id: 'memory:left', kind: HOST_DUP_KIND, other: 'memory:b', label: 'b' },
  ]
  const merged = mergeHealthGroups(
    [{ kind: HOST_DUP_KIND, items: first, count: 1 }],
    [{ kind: HOST_DUP_KIND, items: second, count: 2, has_more: false }],
  )
  assert.equal(merged[0].items.length, 2)
  assert.equal(healthItemKey(merged[0].items[1]), `${HOST_DUP_KIND}\0memory:left\0memory:b`)
})

test('write plan requires nod and rejects biz source', () => {
  assert.equal(healthWritePlan({ op: 'retire', id: 'memory:a' }).error, 'nodded')
  assert.equal(healthWritePlan({ op: 'source', id: 'memory:a', source: 'biz:trace_1', nodded: true }).error, 'NOT_A_SESSION')
  assert.equal(healthWritePlan({ op: 'nope', nodded: true }).error, 'unknown_op')
  const retire = healthWritePlan({ op: 'retire', id: 'memory:a', nodded: true })
  assert.equal(retire.python, 'retire_memory_card')
  const source = healthWritePlan({ op: 'source', id: 'memory:a', source: 'session:s1', nodded: true })
  assert.equal(source.args.source, 'session:s1')
  const link = healthWritePlan({ op: 'link', id: 'memory:a', other: 'memory:b', type: 'confirms', nodded: true })
  assert.equal(link.python, 'nod_memory_edge')
  const group = healthWritePlan({ op: 'retire_group', ids: ['memory:c'], nodded: true })
  assert.deepEqual(group.ids, ['memory:c'])
  assert.equal(group.python, 'retire_memory_card')
  assert.equal(group.pythonEach, undefined)
  assert.deepEqual(group.args.ids, ['memory:c'])
})

test('retire-only group offers retire_group and mute', () => {
  const actions = groupActionsOf([
    { actions: [{ op: 'open' }, { op: 'retire' }] },
    { actions: [{ op: 'open' }, { op: 'retire' }] },
  ])
  assert.deepEqual(actions, ['retire_group', 'mute'])
})
