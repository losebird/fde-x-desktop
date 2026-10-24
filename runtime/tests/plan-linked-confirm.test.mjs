import './support/no-stray-processes.mjs'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { insertBizWriteAudit, openDatabase } from '../db.mjs'
import { configureEventBus } from '../events.mjs'
import { getTask, insertTask } from '../plan/task-store.mjs'
import { proposePlanTask } from '../plan/task-proposals.mjs'
import { startTaskAiRun } from '../plan/task-ai-runs.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'
import { startLanAssistStateWatch } from '../lan-assist-state-watch.mjs'
import { stampPlanConfirmMouth } from '../biz/plan-mouth-stamp.mjs'
import { sheetPayloadFromRaw } from '../biz/sheet-payload.mjs'
import { completeTaskAiRun } from '../plan/task-ai-runs.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')
const PREVIEW = 'pv_0123456789abcdef'
const PREVIEW_NEXT = 'pv_fedcba9876543210'
const EIGHT = 'pv_abcdef12'
const DIFF = {
  action: '改行',
  changes: [{ field: 'level', label: '等级', from: 'B', to: 'A' }],
}

function registerWorkspace(db) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_chip', 'cwd', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd: '/ws-chip' }), now, now)
}

function addTask(db, id) {
  insertTask(db, {
    id,
    workspaceId: 'ws_chip',
    title: '原任务',
    notes: '',
    status: 'todo',
    priority: 'med',
    sourceRef: `fde-task:${id}`,
    tags: [],
  })
}

function propose(db, taskId, title) {
  const result = proposePlanTask(db, {
    op: 'update',
    workspaceId: 'ws_chip',
    taskId,
    title,
    actorId: 'actor_local_user',
    correlationId: `corr_${taskId}_${title}`,
  })
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.proposalId
}

function attachPreview(db, proposalId, previewId, diff = DIFF) {
  const row = db.prepare('SELECT plan_json FROM operations WHERE id = ?').get(proposalId)
  const plan = JSON.parse(row.plan_json)
  plan.change.previewId = previewId
  plan.change.previewChanges = diff
  const json = JSON.stringify(plan)
  db.prepare('UPDATE operations SET plan_json = ?, input_json = ? WHERE id = ?').run(json, json, proposalId)
}

function proposalRow(db, proposalId) {
  return db.prepare('SELECT state, plan_json FROM operations WHERE id = ?').get(proposalId)
}

