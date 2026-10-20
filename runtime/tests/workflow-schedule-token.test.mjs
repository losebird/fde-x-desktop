import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { mintUiToken } from '../routes/bridge.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

function insertWorkspace(db, id) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', '{}', ?, ?)
  `).run(id, id, now, now)
}

function insertBoundEvent(db, id) {
  const now = new Date().toISOString()
  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  db.prepare(`
    INSERT INTO calendar_events
      (id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, source_ref, all_day, workflow_id, recurrence, created_at, updated_at)
    VALUES (?, 'ws_tok', '原标题', ?, ?, 'Asia/Shanghai', NULL, 'reminder', '{}', NULL, 0, 'wf_tok', 'once', ?, ?)
  `).run(id, start, end, now, now)
}

function insertWorkflow(db) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES ('wf_tok', 'ws_tok', '令牌流', 'active', ?, ?, 1, ?, ?)
  `).run(JSON.stringify({ kind: 'manual' }), JSON.stringify({ steps: [] }), now, now)
}

async function call(db, method, path, body, auth = {}) {
  const header = typeof auth === 'string' ? auth : auth.header
  const uiToken = typeof auth === 'string' ? auth : auth.uiToken
  let status = 0
  let raw = ''
  const response = {
    writeHead(code) { status = code },
    end(payload) { raw = payload || '' },
  }
  const url = new URL(path, 'http://127.0.0.1')
  const headers = header ? { 'x-fde-ui-token': header } : {}
  await handlePlanRequest({ method, headers }, response, url, {
    db,
    enqueueEvent() {},
    readJson: async () => body,
    aiRuntime: null,
    uiToken,
  }, 'corr_tok')
  return { status, body: raw ? JSON.parse(raw) : null }
}

function counts(db) {
  return {
    events: db.prepare('SELECT COUNT(*) AS n FROM calendar_events').get().n,
    audits: db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get().n,
  }
}

test('没有页面令牌时不能创建绑定工作流的日程', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-token-post-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_tok')
  try {
    const before = counts(db)
    const created = await call(db, 'POST', '/api/v1/plan/events', {
      workspaceId: 'ws_tok',
      title: '到点',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      workflowId: 'wf_tok',
      recurrence: 'once',
    }, { uiToken: mintUiToken() })
    const after = counts(db)
    assert.equal(created.status, 401)
    assert.equal(after.events, before.events)
    assert.equal(after.audits, before.audits)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('没有页面令牌时不能修改已绑定工作流的日程', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-token-patch-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_tok')
  insertBoundEvent(db, 'cevt_tok')
  try {
    const before = counts(db)
    const patched = await call(db, 'PATCH', '/api/v1/plan/events/cevt_tok', { title: '改过', workspaceId: 'ws_tok' }, { uiToken: mintUiToken() })
    const after = counts(db)
    const title = db.prepare('SELECT title FROM calendar_events WHERE id = ?').get('cevt_tok').title
    assert.equal(patched.status, 401)
    assert.equal(title, '原标题')
    assert.equal(after.events, before.events)
    assert.equal(after.audits, before.audits)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('没有页面令牌时不能删除已绑定工作流的日程', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-token-del-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_tok')
  insertBoundEvent(db, 'cevt_tok')
  try {
    const before = counts(db)
    const removed = await call(db, 'DELETE', '/api/v1/plan/events/cevt_tok?workspaceId=ws_tok', {}, { uiToken: mintUiToken() })
    const after = counts(db)
    const left = db.prepare('SELECT COUNT(*) AS n FROM calendar_events WHERE id = ?').get('cevt_tok').n
    assert.equal(removed.status, 401)
    assert.equal(left, 1)
    assert.equal(after.events, before.events)
    assert.equal(after.audits, before.audits)
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('带页面令牌时创建、修改、删除绑定都会写入并留下审计', async () => {
  const dbPath = join(tmpdir(), `fde-x-schedule-token-ok-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const token = mintUiToken()
  insertWorkspace(db, 'ws_tok')
  insertWorkflow(db)
  try {
    const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const endAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const created = await call(db, 'POST', '/api/v1/plan/events', {
      workspaceId: 'ws_tok',
      title: '到点',
      startAt,
      endAt,
      workflowId: 'wf_tok',
      recurrence: 'once',
    }, token)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.data.workflowId, 'wf_tok')
    assert.equal(created.body.data.recurrence, 'once')
    const id = created.body.data.id
    const stored = db.prepare('SELECT workflow_id, recurrence FROM calendar_events WHERE id = ?').get(id)
    assert.equal(stored.workflow_id, 'wf_tok')
    assert.equal(stored.recurrence, 'once')
    assert.equal(db.prepare(`SELECT action FROM audit_entries WHERE target_ref = ? AND action = 'plan.event.insert'`).get(`fde://plan/events/${id}`).action, 'plan.event.insert')

    const patched = await call(db, 'PATCH', `/api/v1/plan/events/${id}`, {
      workspaceId: 'ws_tok',
      workflowId: 'wf_tok',
      recurrence: 'daily',
    }, token)
    assert.equal(patched.status, 200, JSON.stringify(patched.body))
    assert.equal(patched.body.data.recurrence, 'daily')
    assert.equal(db.prepare('SELECT recurrence FROM calendar_events WHERE id = ?').get(id).recurrence, 'daily')
    assert.equal(db.prepare(`SELECT action FROM audit_entries WHERE target_ref = ? AND action = 'plan.event.update'`).get(`fde://plan/events/${id}`).action, 'plan.event.update')

    const removed = await call(db, 'DELETE', `/api/v1/plan/events/${id}?workspaceId=${encodeURIComponent('ws_tok')}`, {}, token)
    assert.equal(removed.status, 200)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM calendar_events WHERE id = ?').get(id).n, 0)
    assert.equal(db.prepare(`SELECT action FROM audit_entries WHERE target_ref = ? AND action = 'plan.event.delete'`).get(`fde://plan/events/${id}`).action, 'plan.event.delete')
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})
