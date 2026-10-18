import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'
import { proposePlanTask } from '../plan/task-proposals.mjs'

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrations = join(repoRoot, 'runtime', 'migrations')
const tokenText = 'secret-token'

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function readRaw(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

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

function insertWorkflow(db, { id, workspaceId, trigger, steps }) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '验收流', 'paused', ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    JSON.stringify(trigger),
    JSON.stringify({ description: '', category: 'system', emoji: '🤖', steps }),
    now,
    now,
  )
}

function insertTask(db, { id, workspaceId, title }) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO tasks
      (id, workspace_id, title, notes, status, priority, due_at, completed_at, metadata_json, source_ref, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, '', 'todo', 'med', NULL, NULL, '{}', NULL, '[]', ?, ?)
  `).run(id, workspaceId, title, now, now)
  return db.prepare('SELECT title, updated_at FROM tasks WHERE id = ?').get(id)
}

function runCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM workflow_runs').get().n
}

function openFixture(name) {
  const dbPath = `/tmp/fde-x-workflow-run-${name}-${process.pid}.sqlite`
  return { dbPath, db: openDatabase(dbPath, migrations) }
}

function serve(db, aiRuntime, correlationId) {
  const server = http.createServer(async (request, response) => {
    const raw = await readRaw(request)
    const parsed = raw ? JSON.parse(raw) : {}
    const url = new URL(request.url, 'http://127.0.0.1')
    const handled = await handlePlanRequest(request, response, url, {
      db,
      enqueueEvent() {},
      readJson: async () => ({ ...parsed, token: tokenText, pageToken: tokenText }),
      aiRuntime,
    }, correlationId)
    if (!handled && !response.headersSent) {
      response.writeHead(404)
      response.end()
    }
  })
  return server
}

async function postRun(port, workflowId, body = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'x-fde-ui-token': 'a'.repeat(64),
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  return { status: response.status, payload }
}

function storedText(db, runId) {
  const run = db.prepare('SELECT trigger_json, input_json, output_json FROM workflow_runs WHERE id = ?').get(runId)
  const step = db.prepare('SELECT input_json, output_json, error_json FROM workflow_run_steps WHERE run_id = ?').all(runId)
  return JSON.stringify({ run, step })
}

async function flush() {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

test('带页面令牌的 run 返回 200，并插入 queued', async (t) => {
  const { dbPath, db } = openFixture('queued')
  insertWorkspace(db, 'ws_run', '/tmp/fde-x-workflow-run-cwd')
  insertWorkflow(db, {
    id: 'wf_queued',
    workspaceId: 'ws_run',
    trigger: { kind: 'keyword', patterns: ['早报'] },
    steps: [{ id: 's1', kind: 'ai', label: '问一句', config: { prompt: '汇总这条记录', sourceRef: 'app:visits:row1' } }],
  })
  const createGate = deferred()
  const turnGate = deferred()
  const prompted = deferred()
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call(endpoint, args) {
      calls.push({ endpoint, args })
      if (endpoint === 'session/create') {
        await createGate.promise
        return { sessionId: 'sess_wf' }
      }
      if (endpoint === 'session/prompt') {
        prompted.resolve()
        return {}
      }
      return { items: [] }
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start' } }
      await turnGate.promise
      yield { type: 'event', event: { type: 'turn/end' } }
    },
  }
  const server = serve(db, aiRuntime, 'corr_queued')
  const port = await listen(server)
  t.after(async () => {
    createGate.resolve()
    turnGate.resolve()
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_queued', { workspaceId: 'ws_run' })
  assert.equal(status, 200, `run status ${status}, workflow_runs ${runCount(db)}`)
  assert.equal(payload.ok, true)
  assert.equal(payload.data.state, 'queued')
  const runId = payload.data.id
  const queued = db.prepare('SELECT state, output_json, correlation_id, trigger_json FROM workflow_runs WHERE id = ?').get(runId)
  assert.equal(queued.state, 'queued')
  assert.equal(queued.output_json, null)
  assert.equal(queued.correlation_id, 'corr_queued')
  assert.equal(queued.trigger_json, '{"kind":"manual"}')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflow_run_steps WHERE run_id = ?').get(runId).n, 1)
  assert.equal(storedText(db, runId).includes(tokenText), false)

  createGate.resolve()
  await Promise.race([
    prompted.promise,
    delay(1000).then(() => assert.fail('session/prompt was not called')),
  ])
  const started = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(runId)
  const startedOutput = JSON.parse(started.output_json)
  assert.equal(startedOutput.sessionId, 'sess_wf')
  const promptCall = calls.find((call) => call.endpoint === 'session/prompt')
  const promptText = JSON.stringify(promptCall.args)
  assert.equal(promptText.includes('汇总这条记录'), true)
  assert.equal(promptText.includes('app:visits:row1'), true)
  assert.equal(promptText.includes(tokenText), false)
  assert.equal(storedText(db, runId).includes(tokenText), false)

  turnGate.resolve()
  await flush()
  const finished = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(runId)
  assert.equal(finished.state, 'succeeded')
  assert.equal(JSON.parse(finished.output_json).sessionId, 'sess_wf')
  const step = db.prepare('SELECT state, output_json, error_json FROM workflow_run_steps WHERE run_id = ?').get(runId)
  assert.equal(step.state, 'succeeded')
  assert.equal(step.error_json, null)
  assert.notEqual(step.output_json, null)

  const listed = await fetch('http://127.0.0.1:' + port + '/api/v1/plan/workflows?workspaceId=ws_run')
  const listBody = await listed.json()
  const card = listBody.data.find((row) => row.id === 'wf_queued')
  assert.equal(card.lastRunStatus, 'success')
  assert.equal(typeof card.lastRunAt, 'string')
  assert.equal(card.lastRunAt.length > 0, true)
})

test('会话改任务只增加 awaiting_approval，tasks 不变', async (t) => {
  const { dbPath, db } = openFixture('propose')
  insertWorkspace(db, 'ws_prop', '/tmp/fde-x-workflow-run-cwd')
  insertWorkflow(db, {
    id: 'wf_prop',
    workspaceId: 'ws_prop',
    trigger: { kind: 'manual' },
    steps: [{ id: 's1', kind: 'ai', label: '改任务', config: { prompt: '把标题改掉' } }],
  })
  const before = insertTask(db, { id: 'task_prop', workspaceId: 'ws_prop', title: '原标题' })
  const createGate = deferred()
  const turnGate = deferred()
  const prompted = deferred()
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call(endpoint) {
      if (endpoint === 'session/create') {
        await createGate.promise
        return { sessionId: 'sess_prop' }
      }
      if (endpoint === 'session/prompt') {
        const proposed = proposePlanTask(db, {
          op: 'update',
          workspaceId: 'ws_prop',
          taskId: 'task_prop',
          title: '被改掉',
        })
        assert.equal(proposed.ok, true)
        prompted.resolve()
        return {}
      }
      return { items: [] }
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/start' } }
      await turnGate.promise
      yield { type: 'event', event: { type: 'turn/end' } }
    },
  }
  const server = serve(db, aiRuntime, 'corr_prop')
  const port = await listen(server)
  t.after(async () => {
    createGate.resolve()
    turnGate.resolve()
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_prop', { workspaceId: 'ws_prop' })
  assert.equal(status, 200, `run status ${status}, workflow_runs ${runCount(db)}`)
  assert.equal(payload.data.state, 'queued')
  createGate.resolve()
  await Promise.race([
    prompted.promise,
    delay(1000).then(() => assert.fail('session/prompt was not called')),
  ])
  const task = db.prepare('SELECT title, updated_at FROM tasks WHERE id = ?').get('task_prop')
  assert.equal(task.title, before.title)
  assert.equal(task.updated_at, before.updated_at)
  const pending = db.prepare(`
    SELECT state FROM operations WHERE workspace_id = ? AND action = 'plan.task.propose'
  `).all('ws_prop')
  assert.equal(pending.length, 1)
  assert.equal(pending[0].state, 'awaiting_approval')
  turnGate.resolve()
  await flush()
  const after = db.prepare('SELECT title, updated_at FROM tasks WHERE id = ?').get('task_prop')
  assert.equal(after.title, '原标题')
  assert.equal(after.updated_at, before.updated_at)
  const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(payload.data.id)
  assert.equal(run.state, 'succeeded')
  assert.equal(JSON.parse(run.output_json).sessionId, 'sess_prop')
})

test('AI 不可用时 run 为 failed，错误可读', async (t) => {
  const { dbPath, db } = openFixture('down')
  insertWorkspace(db, 'ws_down', '')
  insertWorkflow(db, {
    id: 'wf_down',
    workspaceId: 'ws_down',
    trigger: { kind: 'manual' },
    steps: [{ id: 's1', kind: 'ai', label: '问一句', config: { prompt: '还在吗' } }],
  })
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: false }),
    async call(endpoint) {
      calls.push(endpoint)
      return {}
    },
    async *stream() {},
  }
  const server = serve(db, aiRuntime, 'corr_down')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_down', { workspaceId: 'ws_down' })
  assert.equal(status, 200, `run status ${status}, workflow_runs ${runCount(db)}`)
  assert.equal(payload.data.state, 'queued')
  await flush()
  const run = db.prepare('SELECT id, state, output_json FROM workflow_runs WHERE id = ?').get(payload.data.id)
  assert.equal(run.state, 'failed')
  assert.notEqual(run.state, 'succeeded')
  const step = db.prepare('SELECT state, error_json FROM workflow_run_steps WHERE run_id = ?').get(run.id)
  assert.equal(step.state, 'failed')
  assert.equal(JSON.parse(step.error_json).message, '核心 AI 运行时尚未连接')
  assert.equal(calls.length, 0)
  const listed = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows?workspaceId=ws_down`)
  const listBody = await listed.json()
  const card = listBody.data.find((row) => row.id === 'wf_down')
  assert.equal(card.lastRunStatus, 'failed')
})

