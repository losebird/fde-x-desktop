import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { readPlanHistory } from '../plan/history.mjs'

test('failed workflow history shows the step error, not just failed', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE workflows (id TEXT, workspace_id TEXT, name TEXT);
    CREATE TABLE audit_entries (
      id TEXT, workspace_id TEXT, actor_id TEXT, action TEXT, target_ref TEXT,
      outcome TEXT, risk_level TEXT, correlation_id TEXT, details_json TEXT, occurred_at TEXT
    );
    CREATE TABLE workflow_runs (
      id TEXT, workflow_id TEXT, state TEXT, trigger_json TEXT, input_json TEXT,
      output_json TEXT, correlation_id TEXT, started_at TEXT, finished_at TEXT, created_at TEXT, schedule_key TEXT
    );
    CREATE TABLE workflow_run_steps (
      id TEXT, run_id TEXT, step_key TEXT, sequence_no TEXT, state TEXT,
      input_json TEXT, output_json TEXT, error_json TEXT, started_at TEXT, finished_at TEXT
    );
  `)
  db.prepare('INSERT INTO workflows (id, workspace_id, name) VALUES (?, ?, ?)').run('wf_1', 'ws_1', '等待流')
  db.prepare(`
    INSERT INTO workflow_runs
      (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at, schedule_key)
    VALUES ('wfr_1', 'wf_1', 'failed', '{"kind":"manual"}', '{}', NULL, 'c1', NULL, '2026-11-03T07:38:08.323Z', '2026-11-03T07:38:08.320Z', NULL)
  `).run()
  db.prepare(`
    INSERT INTO workflow_run_steps
      (id, run_id, step_key, sequence_no, state, input_json, output_json, error_json, started_at, finished_at)
    VALUES ('wrs_1', 'wfr_1', 's_wait', '1', 'failed', '{}', NULL, ?, NULL, '2026-11-03T07:38:08.323Z')
  `).run(JSON.stringify({ message: '没有可执行的 ai 步骤' }))

  const result = readPlanHistory(db, { workspaceId: 'ws_1', targetRef: 'fde://plan/workflows/wf_1' })
  assert.equal(result.error, undefined)
  const run = result.entries.find((entry) => entry.kind === 'run')
  assert.ok(run)
  assert.equal(run.run.state, 'failed')
  assert.equal(run.run.message, '没有可执行的 ai 步骤')
  db.close()
})
