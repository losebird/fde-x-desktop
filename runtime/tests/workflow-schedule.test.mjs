import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'
import { tickWorkflowSchedules } from '../plan/workflow-schedule.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

function insertWorkspace(db, id) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', '{}', ?, ?)
  `).run(id, id, now, now)
}

function insertWorkflow(db, id, workspaceId) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '错过流', 'active', ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify({
      steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '只查询', tools: ['fde_app_records_query'] } }],
    }),
    now,
    now,
  )
}

function insertSchedule(db, id, workspaceId, workflowId, startAt, createdAt, recurrence) {
  const endAt = new Date(Date.parse(startAt) + 30 * 60 * 1000).toISOString()
  db.prepare(`
    INSERT INTO calendar_events
      (id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, source_ref, all_day, workflow_id, recurrence, created_at, updated_at)
    VALUES (?, ?, '错过', ?, ?, 'Asia/Shanghai', NULL, 'reminder', '{}', NULL, 0, ?, ?, ?, ?)
  `).run(id, workspaceId, startAt, endAt, workflowId, recurrence, createdAt, createdAt)
}

async function waitForTerminal(db, runId) {
  const started = Date.now()
  while (Date.now() - started < 8000) {
    const row = db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(runId)
    if (row && row.state !== 'queued' && row.state !== 'running') return row.state
    await new Promise((resolve) => setImmediate(resolve))
  }
  return db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(runId)?.state
}

function runtime() {
  const calls = []
  return {
    calls,
    aiRuntime: {
      status: () => ({ connected: true }),
      origin: 'http://127.0.0.1:9',
      cookie: 'c',
      dshHome: '/tmp/fde-x-schedule-unused',
      async call(endpoint) {
        calls.push(endpoint)
        return { sessionId: 'session-should-not' }
      },
      async *stream() {
        yield { type: 'event', event: { type: 'turn/end' } }
      },
    },
  }
}

test('工作台关闭期间错过的触发点记为错过且不跑', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-miss-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_miss')
    insertWorkflow(db, 'wf_miss', 'ws_miss')
    const now = new Date()
    const bootedAt = now
    const startAt = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_miss', 'ws_miss', 'wf_miss', startAt, createdAt, 'once')
    const clock = { now, bootedAt }
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    const rows = db.prepare('SELECT state, output_json FROM workflow_runs WHERE workflow_id = ?').all('wf_miss')
    assert.equal(rows.length, 1)
    assert.equal(JSON.parse(rows[0].output_json).message, '错过')
    assert.equal(calls.includes('session/create'), false)
    assert.equal(calls.length, 0)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('每天固定时间在关闭期间的每个触发点各记一次错过', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-daily-miss-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_daily')
    insertWorkflow(db, 'wf_daily', 'ws_daily')
    const now = new Date()
    const bootedAt = now
    const startAt = new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_daily', 'ws_daily', 'wf_daily', startAt, startAt, 'daily')
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt })
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt })
    const rows = db.prepare('SELECT output_json FROM workflow_runs WHERE workflow_id = ? ORDER BY schedule_key').all('wf_daily')
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map((row) => JSON.parse(row.output_json).message), ['错过', '错过', '错过'])
    assert.equal(calls.length, 0)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('同一个触发点再 tick 一次不会再开会话', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-once-repeat-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_once')
    insertWorkflow(db, 'wf_once', 'ws_once')
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_once', 'ws_once', 'wf_once', startAt, createdAt, 'once')
    const clock = { now, bootedAt }
    const first = await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(first.started.length, 1)
    await waitForTerminal(db, first.started[0].id)
    const second = await tickWorkflowSchedules({ db, aiRuntime }, clock)
    if (second.started[0]) await waitForTerminal(db, second.started[0].id)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflow_runs WHERE workflow_id = ?').get('wf_once').n, 1)
    assert.equal(calls.filter((endpoint) => endpoint === 'session/create').length > 1, false)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

async function readWorkflows(db, workspaceId) {
  let status = 0
  let raw = ''
  const response = {
    writeHead(code) { status = code },
    end(body) { raw = body || '' },
  }
  const url = new URL(`/api/v1/plan/workflows?workspaceId=${workspaceId}`, 'http://127.0.0.1')
  await handlePlanRequest({ method: 'GET', headers: {} }, response, url, {
    db,
    enqueueEvent() {},
    readJson: async () => ({}),
    aiRuntime: null,
  }, 'corr_hist')
  return { status, body: JSON.parse(raw) }
}

test('错过写在 workflow_runs 里，列表直接读出这条历史', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-hist-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_hist')
    insertWorkflow(db, 'wf_hist', 'ws_hist')
    const now = new Date()
    const startAt = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_hist', 'ws_hist', 'wf_hist', startAt, createdAt, 'once')
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt: now })
    const stored = db.prepare('SELECT id FROM workflow_runs WHERE workflow_id = ?').get('wf_hist')
    const listed = await readWorkflows(db, 'ws_hist')
    const card = listed.body.data.find((row) => row.id === 'wf_hist')
    assert.equal(listed.status, 200)
    assert.deepEqual(card.runs, [{
      id: stored.id,
      state: 'cancelled',
      message: '错过',
    }])
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('保存工作流时记下已确认的直接执行工具', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-confirm-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_confirm')
  try {
    let status = 0
    let raw = ''
    const response = {
      writeHead(code) { status = code },
      end(body) { raw = body || '' },
    }
    await handlePlanRequest({ method: 'POST', headers: {} }, response, new URL('/api/v1/plan/workflows', 'http://127.0.0.1'), {
      db,
      enqueueEvent() {},
      readJson: async () => ({
        workspaceId: 'ws_confirm',
        name: '确认流',
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '只查询' } }],
        confirmDanger: ['bash'],
      }),
      aiRuntime: null,
    }, 'corr_confirm')
    assert.equal(status, 201, raw)
    const stored = db.prepare('SELECT definition_json FROM workflows WHERE id = ?').get(JSON.parse(raw).data.id)
    assert.deepEqual(JSON.parse(stored.definition_json).confirmedDanger, ['bash'])
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('两个连接同时 tick 同一个触发点只留下一条运行', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-two-${process.pid}.sqlite`)
  const dbA = openDatabase(dbPath, migrations)
  const dbB = openDatabase(dbPath, migrations)
  const first = runtime()
  const second = runtime()
  try {
    insertWorkspace(dbA, 'ws_two')
    insertWorkflow(dbA, 'wf_two', 'ws_two')
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(dbA, 'cevt_two', 'ws_two', 'wf_two', startAt, createdAt, 'once')
    const clock = { now, bootedAt }
    await Promise.all([
      tickWorkflowSchedules({ db: dbA, aiRuntime: first.aiRuntime }, clock),
      tickWorkflowSchedules({ db: dbB, aiRuntime: second.aiRuntime }, clock),
    ])
    const rows = dbA.prepare('SELECT id FROM workflow_runs WHERE workflow_id = ?').all('wf_two')
    assert.equal(rows.length, 1)
    const calls = [...first.calls, ...second.calls].filter((endpoint) => endpoint === 'session/create')
    assert.equal(calls.length <= 1, true)
  } finally {
    dbA.close()
    dbB.close()
    await rm(dbPath, { force: true })
  }
})
