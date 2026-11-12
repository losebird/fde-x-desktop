import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { briefingDirty, discardBriefingSessionAllow, disposeBriefingSession, resolveBriefingSession, stageBriefingSessionAllow } from '../briefing/session.mjs'

test('disposeBriefingSession removes session files from dsh-home', async () => {
  const home = mkdtempSync(join(tmpdir(), 'briefing-dispose-'))
  const sessionId = 'session-gone'
  mkdirSync(join(home, 'storages', 'session_projcache', 'sessions'), { recursive: true })
  mkdirSync(join(home, 'sessions', 'ws', sessionId), { recursive: true })
  writeFileSync(join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`), '{}')
  writeFileSync(join(home, 'sessions', 'ws', sessionId, 'session.lock'), '')
  await disposeBriefingSession({
    dshHome: home,
    call: async (endpoint) => {
      if (endpoint === 'workspace/archiveSession') return { archivedSessionIds: [sessionId] }
      throw new Error(endpoint)
    },
  }, sessionId)
  assert.throws(() => readFileSync(join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)))
  assert.throws(() => readFileSync(join(home, 'sessions', 'ws', sessionId, 'session.lock')))
  rmSync(home, { recursive: true, force: true })
})

test('disposeBriefingSession keeps files when Host archive fails', async () => {
  const home = mkdtempSync(join(tmpdir(), 'briefing-dispose-keep-'))
  const sessionId = 'session-keep'
  mkdirSync(join(home, 'storages', 'session_projcache', 'sessions'), { recursive: true })
  writeFileSync(join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`), '{}')
  await disposeBriefingSession({
    dshHome: home,
    call: async () => {
      throw new Error('archive down')
    },
  }, sessionId)
  assert.equal(readFileSync(join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`), 'utf8'), '{}')
  rmSync(home, { recursive: true, force: true })
})

test('a listed briefing session without blank metadata is dirty', () => {
  assert.equal(briefingDirty({
    projections: { values: { agentPreset: 'fde-briefing' } },
  }), true)
  assert.equal(briefingDirty({
    projections: { values: { agentPreset: 'fde-briefing', sessionListMetadata: { blank: true } } },
  }), false)
  assert.equal(briefingDirty({
    projections: { values: { agentPreset: 'fde-briefing', sessionListMetadata: { blank: true, lastPromptAt: 9 } } },
  }), true)
})

test('resolveBriefingSession reuses a clean workspace fde-briefing session', async () => {
  const calls = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return {
          items: [{
            sessionId: 'brief-1',
            cwd: '/ws/a',
            projections: { values: { agentPreset: 'fde-briefing', sessionListMetadata: { blank: true } } },
          }],
        }
      }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'brief-1')
  assert.deepEqual(calls.map((row) => row.endpoint), ['session/list'])
})

test('resolveBriefingSession does not delete a normal AI session in the same workspace', async () => {
  const deleted = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint, args) => {
      if (endpoint === 'session/list') {
        return {
          items: [
            {
              sessionId: 'sess-po',
              cwd: '/ws/a',
              projections: { values: { agentPreset: 'fde-duty', title: '新建采购订单停在预览' } },
            },
            {
              sessionId: 'brief-old',
              cwd: '/ws/a',
              projections: { values: { agentPreset: 'fde-briefing', title: '生成并提交AI早报' } },
            },
          ],
        }
      }
      if (endpoint === 'session/create') return { sessionId: 'brief-new' }
      if (endpoint === 'workspace/archiveSession') {
        deleted.push(args.request.sessionId)
        return { archivedSessionIds: [args.request.sessionId] }
      }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'brief-new')
  assert.deepEqual(deleted, ['brief-old'])
})

test('resolveBriefingSession deletes a dirty briefing session and opens a clean one', async () => {
  const calls = []
  const sessionId = await resolveBriefingSession({
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        return {
          items: [{
            sessionId: 'brief-old',
            cwd: '/ws/a',
            projections: { values: { agentPreset: 'fde-briefing', title: '生成并提交AI早报' } },
          }],
        }
      }
      if (endpoint === 'session/create') return { sessionId: 'brief-new' }
      if (endpoint === 'workspace/archiveSession') return { archivedSessionIds: [args.request.sessionId] }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'brief-new')
  assert.deepEqual(calls.map((row) => row.endpoint), ['session/list', 'session/create', 'workspace/archiveSession'])
  assert.equal(calls[2].args.request.sessionId, 'brief-old')
  assert.equal(calls[2].args.request.stopActivity, true)
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
  assert.deepEqual(emitted, [])
})

test('resolveBriefingSession still creates when session/list would fail', async () => {
  const sessionId = await resolveBriefingSession({
    call: async (endpoint) => {
      if (endpoint === 'session/list') throw Object.assign(new Error('list down'), { code: 'session_list_failed' })
      if (endpoint === 'session/create') return { sessionId: 'brief-new' }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'brief-new')
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
  assert.equal(emitted.length, 0)
})

test('resolveBriefingSession stages enabled mcp servers for a reused session and clears them when none stay enabled', async () => {
  const home = mkdtempSync(join(tmpdir(), 'briefing-stage-'))
  const aiRuntime = {
    dshHome: home,
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return {
          items: [{
            sessionId: 'session-brief-old',
            cwd: '/ws/a',
            projections: { values: { agentPreset: 'fde-briefing', sessionListMetadata: { blank: true } } },
          }],
        }
      }
      if (endpoint === 'session/create') return { sessionId: 'session-brief-reuse' }
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
    assert.equal(sessionId, 'session-brief-old')
    const file = join(home, 'run', 'briefing-allow', 'session-brief-old.json')
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).servers, ['mail'])
    stageBriefingSessionAllow(aiRuntime, sessionId, sections, ['QQ-Mail'])
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).servers, ['mail', 'QQ-Mail'])
    const nextId = await resolveBriefingSession(aiRuntime, '/ws/a', [])
    assert.equal(nextId, 'session-brief-old')
    const nextFile = join(home, 'run', 'briefing-allow', `${nextId}.json`)
    assert.deepEqual(JSON.parse(readFileSync(nextFile, 'utf8')).servers, [])
    discardBriefingSessionAllow(aiRuntime, sessionId)
    assert.throws(() => readFileSync(file, 'utf8'))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
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

test('resolveBriefingSession skips emit when the caller omitted it', async () => {
  const sessionId = await resolveBriefingSession({
    call: async (endpoint) => {
      if (endpoint === 'session/list') return { items: [] }
      if (endpoint === 'session/create') return { sessionId: 'sess-no-emit' }
      throw new Error(endpoint)
    },
  }, '/ws/a')
  assert.equal(sessionId, 'sess-no-emit')
})

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