function planOf(row) {
  return JSON.parse(row.plan_json)
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

function runtimeFor(previewId, indexValue, hooks = {}) {
  const writes = []
  const cancels = []
  const handoffMints = Array.isArray(hooks.handoffMints) ? hooks.handoffMints : []
  const aiRuntime = {
    async lanAssist(path, opts = {}) {
      if (path === '/state') {
        return {
          ok: true,
          writePreview: previewId ? { [previewId]: indexValue } : {},
          handoffMints,
          officialRoundSheet: null,
        }
      }
      if (path === '/write') {
        writes.push(opts.body || {})
        if (hooks.onWrite) return hooks.onWrite(opts.body || {})
        return { ok: true, receipt_id: 'rcpt_linked', preview_id: previewId }
      }
      if (path === '/write/cancel') {
        cancels.push(String((opts.body && opts.body.preview_id) || ''))
        return { ok: true }
      }
      return { ok: true }
    },
  }
  return { aiRuntime, writes, cancels }
}

async function planRequest(db, aiRuntime, method, pathname, body) {
  const response = captureResponse()
  const url = new URL(`http://127.0.0.1${pathname}`)
  const handled = await handlePlanRequest({ method, headers: {} }, response, url, {
    db,
    enqueueEvent() {},
    readJson: async () => body || {},
    aiRuntime,
    uiToken: '',
  }, 'corr_linked')
  assert.equal(handled, true)
  return response
}

function openFixture(name) {
  const dbPath = `/tmp/fde-plan-linked-${name}-${process.pid}.sqlite`
  rmSync(dbPath, { force: true })
  const db = openDatabase(dbPath, migrations)
  configureEventBus(db)
  registerWorkspace(db)
  return { db, dbPath }
}

test('confirm posts the business row before it applies the plan', async () => {
  const { db, dbPath } = openFixture('order')
  addTask(db, 'task_order')
  const proposalId = propose(db, 'task_order', '已确认')
  attachPreview(db, proposalId, PREVIEW)
  const seen = []
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'open', {
    onWrite() {
      seen.push(getTask(db, 'task_order', 'ws_chip').title)
      return { ok: true, receipt_id: 'rcpt_linked', preview_id: PREVIEW }
    },
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.deepEqual(writes.map((body) => body.preview_id), [PREVIEW])
  assert.equal(writes[0].source, 'workstation')
  assert.deepEqual(seen, ['原任务'])
  assert.equal(getTask(db, 'task_order', 'ws_chip').title, '已确认')
  const again = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.notEqual(again.status, 200)
  assert.equal(writes.length, 1)
  db.close()
  rmSync(dbPath, { force: true })
})

test('a failed business post does not confirm the plan', async () => {
  const { db, dbPath } = openFixture('write-fail')
  addTask(db, 'task_fail')
  const proposalId = propose(db, 'task_fail', '已确认')
  attachPreview(db, proposalId, PREVIEW)
  const { aiRuntime } = runtimeFor(PREVIEW, 'open', {
    onWrite() {
      return { ok: false, error: 'STALE', hint: '刚才那版不是现在这版' }
    },
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.notEqual(response.status, 200, response.body)
  assert.equal(getTask(db, 'task_fail', 'ws_chip').title, '原任务')
  assert.equal(proposalRow(db, proposalId).state, 'awaiting_approval')
  db.close()
  rmSync(dbPath, { force: true })
})

test('a plan failure after a successful post can be retried without a second post', async () => {
  const { db, dbPath } = openFixture('retry')
  addTask(db, 'task_retry')
  const proposalId = propose(db, 'task_retry', '已确认')
  attachPreview(db, proposalId, PREVIEW)
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'open', {
    onWrite() {
      db.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run('2099-01-01T00:00:00.000Z', 'task_retry')
      return { ok: true, receipt_id: 'rcpt_linked', preview_id: PREVIEW }
    },
  })
  const first = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.match(String(first.json().message || ''), /业务已写入，待办确认失败/)
  assert.equal(getTask(db, 'task_retry', 'ws_chip').title, '原任务')
  assert.equal(writes.length, 1)
  const second = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.match(String(second.json().message || ''), /业务已写入，待办确认失败/)
  assert.equal(writes.length, 1)
  assert.equal(getTask(db, 'task_retry', 'ws_chip').title, '原任务')
  db.close()
  rmSync(dbPath, { force: true })
})

test('an expired preview disables confirm and leaves the plan awaiting', async () => {
  const { db, dbPath } = openFixture('expired')
  addTask(db, 'task_expired')
  const proposalId = propose(db, 'task_expired', '已确认')
  attachPreview(db, proposalId, PREVIEW)
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'expired')
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.match(`${response.json().message || ''}`, /重新交给 AI/)
  assert.equal(writes.length, 0)
  assert.equal(getTask(db, 'task_expired', 'ws_chip').title, '原任务')
  assert.equal(proposalRow(db, proposalId).state, 'awaiting_approval')
  const listed = await planRequest(
    db,
    aiRuntime,
    'GET',
    '/api/v1/plan/task-proposals?workspaceId=ws_chip',
  )
  const card = listed.json().data[0].card
  assert.equal(card.confirm.enabled, false)
  assert.match(card.notice, /重新交给 AI/)
  assert.match(card.business.lines.join('\n'), /等级/)
  assert.match(card.business.lines.join('\n'), /B/)
  assert.match(card.business.lines.join('\n'), /A/)
  db.close()
  rmSync(dbPath, { force: true })
})

test('a posted preview confirms only the plan', async () => {
  const { db, dbPath } = openFixture('posted')
  addTask(db, 'task_posted')
  const proposalId = propose(db, 'task_posted', '已确认')
  attachPreview(db, proposalId, PREVIEW)
  insertBizWriteAudit(db, {
    workspaceCwd: '/ws-chip',
    traceId: 'trace_posted',
    kind: '客户',
    action: '改行',
    recordNo: 'CUST-020',
    receiptId: 'rcpt_posted',
    sessionId: 'sess_posted',
    source: 'workstation',
    changes: DIFF.changes,
    columns: [],
    lookupBind: { previewId: PREVIEW },
  })
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'used')
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.equal(writes.length, 0)
  assert.equal(getTask(db, 'task_posted', 'ws_chip').title, '已确认')
  const listed = await planRequest(
    db,
    aiRuntime,
    'GET',
    '/api/v1/plan/task-proposals?workspaceId=ws_chip',
  )
  assert.equal(listed.json().data.length, 0)
  db.close()
  rmSync(dbPath, { force: true })
})

test('a discarded preview does not post again and does not confirm the plan', async () => {
  const { db, dbPath } = openFixture('voided')
  addTask(db, 'task_voided')
  const proposalId = propose(db, 'task_voided', '已确认')
  attachPreview(db, proposalId, PREVIEW)
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'used')
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.notEqual(response.status, 200, response.body)
  assert.equal(writes.length, 0)
  assert.equal(getTask(db, 'task_voided', 'ws_chip').title, '原任务')
  assert.equal(proposalRow(db, proposalId).state, 'awaiting_approval')
  db.close()
  rmSync(dbPath, { force: true })
})

