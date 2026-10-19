import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'
import { tickWorkflowSchedules } from '../plan/workflow-schedule.mjs'
import { failInterruptedRuns } from '../plan/workflow-run.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

const PAUSED_MESSAGE = '工作流已暂停，未运行'
const BUSY_MESSAGE = '上一次运行还没结束，未运行'
const VALIDATION_MESSAGE = 'AI 步骤的提示不能为空'

const GOOD_DEFINITION = {
  steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '只查询', tools: ['fde_app_records_query'] } }],
}

const BAD_DEFINITION = {
  steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '' } }],
}

function insertWorkspace(db, id) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', '{}', ?, ?)
  `).run(id, id, now, now)
}

function insertWorkflow(db, id, workspaceId, status = 'active', definition = GOOD_DEFINITION) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '定时流', ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    status,
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify(definition),
    now,
    now,
  )
}

function insertSchedule(db, id, workspaceId, workflowId, startAt, createdAt, recurrence, timezone = 'Asia/Shanghai') {
  const endAt = new Date(Date.parse(startAt) + 30 * 60 * 1000).toISOString()
  db.prepare(`
    INSERT INTO calendar_events
      (id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, source_ref, all_day, workflow_id, recurrence, created_at, updated_at)
    VALUES (?, ?, '定时', ?, ?, ?, NULL, 'reminder', '{}', NULL, 0, ?, ?, ?, ?)
  `).run(id, workspaceId, startAt, endAt, timezone, workflowId, recurrence, createdAt, createdAt)
}

function insertOpenRun(db, {
  id,
  workflowId,
  state,
  scheduleKey,
  triggerJson,
  correlationId,
  createdAt,
}) {
  const at = createdAt || new Date().toISOString()
  db.prepare(`
    INSERT INTO workflow_runs
      (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at, schedule_key)
    VALUES (?, ?, ?, ?, '{}', NULL, ?, ?, NULL, ?, ?)
  `).run(id, workflowId, state, triggerJson, correlationId, at, at, scheduleKey)
}

function runtime() {
  const calls = []
  return {
    calls,
    aiRuntime: {
      status: () => ({ connected: true }),
      origin: 'http://127.0.0.1:9',
      cookie: 'c',
      dshHome: '/tmp/fde-x-schedule-due-unused',
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
  }, 'corr_due_list')
  return { status, body: JSON.parse(raw) }
}

function countRuns(db, workflowId) {
  return db.prepare('SELECT COUNT(*) AS n FROM workflow_runs WHERE workflow_id = ?').get(workflowId).n
}

function scheduleKeyRows(db, workflowId) {
  return db.prepare('SELECT * FROM workflow_runs WHERE workflow_id = ? AND schedule_key IS NOT NULL').all(workflowId)
}

function assertNoSession(calls) {
  assert.equal(calls.includes('session/create'), false)
  assert.equal(calls.length, 0)
}

test('暂停工作流在启动窗口内记一次跳过且列表带 eventId', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-paused-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_p1')
    insertWorkflow(db, 'wf_p1', 'ws_p1', 'paused')
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_p1', 'ws_p1', 'wf_p1', startAt, createdAt, 'once')
    const clock = { now, bootedAt }
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    let rows = db.prepare('SELECT state, output_json, schedule_key, trigger_json FROM workflow_runs WHERE workflow_id = ?').all('wf_p1')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].state, 'cancelled')
    assert.equal(JSON.parse(rows[0].output_json).message, PAUSED_MESSAGE)
    const trigger = JSON.parse(rows[0].trigger_json)
    assert.equal(rows[0].schedule_key, `cevt_p1@${trigger.occurrence}`)
    assertNoSession(calls)

    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(countRuns(db, 'wf_p1'), 1)

    db.prepare(`UPDATE workflows SET status = 'active' WHERE id = ?`).run('wf_p1')
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    rows = db.prepare('SELECT output_json FROM workflow_runs WHERE workflow_id = ?').all('wf_p1')
    assert.equal(rows.length, 1)
    assert.equal(JSON.parse(rows[0].output_json).message, PAUSED_MESSAGE)
    assertNoSession(calls)

    const listed = await readWorkflows(db, 'ws_p1')
    const card = listed.body.data.find((row) => row.id === 'wf_p1')
    assert.equal(listed.status, 200)
    const stored = db.prepare('SELECT id FROM workflow_runs WHERE workflow_id = ?').get('wf_p1')
    assert.deepEqual(card.runs, [{
      id: stored.id,
      state: 'cancelled',
      message: PAUSED_MESSAGE,
      eventId: 'cevt_p1',
    }])
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('暂停工作流在关闭期间只记暂停跳过，不记错过', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-paused-miss-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_p2')
    insertWorkflow(db, 'wf_p2', 'ws_p2', 'paused')
    const now = new Date()
    const bootedAt = now
    const startAt = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_p2', 'ws_p2', 'wf_p2', startAt, createdAt, 'once')
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt })
    const rows = db.prepare('SELECT output_json FROM workflow_runs WHERE workflow_id = ?').all('wf_p2')
    assert.equal(rows.length, 1)
    assert.equal(JSON.parse(rows[0].output_json).message, PAUSED_MESSAGE)
    assertNoSession(calls)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('每天暂停在关闭期间每个触发点各记一次暂停跳过', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-paused-daily-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_p3')
    insertWorkflow(db, 'wf_p3', 'ws_p3', 'paused')
    const now = new Date()
    const bootedAt = now
    const startAt = new Date(now.getTime() - 50 * 60 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_p3', 'ws_p3', 'wf_p3', startAt, startAt, 'daily')
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt })
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt })
    const rows = db.prepare('SELECT output_json FROM workflow_runs WHERE workflow_id = ? ORDER BY schedule_key').all('wf_p3')
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map((row) => JSON.parse(row.output_json).message), [PAUSED_MESSAGE, PAUSED_MESSAGE, PAUSED_MESSAGE])
    assertNoSession(calls)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('忙碌在宽限内不消费触发点，结束后可正常开跑', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-busy-grace-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_bg')
    insertWorkflow(db, 'wf_bg', 'ws_bg', 'active')
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 10 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_bg', 'ws_bg', 'wf_bg', startAt, createdAt, 'once')
    const runAt = now.toISOString()
    insertOpenRun(db, {
      id: 'wfr_manual_open',
      workflowId: 'wf_bg',
      state: 'running',
      scheduleKey: null,
      triggerJson: JSON.stringify({ kind: 'manual' }),
      correlationId: 'manual-open',
      createdAt: runAt,
    })
    const clock = { now, bootedAt }
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(scheduleKeyRows(db, 'wf_bg').length, 0)
    assertNoSession(calls)

    const finishedAt = new Date().toISOString()
    db.prepare(`UPDATE workflow_runs SET state = 'succeeded', finished_at = ? WHERE id = ?`).run(finishedAt, 'wfr_manual_open')
    const second = await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(second.started.length, 1)
    assert.equal(scheduleKeyRows(db, 'wf_bg').length, 1)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('忙碌超过宽限记一次忙碌跳过且不重复', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-busy-past-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_bp')
    insertWorkflow(db, 'wf_bp', 'ws_bp', 'active')
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 31 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_bp', 'ws_bp', 'wf_bp', startAt, createdAt, 'once')
    insertOpenRun(db, {
      id: 'wfr_manual_busy',
      workflowId: 'wf_bp',
      state: 'running',
      scheduleKey: null,
      triggerJson: JSON.stringify({ kind: 'manual' }),
      correlationId: 'manual-open',
      createdAt: now.toISOString(),
    })
    const clock = { now, bootedAt }
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    const keyed = scheduleKeyRows(db, 'wf_bp')
    assert.equal(keyed.length, 1)
    assert.equal(keyed[0].state, 'cancelled')
    assert.equal(JSON.parse(keyed[0].output_json).message, BUSY_MESSAGE)
    const manual = db.prepare(`SELECT state FROM workflow_runs WHERE id = ?`).get('wfr_manual_busy')
    assert.equal(manual.state, 'running')
    assertNoSession(calls)

    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(scheduleKeyRows(db, 'wf_bp').length, 1)
    assertNoSession(calls)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('单个坏工作流不会拖垮整次 tick', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-isolate-bad-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  const logged = []
  const originalError = console.error
  console.error = (...args) => { logged.push(args) }
  try {
    insertWorkspace(db, 'ws_iso')
    insertWorkflow(db, 'wf_bad', 'ws_iso', 'active', BAD_DEFINITION)
    insertWorkflow(db, 'wf_good', 'ws_iso', 'active', GOOD_DEFINITION)
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_aaa_bad', 'ws_iso', 'wf_bad', startAt, createdAt, 'once')
    insertSchedule(db, 'cevt_zzz_good', 'ws_iso', 'wf_good', startAt, createdAt, 'once')
    const clock = { now, bootedAt }
    const first = await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(countRuns(db, 'wf_good'), 1)
    assert.equal(first.started.some((row) => row.workflowId === 'wf_good'), true)
    const badRows = db.prepare('SELECT state, output_json FROM workflow_runs WHERE workflow_id = ?').all('wf_bad')
    assert.equal(badRows.length, 1)
    assert.equal(badRows[0].state, 'failed')
    assert.equal(JSON.parse(badRows[0].output_json).message, VALIDATION_MESSAGE)
    assert.equal(logged.length, 0)

    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(countRuns(db, 'wf_good'), 1)
    assert.equal(countRuns(db, 'wf_bad'), 1)
    assert.equal(logged.length, 0)
  } finally {
    console.error = originalError
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('未知错误被隔离并记录，不写失败行', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-unknown-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { aiRuntime } = runtime()
  const logged = []
  const originalError = console.error
  console.error = (...args) => { logged.push(args) }
  try {
    insertWorkspace(db, 'ws_unk')
    insertWorkflow(db, 'wf_tz_bad', 'ws_unk', 'active')
    insertWorkflow(db, 'wf_tz_good', 'ws_unk', 'active')
    const now = new Date()
    const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
    const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_tz_bad', 'ws_unk', 'wf_tz_bad', startAt, createdAt, 'daily', 'Not/AZone')
    insertSchedule(db, 'cevt_tz_good', 'ws_unk', 'wf_tz_good', startAt, createdAt, 'once', 'Asia/Shanghai')
    const clock = { now, bootedAt }
    const first = await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.equal(countRuns(db, 'wf_tz_good'), 1)
    assert.equal(first.started.some((row) => row.workflowId === 'wf_tz_good'), true)
    assert.equal(countRuns(db, 'wf_tz_bad'), 0)
    assert.ok(logged.length >= 1)

    const beforeSecond = logged.length
    await tickWorkflowSchedules({ db, aiRuntime }, clock)
    assert.ok(logged.length > beforeSecond)
    assert.equal(countRuns(db, 'wf_tz_bad'), 0)
  } finally {
    console.error = originalError
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('重启不会重跑已记下的定时运行 (i) 已有 schedule_key 的运行', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-restart-i-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_r1')
    insertWorkflow(db, 'wf_r1', 'ws_r1', 'active')
    const occurrenceMs = Date.now() - 2 * 60 * 1000
    const startAt = new Date(occurrenceMs).toISOString()
    const createdAt = new Date(occurrenceMs - 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_r1', 'ws_r1', 'wf_r1', startAt, createdAt, 'once')
    const scheduleKey = `cevt_r1@${startAt}`
    insertOpenRun(db, {
      id: 'wfr_sched_running',
      workflowId: 'wf_r1',
      state: 'running',
      scheduleKey,
      triggerJson: JSON.stringify({ kind: 'schedule', eventId: 'cevt_r1', occurrence: startAt }),
      correlationId: `schedule:cevt_r1:${startAt}`,
      createdAt: startAt,
    })
    failInterruptedRuns(db)
    const failed = db.prepare(`SELECT state FROM workflow_runs WHERE id = ?`).get('wfr_sched_running')
    assert.equal(failed.state, 'failed')

    const now = new Date(occurrenceMs + 1000)
    const bootedAt = now
    await tickWorkflowSchedules({ db, aiRuntime }, { now, bootedAt })
    assert.equal(countRuns(db, 'wf_r1'), 1)
    const row = db.prepare(`SELECT state FROM workflow_runs WHERE id = ?`).get('wfr_sched_running')
    assert.equal(row.state, 'failed')
    assertNoSession(calls)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('重启不会重跑已记下的定时运行 (ii) 宽限内忙碌后记错过', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-due-restart-ii-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { calls, aiRuntime } = runtime()
  try {
    insertWorkspace(db, 'ws_r2')
    insertWorkflow(db, 'wf_r2', 'ws_r2', 'active')
    const now2 = new Date()
    const bootedAtFirst = new Date(now2.getTime() - 5 * 60 * 1000)
    const startAt = new Date(now2.getTime() - 60 * 1000).toISOString()
    const createdAt = new Date(now2.getTime() - 2 * 60 * 1000).toISOString()
    insertSchedule(db, 'cevt_r2', 'ws_r2', 'wf_r2', startAt, createdAt, 'once')
    insertOpenRun(db, {
      id: 'wfr_manual_r2',
      workflowId: 'wf_r2',
      state: 'running',
      scheduleKey: null,
      triggerJson: JSON.stringify({ kind: 'manual' }),
      correlationId: 'manual-open',
      createdAt: now2.toISOString(),
    })
    await tickWorkflowSchedules({ db, aiRuntime }, { now: now2, bootedAt: bootedAtFirst })
    assert.equal(scheduleKeyRows(db, 'wf_r2').length, 0)

    failInterruptedRuns(db)
    const bootedAtSecond = now2
    await tickWorkflowSchedules({ db, aiRuntime }, { now: now2, bootedAt: bootedAtSecond })
    const keyed = scheduleKeyRows(db, 'wf_r2')
    assert.equal(keyed.length, 1)
    assert.equal(keyed[0].state, 'cancelled')
    assert.equal(JSON.parse(keyed[0].output_json).message, '错过')
    assert.equal(countRuns(db, 'wf_r2'), 2)
    assertNoSession(calls)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})
