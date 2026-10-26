import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { openDatabase } from '../db.mjs'
import { createBriefingRun, getBriefing, getLatestBriefing, getOrCreateDefinition } from '../briefing/store.mjs'
import { runBriefing } from '../briefing/run.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrations = join(repoRoot, 'runtime', 'migrations')
const wsCwd = '/tmp/fde-x-briefing-inflight-ws'

function makeDb(path) {
  return openDatabase(path, migrations)
}

function registerWorkspace(db, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_inflight', 't', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd }), now, now)
}

test('a second full run joins the in-flight briefing and does not prompt again', async () => {
  const path = '/tmp/fde-x-briefing-inflight.sqlite'
  await rm(path, { force: true }).catch(() => undefined)
  const db = makeDb(path)
  registerWorkspace(db, wsCwd)
  getOrCreateDefinition(db, wsCwd)
  let prompts = 0
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint, args) => {
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'sess-a', cwd: wsCwd, origin: 'user', updatedAt: 2, running: false }] }
      }
      if (endpoint === 'session/create') {
        assert.fail('briefing must not create an fde-briefing session')
      }
      if (endpoint === 'session/prompt') {
        prompts += 1
        assert.equal(args.request.sessionId, 'sess-a')
        return {}
      }
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start', data: {} } }
      yield { type: 'event', event: { type: 'turn/end', data: {} } }
    },
  }
  const first = runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'full' })
  const second = runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'full' })
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.briefingId, b.briefingId)
  assert.equal(Boolean(a.joined) && Boolean(b.joined), false)
  assert.equal(Boolean(a.joined) || Boolean(b.joined), true)
  assert.equal(prompts, 1)
  db.close()
})

function connectedRuntime(hooks = {}) {
  return {
    status: () => ({ connected: true }),
    call: async (endpoint, args) => {
      if (endpoint === 'session/list') return { items: [] }
      if (endpoint === 'session/create') {
        if (hooks.onCreate) return hooks.onCreate(args)
        return { sessionId: 'sess-briefing' }
      }
      if (endpoint === 'session/prompt') {
        if (hooks.onPrompt) hooks.onPrompt(args)
        return {}
      }
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start', data: {} } }
      yield { type: 'event', event: { type: 'turn/end', data: {} } }
    },
  }
}

test('a running briefing with no live owner is abandoned and the next generate starts fresh', async () => {
  const path = '/tmp/fde-x-briefing-orphan.sqlite'
  await rm(path, { force: true }).catch(() => undefined)
  const db = makeDb(path)
  registerWorkspace(db, wsCwd)
  const definition = getOrCreateDefinition(db, wsCwd)
  const stuck = createBriefingRun(db, {
    definitionId: definition.id,
    workspaceCwd: wsCwd,
    agentRequestId: '',
  })
  const next = await runBriefing(
    { db, aiRuntime: connectedRuntime() },
    { workspaceCwd: wsCwd, mode: 'full' },
  )
  assert.notEqual(next.briefingId, stuck.id)
  assert.notEqual(next.joined, true)
  const old = getBriefing(db, stuck.id, wsCwd)
  assert.equal(old.status, 'failed')
  assert.equal(old.agentError, '生成中断')
  db.close()
})

test('a generate without a live AI session fails closed and the next generate starts fresh', async () => {
  const path = '/tmp/fde-x-briefing-throw.sqlite'
  await rm(path, { force: true }).catch(() => undefined)
  const db = makeDb(path)
  registerWorkspace(db, wsCwd)
  getOrCreateDefinition(db, wsCwd)
  let prompts = 0
  let listed = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint, args) => {
      if (endpoint === 'session/list') return { items: listed }
      if (endpoint === 'session/create') assert.fail('briefing must not create an fde-briefing session')
      if (endpoint === 'session/prompt') {
        prompts += 1
        assert.equal(args.request.sessionId, 'sess-briefing')
        return {}
      }
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start', data: {} } }
      yield { type: 'event', event: { type: 'turn/end', data: {} } }
    },
  }
  const stuckRun = await runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'full' })
  const stuck = getBriefing(db, stuckRun.briefingId, wsCwd)
  assert.equal(stuck.status, 'partial')
  assert.equal(stuck.agentError, '当前工作区还没有可用的 AI 会话')
  listed = [{ sessionId: 'sess-briefing', cwd: wsCwd, origin: 'user', updatedAt: 2, running: false }]
  const next = await runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'full' })
  assert.notEqual(next.briefingId, stuck.id)
  assert.notEqual(next.joined, true)
  assert.equal(prompts, 1)
  db.close()
})

test('onOpen full skips the canvas-selected session', async () => {
  const path = '/tmp/fde-x-briefing-canvas.sqlite'
  await rm(path, { force: true }).catch(() => undefined)
  const db = makeDb(path)
  registerWorkspace(db, wsCwd)
  getOrCreateDefinition(db, wsCwd)
  let prompts = 0
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return { items: [{ sessionId: 'sess-canvas', cwd: wsCwd, origin: 'user', updatedAt: 9, running: false }] }
      }
      if (endpoint === 'session/prompt') {
        prompts += 1
        return {}
      }
      return {}
    },
  }
  await runBriefing({ db, aiRuntime }, { workspaceCwd: wsCwd, mode: 'internal-only' })
  const full = await runBriefing({ db, aiRuntime }, {
    workspaceCwd: wsCwd,
    mode: 'full',
    skipIfCanvas: true,
    canvasSessionId: 'sess-canvas',
  })
  assert.equal(full.skippedCanvas, true)
  assert.equal(prompts, 0)
  db.close()
})

test('Briefing land uses onOpen=0; openRef increments land', () => {
  const briefing = readFileSync(join(repoRoot, 'src/pages/Briefing.tsx'), 'utf8')
  assert.match(briefing, /briefingLand/)
  assert.match(briefing, /refresh\(false\)/)
  assert.match(briefing, /refresh\(true\)/)
  const openRef = readFileSync(join(repoRoot, 'src/lib/open-ref.ts'), 'utf8')
  assert.match(openRef, /setBriefingBrowse\(\{ land:/)
  const routes = readFileSync(join(repoRoot, 'runtime/routes/briefing.mjs'), 'utf8')
  assert.match(routes, /skipIfCanvas: true/)
  assert.match(routes, /canvasSessionId/)
})