test('reject cancels the proposal and discards the unused preview without a business post', async () => {
  const { db, dbPath } = openFixture('reject')
  addTask(db, 'task_reject_link')
  const proposalId = propose(db, 'task_reject_link', '不采用')
  attachPreview(db, proposalId, PREVIEW)
  const { aiRuntime, writes, cancels } = runtimeFor(PREVIEW, 'open')
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/reject`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.deepEqual(cancels, [PREVIEW])
  assert.equal(writes.length, 0)
  assert.equal(getTask(db, 'task_reject_link', 'ws_chip').title, '原任务')
  assert.equal(proposalRow(db, proposalId).state, 'cancelled')
  db.close()
  rmSync(dbPath, { force: true })
})

test('a proposal with no preview keeps confirm on the plan only', async () => {
  const { db, dbPath } = openFixture('todo')
  addTask(db, 'task_todo')
  const proposalId = propose(db, 'task_todo', '只改待办')
  const { aiRuntime, writes } = runtimeFor('', 'open')
  const listed = await planRequest(
    db,
    aiRuntime,
    'GET',
    '/api/v1/plan/task-proposals?workspaceId=ws_chip',
  )
  const card = listed.json().data[0].card
  assert.equal(card.confirm.label, '确认')
  assert.equal(card.confirm.enabled, true)
  assert.equal(card.business, null)
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.equal(writes.length, 0)
  assert.equal(getTask(db, 'task_todo', 'ws_chip').title, '只改待办')
  db.close()
  rmSync(dbPath, { force: true })
})

test('handoff sheet does not auto-open the business drawer', () => {
  const panel = readFileSync(new URL('../../src/components/biz/RecordsPanel.tsx', import.meta.url), 'utf8')
  const pendingAt = panel.indexOf("useEvents(['biz.sheet.pending']")
  const runAt = panel.indexOf('const runPreview')
  const applyAt = panel.indexOf('const applyPendingSheet')
  assert.ok(pendingAt > 0 && runAt > pendingAt && applyAt > 0 && applyAt < pendingAt)
  const pending = panel.slice(pendingAt, runAt)
  const guardAt = pending.indexOf('sheetConfirmsOnPlanCard')
  const focusAt = pending.indexOf('focusBizRecordsPanel')
  assert.ok(guardAt >= 0)
  assert.ok(focusAt > guardAt)
  assert.match(pending, /if \(sheetConfirmsOnPlanCard\([^)]*\)\) return/)
  const apply = panel.slice(applyAt, pendingAt)
  const applyGuard = apply.indexOf('sheetConfirmsOnPlanCard')
  assert.ok(applyGuard >= 0)
  assert.ok(applyGuard < apply.indexOf('setDrawer'))
  assert.match(apply, /if \(sheetConfirmsOnPlanCard\([^)]*\)\) return/)
  const run = panel.slice(runAt, runAt + 2500)
  assert.equal(run.includes('setDrawer('), true)
  assert.equal(run.includes('sheetConfirmsOnPlanCard'), false)
})

test('the plan card view follows the preview face', async () => {
  const { planCardView } = await import('../plan/plan-card.mjs')
  const { parseLivePreviewId, sheetConfirmsOnPlanCard } = await import('../biz/confirm-mouth.mjs')
  assert.equal(parseLivePreviewId(PREVIEW), PREVIEW)
  assert.equal(parseLivePreviewId(EIGHT), null)
  assert.equal(sheetConfirmsOnPlanCard({ confirmMouth: 'plan' }), true)
  assert.equal(sheetConfirmsOnPlanCard({ preview_id: PREVIEW }), false)
  const open = planCardView({
    previewId: PREVIEW,
    token: { status: 'open' },
    audit: null,
    sheetChanges: DIFF.changes,
    action: DIFF.action,
  })
  assert.equal(open.confirm.label, '确认并过账')
  assert.equal(open.confirm.enabled, true)
  assert.match(open.business.lines.join('\n'), /等级/)
  const posted = planCardView({
    previewId: PREVIEW,
    token: { status: 'used' },
    audit: { traceId: 'trace_1' },
    sheetChanges: DIFF.changes,
    action: DIFF.action,
  })
  assert.equal(posted.confirm.label, '确认')
  assert.equal(posted.confirm.enabled, true)
  assert.match(posted.business.headline, /已过账/)
  const expired = planCardView({
    previewId: PREVIEW,
    token: { status: 'expired' },
    audit: null,
    sheetChanges: DIFF.changes,
    action: DIFF.action,
  })
  assert.equal(expired.confirm.enabled, false)
  assert.match(expired.notice, /重新交给 AI/)
  const voided = planCardView({
    previewId: PREVIEW,
    token: { status: 'used' },
    audit: null,
    sheetChanges: DIFF.changes,
    action: DIFF.action,
  })
  assert.equal(voided.confirm.enabled, false)
  const todo = planCardView({
    previewId: null,
    token: null,
    audit: null,
    sheetChanges: [],
    action: '',
  })
  assert.equal(todo.confirm.label, '确认')
  assert.equal(todo.business, null)
})

test('mint writes one primary preview id and a later empty proposal can take a fresh token', async () => {
  const { offerHandoffPreview } = await import('../plan/plan-card.mjs')
  const { db, dbPath } = openFixture('offer')
  addTask(db, 'task_offer')
  startTaskAiRun(db, { taskId: 'task_offer', sessionId: 'sess_offer', requestId: 'req_offer' })
  const firstId = propose(db, 'task_offer', '第一次')
  const voided = []
  const forced = new Map()
  const ctx = {
    now: Date.now(),
    tokenStatus(id) {
      if (voided.includes(id)) return 'used'
      return forced.get(id) || 'open'
    },
    voidPreview(id) {
      voided.push(id)
    },
  }
  const first = offerHandoffPreview(db, {
    type: 'mint',
    sessionId: 'sess_offer',
    previewId: PREVIEW,
    workstation: false,
    action: DIFF.action,
    changes: DIFF.changes,
  }, ctx)
  assert.equal(first.mouth, 'plan')
  assert.equal(planOf(proposalRow(db, firstId)).change.previewId, PREVIEW)
  const extra = offerHandoffPreview(db, {
    type: 'mint',
    sessionId: 'sess_offer',
    previewId: PREVIEW_NEXT,
    workstation: false,
    action: DIFF.action,
    changes: DIFF.changes,
  }, ctx)
  assert.deepEqual(voided, [PREVIEW_NEXT])
  assert.equal(planOf(proposalRow(db, firstId)).change.previewId, PREVIEW)
  assert.equal(extra.discardedPreviewId, PREVIEW_NEXT)
  forced.set(PREVIEW, 'expired')
  voided.length = 0
  const freshId = 'pv_0011223344556677'
  offerHandoffPreview(db, {
    type: 'mint',
    sessionId: 'sess_offer',
    previewId: freshId,
    workstation: false,
    action: DIFF.action,
    changes: DIFF.changes,
  }, ctx)
  assert.deepEqual(voided, [])
  assert.equal(planOf(proposalRow(db, firstId)).change.previewId, PREVIEW)
  const secondId = propose(db, 'task_offer', '重跑')
  offerHandoffPreview(db, { type: 'propose', taskId: 'task_offer', proposalId: secondId }, ctx)
  assert.equal(planOf(proposalRow(db, secondId)).change.previewId, freshId)
  assert.equal(planOf(proposalRow(db, firstId)).change.previewId, PREVIEW)
  const direct = offerHandoffPreview(db, {
    type: 'mint',
    sessionId: 'sess_offer',
    previewId: 'pv_8899aabbccddeeff',
    workstation: true,
    action: DIFF.action,
    changes: DIFF.changes,
  }, ctx)
  assert.equal(direct.mouth, 'drawer')
  assert.equal(voided.includes('pv_8899aabbccddeeff'), false)
  db.close()
  rmSync(dbPath, { force: true })
})

test('state poll binds open handoff mints onto awaiting proposals', async () => {
  const { db, dbPath } = openFixture('poll-bind')
  addTask(db, 'task_poll')
  startTaskAiRun(db, { taskId: 'task_poll', sessionId: 'sess_poll', requestId: 'req_poll' })
  const proposalId = propose(db, 'task_poll', '轮询绑定')
  const cancels = []
  const handle = startLanAssistStateWatch({
    cwd: '/ws-chip',
    db,
    lanAssist: async (path, opts = {}) => {
      if (path === '/state') {
        return {
          ok: true,
          writePreview: { [PREVIEW]: 'open' },
          handoffMints: [{
            previewId: PREVIEW,
            sessionId: 'sess_poll',
            workstation: false,
            action: DIFF.action,
            changes: DIFF.changes,
          }],
          officialRoundSheet: null,
        }
      }
      if (path === '/write/cancel') {
        cancels.push(String((opts.body && opts.body.preview_id) || ''))
        return { ok: true }
      }
      if (path === '/sleep') return { ok: true }
      return { ok: true }
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 40))
  handle.stop()
  const change = planOf(proposalRow(db, proposalId)).change
  assert.equal(change.previewId, PREVIEW)
  assert.equal(change.previewChanges.action, DIFF.action)
  assert.deepEqual(cancels, [])
  db.close()
  rmSync(dbPath, { force: true })
})

test('confirm without a stored preview id binds one open mint then posts and decides', async () => {
  const { db, dbPath } = openFixture('bind-confirm')
  addTask(db, 'task_one')
  startTaskAiRun(db, { taskId: 'task_one', sessionId: 'sess_one', requestId: 'req_one' })
  const proposalId = propose(db, 'task_one', '绑定确认')
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [{
      previewId: PREVIEW,
      sessionId: 'sess_one',
      workstation: false,
      action: DIFF.action,
      changes: DIFF.changes,
    }],
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].preview_id, PREVIEW)
  assert.equal(writes[0].source, 'workstation')
  assert.equal(getTask(db, 'task_one', 'ws_chip').title, '绑定确认')
  assert.equal(planOf(proposalRow(db, proposalId)).change.previewId, PREVIEW)
  db.close()
  rmSync(dbPath, { force: true })
})

test('a failed bind confirm write leaves the proposal awaiting with the preview id', async () => {
  const { db, dbPath } = openFixture('bind-write-fail')
  addTask(db, 'task_bind_fail')
  startTaskAiRun(db, { taskId: 'task_bind_fail', sessionId: 'sess_one', requestId: 'req_bind_fail' })
  const proposalId = propose(db, 'task_bind_fail', '绑定失败')
  const { aiRuntime } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [{
      previewId: PREVIEW,
      sessionId: 'sess_one',
      workstation: false,
      action: DIFF.action,
      changes: DIFF.changes,
    }],
    onWrite() {
      return { ok: false, error: 'STALE' }
    },
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.notEqual(response.status, 200, response.body)
  assert.equal(getTask(db, 'task_bind_fail', 'ws_chip').title, '原任务')
  assert.equal(proposalRow(db, proposalId).state, 'awaiting_approval')
  assert.equal(planOf(proposalRow(db, proposalId)).change.previewId, PREVIEW)
  db.close()
  rmSync(dbPath, { force: true })
})

test('two open handoff mints refuse confirm without writing', async () => {
  const { db, dbPath } = openFixture('bind-ambiguous')
  addTask(db, 'task_amb')
  startTaskAiRun(db, { taskId: 'task_amb', sessionId: 'sess_one', requestId: 'req_amb' })
  const proposalId = propose(db, 'task_amb', '多份预览')
  const { aiRuntime, writes } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [
      {
        previewId: PREVIEW,
        sessionId: 'sess_one',
        workstation: false,
        action: DIFF.action,
        changes: DIFF.changes,
      },
      {
        previewId: PREVIEW_NEXT,
        sessionId: 'sess_one',
        workstation: false,
        action: DIFF.action,
        changes: DIFF.changes,
      },
    ],
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 409, response.body)
  assert.equal(response.json().error, 'preview_ambiguous')
  assert.equal(writes.length, 0)
  assert.equal(getTask(db, 'task_amb', 'ws_chip').title, '原任务')
  assert.equal(proposalRow(db, proposalId).state, 'awaiting_approval')
  db.close()
  rmSync(dbPath, { force: true })
})

test('stampPlanConfirmMouth stamps completed runs with awaiting plan proposals', () => {
  const { db, dbPath } = openFixture('mouth-stamp')
  addTask(db, 'task_mouth')
  startTaskAiRun(db, { taskId: 'task_mouth', sessionId: 'sess_mouth', requestId: 'req_mouth' })
  propose(db, 'task_mouth', '待确认')
  completeTaskAiRun(db, 'task_mouth')
  const stamped = stampPlanConfirmMouth(db, { sessionId: 'sess_mouth', kind: '客户' })
  assert.equal(stamped.confirmMouth, 'plan')
  const other = stampPlanConfirmMouth(db, { sessionId: 'sess_other', kind: '客户' })
  assert.equal(other.confirmMouth, undefined)
  db.close()
  rmSync(dbPath, { force: true })
})

test('sheetPayloadFromRaw keeps confirmMouth plan', () => {
  const payload = sheetPayloadFromRaw({
    kind: '客户',
    action: '改行',
    confirmMouth: 'plan',
    preview_id: PREVIEW,
  })
  assert.equal(payload.confirmMouth, 'plan')
})

test('confirm leaves a preview that another awaiting proposal already holds', async () => {
  const { db, dbPath } = openFixture('bind-held')
  addTask(db, 'task_held')
  startTaskAiRun(db, { taskId: 'task_held', sessionId: 'sess_one', requestId: 'req_held' })
  const firstId = propose(db, 'task_held', '先提案')
  const secondId = propose(db, 'task_held', '后提案')
  attachPreview(db, firstId, PREVIEW)
  const { aiRuntime, writes, cancels } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [{
      previewId: PREVIEW,
      sessionId: 'sess_one',
      workstation: false,
      action: DIFF.action,
      changes: DIFF.changes,
    }],
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${secondId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.equal(writes.length, 0)
  assert.deepEqual(cancels, [])
  assert.equal(planOf(proposalRow(db, firstId)).change.previewId, PREVIEW)
  assert.equal(proposalRow(db, firstId).state, 'awaiting_approval')
  assert.equal(parseLive(planOf(proposalRow(db, secondId))), null)
  db.close()
  rmSync(dbPath, { force: true })
})

function parseLive(plan) {
  const id = plan && plan.change && plan.change.previewId
  return id || null
}

test('reject does not cancel a preview another awaiting proposal holds', async () => {
  const { db, dbPath } = openFixture('reject-held')
  addTask(db, 'task_reject_held')
  startTaskAiRun(db, { taskId: 'task_reject_held', sessionId: 'sess_one', requestId: 'req_reject_held' })
  const firstId = propose(db, 'task_reject_held', '先提案')
  const secondId = propose(db, 'task_reject_held', '后提案')
  attachPreview(db, firstId, PREVIEW)
  const { aiRuntime, writes, cancels } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [{
      previewId: PREVIEW,
      sessionId: 'sess_one',
      workstation: false,
      action: DIFF.action,
      changes: DIFF.changes,
    }],
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${secondId}/reject`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.equal(writes.length, 0)
  assert.deepEqual(cancels, [])
  assert.equal(proposalRow(db, secondId).state, 'cancelled')
  assert.equal(planOf(proposalRow(db, firstId)).change.previewId, PREVIEW)
  assert.equal(proposalRow(db, firstId).state, 'awaiting_approval')
  db.close()
  rmSync(dbPath, { force: true })
})

