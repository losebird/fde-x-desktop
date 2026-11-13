import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractDossierKeys, formatDossierDraft, scanDossierIssues, scanDossierLinkIssues, suggestDossierEdge } from '../memory/dossier-index.mjs'
import { healthWritePlan, mergeDossierGroup, mergeDossierLinkGroup } from '../memory/health.mjs'

test('extractDossierKeys normalizes PO and 工单', () => {
  assert.deepEqual(extractDossierKeys('现况未读到 PO-20261112 和 PO20250407926'), ['PO-20261112', 'PO-20250407926'])
  assert.deepEqual(extractDossierKeys('工单：WO-88 已解决'), ['WO-88'])
})

test('scanDossierIssues needs two 已入档 cards on the same key', () => {
  const issues = scanDossierIssues([
    { id: 'memory:a', status: '已入档', body: '规则：PO-20261112 到货对发票', origin: 'session:s1' },
    { id: 'memory:b', status: '已入档', body: '陷阱：PO-20261112 未放行', origin: 'session:s2' },
    { id: 'memory:c', status: '起草', body: '规则：PO-20261112 待审' },
    { id: 'memory:d', status: '已入档', body: '规则：库存余额现查' },
  ])
  assert.equal(issues.length, 1)
  assert.equal(issues[0].key, 'PO-20261112')
  assert.deepEqual(issues[0].members, ['memory:a', 'memory:b'])
  assert.match(issues[0].draft, /规则：PO-20261112 案卷/)
  assert.match(issues[0].draft, /memory:a session:s1/)
  assert.match(issues[0].draft, /未证实：/)
  assert.deepEqual(issues[0].actions.map((row) => row.op), ['open', 'index'])
})

test('index cards and live-only cards do not seed a dossier', () => {
  const issues = scanDossierIssues([
    { id: 'memory:ix', status: '已入档', body: '规则：PO-20261112 案卷\n怎么知道：memory:a' },
    { id: 'memory:live', status: '已入档', body: '规则：库存余额现查' },
  ])
  assert.equal(issues.length, 0)
})

test('formatDossierDraft stays under cap', () => {
  const draft = formatDossierDraft({
    key: 'PO-1',
    members: [{ id: 'memory:a', origin: 'file:a.md' }, { id: 'memory:b' }],
  })
  assert.ok(draft.length <= 800)
})

test('healthWritePlan index needs nod and key', () => {
  assert.equal(healthWritePlan({ op: 'index', key: 'PO-1' }).error, 'nodded')
  const plan = healthWritePlan({ op: 'index', key: 'PO-20261112', id: 'memory:a', nodded: true })
  assert.equal(plan.fde, 'dream_index')
  assert.equal(plan.args.key, 'PO-20261112')
})

test('suggestDossierEdge only returns confirms or enriches', () => {
  assert.equal(suggestDossierEdge('规则：PO-20261112 案卷', '规则：PO-20261112 到货对发票'), 'confirms')
  assert.equal(suggestDossierEdge('短', '完全不相干的一句话足够长了'), 'enriches')
  assert.notEqual(suggestDossierEdge('a', 'b'), 'replaces')
  assert.notEqual(suggestDossierEdge('a', 'b'), 'challenges')
})

test('scanDossierLinkIssues waits for an index card and skips existing edges', () => {
  const cards = [
    { id: 'memory:ix', status: '起草', body: '规则：PO-20261112 案卷\n怎么知道：memory:a' },
    { id: 'memory:a', status: '已入档', body: '规则：PO-20261112 到货对发票' },
    { id: 'memory:b', status: '已入档', body: '规则：PO-20261112 收货数量待对发票' },
  ]
  const open = scanDossierLinkIssues(cards)
  assert.equal(open.length, 1)
  assert.equal(open[0].kind, '案卷连边')
  assert.deepEqual(open[0].members.sort(), ['memory:a', 'memory:b'])
  assert.equal(open[0].links.every((row) => row.type === 'confirms' || row.type === 'enriches'), true)
  const left = scanDossierLinkIssues(cards, [
    { source: 'memory:ix', target: 'memory:a', type: 'enriches' },
    { source: 'memory:ix', target: 'memory:b', type: 'confirms' },
  ])
  assert.equal(left.length, 0)
})

test('healthWritePlan link_group needs nod and members', () => {
  assert.equal(healthWritePlan({ op: 'link_group', id: 'memory:ix', members: ['memory:a'] }).error, 'nodded')
  const plan = healthWritePlan({ op: 'link_group', id: 'memory:ix', members: ['memory:a', 'memory:b'], key: 'PO-1', nodded: true })
  assert.equal(plan.fde, 'dream_link_group')
  assert.equal(plan.args.source, 'memory:ix')
  assert.deepEqual(plan.args.members, ['memory:a', 'memory:b'])
})

test('mergeDossierGroup appends 案卷索引', () => {
  const merged = mergeDossierGroup({ groups: [], muted: [] }, [{
    id: 'memory:a',
    key: 'PO-1',
    kind: '案卷索引',
    actions: [{ op: 'index', key: 'PO-1' }],
  }])
  assert.equal(merged.groups.at(-1).kind, '案卷索引')
  assert.equal(merged.groups.at(-1).count, 1)
})

test('mergeDossierLinkGroup appends 案卷连边', () => {
  const merged = mergeDossierLinkGroup({ groups: [], muted: [] }, [{
    id: 'memory:ix',
    kind: '案卷连边',
    members: ['memory:a'],
    actions: [{ op: 'link_group', id: 'memory:ix' }],
  }])
  assert.equal(merged.groups.at(-1).kind, '案卷连边')
})
