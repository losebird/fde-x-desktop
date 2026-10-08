import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asDraftCard, attachCuesOnGroups, cardCue, cardFromOpenedNode, collapseCueCards, cueFromOriginDoc, cueIdOf, draftMemoryCardInsert, loadNamedCards, namedCardIds, nodeMayCite } from '../memory/cards.mjs'
import { attachCardOrigin } from '../memory/draft.mjs'
import { instanceOriginOf } from '../memory/identity.mjs'

test('insert op is add_node with 起草 metadata', () => {
  const insert = draftMemoryCardInsert('12345678\n应用动作只起草卡片', 'choice')
  assert.equal(insert.op, 'add_node')
  assert.notEqual(insert.op, 'draft_memory_card')
  assert.equal(insert.args.type, '记忆卡片')
  assert.equal(insert.args.metadata.status, '起草')
  assert.equal(insert.args.metadata.kind, '记忆卡片')
  assert.equal(insert.args.metadata.auto, false)
  assert.match(insert.args.id, /^memory:[a-f0-9]{16}$/u)
  assert.equal(insert.args.id, cueIdOf('', '12345678\n应用动作只起草卡片', 'choice'))
  assert.ok(insert.args.label.length >= 8)
})

test('same cue reuses id', () => {
  const a = draftMemoryCardInsert('12345678 same text', 'correction')
  const b = draftMemoryCardInsert('12345678 same text', 'correction')
  assert.equal(a.args.id, b.args.id)
})

test('list attach takes origin from the write log map', () => {
  const map = new Map([['memory:x', 'biz:trace_1']])
  const attached = attachCardOrigin({ id: 'memory:x', label: '过账 receipt' }, map)
  assert.equal(attached.origin, 'biz:trace_1')
  const listed = attachCardOrigin({ id: 'memory:y', label: '过账 receipt' })
  assert.equal(listed.origin, undefined)
})

test('instance origin goes to metadata; receipts and specs do not', () => {
  const biz = draftMemoryCardInsert('12345678 过账摘要正文', 'choice', { origin: 'biz:trace_1', auto: true })
  assert.equal(biz.args.metadata.origin, 'biz:trace_1')
  assert.equal(biz.args.metadata.source, undefined)
  assert.equal(biz.args.metadata.auto, true)
  const receipt = draftMemoryCardInsert('12345678 过账回执正文', 'choice', { origin: 'biz:dup', auto: true })
  assert.equal(receipt.args.metadata.origin, undefined)
  const spec = draftMemoryCardInsert('12345678 应用说明正文', 'choice', { origin: 'app:board' })
  assert.equal(spec.args.metadata.origin, undefined)
  const row = draftMemoryCardInsert('12345678 一条记录正文', 'choice', { origin: 'app:board:doc:r1' })
  assert.equal(row.args.metadata.origin, 'app:board:doc:r1')
  assert.equal(row.args.metadata.source, undefined)
  const file = draftMemoryCardInsert('12345678 文件摘录正文', 'correction', { origin: 'file:docs/a.md' })
  assert.equal(file.args.metadata.origin, 'file:docs/a.md')
  assert.equal(file.args.metadata.source, 'file:docs/a.md')
})

test('asDraftCard stays 起草 not 已入档', () => {
  const insert = draftMemoryCardInsert('12345678 hello', 'correction')
  const card = asDraftCard({ id: insert.args.id }, '12345678 hello')
  assert.equal(card.status, '起草')
  assert.notEqual(card.status, '已入档')
  assert.equal(card.id, insert.args.id)
  assert.equal(card.body, '12345678 hello')
})

test('instance origin arity is structural', () => {
  assert.equal(instanceOriginOf('session:s1'), 'session:s1')
  assert.equal(instanceOriginOf('file:docs/a.md'), 'file:docs/a.md')
  assert.equal(instanceOriginOf('im:r1'), 'im:r1')
  assert.equal(instanceOriginOf('task:t1'), 'task:t1')
  assert.equal(instanceOriginOf('briefing:b1'), 'briefing:b1')
  assert.equal(instanceOriginOf('app:board:doc:r1'), 'app:board:doc:r1')
  assert.equal(instanceOriginOf('app:board'), '')
  assert.equal(instanceOriginOf('biz:trace_1'), 'biz:trace_1')
  assert.equal(instanceOriginOf('biz:dup'), '')
  assert.equal(instanceOriginOf('memory:ab'), '')
})

test('list collapse keeps 已入档 and folds the same cue', () => {
  const rows = collapseCueCards([
    { id: 'memory:a', label: '同一句足够长的正文', status: '起草', origin: 'file:a.md' },
    { id: 'memory:b', label: '同一句足够长的正文', status: '已入档', origin: 'file:a.md' },
    { id: 'memory:c', label: '另一句足够长的正文', status: '起草' },
  ])
  assert.equal(rows.length, 2)
  const filed = rows.find((row) => String(row.status) === '已入档')
  assert.equal(filed.id, 'memory:b')
  assert.deepEqual(filed.ids, ['memory:a', 'memory:b'])
})