test('confirm cancels an unbound extra mint and keeps the posted preview', async () => {
  const { db, dbPath } = openFixture('cancel-extra')
  addTask(db, 'task_extra')
  startTaskAiRun(db, { taskId: 'task_extra', sessionId: 'sess_one', requestId: 'req_extra' })
  const proposalId = propose(db, 'task_extra', '已绑定')
  attachPreview(db, proposalId, PREVIEW)
  const { aiRuntime, writes, cancels } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [
      {
        previewId: PREVIEW,
        sessionId: 'sess_one',
        workstation: false,
        action: DIFF.action,
        changes: DIFF.changes,
      },
      {
        previewId: PREVIEW_NEXT,
        sessionId: 'sess_one',
        workstation: false,
        action: DIFF.action,
        changes: DIFF.changes,
      },
    ],
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/confirm`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].preview_id, PREVIEW)
  assert.deepEqual(cancels, [PREVIEW_NEXT])
  db.close()
  rmSync(dbPath, { force: true })
})

test('reject without a stored preview id cancels the open mint and proposal', async () => {
  const { db, dbPath } = openFixture('bind-reject')
  addTask(db, 'task_bind_reject')
  startTaskAiRun(db, { taskId: 'task_bind_reject', sessionId: 'sess_one', requestId: 'req_bind_reject' })
  const proposalId = propose(db, 'task_bind_reject', '拒绝绑定')
  const { aiRuntime, writes, cancels } = runtimeFor(PREVIEW, 'open', {
    handoffMints: [{
      previewId: PREVIEW,
      sessionId: 'sess_one',
      workstation: false,
      action: DIFF.action,
      changes: DIFF.changes,
    }],
  })
  const response = await planRequest(
    db,
    aiRuntime,
    'POST',
    `/api/v1/plan/task-proposals/${proposalId}/reject`,
    { workspaceId: 'ws_chip' },
  )
  assert.equal(response.status, 200, response.body)
  assert.deepEqual(cancels, [PREVIEW])
  assert.equal(writes.length, 0)
  assert.equal(proposalRow(db, proposalId).state, 'cancelled')
  db.close()
  rmSync(dbPath, { force: true })
})
