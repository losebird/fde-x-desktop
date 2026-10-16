import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBriefingSession } from '../briefing/session.mjs'

test('resolveBriefingSession reuses the workspace fde-briefing session', async () => {
  const calls = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      return {
        items: [{
          sessionId: 'brief-1',
          cwd: '/ws/a',
          projections: { values: { agentPreset: 'fde-briefing' } },
        }],
      }
    },
  }, '/ws/a')
  assert.equal(sessionId, 'brief-1')
  assert.deepEqual(calls.map((row) => row.endpoint), ['session/list'])
})

test('resolveBriefingSession creates an fde-briefing session when none exists', async () => {
  const calls = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'primary', cwd: '/ws/a', projections: { values: { agentPreset: 'standard' } } }] }
      }
      if (endpoint === 'session/create') return { sessionId: 'brief-new' }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'brief-new')
  assert.equal(calls[1].args.request.agentPreset, 'fde-briefing')
  assert.equal(calls[1].args.request.cwd, '/ws/a')
})
