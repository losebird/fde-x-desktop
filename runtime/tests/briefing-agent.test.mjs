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
        if (endpoint === 'session/list') return { items: [{ sessionId: 'sess-current', running: false }] }
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
  const prompt = calls.find((row) => row.endpoint === 'session/prompt')
  assert.ok(prompt)
  assert.equal(prompt.args.request.sessionId, 'sess-current')
  assert.equal(prompt.args.request.mode, 'queue')
  assert.equal(prompt.args.request.content[0].type, 'text')
  assert.equal(prompt.args.agentId, undefined)
})

test('runBriefingAgent waits for an idle session and does not queue a second prompt', async () => {
  const calls = []
  const result = await runBriefingAgent({
    db: { prepare() { return { run() {} } } },
    aiRuntime: {
      status: () => ({ connected: true }),
      call: async (endpoint, args) => {
        calls.push(endpoint)
        if (endpoint === 'session/list') return { items: [{ sessionId: 'sess-current', running: true }] }
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
    timeoutMs: 50,
    projectWaitMs: 0,
  })
  assert.equal(result.ok, false)
  assert.match(result.error, /上一轮/)
  assert.equal(calls.includes('session/prompt'), false)
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
