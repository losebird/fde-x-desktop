import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { tickWorkflowSchedules } from '../plan/workflow-schedule.mjs'
import { bootWorkflowHost, waitForProbe } from './support/workflow-host.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')
const TOOLS = ['fde_app_records_query']

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify({ cwd }), now, now)
}

function insertDangerWorkflow(db, id, workspaceId, confirmed) {
  const now = new Date().toISOString()
  const definition = {
    steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '列出目录', tools: ['bash'] } }],
  }
  if (confirmed) definition.confirmedDanger = ['bash']
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '到点执行', 'active', ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify(definition),
    now,
    now,
  )
}

function insertWorkflow(db, id, workspaceId) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '到点查询', 'active', ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify({
      steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '只查询这条记录', tools: TOOLS } }],
    }),
    now,
    now,
  )
}

function insertSchedule(db, id, workspaceId, workflowId, startAt, createdAt) {
  const endAt = new Date(Date.parse(startAt) + 30 * 60 * 1000).toISOString()
  db.prepare(`
    INSERT INTO calendar_events
      (id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, source_ref, all_day, workflow_id, recurrence, created_at, updated_at)
    VALUES (?, ?, '到点跑', ?, ?, 'Asia/Shanghai', NULL, 'reminder', '{}', NULL, 0, ?, 'once', ?, ?)
  `).run(id, workspaceId, startAt, endAt, workflowId, createdAt, createdAt)
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

describe('日程到点跑受限工作流', { concurrency: 1 }, () => {
  test('真 pin 上到点触发一次受限运行，可见工具等于清单', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-schedule-due-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      host.core.stream = async function* () {
        yield { type: 'event', event: { type: 'turn/end' } }
      }
      const now = new Date()
      const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
      const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
      const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      insertWorkspace(db, 'ws_sched', host.cwd)
      insertWorkflow(db, 'wf_sched', 'ws_sched')
      insertSchedule(db, 'cevt_sched', 'ws_sched', 'wf_sched', startAt, createdAt)

      const result = await tickWorkflowSchedules({ db, aiRuntime: host.core }, { now, bootedAt })
      assert.equal(result.started.length, 1)
      const runId = result.started[0].id
      assert.equal(await waitForTerminal(db, runId), 'succeeded')
      const run = db.prepare('SELECT output_json, trigger_json FROM workflow_runs WHERE id = ?').get(runId)
      const output = JSON.parse(run.output_json)
      const trigger = JSON.parse(run.trigger_json)
      assert.equal(trigger.kind, 'schedule')
      assert.equal(trigger.eventId, 'cevt_sched')
      const seen = await waitForProbe(host.probeDir, output.sessionId)
      assert.deepEqual(seen.names, TOOLS)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflow_runs WHERE workflow_id = ?').get('wf_sched').n, 1)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('重复 tick 不重复跑', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-schedule-repeat-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      const calls = []
      const call = host.core.call.bind(host.core)
      host.core.call = async (endpoint, args, signal) => {
        calls.push(endpoint)
        return call(endpoint, args, signal)
      }
      host.core.stream = async function* () {
        yield { type: 'event', event: { type: 'turn/end' } }
      }
      const now = new Date()
      const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
      const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
      const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      insertWorkspace(db, 'ws_repeat', host.cwd)
      insertWorkflow(db, 'wf_repeat', 'ws_repeat')
      insertSchedule(db, 'cevt_repeat', 'ws_repeat', 'wf_repeat', startAt, createdAt)
      const clock = { now, bootedAt }
      const first = await tickWorkflowSchedules({ db, aiRuntime: host.core }, clock)
      assert.equal(first.started.length, 1)
      assert.equal(await waitForTerminal(db, first.started[0].id), 'succeeded')
      const second = await tickWorkflowSchedules({ db, aiRuntime: host.core }, clock)
      if (second.started[0]) await waitForTerminal(db, second.started[0].id)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflow_runs WHERE workflow_id = ?').get('wf_repeat').n, 1)
      assert.equal(calls.filter((endpoint) => endpoint === 'session/create').length, 1)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('没有确认的危险工具在定时触发时失败关闭', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-schedule-danger-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      const calls = []
      const call = host.core.call.bind(host.core)
      host.core.call = async (endpoint, args, signal) => {
        calls.push(endpoint)
        return call(endpoint, args, signal)
      }
      host.core.stream = async function* () {
        yield { type: 'event', event: { type: 'turn/end' } }
      }
      const now = new Date()
      const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
      const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
      const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      insertWorkspace(db, 'ws_danger', host.cwd)
      insertDangerWorkflow(db, 'wf_danger', 'ws_danger')
      insertSchedule(db, 'cevt_danger', 'ws_danger', 'wf_danger', startAt, createdAt)
      const result = await tickWorkflowSchedules({ db, aiRuntime: host.core }, { now, bootedAt })
      assert.equal(result.started.length, 1)
      assert.equal(await waitForTerminal(db, result.started[0].id), 'failed')
      const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(result.started[0].id)
      assert.equal(JSON.parse(step.error_json).message, '直接执行的工具需要逐项确认')
      assert.equal(calls.includes('session/create'), false)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('已确认的危险工具在定时触发时仍走受限运行', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-schedule-danger-ok-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      const calls = []
      const call = host.core.call.bind(host.core)
      host.core.call = async (endpoint, args, signal) => {
        calls.push(endpoint)
        return call(endpoint, args, signal)
      }
      host.core.stream = async function* () {
        yield { type: 'event', event: { type: 'turn/end' } }
      }
      const now = new Date()
      const bootedAt = new Date(now.getTime() - 5 * 60 * 1000)
      const startAt = new Date(now.getTime() - 60 * 1000).toISOString()
      const createdAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
      insertWorkspace(db, 'ws_danger_ok', host.cwd)
      insertDangerWorkflow(db, 'wf_danger_ok', 'ws_danger_ok', true)
      insertSchedule(db, 'cevt_danger_ok', 'ws_danger_ok', 'wf_danger_ok', startAt, createdAt)
      const result = await tickWorkflowSchedules({ db, aiRuntime: host.core }, { now, bootedAt })
      assert.equal(result.started.length, 1)
      assert.equal(await waitForTerminal(db, result.started[0].id), 'succeeded')
      const run = db.prepare('SELECT output_json FROM workflow_runs WHERE id = ?').get(result.started[0].id)
      const seen = await waitForProbe(host.probeDir, JSON.parse(run.output_json).sessionId)
      assert.deepEqual(seen.names, ['bash'])
      assert.equal(calls.filter((endpoint) => endpoint === 'session/create').length, 1)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })
})