test('没有 ai 步骤时不把 run 标成成功', async (t) => {
  const { dbPath, db } = openFixture('memory')
  insertWorkspace(db, 'ws_mem', '')
  insertWorkflow(db, {
    id: 'wf_mem',
    workspaceId: 'ws_mem',
    trigger: { kind: 'event', on: 'task.done' },
    steps: [{ id: 's1', kind: 'memory.add', label: '记一笔', config: {} }],
  })
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call(endpoint) {
      calls.push(endpoint)
      return { sessionId: 'sess_should_not' }
    },
    async *stream() {},
  }
  const server = serve(db, aiRuntime, 'corr_mem')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const { status, payload } = await postRun(port, 'wf_mem', { workspaceId: 'ws_mem' })
  assert.equal(status, 200, `run status ${status}, workflow_runs ${runCount(db)}`)
  assert.equal(payload.data.state, 'queued')
  await flush()
  const run = db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(payload.data.id)
  assert.equal(run.state, 'failed')
  const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(payload.data.id)
  assert.equal(JSON.parse(step.error_json).message, '没有记忆 M1，这一步只留提案')
  assert.equal(calls.includes('session/create'), false)
})

test('缺少提示、Host job、未知 id 不插入 run', async (t) => {
  const { dbPath, db } = openFixture('reject')
  insertWorkspace(db, 'ws_rej', '')
  insertWorkflow(db, {
    id: 'wf_empty',
    workspaceId: 'ws_rej',
    trigger: { kind: 'manual' },
    steps: [{ id: 's1', kind: 'ai', label: '空', config: { prompt: '   ' } }],
  })
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call() {
      return { sessionId: 'sess_no' }
    },
    async *stream() {},
  }
  const server = serve(db, aiRuntime, 'corr_rej')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const empty = await postRun(port, 'wf_empty', { workspaceId: 'ws_rej' })
  assert.equal(empty.status, 422, `run status ${empty.status}, workflow_runs ${runCount(db)}`)
  assert.equal(runCount(db), 0)
  const host = await postRun(port, 'dsh-job:j1', { workspaceId: 'ws_rej' })
  assert.equal(host.status, 404)
  assert.equal(runCount(db), 0)
  const missing = await postRun(port, 'wf_missing', { workspaceId: 'ws_rej' })
  assert.equal(missing.status, 404)
  assert.equal(runCount(db), 0)
})

