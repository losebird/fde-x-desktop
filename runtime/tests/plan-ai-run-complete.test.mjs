import './support/no-stray-processes.mjs'
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../db.mjs'
import { configureEventBus } from '../events.mjs'
import { insertTask, getTask } from '../plan/task-store.mjs'
import { proposePlanTask } from '../plan/task-proposals.mjs'
import { listTaskAiRuns, startTaskAiRun } from '../plan/task-ai-runs.mjs'
import * as aiRuns from '../plan/task-ai-runs.mjs'
import { planAiRunOpen } from '../plan/plan-ai-chip.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

function addTask(db, id, notes = '') {
  insertTask(db, {
    id,
    workspaceId: 'ws_chip',
    title: '原任务',
    notes,
    status: 'todo',
    priority: 'med',
    sourceRef: `fde-task:${id}`,
    tags: [],
  })
}

function startRun(db, taskId, sessionId) {
  const started = startTaskAiRun(db, { taskId, sessionId, requestId: `req_${taskId}` })
  assert.equal(started.ok, true, JSON.stringify(started))
  assert.equal(started.data.state, 'running')
  return started.data
}

function propose(db, taskId, title, notes) {
  const result = proposePlanTask(db, {
    op: 'update',
    workspaceId: 'ws_chip',
    taskId,
    title,
    ...(notes === undefined ? {} : { notes }),
    actorId: 'actor_local_user',
    correlationId: `corr_${taskId}`,
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.proposalId
}

function captureResponse() {
  return {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status
    },
    end(body) {
      this.body = String(body || '')
    },
    json() {
      return JSON.parse(this.body)
    },
  }
}

async function decide(db, proposalId, decision, workspaceId = 'ws_chip') {
  const response = captureResponse()
  const url = new URL(`http://127.0.0.1/api/v1/plan/task-proposals/${proposalId}/${decision}`)
  const handled = await handlePlanRequest({
    method: 'POST',
    headers: {},
  }, response, url, {
    db,
    enqueueEvent() {},
    readJson: async () => ({ workspaceId }),
    aiRuntime: {},
    uiToken: '',
  }, 'corr_decide')
  assert.equal(handled, true)
  return response
}

function chipLabel(db, taskId) {
  const running = listTaskAiRuns(db, taskId).find((row) => row.state === 'running')
  const open = planAiRunOpen(running)
  return open ? open.label : null
}

test('plan confirm and reject success complete the linked run and hide the chip', async () => {
  const dbPath = `/tmp/fde-ai-run-complete-${process.pid}.sqlite`
  rmSync(dbPath, { force: true })
  const db = openDatabase(dbPath, migrations)
  configureEventBus(db)
  registerWorkspace(db, 'ws_chip', '/ws-chip')
  addTask(db, 'task_confirm')
  addTask(db, 'task_reject')
  addTask(db, 'task_other')
  startRun(db, 'task_confirm', 'sess_confirm')
  startRun(db, 'task_reject', 'sess_reject')
  startRun(db, 'task_other', 'sess_other')
  const confirmId = propose(db, 'task_confirm', '已确认')
  const rejectId = propose(db, 'task_reject', '不采用')

  const confirmed = await decide(db, confirmId, 'confirm')
  assert.equal(confirmed.status, 200, confirmed.body)
  assert.equal(getTask(db, 'task_confirm', 'ws_chip').title, '已确认')
  assert.deepEqual(listTaskAiRuns(db, 'task_confirm').map((row) => row.state), ['completed'])
  assert.equal(chipLabel(db, 'task_confirm'), null)
  assert.equal(chipLabel(db, 'task_other'), 'AI 处理中 · 打开会话')

  const rejected = await decide(db, rejectId, 'reject')
  assert.equal(rejected.status, 200, rejected.body)
  assert.equal(getTask(db, 'task_reject', 'ws_chip').title, '原任务')
  assert.deepEqual(listTaskAiRuns(db, 'task_reject').map((row) => row.state), ['completed'])
  assert.equal(chipLabel(db, 'task_reject'), null)

  const missed = await decide(db, 'op_missing', 'confirm')
  assert.equal(missed.status, 404)
  assert.equal(chipLabel(db, 'task_other'), 'AI 处理中 · 打开会话')

  const foreign = propose(db, 'task_other', '别人的工作区')
  const denied = await decide(db, foreign, 'confirm', 'ws_personal')
  assert.notEqual(denied.status, 200)
  assert.equal(getTask(db, 'task_other', 'ws_chip').title, '原任务')
  assert.deepEqual(listTaskAiRuns(db, 'task_other').map((row) => row.state), ['running'])

  const again = startTaskAiRun(db, { taskId: 'task_confirm', sessionId: 'sess_next', requestId: 'req_next' })
  assert.equal(again.ok, true, JSON.stringify(again))
  assert.equal(again.data.state, 'running')
  db.close()
  rmSync(dbPath, { force: true })
})

test('cancel still ends the run, and a failed confirm does not', async () => {
  const dbPath = `/tmp/fde-ai-run-cancel-${process.pid}.sqlite`
  rmSync(dbPath, { force: true })
  const db = openDatabase(dbPath, migrations)
  configureEventBus(db)
  registerWorkspace(db, 'ws_chip', '/ws-chip')
  addTask(db, 'task_cancel')
  startRun(db, 'task_cancel', 'sess_cancel')
  const response = captureResponse()
  const url = new URL('http://127.0.0.1/api/v1/plan/tasks/task_cancel/ai-runs')
  const handled = await handlePlanRequest({ method: 'POST', headers: {} }, response, url, {
    db,
    enqueueEvent() {},
    readJson: async () => ({ op: 'cancel', workspaceId: 'ws_chip' }),
    aiRuntime: {},
    uiToken: '',
  }, 'corr_cancel')
  assert.equal(handled, true)
  assert.equal(response.status, 200, response.body)
  assert.equal(response.json().data.state, 'cancelled')
  assert.equal(chipLabel(db, 'task_cancel'), null)
  const restarted = startTaskAiRun(db, { taskId: 'task_cancel', sessionId: 'sess_again', requestId: 'req_again' })
  assert.equal(restarted.ok, true)
  db.close()
  rmSync(dbPath, { force: true })
})

test('a linked workstation write completes the handoff run and an unlinked write does not', () => {
  assert.equal(typeof aiRuns.finishWorkstationHandoff, 'function')
  const dbPath = `/tmp/fde-ai-run-biz-${process.pid}.sqlite`
  const db = openDatabase(dbPath, migrations)
  registerWorkspace(db, 'ws_chip', '/ws-chip')
  addTask(db, 'task_session')
  addTask(db, 'task_preview', '改这一行 preview_id=pv_abcdef12')
  addTask(db, 'task_quiet')
  startRun(db, 'task_session', 'sess_handoff')
  startRun(db, 'task_preview', 'sess_other')
  startRun(db, 'task_quiet', 'sess_quiet')

  const missed = aiRuns.finishWorkstationHandoff(db, {
    ok: false,
    sessionId: 'sess_handoff',
    previewId: 'pv_abcdef12',
  })
  assert.equal(missed.completed, false)
  assert.equal(chipLabel(db, 'task_session'), 'AI 处理中 · 打开会话')

  const rollback = aiRuns.finishWorkstationHandoff(db, {
    ok: true,
    rollback: true,
    sessionId: 'sess_handoff',
    previewId: 'pv_abcdef12',
  })
  assert.equal(rollback.completed, false)
  assert.equal(chipLabel(db, 'task_session'), 'AI 处理中 · 打开会话')

  const bySession = aiRuns.finishWorkstationHandoff(db, {
    ok: true,
    sessionId: 'sess_handoff',
    previewId: '',
  })
  assert.equal(bySession.completed, true)
  assert.deepEqual(listTaskAiRuns(db, 'task_session').map((row) => row.state), ['completed'])
  assert.equal(chipLabel(db, 'task_session'), null)
  assert.equal(chipLabel(db, 'task_preview'), 'AI 处理中 · 打开会话')
  assert.equal(chipLabel(db, 'task_quiet'), 'AI 处理中 · 打开会话')

  const byPreview = aiRuns.finishWorkstationHandoff(db, {
    ok: true,
    sessionId: '',
    previewId: 'pv_abcdef12',
  })
  assert.equal(byPreview.completed, true)
  assert.deepEqual(listTaskAiRuns(db, 'task_preview').map((row) => row.state), ['completed'])
  assert.equal(chipLabel(db, 'task_quiet'), 'AI 处理中 · 打开会话')

  addTask(db, 'task_card')
  startRun(db, 'task_card', 'sess_card')
  propose(db, 'task_card', '原任务', '请过账 preview_id=pv_1234abcd')
  const byCard = aiRuns.finishWorkstationHandoff(db, {
    ok: true,
    sessionId: 'sess_unrelated',
    previewId: 'pv_1234abcd',
  })
  assert.equal(byCard.completed, true)
  assert.equal(chipLabel(db, 'task_card'), null)
  assert.equal(chipLabel(db, 'task_quiet'), 'AI 处理中 · 打开会话')

  const twice = aiRuns.finishWorkstationHandoff(db, {
    ok: true,
    sessionId: 'sess_card',
    previewId: 'pv_1234abcd',
  })
  assert.equal(twice.completed, false)
  assert.deepEqual(listTaskAiRuns(db, 'task_card').map((row) => row.state), ['completed'])
  db.close()
  rmSync(dbPath, { force: true })
})

function includes(source, needle) {
  assert.equal(source.includes(needle), true, `missing ${needle}`)
}

function excludes(source, needle) {
  assert.equal(source.includes(needle), false, `unexpected ${needle}`)
}

test('an existing running row can be marked completed after the migration', () => {
  const root = `/tmp/fde-ai-run-mig-${process.pid}`
  rmSync(root, { recursive: true, force: true })
  const partial = join(root, 'partial')
  mkdirSync(partial, { recursive: true })
  for (const name of readdirSync(migrations)) {
    if (name.startsWith('021_')) continue
    cpSync(join(migrations, name), join(partial, name))
  }
  const dbPath = join(root, 't.sqlite')
  const opened = openDatabase(dbPath, partial)
  registerWorkspace(opened, 'ws_chip', '/ws-chip')
  addTask(opened, 'task_old')
  startRun(opened, 'task_old', 'sess_old')
  opened.close()
  const db = openDatabase(dbPath, migrations)
  assert.equal(listTaskAiRuns(db, 'task_old')[0].state, 'running')
  assert.equal(chipLabel(db, 'task_old'), 'AI 处理中 · 打开会话')
  const done = aiRuns.completeTaskAiRun(db, 'task_old')
  assert.equal(done.completed, true)
  assert.deepEqual(listTaskAiRuns(db, 'task_old').map((row) => row.state), ['completed'])
  assert.equal(chipLabel(db, 'task_old'), null)
  db.close()
  rmSync(root, { recursive: true, force: true })
})

test('plan confirm and biz post stay on separate buttons', () => {
  const card = readFileSync(new URL('../../src/components/plan/PlanTaskProposals.tsx', import.meta.url), 'utf8')
  const drawer = readFileSync(new URL('../../src/components/biz/BizPreviewDrawer.tsx', import.meta.url), 'utf8')
  const planRoute = readFileSync(new URL('../routes/plan.mjs', import.meta.url), 'utf8')
  const bizRoute = readFileSync(new URL('../routes/biz.mjs', import.meta.url), 'utf8')
  includes(card, '确认')
  includes(card, '拒绝')
  excludes(card, '确认过账')
  excludes(card, 'bizWrite')
  excludes(card, '/api/v1/biz/write')
  includes(drawer, '确认过账')
  excludes(drawer, 'decidePlanTaskProposal')
  excludes(drawer, 'task-proposals')
  excludes(planRoute, '/api/v1/biz/write')
  excludes(planRoute, 'finishWorkstationHandoff')
  includes(bizRoute, 'finishWorkstationHandoff(')
  assert.equal(bizRoute.split('finishWorkstationHandoff(').length - 1, 2)
  excludes(bizRoute, 'decidePlanTask')
  excludes(bizRoute, 'task-proposals')
})

test('the plan list reloads runs after confirm and after a workstation write', () => {
  const plan = readFileSync(new URL('../../src/pages/Plan.tsx', import.meta.url), 'utf8')
  const start = plan.indexOf('function TodoTab')
  const end = plan.indexOf('function localDateValue')
  const todo = plan.slice(start, end)
  includes(todo, 'task.proposal.changed')
  includes(todo, 'biz.write.done')
  includes(todo, 'listTaskAiRuns')
  const card = readFileSync(new URL('../../src/components/plan/PlanTaskProposals.tsx', import.meta.url), 'utf8')
  includes(card, 'onDecided?.(')
})
