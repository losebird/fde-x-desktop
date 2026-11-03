import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { readPlanUnattended, writePlanUnattended } from '../plan/unattended.mjs'

test('plan unattended defaults off and persists on the workspace', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_1', '测试', '', 'active', '{"cwd":"/tmp/a"}', 't', 't')
  `).run()
  assert.equal(readPlanUnattended(db, 'ws_1'), false)
  assert.equal(writePlanUnattended(db, 'ws_1', true), true)
  assert.equal(readPlanUnattended(db, 'ws_1'), true)
  const meta = JSON.parse(db.prepare('SELECT metadata_json FROM workspaces WHERE id = ?').get('ws_1').metadata_json)
  assert.equal(meta.cwd, '/tmp/a')
  assert.equal(meta.planUnattended, true)
  assert.equal(writePlanUnattended(db, 'ws_1', false), true)
  assert.equal(readPlanUnattended(db, 'ws_1'), false)
  db.close()
})
