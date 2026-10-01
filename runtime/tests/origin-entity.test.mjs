import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORIGIN_ENTITY_BUDGET, originKindOf, renderOriginEntity } from '../memory/origin-entity.mjs'

test('origin entity keeps body and status, drops lookup titles', () => {
  const text = renderOriginEntity({
    title: 'memory:6ac9d5e6',
    text: '图层里导入的点',
    status: '起草',
    originTitle: '资料卡片板',
    originText: '应用动作只起草卡片',
  })
  assert.match(text, /【来源实体】/)
  assert.match(text, /图层里导入的点/)
  assert.match(text, /状态：起草/)
  assert.match(text, /【原文】/)
  assert.match(text, /应用动作只起草卡片/)
  assert.equal(text.includes('记忆摘录'), false)
  assert.equal(/出处\s+memory:/.test(text), false)
  assert.equal(text.includes('memory:6ac9d5e6'), false)
})

test('origin kind follows prefix table', () => {
  assert.equal(originKindOf('biz:trace_1'), 'biz')
  assert.equal(originKindOf('app:board'), 'app')
  assert.equal(originKindOf('memory:ab'), 'memory')
  assert.equal(originKindOf('nope'), '')
})

test('origin entity has its own budget', () => {
  const text = renderOriginEntity({
    title: '一行',
    text: '正文'.repeat(2000),
  })
  assert.ok(text.length <= ORIGIN_ENTITY_BUDGET)
  assert.match(text, /【来源实体】/)
})
