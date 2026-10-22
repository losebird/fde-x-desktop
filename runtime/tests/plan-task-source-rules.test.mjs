import './support/no-stray-processes.mjs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../db.mjs'
import { proposePlanTask } from '../plan/task-proposals.mjs'
import { insertTask } from '../plan/task-store.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

function db() {
  const dir = mkdtempSync(join(tmpdir(), 'fde-task-source-'))
  const database = openDatabase(join(dir, 'core.sqlite'), migrations)
  database.__dir = dir
  return database
}

function close(database) {
  database.close()
  rmSync(database.__dir, { recursive: true, force: true })
}

test('propose rejects an illegal sourceRef and keeps a biz ref on insert and update', () => {
  const database = db()
  try {
    const bad = proposePlanTask(database, {
      op: 'insert',
      workspaceId: 'ws_personal',
      title: '跟进',
      sourceRef: 'memory:aa',
    })
    assert.equal(bad.ok, false)
    assert.equal(bad.error, 'invalid_source_ref')

    const created = proposePlanTask(database, {
      op: 'insert',
      workspaceId: 'ws_personal',
      title: '跟进采购单',
      sourceRef: 'biz:采购单:PO-2026-001',
    })
    assert.equal(created.ok, true, JSON.stringify(created))
    assert.equal(created.plan.change.sourceRef, 'biz:采购单:PO-2026-001')

    insertTask(database, {
      id: 'task_existing',
      workspaceId: 'ws_personal',
      title: '旧标题',
      notes: '',
      status: 'todo',
      priority: 'med',
      dueAt: null,
      sourceRef: 'fde-task:task_existing',
      tags: [],
    })
    const updated = proposePlanTask(database, {
      op: 'update',
      workspaceId: 'ws_personal',
      taskId: 'task_existing',
      sourceRef: 'im:req_9',
    })
    assert.equal(updated.ok, true, JSON.stringify(updated))
    assert.equal(updated.plan.change.sourceRef, 'im:req_9')

    const rejected = proposePlanTask(database, {
      op: 'update',
      workspaceId: 'ws_personal',
      taskId: 'task_existing',
      sourceRef: 'app:orders',
    })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.error, 'invalid_source_ref')
  } finally {
    close(database)
  }
})
