import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const require = createRequire(import.meta.url)
const { FDE_TOOL_NAMES } = require('../fde-x-dsh-bridge/lib/tools.js')

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-p3-plan-task-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')
const port = 4408
const base = `http://127.0.0.1:${port}`
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tokenPath = join(dshHome, 'run', 'bridge.token')

let child
let pageToken = ''
let bridgeToken = ''

test('fde_plan_task_propose is registered immediately after fde_app_records_propose', () => {
  const recordsAt = FDE_TOOL_NAMES.indexOf('fde_app_records_propose')
  assert.equal(FDE_TOOL_NAMES[recordsAt + 1], 'fde_plan_task_propose', 'missing tool fde_plan_task_propose')
})

function pageHeaders(token = pageToken) {
  return {
    Origin: origin,
    'Content-Type': 'application/json',
    'x-fde-ui-token': token,
  }
}

function openRead() {
  return new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 })
}

function proposals(workspaceId) {
  const db = openRead()
  try {
    return db.prepare(`
      SELECT id, state, action, execution_mode, expected_version, plan_json
      FROM operations
      WHERE workspace_id = ? AND action = 'plan.task.propose'
      ORDER BY created_at ASC
    `).all(workspaceId)
  } finally {
    db.close()
  }
}

function audits(workspaceId, action) {
  const db = openRead()
  try {
    return db.prepare(`
      SELECT action, outcome, details_json
      FROM audit_entries
      WHERE workspace_id = ? AND action = ?
      ORDER BY occurred_at ASC
    `).all(workspaceId, action)
  } finally {
    db.close()
  }
}

function taskById(id) {
  const db = openRead()
  try {
    return db.prepare('SELECT id, title, status, notes, updated_at FROM tasks WHERE id = ?').get(id) ?? null
  } finally {
    db.close()
  }
}

function insertExistingTask(id, workspaceId, title) {
  const db = new DatabaseSync(dbPath, { timeout: 5000 })
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO tasks
      (id, workspace_id, title, notes, status, priority, due_at, completed_at, metadata_json, source_ref, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, '', 'todo', 'med', NULL, NULL, '{}', ?, '[]', ?, ?)
  `).run(id, workspaceId, title, `fde-task:${id}`, now, now)
  db.close()
}

async function startServer() {
  await rm(root, { recursive: true, force: true })
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  pageToken = ''
  bridgeToken = ''
  let stdout = ''
  let stderr = ''
  child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: workspaceCwd,
      FDE_DSH_HOME: dshHome,
      FDE_RUNTIME_SUPERVISED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
    const tokenMatch = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(stdout)
    if (tokenMatch) pageToken = tokenMatch[1]
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  for (let i = 0; i < 150; i += 1) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok && pageToken) {
        bridgeToken = String(await readFile(tokenPath, 'utf8')).trim()
        if (bridgeToken) return
      }
    } catch {
      // The listener is not up yet.
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  throw new Error(`plan task propose server failed to start\n${stderr}\n${stdout}`)
}

async function stopServer() {
  if (!child || child.exitCode != null) return
  child.kill('SIGTERM')
  for (let i = 0; i < 20; i += 1) {
    if (child.exitCode != null) return
    await delay(50)
  }
  child.kill('SIGKILL')
}

async function readJson(res) {
  return res.json().catch(() => ({}))
}

async function createWorkspace() {
  const id = `ws_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const res = await fetch(`${base}/api/v1/workspaces`, {
    method: 'POST',
    headers: pageHeaders(),
    body: JSON.stringify({ id, name: id, description: 'plan propose' }),
  })
  const payload = await readJson(res)
  assert.equal(res.status, 201, JSON.stringify(payload))
  return id
}

async function createTask(workspaceId, title) {
  const res = await fetch(`${base}/api/v1/plan/tasks`, {
    method: 'POST',
    headers: pageHeaders(),
    body: JSON.stringify({ workspaceId, title }),
  })
  const payload = await readJson(res)
  assert.equal(res.status, 201, JSON.stringify(payload))
  return payload.data
}

