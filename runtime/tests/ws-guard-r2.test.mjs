import './support/no-stray-processes.mjs'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { insertTask } from '../plan/task-store.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

function insertWebApp(db, id, workspaceId) {
  const now = new Date().toISOString()
  const spec = { spec: 'fde-web/v1', slug: 'shop', name: '店', _workspaceCwd: '/ws-guard-b' }
  db.prepare(`
    INSERT INTO business_apps (
      id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    ) VALUES (?, ?, '店', 'generated', 'draft', 1, ?, ?, ?)
  `).run(id, workspaceId, JSON.stringify(spec), now, now)
}

function insertOperation(db, id, state) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO operations (
      id, workspace_id, connection_id, app_id, requested_by, target_ref, action,
      operation_kind, risk_level, execution_mode, state, idempotency_key, expected_version,
      input_json, plan_json, correlation_id, causation_id, created_at, updated_at
    ) VALUES (?, 'ws_b', NULL, NULL, 'actor_local_user', 'fde://workstation/op', ?, 'write', 'low', 'dry_run', ?, ?, NULL, '{}', ?, ?, NULL, ?, ?)
  `).run(id, state.action, state.state, `idem-${id}`, state.plan || '{}', `corr-${id}`, now, now)
}

function insertEvent(db, id, title) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO calendar_events (
      id, workspace_id, title, start_at, end_at, timezone, event_kind, metadata_json, created_at, updated_at
    ) VALUES (?, 'ws_b', ?, '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 'Asia/Shanghai', 'meeting', '{}', ?, ?)
  `).run(id, title, now, now)
}

