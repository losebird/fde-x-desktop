import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asDraftCard, collapseCueCards, cueIdOf, draftMemoryCardInsert } from '../memory/cards.mjs'
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

test('choice and correction of the same text stay two cues', () => {
  const rows = collapseCueCards([
    { id: 'memory:a', label: '同一句足够长的正文', origin: 'file:a.md', cause: 'choice' },
    { id: 'memory:b', label: '同一句足够长的正文', origin: 'file:a.md', cause: 'correction' },
  ])
  assert.equal(rows.length, 2)
})