async function patchTask(id, body) {
  const res = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: pageHeaders(),
    body: JSON.stringify(body),
  })
  const payload = await readJson(res)
  return { status: res.status, payload }
}

async function deleteTask(id) {
  const res = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: pageHeaders(),
  })
  const payload = await readJson(res)
  return { status: res.status, payload }
}

async function listedTask(workspaceId, id) {
  const res = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${encodeURIComponent(workspaceId)}`)
  const payload = await readJson(res)
  assert.equal(res.status, 200, JSON.stringify(payload))
  return (payload.data || []).find((row) => row.id === id) ?? null
}

async function bridgePropose(body, headers = { 'x-fde-bridge-token': bridgeToken }) {
  const res = await fetch(`${base}/api/v1/bridge/plan-task-propose`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
  const payload = await readJson(res)
  return { status: res.status, payload }
}

async function decide(proposalId, decision, headers, body) {
  const res = await fetch(`${base}/api/v1/plan/task-proposals/${encodeURIComponent(proposalId)}/${decision}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body ?? {}),
  })
  const payload = await readJson(res)
  return { status: res.status, payload }
}

function assertAwaiting(workspaceId) {
  const rows = proposals(workspaceId)
  assert.equal(rows.length, 1, '提案后应有一条 awaiting_approval 的操作')
  assert.equal(rows[0].state, 'awaiting_approval')
  assert.equal(rows[0].action, 'plan.task.propose')
  assert.equal(rows[0].execution_mode, 'dry_run')
  return rows[0]
}