test('loadNamedCards pages the list then opens remaining ids', async () => {
  const calls = []
  const aiRuntime = {
    semanticOs: async (_path, options) => {
      calls.push(options)
      if (options.op === 'list_memory_cards') {
        if (Number(options.args.offset || 0) === 0) {
          return {
            cards: [{ id: 'memory:a', origin: 'biz:trace_1', label: '列表里的卡' }],
            has_more: true,
          }
        }
        return { cards: [], has_more: false }
      }
      if (options.op === 'open_node' && options.args.id === 'memory:b') {
        return { id: 'memory:b', then: '打开单卡这一句足够长', origin: 'biz:trace_2' }
      }
      throw new Error(`unexpected ${options.op}`)
    },
  }
  const byId = await loadNamedCards(aiRuntime, '/tmp/ws', ['memory:a', 'memory:b'])
  assert.equal(byId.get('memory:a').label, '列表里的卡')
  assert.equal(cardFromOpenedNode('memory:b', { then: '打开单卡这一句足够长' }).label, '打开单卡这一句足够长')
  assert.equal(cardFromOpenedNode('memory:c', { then: { text: '对象正文这一句足够长' } }).label, '对象正文这一句足够长')
  assert.equal(cardFromOpenedNode('memory:d', { then: { status: '已停用', label: '当时 · 已停用' } }).status, '已停用')
  assert.equal(byId.get('memory:b').label, '打开单卡这一句足够长')
  assert.deepEqual(calls.map((row) => row.op), ['list_memory_cards', 'list_memory_cards', 'open_node'])
})

test('nodeMayCite matches host cite rules', () => {
  assert.equal(nodeMayCite({ id: 'session:s1:3', type: 'Document', content: '当轮' }), true)
  assert.equal(nodeMayCite({ id: 'file:docs/a.md', content: '文件' }), true)
  assert.equal(nodeMayCite({ id: 'memory:a', type: '记忆卡片', status: '起草', content: '起草' }), false)
  assert.equal(nodeMayCite({ id: 'memory:b', type: '记忆卡片', status: '已入档', content: '入档' }), true)
  assert.equal(nodeMayCite({ id: 'd1', type: 'decision', status: '起草' }), false)
  assert.equal(nodeMayCite({ id: 'd2', type: 'decision', status: '已生效' }), true)
  assert.equal(nodeMayCite({ id: 'v1', type: 'skos:Concept' }), false)
})

test('named card ids include other and ids', () => {
  assert.deepEqual(namedCardIds({ id: 'memory:a', other: 'memory:b', ids: ['memory:a', 'memory:c'] }), ['memory:a', 'memory:b', 'memory:c'])
})

test('health group cue uses named cards not raw ids', async () => {
  const groups = await attachCuesOnGroups(
    [{
      kind: '重复',
      items: [{ id: 'memory:a', other: 'memory:b', label: 'memory:a ~ memory:b' }],
    }],
    async (origin) => {
      if (origin === 'biz:trace_1') return { ok: true, text: '把客户张三改成成交这一句足够长' }
      if (origin === 'biz:trace_2') return { ok: true, text: '停用客户还有哪些没关的工单？' }
      return { ok: false }
    },
    new Map([['memory:a', 'biz:trace_1'], ['memory:b', 'biz:trace_2']]),
  )
  assert.equal(groups[0].items[0].cue, '把客户张三改成成交这一句足够长 · 停用客户还有哪些没关的工单？')
  assert.equal(groups[0].items[0].id, 'memory:a')
  assert.equal(groups[0].items[0].other, 'memory:b')
  assert.deepEqual(groups[0].items[0].named.map((row) => row.id), ['memory:a', 'memory:b'])
})

test('health group cue uses listed card origin when write log misses', async () => {
  const groups = await attachCuesOnGroups(
    [{ kind: '重复', items: [{ id: 'memory:a', other: 'memory:b' }] }],
    async (origin) => {
      if (origin === 'biz:trace_listed') return { ok: true, text: '东莞联创到期合同下还有哪些待审回款？把备注改成催收。' }
      return { ok: false }
    },
    new Map(),
    new Map([['memory:a', { id: 'memory:a', origin: 'biz:trace_listed', label: '过账 receipt' }]]),
  )
  assert.equal(groups[0].items[0].cue, '东莞联创到期合同下还有哪些待审回款？把备注改成催收。')
})

test('origin cue prefers readable text over identity title', () => {
  assert.equal(cueFromOriginDoc({ title: '当时原文', text: '把客户张三改成成交这一句足够长' }), '把客户张三改成成交这一句足够长')
  assert.equal(cueFromOriginDoc({ title: '任务完成了这一句足够长', text: '{"ok":true}' }), '任务完成了这一句足够长')
  assert.equal(cueFromOriginDoc({ title: '当时原文', text: '{"ok":true}' }), '当时原文')
  assert.equal(cardCue({ label: '过账 receipt receipt 1', cue: '把客户张三改成成交这一句足够长' }), '把客户张三改成成交这一句足够长')
  assert.equal(cardCue({ label: '过账 receipt receipt 1' }), '过账 receipt receipt 1')
})

test('choice and correction of the same text stay two cues', () => {
  const rows = collapseCueCards([
    { id: 'memory:a', label: '同一句足够长的正文', origin: 'file:a.md', cause: 'choice' },
    { id: 'memory:b', label: '同一句足够长的正文', origin: 'file:a.md', cause: 'correction' },
  ])
  assert.equal(rows.length, 2)
})
