import assert from 'node:assert/strict'
import { test } from 'node:test'
import { harvestTurnToolResults, itemsFromToolResult } from '../briefing/tool-official.mjs'

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
