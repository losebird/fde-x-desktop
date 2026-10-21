import './support/no-stray-processes.mjs'
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
  }, '/ws/a')
  assert.equal(sessionId, 'brief-new')
  assert.deepEqual(calls, ['session/list', 'session/create'])
})

const missingSessionBodies = [
  { name: 'empty object', created: {} },
  { name: 'empty sessionId', created: { sessionId: '' } },
  { name: 'null sessionId', created: { sessionId: null } },
  { name: 'missing sessionId field', created: { agentPreset: 'fde-briefing' } },
  { name: 'id only', created: { id: 'x' } },
  { name: 'session_id only', created: { session_id: 'x' } },
]

for (const row of missingSessionBodies) {
  test(`resolveBriefingSession rejects session/create ${row.name} with briefing_session_missing`, async () => {
    const calls = []
    await assert.rejects(
      () => resolveBriefingSession({
        call: async (endpoint) => {
          calls.push(endpoint)
          if (endpoint === 'session/list') return { items: [] }
          if (endpoint === 'session/create') return row.created
          throw new Error(endpoint)
        },
      }, '/ws/a'),
      (error) => error.code === 'briefing_session_missing',
    )
    assert.deepEqual(calls, ['session/list', 'session/create'])
  })
}

test('resolveBriefingSession returns sess-ok when session/create returns a sessionId', async () => {
  const sessionId = await resolveBriefingSession({
    call: async (endpoint) => {
      if (endpoint === 'session/list') return { items: [] }
      if (endpoint === 'session/create') return { sessionId: 'sess-ok' }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'sess-ok')
})
