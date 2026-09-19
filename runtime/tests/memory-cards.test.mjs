import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asDraftCard, draftMemoryCardInsert } from '../memory/cards.mjs'

test('insert op is add_node with 起草 metadata', () => {
  const insert = draftMemoryCardInsert('12345678\n应用动作只起草卡片', 'choice')
  assert.equal(insert.op, 'add_node')
  assert.notEqual(insert.op, 'draft_memory_card')
  assert.equal(insert.args.type, '记忆卡片')
  assert.equal(insert.args.metadata.status, '起草')
  assert.equal(insert.args.metadata.kind, '记忆卡片')
  assert.equal(insert.args.metadata.auto, false)
  assert.match(insert.args.id, /^memory:[a-f0-9]{8}$/u)
  assert.ok(insert.args.label.length >= 8)
})

test('repeated drafts do not reuse ids', () => {
  const a = draftMemoryCardInsert('12345678 same text', 'correction')
  const b = draftMemoryCardInsert('12345678 same text', 'correction')
  assert.notEqual(a.args.id, b.args.id)
})

test('asDraftCard stays 起草 not 已入档', () => {
  const insert = draftMemoryCardInsert('12345678 hello', 'correction')
  const card = asDraftCard({ id: insert.args.id }, '12345678 hello')
  assert.equal(card.status, '起草')
  assert.notEqual(card.status, '已入档')
  assert.equal(card.id, insert.args.id)
  assert.equal(card.body, '12345678 hello')
})
