import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBriefingSession } from '../briefing/session.mjs'

test('resolveBriefingSession reuses the workspace fde-briefing session', async () => {
  const calls = []
  const emitted = []
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
  }, '/ws/a', (type, payload, meta) => {
    emitted.push({ type, payload, meta })
  })
  assert.equal(sessionId, 'brief-1')
  assert.deepEqual(calls.map((row) => row.endpoint), ['session/list'])
  assert.deepEqual(emitted, [])
})

test('resolveBriefingSession creates an fde-briefing session when none exists', async () => {
  const calls = []
  const emitted = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'primary', cwd: '/ws/a', projections: { values: { agentPreset: 'standard' } } }] }
      }
      if (endpoint === 'session/create') return { sessionId: 'brief-new' }
      throw new Error(endpoint)
    },
  }, '/ws/a', (type, payload, meta) => {
    emitted.push({ type, payload, meta })
  })
  assert.equal(sessionId, 'brief-new')
  assert.equal(calls[1].args.request.agentPreset, 'fde-briefing')
  assert.equal(calls[1].args.request.cwd, '/ws/a')
  assert.deepEqual(emitted, [{
    type: 'ai.session.changed',
    payload: { sessionId: 'brief-new', kind: 'created' },
    meta: { workspaceCwd: '/ws/a', sessionId: 'brief-new' },
  }])
})

test('resolveBriefingSession does not create a session when list fails', async () => {
  const calls = []
  await assert.rejects(
    () => resolveBriefingSession({
      call: async (endpoint) => {
        calls.push(endpoint)
        throw Object.assign(new Error('list down'), { code: 'session_list_failed' })
      },
    }, '/ws/a'),
    (error) => error.message === 'list down',
  )
  assert.deepEqual(calls, ['session/list'])
})

test('resolveBriefingSession ignores a briefing row with no workspace', async () => {
  const calls = []
  const emitted = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint) => {
      calls.push(endpoint)
      if (endpoint === 'session/list') {
        return {
          items: [{
            sessionId: 'blank',
            projections: { values: { agentPreset: 'fde-briefing' } },
          }],
        }
      }
      if (endpoint === 'session/create') return { sessionId: 'brief-new' }
      throw new Error(endpoint)
    },
  }, '/ws/a', (type, payload, meta) => {
    emitted.push({ type, payload, meta })
  })
  assert.equal(sessionId, 'brief-new')
  assert.deepEqual(calls, ['session/list', 'session/create'])
  assert.equal(emitted.length, 1)
  assert.equal(emitted[0].payload.kind, 'created')
})
