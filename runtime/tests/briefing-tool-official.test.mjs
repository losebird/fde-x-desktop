import assert from 'node:assert/strict'
import { test } from 'node:test'
import { harvestTurnToolResults, itemsFromToolResult } from '../briefing/tool-official.mjs'
import { digestBeats, digestItems, presentBriefingItem } from '../briefing/item.mjs'

test('itemsFromToolResult maps a JSON collection without slicing', () => {
  const items = itemsFromToolResult(JSON.stringify({
    messages: [
      { subject: '新邮件', from: 'a@b.com', url: 'https://mail/1' },
      { subject: '更新', from: 'c@d.com' },
    ],
  }))
  assert.equal(items.length, 2)
  assert.equal(items[0].text, '新邮件')
  assert.equal(items[0].sub, 'a@b.com')
  assert.equal(items[0].href, 'https://mail/1')
})

test('itemsFromToolResult folds a markdown list instead of every newline', () => {
  const blob = [
    '安全边界：下方分隔区内的标题来自外部信源。',
    '',
    '1. 第一篇标题 https://news.example/a',
    '摘要甲。',
    '',
    '2. 第二篇标题',
    'https://news.example/b',
    '摘要乙。',
  ].join('\n')
  const items = itemsFromToolResult(blob)
  assert.equal(items.length, 2)
  assert.equal(items[0].text, '第一篇标题 https://news.example/a')
  assert.equal(items[0].href, 'https://news.example/a')
  assert.equal(items[1].text, '第二篇标题')
  assert.equal(items[1].href, 'https://news.example/b')
})

test('itemsFromToolResult splits a blob on blank lines and drops fillers', () => {
  const blob = [
    'From: a@b.com',
    'Weekly digest',
    '',
    '---',
    '',
    'https://example.com/only',
    '',
    'GitHub Actions',
    'Run failed: Build desktop installers',
    'https://github.com/losebird/fdex-workbench/actions/1',
  ].join('\n')
  const items = itemsFromToolResult(blob)
  assert.equal(items.length, 2)
  assert.equal(items[0].text, 'From: a@b.com')
  assert.equal(items[0].sub.includes('Weekly digest'), true)
  assert.equal(items[1].text, 'GitHub Actions')
  assert.equal(items[1].href, 'https://github.com/losebird/fdex-workbench/actions/1')
})

test('itemsFromToolResult honors limit', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ title: `t${i}` }))
  const items = itemsFromToolResult(JSON.stringify({ items: rows }), { limit: 3 })
  assert.equal(items.length, 3)
  assert.equal(items[2].text, 't2')
})

test('presentBriefingItem unwraps markdown links', () => {
  const item = presentBriefingItem({
    text: '[AlphaProof Nexus](https://aihot.news/items/abc)',
    sub: 'The Decoder',
  })
  assert.equal(item.text, 'AlphaProof Nexus')
  assert.equal(item.href, 'https://aihot.news/items/abc')
  assert.equal(item.sub, 'The Decoder')
})

test('digestBeats splits a wall and keeps multiple items', () => {
  assert.deepEqual(
    digestBeats({ items: [{ text: '今日无待办；邮箱有两封未读。' }] }),
    ['今日无待办', '邮箱有两封未读。'],
  )
  assert.deepEqual(
    digestBeats({ items: [{ text: '甲' }, { text: '乙' }] }),
    ['甲', '乙'],
  )
})

test('digestItems uses sentence bounds and colon as sub', () => {
  const items = digestItems({
    items: [{
      text: '今日无待办。昨日记忆是预览，没有过账。邮箱近 24 小时未读 15 封：Google 安全提醒。行业侧：AlphaProof 攻克问题。',
    }],
  })
  assert.equal(items[0].text, '今日无待办。')
  assert.equal(items.some((row) => row.text === '昨日记忆是预览，没有过账。'), true)
  const mail = items.find((row) => row.text.startsWith('邮箱'))
  assert.equal(mail?.sub?.includes('Google'), true)
  const news = items.find((row) => row.text === '行业侧')
  assert.equal(news?.sub?.includes('AlphaProof'), true)
})

test('itemsFromToolResult unwraps markdown titles in a collection', () => {
  const items = itemsFromToolResult(JSON.stringify({
    items: [{ title: '[GPT-6.1](https://aihot.news/x)', source: 'Tibo' }],
  }))
  assert.equal(items[0].text, 'GPT-6.1')
  assert.equal(items[0].href, 'https://aihot.news/x')
})

test('harvestTurnToolResults keeps this-turn last result per tool', async () => {
  const aiRuntime = {
    async *stream(endpoint) {
      assert.equal(endpoint, 'session/follow')
      yield { type: 'snapshot', header: {}, records: [] }
      yield { type: 'event', event: { type: 'turn/start', data: { turn: 2 } } }
      yield { type: 'event', event: { type: 'tool/call', data: { name: 'mcp__mail__imap_search', callId: 'c1' } } }
      yield {
        type: 'event',
        event: {
          type: 'tool/result',
          data: {
            message: {
              source: { callId: 'c1' },
              content: [{ type: 'text', text: JSON.stringify({ items: [{ text: '最新一封' }] }) }],
            },
          },
        },
      }
      yield { type: 'event', event: { type: 'turn/end', data: { turn: 2 } } }
    },
  }
  const harvest = await harvestTurnToolResults(aiRuntime, 'sess', { timeoutMs: 1000 })
  assert.equal(harvest.ended, true)
  assert.equal(harvest.byTool['mcp__mail__imap_search'].text.includes('最新一封'), true)
})
