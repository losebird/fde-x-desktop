import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolSessionId, toolWorkspace } from '../tools.js'

test('biz_preview binds the conversation session, not the agent runtime id', () => {
  assert.equal(toolSessionId({
    agent: {
      id: 'agent-runtime',
      session: { id: 'sess-chat', header: { id: 'header-id', cwd: '/ws' } },
    },
  }), 'sess-chat')
  assert.equal(toolSessionId({
    agent: {
      id: 'agent-runtime',
      session: { sessionId: 'sess-chat', header: { cwd: '/ws' } },
    },
  }), 'sess-chat')
  assert.equal(toolSessionId({ agent: { id: 'agent-runtime' } }), 'agent-runtime')
  assert.equal(toolWorkspace({
    agent: { session: { header: { cwd: '/mail/nocobase-test' } } },
  }), '/mail/nocobase-test')
})
