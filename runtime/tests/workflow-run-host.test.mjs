import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm } from 'node:fs/promises'
import { openDatabase } from '../db.mjs'
import { startWorkflowRun } from '../plan/workflow-run.mjs'
import { bootWorkflowHost, waitForProbe } from './support/workflow-host.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')
const MISMATCH = '工作流会话可见工具不是查询和提案这三项，未运行'

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify({ cwd }), now, now)
}

function insertWorkflow(db, id, workspaceId) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '验收流', 'paused', ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify({ steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '汇总这条记录' } }] }),
    now,
    now,
  )
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

async function waitForTerminal(db, runId) {
  const started = Date.now()
  while (Date.now() - started < 8000) {
    const row = db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(runId)
    if (row && row.state !== 'queued' && row.state !== 'running') return row.state
    await new Promise((resolve) => setImmediate(resolve))
  }
  return db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(runId)?.state
}

test('限制没有生效时 run 从 queued 直接失败且不发送步骤', async () => {
  const host = await bootWorkflowHost({ leak: true })
  const dbPath = join(tmpdir(), `fde-x-workflow-host-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  try {
    await host.core.call('session/create', {
      request: { cwd: host.cwd, agentPreset: 'fde-workflow' },
    })
    const seen = await waitForProbe(host.probeDir, 'fde-workflow')
    assert.equal(seen.names.includes('workflow_leak'), true)

    insertWorkspace(db, 'ws_host', host.cwd)
    insertWorkflow(db, 'wf_host', 'ws_host')
    installTrace(db)
    const calls = []
    const call = host.core.call.bind(host.core)
    host.core.call = async (endpoint, args, signal) => {
      calls.push(endpoint)
      return call(endpoint, args, signal)
    }
    host.core.stream = async function* () {
      yield { type: 'event', event: { type: 'turn/end' } }
    }

    const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
      workflowId: 'wf_host',
      workspaceId: 'ws_host',
      correlationId: 'corr_host',
      trigger: { kind: 'manual' },
    })
    assert.equal(ticket.state, 'queued')
    await waitForTerminal(db, ticket.id)

    assert.equal(calls.includes('session/prompt'), false)
    assert.deepEqual(
      db.prepare('SELECT state FROM run_state_trace WHERE run_id = ? ORDER BY id').all(ticket.id).map((row) => row.state),
      ['failed'],
    )
    const step = db.prepare('SELECT state, error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
    assert.equal(step.state, 'failed')
    assert.equal(JSON.parse(step.error_json).message, MISMATCH)
    const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
    assert.equal(run.state, 'failed')
    assert.equal(run.output_json, null)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
    await host.stop()
  }
})
