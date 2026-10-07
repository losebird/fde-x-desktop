import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBriefingAgent } from '../briefing/ask-ai.mjs'

test('runBriefingAgent prompts the pointed session and does not create another', async () => {
  const calls = []
  const db = {
    prepare() {
      return { run() { /* agent_request_id */ } }
    },
  }
  const result = await runBriefingAgent({
    db,
    aiRuntime: {
      status: () => ({ connected: true }),
      call: async (endpoint, args) => {
        calls.push({ endpoint, args })
        if (endpoint === 'session/prompt') return {}
        throw new Error(`unexpected ${endpoint}`)
      },
    },
  }, {
    briefingId: 'brf',
    workspaceCwd: '/ws/a',
    sessionId: 'sess-current',
    sections: [{ id: 'ai', type: 'ai', enabled: true, title: '摘要', render: 'digest', params: {} }],
    internalSections: [],
    timeoutMs: 0,
    projectWaitMs: 0,
  })
  assert.equal(result.sessionId, 'sess-current')
  assert.equal(calls.some((row) => row.endpoint === 'session/create'), false)
  assert.equal(calls[0].endpoint, 'session/prompt')
  assert.equal(calls[0].args.request.sessionId, 'sess-current')
  assert.equal(calls[0].args.request.mode, 'queue')
  assert.equal(calls[0].args.request.content[0].type, 'text')
  assert.equal(calls[0].args.agentId, undefined)
})

test('runBriefingAgent refuses to invent a session', async () => {
  const result = await runBriefingAgent({
    db: { prepare() { return { run() {} } } },
    aiRuntime: { status: () => ({ connected: true }), call: async () => ({}) },
  }, {
    briefingId: 'brf',
    workspaceCwd: '/ws/a',
    sessionId: '',
    sections: [],
    internalSections: [],
    timeoutMs: 10,
  })
  assert.equal(result.ok, false)
  assert.match(result.error, /没有可用的 AI 会话/)
})

test('runBriefingAgent blocks mcp tools the session has not projected', async () => {
  const calls = []
  const result = await runBriefingAgent({
    db: { prepare() { return { run() {} } } },
    aiRuntime: {
      status: () => ({ connected: true }),
      call: async () => { throw new Error('unexpected call') },
      async *stream(endpoint) {
        calls.push(endpoint)
        if (endpoint === 'session/follow') {
          yield { type: 'snapshot', header: { tools: [] }, records: [] }
        }
      },
    },
  }, {
    briefingId: 'brf',
    workspaceCwd: '/ws/a',
    sessionId: 'sess-current',
    sections: [{
      id: 'news',
      type: 'mcp',
      enabled: true,
      title: '资讯',
      params: { server: 'ai-hot', tool: 'mcp__ai-hot__aihot_get_latest' },
    }],
    internalSections: [],
    timeoutMs: 0,
    projectWaitMs: 0,
  })
  assert.equal(result.ok, true)
  assert.equal(calls.includes('session/prompt'), false)
  assert.equal(result.blocked[0].id, 'news')
  assert.match(result.blocked[0].error, /会话未投影/)
})