test('跨工作区的 run 返回 404，workflow_runs 不增加', async (t) => {
  const { dbPath, db } = openFixture('cross')
  insertWorkspace(db, 'ws_owner', '')
  insertWorkspace(db, 'ws_other', '')
  insertWorkflow(db, {
    id: 'wf_cross',
    workspaceId: 'ws_owner',
    trigger: { kind: 'manual' },
    steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '汇总' } }],
  })
  const aiRuntime = {
    status: () => ({ connected: true }),
    async call() {
      return { sessionId: 'sess_cross' }
    },
    async *stream() {},
  }
  const server = serve(db, aiRuntime, 'corr_cross')
  const port = await listen(server)
  t.after(async () => {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  })

  const before = runCount(db)
  const { status } = await postRun(port, 'wf_cross', { workspaceId: 'ws_other' })
  assert.equal(status, 404, `run status ${status}, workflow_runs ${runCount(db)}`)
  assert.equal(runCount(db), before)
})

test('不带页面令牌的 run 返回 401，workflow_runs 仍是 0 行', async (t) => {
  const root = `/tmp/fde-x-workflow-run-401-${process.pid}`
  const dbPath = join(root, 'fde.sqlite')
  await rm(root, { recursive: true, force: true })
  await mkdir(root, { recursive: true })
  const child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: root,
      FDE_RUNTIME_SUPERVISED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let pageToken = ''
  let base = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
    const tokenMatch = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(stdout)
    if (tokenMatch) pageToken = tokenMatch[1]
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  t.after(async () => {
    if (child.exitCode == null) child.kill('SIGTERM')
    await rm(root, { recursive: true, force: true })
  })
  for (let i = 0; i < 100; i += 1) {
    const match = /^FDE_LISTENING\s+(\d+)/m.exec(stdout)
    if (match && pageToken) {
      base = `http://127.0.0.1:${match[1]}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  assert.ok(base, `server failed\n${stderr}\n${stdout}`)
  const response = await fetch(`${base}/api/v1/plan/workflows/${encodeURIComponent('wf_missing')}/run`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const payload = await response.json()
  assert.equal(response.status, 401)
  assert.equal(payload.error.code, 'ui_token_invalid')
  const read = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 })
  try {
    assert.equal(read.prepare('SELECT COUNT(*) AS n FROM workflow_runs').get().n, 0)
  } finally {
    read.close()
  }
})