function insertWorkflow(db, id, name) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows (
      id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at
    ) VALUES (?, 'ws_b', ?, 'paused', '{}', '{}', 1, ?, ?)
  `).run(id, name, now, now)
}

async function startServer(dbPath) {
  const dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-guard-r2-'))
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_RUNTIME_SUPERVISED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  let base = ''
  let uiToken = ''
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const port = (stdout.match(/^FDE_LISTENING\s+(\d+)/m) || [])[1]
    uiToken = (stdout.match(/^FDE_UI_TOKEN\s+(\S+)/m) || [])[1] || ''
    if (port && uiToken) {
      base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  if (!base) {
    child.kill('SIGTERM')
    throw new Error(`runtime did not start: ${stderr.slice(0, 500)}\n${stdout.slice(0, 500)}`)
  }
  return {
    base,
    uiToken,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(50)
      await rm(dshHome, { recursive: true, force: true })
    },
  }
}

async function call(server, method, path, body) {
  const headers = {
    Origin: server.base,
    'x-fde-ui-token': server.uiToken,
  }
  let payload
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const response = await fetch(`${server.base}${path}`, { method, headers, body: payload })
  const text = await response.text()
  let parsed = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: response.status, payload: parsed }
}

function codeOf(payload) {
  if (payload?.error && typeof payload.error === 'object') return payload.error.code
  return payload?.error
}

test('store writes stay inside the app workspace', async () => {
  const dbPath = `/tmp/fde-ws-r2-store-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  insertWebApp(db, 'app_put', 'ws_b')
  insertWebApp(db, 'app_post', 'ws_b')
  insertWebApp(db, 'app_own', 'ws_b')
  db.close()
  const server = await startServer(dbPath)
  try {
    const putA = await call(server, 'PUT', '/api/v1/apps/app_put/store/note?workspaceId=ws_a', { value: { n: 1 } })
    const postBare = await call(server, 'POST', '/api/v1/apps/app_post/store/note', { value: { n: 2 } })
    const putOwn = await call(server, 'PUT', '/api/v1/apps/app_own/store/note?workspaceId=ws_b', { value: { n: 3 } })
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const count = (id) => check.prepare('SELECT COUNT(*) AS n FROM app_documents WHERE app_id = ?').get(id).n
    const seen = {
      putA: putA.status,
      putACode: codeOf(putA.payload),
      putRows: count('app_put'),
      postBare: postBare.status,
      postBareCode: codeOf(postBare.payload),
      postRows: count('app_post'),
      putOwn: putOwn.status,
      ownRows: count('app_own'),
    }
    check.close()
    assert.deepEqual(seen, {
      putA: 404,
      putACode: 'not_found',
      putRows: 0,
      postBare: 404,
      postBareCode: 'not_found',
      postRows: 0,
      putOwn: 200,
      ownRows: 1,
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('record proposal confirm and reject stay inside the operation workspace', async () => {
  const dbPath = `/tmp/fde-ws-r2-prop-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  const now = new Date().toISOString()
  const spec = {
    spec: 'fde-app/v1',
    slug: 'shop',
    name: '店',
    entities: [{ name: 'item', fields: [{ name: 'title', type: 'text' }] }],
  }
  db.prepare(`
    INSERT INTO business_apps (
      id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    ) VALUES ('app_prop', 'ws_b', '店', 'generated', 'active', 1, ?, ?, ?)
  `).run(JSON.stringify(spec), now, now)
  db.exec(`
    CREATE TABLE "app_shop__item" (
      id TEXT PRIMARY KEY,
      workspace_cwd TEXT,
      title TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      deleted_at INTEGER
    )
  `)
  db.prepare(`
    INSERT INTO "app_shop__item" (id, workspace_cwd, title, created_at, updated_at, deleted_at)
    VALUES ('rec_a', '/ws-guard-b', '原记录', 1, 1, NULL),
           ('rec_bare', '/ws-guard-b', '原记录', 1, 1, NULL)
  `).run()
  const planFor = (rid) => JSON.stringify({
    appId: 'app_prop',
    entity: 'item',
    workspaceCwd: '/ws-guard-b',
    patches: [{ rid, fields: { title: '被串改' }, base: { updated_at: 1 } }],
  })
  insertOperation(db, 'op_reject_a', { action: 'app.record.propose', state: 'awaiting_approval' })
  insertOperation(db, 'op_reject_bare', { action: 'app.record.propose', state: 'awaiting_approval' })
  insertOperation(db, 'op_confirm_a', { action: 'app.record.propose', state: 'awaiting_approval', plan: planFor('rec_a') })
  insertOperation(db, 'op_confirm_bare', { action: 'app.record.propose', state: 'awaiting_approval', plan: planFor('rec_bare') })
  insertOperation(db, 'op_reject_own', { action: 'app.record.propose', state: 'awaiting_approval' })
  db.close()
  const server = await startServer(dbPath)
  try {
    const rejectA = await call(server, 'POST', '/api/v1/apps/record-proposals/op_reject_a/reject?workspaceId=ws_a', {})
    const rejectBare = await call(server, 'POST', '/api/v1/apps/record-proposals/op_reject_bare/reject', {})
    const confirmA = await call(server, 'POST', '/api/v1/apps/record-proposals/op_confirm_a/confirm?workspaceId=ws_a', {})
    const confirmBare = await call(server, 'POST', '/api/v1/apps/record-proposals/op_confirm_bare/confirm', {})
    const rejectOwn = await call(server, 'POST', '/api/v1/apps/record-proposals/op_reject_own/reject?workspaceId=ws_b', {})
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const state = (id) => check.prepare('SELECT state FROM operations WHERE id = ?').get(id).state
    const recordTitle = (id) => check.prepare('SELECT title FROM "app_shop__item" WHERE id = ?').get(id).title
    const seen = {
      rejectA: rejectA.status,
      rejectACode: codeOf(rejectA.payload),
      rejectAState: state('op_reject_a'),
      rejectBare: rejectBare.status,
      rejectBareCode: codeOf(rejectBare.payload),
      rejectBareState: state('op_reject_bare'),
      confirmA: confirmA.status,
      confirmACode: codeOf(confirmA.payload),
      confirmAState: state('op_confirm_a'),
      confirmATitle: recordTitle('rec_a'),
      confirmBare: confirmBare.status,
      confirmBareCode: codeOf(confirmBare.payload),
      confirmBareState: state('op_confirm_bare'),
      confirmBareTitle: recordTitle('rec_bare'),
      rejectOwn: rejectOwn.status,
      rejectOwnState: state('op_reject_own'),
    }
    check.close()
    assert.deepEqual(seen, {
      rejectA: 404,
      rejectACode: 'not_found',
      rejectAState: 'awaiting_approval',
      rejectBare: 404,
      rejectBareCode: 'not_found',
      rejectBareState: 'awaiting_approval',
      confirmA: 404,
      confirmACode: 'not_found',
      confirmAState: 'awaiting_approval',
      confirmATitle: '原记录',
      confirmBare: 404,
      confirmBareCode: 'not_found',
      confirmBareState: 'awaiting_approval',
      confirmBareTitle: '原记录',
      rejectOwn: 200,
      rejectOwnState: 'cancelled',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('operation approve and execute stay inside the operation workspace', async () => {
  const dbPath = `/tmp/fde-ws-r2-ops-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  insertOperation(db, 'op_approve_a', { action: 'record.update', state: 'awaiting_approval' })
  insertOperation(db, 'op_approve_bare', { action: 'record.update', state: 'awaiting_approval' })
  insertOperation(db, 'op_exec_a', { action: 'record.update', state: 'draft' })
  insertOperation(db, 'op_exec_bare', { action: 'record.update', state: 'draft' })
  insertOperation(db, 'op_approve_own', { action: 'record.update', state: 'awaiting_approval' })
  db.close()
  const server = await startServer(dbPath)
  try {
    const approveA = await call(server, 'POST', '/api/v1/operations/op_approve_a/approve?workspaceId=ws_a', {})
    const approveBare = await call(server, 'POST', '/api/v1/operations/op_approve_bare/approve', {})
    const execA = await call(server, 'POST', '/api/v1/operations/op_exec_a/execute?workspaceId=ws_a', {})
    const execBare = await call(server, 'POST', '/api/v1/operations/op_exec_bare/execute', {})
    const approveOwn = await call(server, 'POST', '/api/v1/operations/op_approve_own/approve?workspaceId=ws_b', {})
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const state = (id) => check.prepare('SELECT state FROM operations WHERE id = ?').get(id).state
    const seen = {
      approveA: approveA.status,
      approveACode: codeOf(approveA.payload),
      approveAState: state('op_approve_a'),
      approveBare: approveBare.status,
      approveBareCode: codeOf(approveBare.payload),
      approveBareState: state('op_approve_bare'),
      execA: execA.status,
      execACode: codeOf(execA.payload),
      execAState: state('op_exec_a'),
      execBare: execBare.status,
      execBareCode: codeOf(execBare.payload),
      execBareState: state('op_exec_bare'),
      approveOwn: approveOwn.status,
      approveOwnState: state('op_approve_own'),
    }
    check.close()
    assert.deepEqual(seen, {
      approveA: 404,
      approveACode: 'not_found',
      approveAState: 'awaiting_approval',
      approveBare: 404,
      approveBareCode: 'not_found',
      approveBareState: 'awaiting_approval',
      execA: 404,
      execACode: 'not_found',
      execAState: 'draft',
      execBare: 404,
      execBareCode: 'not_found',
      execBareState: 'draft',
      approveOwn: 200,
      approveOwnState: 'approved',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('plan task event and workflow writes stay inside the row workspace', async () => {
  const dbPath = `/tmp/fde-ws-r2-plan-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  for (const id of ['task_patch_a', 'task_patch_bare', 'task_del_a', 'task_del_bare', 'task_own']) {
    insertTask(db, {
      id,
      workspaceId: 'ws_b',
      title: '原任务',
      notes: '',
      status: 'todo',
      priority: 'med',
      sourceRef: `fde://plan/tasks/${id}`,
      tags: [],
    })
  }
  for (const id of ['evt_patch_a', 'evt_patch_bare', 'evt_del_a', 'evt_del_bare', 'evt_own']) insertEvent(db, id, '原日程')
  for (const id of ['wf_patch_a', 'wf_patch_bare', 'wf_del_a', 'wf_del_bare', 'wf_own']) insertWorkflow(db, id, '原流程')
  db.close()
  const server = await startServer(dbPath)
  try {
    const taskA = await call(server, 'PATCH', '/api/v1/plan/tasks/task_patch_a', { workspaceId: 'ws_a', title: '被串改' })
    const taskBare = await call(server, 'PATCH', '/api/v1/plan/tasks/task_patch_bare', { title: '无区改' })
    const taskDelA = await call(server, 'DELETE', '/api/v1/plan/tasks/task_del_a?workspaceId=ws_a')
    const taskDelBare = await call(server, 'DELETE', '/api/v1/plan/tasks/task_del_bare')
    const taskOwn = await call(server, 'PATCH', '/api/v1/plan/tasks/task_own', { workspaceId: 'ws_b', title: '自己的' })
    const evtA = await call(server, 'PATCH', '/api/v1/plan/events/evt_patch_a', { workspaceId: 'ws_a', title: '被串改' })
    const evtBare = await call(server, 'PATCH', '/api/v1/plan/events/evt_patch_bare', { title: '无区改' })
    const evtDelA = await call(server, 'DELETE', '/api/v1/plan/events/evt_del_a?workspaceId=ws_a')
    const evtDelBare = await call(server, 'DELETE', '/api/v1/plan/events/evt_del_bare')
    const evtOwn = await call(server, 'PATCH', '/api/v1/plan/events/evt_own', { workspaceId: 'ws_b', title: '自己的' })
    const wfA = await call(server, 'PATCH', '/api/v1/plan/workflows/wf_patch_a', { workspaceId: 'ws_a', name: '被串改' })
    const wfBare = await call(server, 'PATCH', '/api/v1/plan/workflows/wf_patch_bare', { name: '无区改' })
    const wfDelA = await call(server, 'DELETE', '/api/v1/plan/workflows/wf_del_a?workspaceId=ws_a')
    const wfDelBare = await call(server, 'DELETE', '/api/v1/plan/workflows/wf_del_bare')
    const wfOwn = await call(server, 'PATCH', '/api/v1/plan/workflows/wf_own', { workspaceId: 'ws_b', name: '自己的' })
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const title = (table, id, column) => {
      const row = check.prepare(`SELECT ${column} AS v FROM ${table} WHERE id = ?`).get(id)
      return row ? row.v : ''
    }
    const seen = {
      taskA: taskA.status,
      taskACode: codeOf(taskA.payload),
      taskATitle: title('tasks', 'task_patch_a', 'title'),
      taskBare: taskBare.status,
      taskBareCode: codeOf(taskBare.payload),
      taskBareTitle: title('tasks', 'task_patch_bare', 'title'),
      taskDelA: taskDelA.status,
      taskDelACode: codeOf(taskDelA.payload),
      taskDelATitle: title('tasks', 'task_del_a', 'title'),
      taskDelBare: taskDelBare.status,
      taskDelBareCode: codeOf(taskDelBare.payload),
      taskDelBareTitle: title('tasks', 'task_del_bare', 'title'),
      taskOwn: taskOwn.status,
      taskOwnTitle: title('tasks', 'task_own', 'title'),
      evtA: evtA.status,
      evtACode: codeOf(evtA.payload),
      evtATitle: title('calendar_events', 'evt_patch_a', 'title'),
      evtBare: evtBare.status,
      evtBareCode: codeOf(evtBare.payload),
      evtBareTitle: title('calendar_events', 'evt_patch_bare', 'title'),
      evtDelA: evtDelA.status,
      evtDelACode: codeOf(evtDelA.payload),
      evtDelATitle: title('calendar_events', 'evt_del_a', 'title'),
      evtDelBare: evtDelBare.status,
      evtDelBareCode: codeOf(evtDelBare.payload),
      evtDelBareTitle: title('calendar_events', 'evt_del_bare', 'title'),
      evtOwn: evtOwn.status,
      evtOwnTitle: title('calendar_events', 'evt_own', 'title'),
      wfA: wfA.status,
      wfACode: codeOf(wfA.payload),
      wfAName: title('workflows', 'wf_patch_a', 'name'),
      wfBare: wfBare.status,
      wfBareCode: codeOf(wfBare.payload),
      wfBareName: title('workflows', 'wf_patch_bare', 'name'),
      wfDelA: wfDelA.status,
      wfDelACode: codeOf(wfDelA.payload),
      wfDelAName: title('workflows', 'wf_del_a', 'name'),
      wfDelBare: wfDelBare.status,
      wfDelBareCode: codeOf(wfDelBare.payload),
      wfDelBareName: title('workflows', 'wf_del_bare', 'name'),
      wfOwn: wfOwn.status,
      wfOwnName: title('workflows', 'wf_own', 'name'),
    }
    check.close()
    assert.deepEqual(seen, {
      taskA: 404,
      taskACode: 'not_found',
      taskATitle: '原任务',
      taskBare: 404,
      taskBareCode: 'not_found',
      taskBareTitle: '原任务',
      taskDelA: 404,
      taskDelACode: 'not_found',
      taskDelATitle: '原任务',
      taskDelBare: 404,
      taskDelBareCode: 'not_found',
      taskDelBareTitle: '原任务',
      taskOwn: 200,
      taskOwnTitle: '自己的',
      evtA: 404,
      evtACode: 'not_found',
      evtATitle: '原日程',
      evtBare: 404,
      evtBareCode: 'not_found',
      evtBareTitle: '原日程',
      evtDelA: 404,
      evtDelACode: 'not_found',
      evtDelATitle: '原日程',
      evtDelBare: 404,
      evtDelBareCode: 'not_found',
      evtDelBareTitle: '原日程',
      evtOwn: 200,
      evtOwnTitle: '自己的',
      wfA: 404,
      wfACode: 'not_found',
      wfAName: '原流程',
      wfBare: 404,
      wfBareCode: 'not_found',
      wfBareName: '原流程',
      wfDelA: 404,
      wfDelACode: 'not_found',
      wfDelAName: '原流程',
      wfDelBare: 404,
      wfDelBareCode: 'not_found',
      wfDelBareName: '原流程',
      wfOwn: 200,
      wfOwnName: '自己的',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('an unregistered plan workspace is missing_workspace', async () => {
  const dbPath = `/tmp/fde-ws-r2-missing-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  db.close()
  const server = await startServer(dbPath)
  try {
    const task = await call(server, 'POST', '/api/v1/plan/tasks', { workspaceId: 'ws_absent', title: '不应出现' })
    const event = await call(server, 'POST', '/api/v1/plan/events', {
      workspaceId: 'ws_absent',
      title: '不应出现',
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2026-01-01T01:00:00.000Z',
    })
    const blank = await call(server, 'POST', '/api/v1/plan/tasks', { title: '缺 id' })
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const tasks = check.prepare("SELECT COUNT(*) AS n FROM tasks WHERE title = '不应出现'").get().n
    const events = check.prepare("SELECT COUNT(*) AS n FROM calendar_events WHERE title = '不应出现'").get().n
    check.close()
    assert.deepEqual({
      task: task.status,
      taskCode: codeOf(task.payload),
      taskMessage: task.payload.message,
      event: event.status,
      eventCode: codeOf(event.payload),
      eventMessage: event.payload.message,
      tasks,
      events,
      blank: blank.status,
      blankCode: codeOf(blank.payload),
    }, {
      task: 404,
      taskCode: 'missing_workspace',
      taskMessage: '工作区未登记',
      event: 404,
      eventCode: 'missing_workspace',
      eventMessage: '工作区未登记',
      tasks: 0,
      events: 0,
      blank: 400,
      blankCode: 'missing_workspace_id',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})