describe('plan task proposals', { concurrency: 1 }, () => {
  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })

  test('propose leaves the task unchanged and stores one awaiting_approval operation', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    const before = taskById(task.id)
    const proposed = await bridgePropose({
      workspaceId,
      op: 'update',
      taskId: task.id,
      title: '提案标题',
    })
    const row = assertAwaiting(workspaceId)
    assert.equal(proposed.status, 200, JSON.stringify(proposed.payload))
    assert.equal(proposed.payload.ok, true)
    assert.equal(proposed.payload.data.ok, true)
    assert.equal(proposed.payload.data.proposalId, row.id)
    const after = taskById(task.id)
    assert.equal(after.title, '原来的标题')
    assert.equal(after.updated_at, before.updated_at)
    const plan = JSON.parse(row.plan_json)
    assert.equal(plan.op, 'update')
    assert.equal(plan.taskId, task.id)
    assert.equal(plan.change.title, '提案标题')
    assert.equal(plan.change.base.updated_at, before.updated_at)
    assert.equal(row.expected_version, before.updated_at)
    const proposeAudits = audits(workspaceId, 'plan.task.propose')
    assert.equal(proposeAudits.length, 1)
    assert.equal(proposeAudits[0].outcome, 'accepted')
    assert.deepEqual(JSON.parse(proposeAudits[0].details_json), plan)
    const seen = await listedTask(workspaceId, task.id)
    assert.equal(seen.title, '原来的标题')
  })

  test('page token confirm applies the stored title and ignores a different body', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const confirmed = await decide(row.id, 'confirm', pageHeaders(), { title: '请求体标题' })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.payload))
    assert.equal(taskById(task.id).title, '提案标题')
    const op = proposals(workspaceId)[0]
    assert.equal(op.state, 'succeeded')
    assert.equal(op.execution_mode, 'dry_run')
    const confirmAudits = audits(workspaceId, 'plan.task.confirm')
    assert.equal(confirmAudits.length, 1)
    assert.equal(confirmAudits[0].outcome, 'succeeded')
    assert.deepEqual(JSON.parse(confirmAudits[0].details_json), {
      operationId: row.id,
      op: 'update',
      taskId: task.id,
    })
    assert.equal(audits(workspaceId, 'plan.task.update').length, 0)
    const again = await decide(row.id, 'confirm', pageHeaders(), { title: '提案标题' })
    assert.equal(again.status, 409)
    assert.equal(again.payload.error, 'invalid_state')
    assert.equal(again.payload.message, '提案已经确认或拒绝')
    assert.equal(audits(workspaceId, 'plan.task.confirm').length, 1)
    assert.equal(taskById(task.id).title, '提案标题')
  })

  test('confirm without the page token returns 401 and leaves the task', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const missing = await decide(row.id, 'confirm', {}, { title: '提案标题' })
    assert.equal(missing.status, 401)
    const bridged = await decide(row.id, 'confirm', { 'x-fde-ui-token': bridgeToken }, { title: '提案标题' })
    assert.equal(bridged.status, 401)
    assert.equal(taskById(task.id).title, '原来的标题')
    assert.equal(proposals(workspaceId)[0].state, 'awaiting_approval')
    assert.equal(audits(workspaceId, 'plan.task.confirm').length, 0)
  })

  test('reject cancels the proposal and a later confirm writes no second audit', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const rejected = await decide(row.id, 'reject', pageHeaders(), { title: '提案标题' })
    assert.equal(rejected.status, 200, JSON.stringify(rejected.payload))
    assert.equal(taskById(task.id).title, '原来的标题')
    assert.equal(proposals(workspaceId)[0].state, 'cancelled')
    const rejectAudits = audits(workspaceId, 'plan.task.reject')
    assert.equal(rejectAudits.length, 1)
    assert.equal(rejectAudits[0].outcome, 'rejected')
    assert.deepEqual(JSON.parse(rejectAudits[0].details_json), { operationId: row.id })
    const again = await decide(row.id, 'confirm', pageHeaders(), {})
    assert.equal(again.status, 409)
    assert.equal(again.payload.error, 'invalid_state')
    assert.equal(again.payload.message, '提案已经确认或拒绝')
    assert.equal(proposals(workspaceId)[0].state, 'cancelled')
    assert.equal(audits(workspaceId, 'plan.task.reject').length, 1)
    assert.equal(audits(workspaceId, 'plan.task.confirm').length, 0)
    assert.equal(taskById(task.id).title, '原来的标题')
  })

  test('confirm fails when the task changed after the proposal', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const patched = await patchTask(task.id, { title: '人手改过' })
    assert.equal(patched.status, 200, JSON.stringify(patched.payload))
    const confirmed = await decide(row.id, 'confirm', pageHeaders(), { title: '提案标题' })
    assert.equal(confirmed.status, 409)
    assert.equal(confirmed.payload.error, 'stale_task')
    assert.equal(confirmed.payload.message, '任务在提案之后已变更')
    assert.equal(taskById(task.id).title, '人手改过')
    assert.equal(proposals(workspaceId)[0].state, 'failed')
    const confirmAudits = audits(workspaceId, 'plan.task.confirm')
    assert.equal(confirmAudits.length, 1)
    assert.equal(confirmAudits[0].outcome, 'failed')
    assert.deepEqual(JSON.parse(confirmAudits[0].details_json), {
      operationId: row.id,
      reason: 'stale_task',
    })
    const again = await decide(row.id, 'confirm', pageHeaders(), { title: '提案标题' })
    assert.equal(again.status, 409)
    assert.equal(again.payload.error, 'invalid_state')
    assert.equal(audits(workspaceId, 'plan.task.confirm').length, 1)
    assert.equal(taskById(task.id).title, '人手改过')
  })

  test('confirm closes the proposal when the task was deleted', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const removed = await deleteTask(task.id)
    assert.equal(removed.status, 200, JSON.stringify(removed.payload))
    const confirmed = await decide(row.id, 'confirm', pageHeaders(), {})
    assert.equal(confirmed.status, 404)
    assert.equal(confirmed.payload.error, 'not_found')
    assert.equal(confirmed.payload.message, '提案不存在')
    assert.equal(proposals(workspaceId)[0].state, 'failed')
    const confirmAudits = audits(workspaceId, 'plan.task.confirm')
    assert.equal(confirmAudits.length, 1)
    assert.equal(confirmAudits[0].outcome, 'failed')
    assert.deepEqual(JSON.parse(confirmAudits[0].details_json), {
      operationId: row.id,
      reason: 'task_missing',
    })
    const again = await decide(row.id, 'confirm', pageHeaders(), {})
    assert.equal(again.status, 409)
    assert.equal(again.payload.error, 'invalid_state')
    assert.equal(proposals(workspaceId)[0].state, 'failed')
    assert.equal(audits(workspaceId, 'plan.task.confirm').length, 1)
    assert.equal(taskById(task.id), null)
  })

  test('insert waits for confirm and does not write plan.task.insert', async () => {
    const workspaceId = await createWorkspace()
    const proposed = await bridgePropose({ workspaceId, op: 'insert', title: '新任务' })
    const row = assertAwaiting(workspaceId)
    assert.equal(proposed.status, 200, JSON.stringify(proposed.payload))
    const plan = JSON.parse(row.plan_json)
    assert.equal(plan.op, 'insert')
    assert.equal(plan.change.base, null)
    assert.equal(row.expected_version, null)
    assert.equal(taskById(plan.taskId), null)
    const confirmed = await decide(row.id, 'confirm', pageHeaders(), { title: '请求体标题' })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.payload))
    const created = taskById(plan.taskId)
    assert.equal(created.title, '新任务')
    assert.equal(proposals(workspaceId)[0].state, 'succeeded')
    assert.equal(proposals(workspaceId)[0].execution_mode, 'dry_run')
    assert.equal(audits(workspaceId, 'plan.task.insert').length, 0)
    const confirmAudits = audits(workspaceId, 'plan.task.confirm')
    assert.equal(confirmAudits.length, 1)
    assert.equal(confirmAudits[0].outcome, 'succeeded')
    assert.deepEqual(JSON.parse(confirmAudits[0].details_json), {
      operationId: row.id,
      op: 'insert',
      taskId: plan.taskId,
    })
  })

  test('an insert whose id already exists fails without overwriting the row', async () => {
    const workspaceId = await createWorkspace()
    await bridgePropose({ workspaceId, op: 'insert', title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const plan = JSON.parse(row.plan_json)
    insertExistingTask(plan.taskId, workspaceId, '别人先写了')
    const confirmed = await decide(row.id, 'confirm', pageHeaders(), { title: '提案标题' })
    assert.equal(confirmed.status, 409)
    assert.equal(confirmed.payload.error, 'stale_task')
    assert.equal(confirmed.payload.message, '任务在提案之后已变更')
    assert.equal(taskById(plan.taskId).title, '别人先写了')
    assert.equal(proposals(workspaceId)[0].state, 'failed')
    const confirmAudits = audits(workspaceId, 'plan.task.confirm')
    assert.equal(confirmAudits.length, 1)
    assert.equal(confirmAudits[0].outcome, 'failed')
    assert.deepEqual(JSON.parse(confirmAudits[0].details_json), {
      operationId: row.id,
      reason: 'task_exists',
    })
  })

  test('two open proposals let the first confirm win', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '第一份' })
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '第二份' })
    const rows = proposals(workspaceId)
    assert.equal(rows.length, 2, '同一任务可以同时有两条 awaiting_approval 提案')
    assert.equal(rows[0].state, 'awaiting_approval')
    assert.equal(rows[1].state, 'awaiting_approval')
    const first = await decide(rows[0].id, 'confirm', pageHeaders(), { title: '请求体标题' })
    assert.equal(first.status, 200, JSON.stringify(first.payload))
    assert.equal(taskById(task.id).title, '第一份')
    const second = await decide(rows[1].id, 'confirm', pageHeaders(), { title: '第二份' })
    assert.equal(second.status, 409)
    assert.equal(second.payload.error, 'stale_task')
    assert.equal(second.payload.message, '任务在提案之后已变更')
    const after = proposals(workspaceId)
    assert.equal(after[0].state, 'succeeded')
    assert.equal(after[1].state, 'failed')
    assert.equal(taskById(task.id).title, '第一份')
    const confirmAudits = audits(workspaceId, 'plan.task.confirm')
    assert.equal(confirmAudits.length, 2)
    assert.equal(confirmAudits[0].outcome, 'succeeded')
    assert.equal(confirmAudits[1].outcome, 'failed')
    assert.equal(JSON.parse(confirmAudits[1].details_json).reason, 'stale_task')
  })

  test('the open list is not token-gated and drops a confirmed proposal', async () => {
    const workspaceId = await createWorkspace()
    const task = await createTask(workspaceId, '原来的标题')
    await bridgePropose({ workspaceId, op: 'update', taskId: task.id, title: '提案标题' })
    const row = assertAwaiting(workspaceId)
    const listed = await fetch(`${base}/api/v1/plan/task-proposals?workspaceId=${encodeURIComponent(workspaceId)}`)
    const payload = await readJson(listed)
    assert.equal(listed.status, 200, JSON.stringify(payload))
    assert.equal(payload.ok, true)
    const hit = payload.data.find((item) => item.id === row.id)
    assert.equal(hit.op, 'update')
    assert.equal(hit.taskId, task.id)
    assert.equal(hit.title, '提案标题')
    const confirmed = await decide(row.id, 'confirm', pageHeaders(), { title: '请求体标题' })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.payload))
    const again = await fetch(`${base}/api/v1/plan/task-proposals?workspaceId=${encodeURIComponent(workspaceId)}`)
    const againPayload = await readJson(again)
    assert.equal(again.status, 200, JSON.stringify(againPayload))
    assert.equal(againPayload.data.some((item) => item.id === row.id), false)
  })

  test('a host goal id is rejected before an operation row exists', async () => {
    const workspaceId = await createWorkspace()
    const proposed = await bridgePropose({
      workspaceId,
      op: 'update',
      taskId: 'dsh-goal:goal_1',
      status: 'done',
    })
    assert.equal(proposed.status, 422, JSON.stringify(proposed.payload))
    assert.equal(proposed.payload.error, 'validation_error')
    assert.equal(proposed.payload.message, 'Host goal 只能改状态')
    assert.equal(proposals(workspaceId).length, 0)
  })

  test('a missing task is not_found and writes no operation', async () => {
    const workspaceId = await createWorkspace()
    const proposed = await bridgePropose({
      workspaceId,
      op: 'update',
      taskId: 'task_missing',
      title: '提案标题',
    })
    assert.equal(proposed.status, 404, JSON.stringify(proposed.payload))
    assert.equal(proposed.payload.error, 'not_found')
    assert.equal(proposed.payload.message, '任务不存在')
    assert.equal(proposals(workspaceId).length, 0)
  })

  test('an insert without a title is validation_error', async () => {
    const workspaceId = await createWorkspace()
    const proposed = await bridgePropose({ workspaceId, op: 'insert', title: '   ' })
    assert.equal(proposed.status, 422, JSON.stringify(proposed.payload))
    assert.equal(proposed.payload.error, 'validation_error')
    assert.equal(proposed.payload.message, '标题不能为空')
    assert.equal(proposals(workspaceId).length, 0)
  })

  test('the bridge route rejects a missing bridge token', async () => {
    const workspaceId = await createWorkspace()
    const proposed = await bridgePropose({
      workspaceId,
      op: 'insert',
      title: '新任务',
    }, {})
    assert.equal(proposed.status, 401)
    assert.equal(proposals(workspaceId).length, 0)
  })
})
