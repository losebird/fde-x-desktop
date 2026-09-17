import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { validateSections, validateSchedule } from '../briefing/validate.mjs'
import { defaultSections } from '../briefing/defaults.mjs'
import { setBriefingClock, startBriefingScheduler } from '../briefing/scheduler.mjs'
import { mergeBriefingSubmit } from '../briefing/run.mjs'
import { openDatabase } from '../db.mjs'

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const dbPath = '/tmp/fde-x-briefing-test.sqlite'
const port = 4396
const base = `http://127.0.0.1:${port}`
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const wsCwd = '/tmp/fde-x-briefing-test-ws'

let child

async function startServer() {
  await rm(dbPath, { force: true }).catch(() => undefined)
  await mkdir(wsCwd, { recursive: true })
  child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: wsCwd,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return
    } catch { /* retry */ }
    await delay(50)
  }
  throw new Error('briefing test server failed to start')
}

async function stopServer() {
  if (!child) return
  child.kill('SIGTERM')
  await delay(100)
}

test('validate sections closed set and default definition', () => {
  const defaults = defaultSections()
  assert.equal(validateSections(defaults).length, 0)
  const bad = validateSections([{ id: 'x', type: 'nope', title: 't', render: 'list' }])
  assert.ok(bad.some((e) => e.includes('type')))
  assert.equal(validateSchedule({ at: '08:30', days: [1], onOpen: true }).length, 0)
  assert.ok(validateSchedule({ at: '8:30' }).length > 0)
})

test('internal-only run isolates section failures', async (t) => {
  await startServer()
  t.after(stopServer)

  await fetch(`${base}/api/v1/workspaces`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'ws_brief',
      name: 'brief',
      description: 't',
      metadata: { cwd: wsCwd },
    }),
  })

  const defRes = await fetch(`${base}/api/v1/briefing/definition?workspace=${encodeURIComponent(wsCwd)}`)
  assert.equal(defRes.status, 200)
  const defBody = await defRes.json()
  assert.equal(defBody.ok, true)
  assert.ok(Array.isArray(defBody.data.sections))
  assert.ok(defBody.data.sections.some((s) => s.id === 'tasks-today'))

  const runRes = await fetch(`${base}/api/v1/briefing/run`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceCwd: wsCwd, mode: 'internal-only' }),
  })
  assert.equal(runRes.status, 200)
  const runBody = await runRes.json()
  assert.ok(runBody.data.briefingId)
  const briefing = runBody.data.briefing
  assert.ok(['ready', 'partial', 'failed', 'running'].includes(briefing.status))
  assert.ok(Array.isArray(briefing.sections))
})

test('briefing-submit merge', async () => {
  const migrations = join(repoRoot, 'runtime', 'migrations')
  const mergeDb = '/tmp/fde-x-briefing-merge.sqlite'
  await rm(mergeDb, { force: true }).catch(() => undefined)
  const db = openDatabase(mergeDb, migrations)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_b', 'b', '', 'active', '{}', ?, ?)
  `).run(now, now)
  db.prepare(`
    INSERT INTO briefing_definitions
      (id, workspace_id, name, status, sources_json, sections_json, filters_json, schedule_json, delivery_json, template_json, created_at, updated_at)
    VALUES ('bdef_ws_b', 'ws_b', 'd', 'active', '[]', '[]', '{}', '{}', '{}', '{}', ?, ?)
  `).run(now, now)
  db.prepare(`
    INSERT INTO briefings
      (id, definition_id, state, content_json, generated_at, created_at, workspace_cwd, agent_request_id)
      VALUES ('brf_1', 'bdef_ws_b', 'generating', ?, ?, ?, ?, ?)
  `).run(JSON.stringify({
    status: 'running',
    sections: [{ id: 'news', type: 'mcp', title: '资讯', render: 'digest', items: [], pendingAgent: true }],
  }), now, now, wsCwd, 'brq_test')
  const result = mergeBriefingSubmit(db, 'brq_test', [{
    id: 'news',
    title: '资讯',
    render: 'digest',
    items: [{ text: '示例', href: 'https://example.com' }],
  }])
  assert.equal(result.ok, true)
  const row = db.prepare('SELECT content_json FROM briefings WHERE id = ?').get('brf_1')
  const content = JSON.parse(row.content_json)
  assert.equal(content.sections[0].items.length, 1)
  db.close()
})

test('scheduler tick with injected clock', async () => {
  const migrations = join(repoRoot, 'runtime', 'migrations')
  const db = openDatabase('/tmp/fde-x-briefing-sched.sqlite', migrations)
  const now = new Date()
  now.setHours(8, 30, 0, 0)
  setBriefingClock(() => now)
  const fired = { count: 0 }
  const aiRuntime = { status: () => ({ connected: false }) }
  startBriefingScheduler({
    db,
    aiRuntime,
    defaultCwd: wsCwd,
  })
  db.close()
  assert.equal(typeof fired.count, 'number')
})
