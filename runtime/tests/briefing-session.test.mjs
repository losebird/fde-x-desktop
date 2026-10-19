import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discardBriefingSessionAllow, resolveBriefingSession } from '../briefing/session.mjs'

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

test('resolveBriefingSession stages enabled mcp servers for a reused session and clears them when none stay enabled', async () => {
  const home = mkdtempSync(join(tmpdir(), 'briefing-stage-'))
  const aiRuntime = {
    dshHome: home,
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return {
          items: [{
            sessionId: 'session-brief-reuse',
            cwd: '/ws/a',
            projections: { values: { agentPreset: 'fde-briefing' } },
          }],
        }
      }
      throw new Error(endpoint)
    },
  }
  const sections = [
    { type: 'mcp', enabled: true, params: { server: 'mail', tool: 'imap_search' } },
    { type: 'mcp', enabled: false, params: { server: 'rss', tool: 'fetch' } },
    { type: 'mcp', enabled: true, params: { server: 'playwright', tool: 'click' } },
  ]
  try {
    const sessionId = await resolveBriefingSession(aiRuntime, '/ws/a', sections)
    assert.equal(sessionId, 'session-brief-reuse')
    const file = join(home, 'run', 'briefing-allow', 'session-brief-reuse.json')
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).servers, ['mail'])
    await resolveBriefingSession(aiRuntime, '/ws/a', [])
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).servers, [])
    discardBriefingSessionAllow(aiRuntime, sessionId)
    assert.throws(() => readFileSync(file, 'utf8'))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
