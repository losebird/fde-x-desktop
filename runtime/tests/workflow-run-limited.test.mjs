import http from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'

const home = join(tmpdir(), `fde-x-workflow-limit-home-${process.pid}`)
process.env.FDE_DSH_HOME = home
mkdirSync(join(home, 'run'), { recursive: true })
writeFileSync(join(home, 'run', 'bridge-tools.json'), `${JSON.stringify({
  ok: true,
  workflowLimit: true,
  tools: ['fde_app_records_query', 'fde_app_records_propose', 'fde_plan_task_propose'],
})}\n`)

const origin = 'http://127.0.0.1:5173'
const migrations = join(import.meta.dirname, '..', 'migrations')
const sourceRef = `app:app_${'a'.repeat(32)}:rec${'b'.repeat(32)}`

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify(cwd ? { cwd } : {}), now, now)
}

function insertWorkflow(db, id, workspaceId, steps) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '验收流', 'paused', ?, ?, 1, ?, ?)
  `).run(id, workspaceId, JSON.stringify({ kind: 'manual' }), JSON.stringify({ steps }), now, now)
}

function serve(db, aiRuntime, correlationId) {
  return http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    const parsed = raw ? JSON.parse(raw) : {}
    const url = new URL(request.url, 'http://127.0.0.1')
    const handled = await handlePlanRequest(request, response, url, {
      db,
      enqueueEvent() {},
      readJson: async () => parsed,
      aiRuntime,
    }, correlationId)
    if (!handled && !response.headersSent) {
      response.writeHead(404)
      response.end()
    }
  })
}

async function postRun(port, workflowId, workspaceId) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  })
  return { status: response.status, payload: await response.json() }
}

async function flush() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

function traceOf(db, runId) {
  return db.prepare('SELECT state FROM run_state_trace WHERE run_id = ? ORDER BY id').all(runId).map((row) => row.state)
}

function installTrace(db) {
  db.exec(`
    CREATE TABLE run_state_trace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      state TEXT NOT NULL
    );
    CREATE TRIGGER trace_workflow_run_state
    AFTER UPDATE OF state ON workflow_runs
    BEGIN
      INSERT INTO run_state_trace (run_id, state) VALUES (NEW.id, NEW.state);
    END;
  `)
}

test('可见工具核对不上时 run 从 queued 直接失败且不发送步骤', async (t) => {
  const dbPath = join(tmpdir(), `fde-x-workflow-unchecked-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_unchecked', '/tmp/fde-x-workflow-unchecked-cwd')
  insertWorkflow(db, 'wf_unchecked', 'ws_unchecked', [
    { id: 's1', kind: 'ai', label: 'AI', config: { prompt: '汇总这条记录', sourceRef } },
  ])
  installTrace(db)
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'session/create') return { sessionId: 'session-unchecked' }
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/end' } }
    },
  }
  const server = serve(db, aiRuntime, 'corr_unchecked')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_unchecked', 'ws_unchecked')
  assert.equal(status, 200)
  assert.equal(payload.data.state, 'queued')
  await flush()

  assert.equal(calls.some((call) => call.endpoint === 'session/create'), true)
  assert.equal(calls.some((call) => call.endpoint === 'session/prompt'), false)
  assert.deepEqual(traceOf(db, payload.data.id), ['failed'])
  const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(payload.data.id)
  const step = db.prepare('SELECT state, error_json FROM workflow_run_steps WHERE run_id = ?').get(payload.data.id)
  assert.equal(run.state, 'failed')
  assert.equal(run.output_json, null)
  assert.equal(step.state, 'failed')
  assert.equal(JSON.parse(step.error_json).message, '工作流会话的可见工具没有核对上，未运行')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM operations').get().n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n, 0)
})

test('会话没建成时 run 从 queued 直接失败', async (t) => {
  const dbPath = join(tmpdir(), `fde-x-workflow-limited-reject-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_reject', '/tmp/fde-x-workflow-limited-cwd')
  insertWorkflow(db, 'wf_reject', 'ws_reject', [
    { id: 's1', kind: 'ai', label: 'AI', config: { prompt: '汇总这条记录' } },
  ])
  installTrace(db)
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call() {
      throw new Error('工作流预设未能限制工具')
    },
    async *stream() {},
  }
  const server = serve(db, aiRuntime, 'corr_reject')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_reject', 'ws_reject')
  assert.equal(status, 200)
  assert.equal(payload.data.state, 'queued')
  await flush()
  assert.deepEqual(traceOf(db, payload.data.id), ['failed'])
  const rejected = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(payload.data.id)
  assert.equal(rejected.state, 'failed')
  assert.equal(rejected.output_json, null)
  const step = db.prepare('SELECT state, error_json FROM workflow_run_steps WHERE run_id = ?').get(payload.data.id)
  assert.equal(step.state, 'failed')
  assert.equal(JSON.parse(step.error_json).message, '工作流预设未能限制工具')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM operations').get().n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n, 0)
})

test('没有目录时不开工作流会话', async (t) => {
  const dbPath = join(tmpdir(), `fde-x-workflow-limited-cwd-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_nocwd', '')
  insertWorkflow(db, 'wf_nocwd', 'ws_nocwd', [
    { id: 's1', kind: 'ai', label: 'AI', config: { prompt: '汇总这条记录' } },
  ])
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call(endpoint) {
      calls.push(endpoint)
      return { sessionId: 'sess_nocwd' }
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/end' } }
    },
  }
  const server = serve(db, aiRuntime, 'corr_nocwd')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_nocwd', 'ws_nocwd')
  assert.equal(status, 200)
  await flush()
  assert.equal(calls.includes('session/create'), false)
  const run = db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(payload.data.id)
  const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(payload.data.id)
  assert.equal(run.state, 'failed')
  assert.equal(JSON.parse(step.error_json).message, '工作区没有可用目录，未开会话')
})
