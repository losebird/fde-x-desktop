import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-plan-history-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')
const port = 4421
const base = `http://127.0.0.1:${port}`
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tokenPath = join(dshHome, 'run', 'bridge.token')
const longNotes = '注'.repeat(250)
const step = { kind: 'ai', name: '问', config: { prompt: '你好' } }

let child
let pageToken = ''
let bridgeToken = ''

function pageHeaders() {
  return {
    Origin: origin,
    'Content-Type': 'application/json',
    'x-fde-ui-token': pageToken,
  }
}

async function readJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function boot() {
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
    } catch { /* retry */ }
    if (child.exitCode != null) break
    await delay(100)
  }
  throw new Error(`plan history server failed to start\n${stderr}\n${stdout}`)
}

async function startServer() {
  await rm(root, { recursive: true, force: true })
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  await boot()
}

async function stopServer() {
  if (!child || child.exitCode != null) return
  child.kill('SIGTERM')
  for (let i = 0; i < 40; i += 1) {
    if (child.exitCode != null) return
    await delay(50)
  }
  child.kill('SIGKILL')
}

async function restartServer() {
  await stopServer()
  await boot()
}

async function createWorkspace() {
  const id = `ws_${randomUUID().replaceAll('-', '').slice(0, 12)}`
  const res = await fetch(`${base}/api/v1/workspaces`, {
    method: 'POST',
    headers: pageHeaders(),
    body: JSON.stringify({ id, name: id, description: 'plan history' }),
  })
  const payload = await readJson(res)
  assert.equal(res.status, 201, JSON.stringify(payload))
  return id
}

async function send(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: pageHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await readJson(res)
  return { status: res.status, payload }
}

function ref(kind, id) {
  return `fde://plan/${kind}/${id}`
}

async function history(workspaceId, targetRef) {
  const params = new URLSearchParams()
  if (workspaceId !== undefined) params.set('workspaceId', workspaceId)
  if (targetRef !== undefined) params.set('targetRef', targetRef)
  const res = await fetch(`${base}/api/v1/plan/history?${params}`)
  const payload = await readJson(res)
  return { status: res.status, payload }
}

function entriesOf(result) {
  assert.equal(result.status, 200, JSON.stringify(result.payload))
  assert.equal(result.payload.ok, true)
  assert.equal(result.payload.data.hostManaged, false)
  const entries = result.payload.data.entries
  assert.ok(Array.isArray(entries))
  return entries
}

function change(entry, field) {
  return (entry.changes || []).find((item) => item.field === field)
}

function titleUpdates(entries) {
  return entries.filter((entry) => entry.action === 'plan.task.update' && change(entry, 'title'))
}

describe('plan history', { concurrency: 1 }, () => {
  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })

  test('three task edits keep before and after, including conflict, restart, and a legacy row', async () => {
    const workspaceId = await createWorkspace()
    const otherId = await createWorkspace()
    const created = await send('POST', '/api/v1/plan/tasks', { workspaceId, title: 'v1' })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const task = created.payload.data
    const targetRef = ref('tasks', task.id)

    const toV2 = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, { workspaceId, title: 'v2' })
    assert.equal(toV2.status, 200, JSON.stringify(toV2.payload))
    const toV3 = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, { workspaceId, title: 'v3' })
    assert.equal(toV3.status, 200, JSON.stringify(toV3.payload))
    const toV4 = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, { workspaceId, title: 'v4' })
    assert.equal(toV4.status, 200, JSON.stringify(toV4.payload))
    assert.equal(toV4.payload.data.title, 'v4')

    const noted = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, {
      workspaceId,
      notes: longNotes,
      via: 'organize',
    })
    assert.equal(noted.status, 200, JSON.stringify(noted.payload))
    assert.equal(noted.payload.data.notes, longNotes)
    const doing = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, { workspaceId, status: 'doing' })
    assert.equal(doing.status, 200, JSON.stringify(doing.payload))
    const bogus = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, { workspaceId, status: 'bogus' })
    assert.equal(bogus.status, 422)
    const empty = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, { workspaceId })
    assert.equal(empty.status, 200, JSON.stringify(empty.payload))
    assert.equal(empty.payload.data.title, 'v4')
    assert.equal(empty.payload.data.status, 'doing')

    const db = new DatabaseSync(dbPath, { timeout: 5000 })
    db.prepare(`
      INSERT INTO audit_entries
        (id, workspace_id, actor_id, action, target_ref, outcome, risk_level, correlation_id, details_json, occurred_at)
      VALUES (?, ?, NULL, 'plan.task.update', ?, 'succeeded', 'low', 'corr_legacy', '{"id":"legacy"}', '2020-01-01T00:00:00.000Z')
    `).run(`audit_legacy_${task.id}`, workspaceId, targetRef)
    db.close()

    const seen = entriesOf(await history(workspaceId, targetRef))
    assert.deepEqual(
      titleUpdates(seen).map((entry) => change(entry, 'title')),
      [
        { field: 'title', before: 'v3', after: 'v4' },
        { field: 'title', before: 'v2', after: 'v3' },
        { field: 'title', before: 'v1', after: 'v2' },
      ],
    )
    assert.equal(titleUpdates(seen).some((entry) => entry.actor !== 'you'), false)
    const notes = seen.find((entry) => entry.via === 'organize')
    assert.ok(notes, 'organize write is marked on the history entry')
    assert.deepEqual(change(notes, 'notes'), { field: 'notes', before: '', after: '注'.repeat(200) })
    assert.equal((notes.changes || []).some((item) => item.field === 'via'), false)
    assert.deepEqual(change(seen.find((entry) => change(entry, 'status')), 'status'), {
      field: 'status',
      before: 'todo',
      after: 'doing',
    })
    const legacy = seen.filter((entry) => entry.legacy)
    assert.equal(legacy.length, 1)
    assert.equal(legacy[0].changes, null)
    assert.match(legacy[0].label, /早期记录无详情/)
    const createdEntry = seen.find((entry) => entry.action === 'plan.task.insert')
    assert.ok(createdEntry)
    assert.match(createdEntry.label, /新建/)
    for (let i = 1; i < seen.length; i += 1) {
      assert.ok(seen[i - 1].at >= seen[i].at)
    }

    const hidden = await history(otherId, targetRef)
    assert.equal(hidden.status, 404)
    assert.equal(hidden.payload.error, 'not_found')
    const missingWs = await history(undefined, targetRef)
    assert.equal(missingWs.status, 400)
    assert.equal(missingWs.payload.error, 'missing_workspace_id')
    const missingRef = await history(workspaceId, undefined)
    assert.equal(missingRef.status, 400)
    assert.equal(missingRef.payload.error, 'missing_target_ref')
    const host = await history(workspaceId, ref('tasks', 'dsh-goal:goal1'))
    assert.equal(host.status, 200, JSON.stringify(host.payload))
    assert.equal(host.payload.data.hostManaged, true)
    assert.match(JSON.stringify(host.payload.data), /Host 管理/)

    const stale = await send('PATCH', `/api/v1/plan/tasks/${encodeURIComponent(task.id)}`, {
      workspaceId,
      title: 'nope',
      expectedUpdatedAt: task.updatedAt,
    })
    assert.equal(stale.status, 409, JSON.stringify(stale.payload))
    assert.equal(stale.payload.ok, false)
    assert.equal(stale.payload.error, 'conflict')
    assert.match(stale.payload.message, /被改过/)
    const still = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${encodeURIComponent(workspaceId)}`)
    const stillBody = await readJson(still)
    assert.equal(stillBody.data.find((row) => row.id === task.id).title, 'v4')

    await restartServer()
    const again = entriesOf(await history(workspaceId, targetRef))
    assert.deepEqual(
      titleUpdates(again).map((entry) => change(entry, 'title')),
      [
        { field: 'title', before: 'v3', after: 'v4' },
        { field: 'title', before: 'v2', after: 'v3' },
        { field: 'title', before: 'v1', after: 'v2' },
      ],
    )
    assert.equal(again.filter((entry) => entry.legacy).length, 1)
    const listed = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${encodeURIComponent(workspaceId)}`)
    const listedBody = await readJson(listed)
    assert.equal(listedBody.data.find((row) => row.id === task.id).title, 'v4')
  })

  test('workflow and event history keep repeated edits and merge runs', async () => {
    const workspaceId = await createWorkspace()
    const createdWf = await send('POST', '/api/v1/plan/workflows', { workspaceId, name: '流' })
    assert.equal(createdWf.status, 201, JSON.stringify(createdWf.payload))
    const workflow = createdWf.payload.data
    const renamed = await send('PATCH', `/api/v1/plan/workflows/${encodeURIComponent(workflow.id)}`, { workspaceId, name: '流 v2' })
    assert.equal(renamed.status, 200, JSON.stringify(renamed.payload))
    const renamedAgain = await send('PATCH', `/api/v1/plan/workflows/${encodeURIComponent(workflow.id)}`, { workspaceId, name: '流 v3' })
    assert.equal(renamedAgain.status, 200, JSON.stringify(renamedAgain.payload))
    const stepped = await send('PATCH', `/api/v1/plan/workflows/${encodeURIComponent(workflow.id)}`, { workspaceId, steps: [step] })
    assert.equal(stepped.status, 200, JSON.stringify(stepped.payload))
    const activated = await send('PATCH', `/api/v1/plan/workflows/${encodeURIComponent(workflow.id)}`, { workspaceId, status: 'active' })
    assert.equal(activated.status, 200, JSON.stringify(activated.payload))

    const createdEvent = await send('POST', '/api/v1/plan/events', {
      workspaceId,
      title: '会 v1',
      startAt: '2026-10-19T10:45:00.000Z',
      endAt: '2026-10-19T11:00:00.000Z',
      workflowId: workflow.id,
      recurrence: 'once',
    })
    assert.equal(createdEvent.status, 201, JSON.stringify(createdEvent.payload))
    const event = createdEvent.payload.data
    const eventV2 = await send('PATCH', `/api/v1/plan/events/${encodeURIComponent(event.id)}`, { workspaceId, title: '会 v2' })
    assert.equal(eventV2.status, 200, JSON.stringify(eventV2.payload))
    const eventV3 = await send('PATCH', `/api/v1/plan/events/${encodeURIComponent(event.id)}`, { workspaceId, title: '会 v3' })
    assert.equal(eventV3.status, 200, JSON.stringify(eventV3.payload))
    const unbound = await send('POST', '/api/v1/plan/events', {
      workspaceId,
      title: '未绑定',
      startAt: '2026-10-19T12:00:00.000Z',
      endAt: '2026-10-19T12:30:00.000Z',
    })
    assert.equal(unbound.status, 201, JSON.stringify(unbound.payload))
    const noToken = await fetch(`${base}/api/v1/plan/events/${encodeURIComponent(unbound.payload.data.id)}`, {
      method: 'PATCH',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, workflowId: workflow.id, recurrence: 'daily' }),
    })
    assert.equal(noToken.status, 401)

    const missedAt = '2026-10-19T10:45:00.000Z'
    const skippedAt = '2026-10-19T18:45:00.000Z'
    const db = new DatabaseSync(dbPath, { timeout: 5000 })
    const insertRun = db.prepare(`
      INSERT INTO workflow_runs
        (id, workflow_id, state, trigger_json, input_json, output_json, correlation_id, started_at, finished_at, created_at, schedule_key)
      VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)
    `)
    insertRun.run(
      `wfr_miss_${event.id}`,
      workflow.id,
      'cancelled',
      JSON.stringify({ kind: 'schedule', eventId: event.id, occurrence: missedAt }),
      JSON.stringify({ message: '错过' }),
      `schedule:${event.id}:${missedAt}`,
      null,
      missedAt,
      missedAt,
      `${event.id}@${missedAt}`,
    )
    insertRun.run(
      `wfr_skip_${event.id}`,
      workflow.id,
      'cancelled',
      JSON.stringify({ kind: 'schedule', eventId: event.id, occurrence: skippedAt }),
      JSON.stringify({ message: '工作流已暂停，未运行' }),
      `schedule:${event.id}:${skippedAt}`,
      null,
      skippedAt,
      skippedAt,
      `${event.id}@${skippedAt}`,
    )
    insertRun.run(
      `wfr_manual_${workflow.id}`,
      workflow.id,
      'succeeded',
      JSON.stringify({ kind: 'manual' }),
      JSON.stringify({ message: '完成', sessionId: 'ses_hist' }),
      `manual:${workflow.id}`,
      '2026-10-19T09:00:00.000Z',
      '2026-10-19T09:07:00.000Z',
      '2026-10-19T09:00:00.000Z',
      null,
    )
    db.close()

    const wfEntries = entriesOf(await history(workspaceId, ref('workflows', workflow.id)))
    const names = wfEntries
      .filter((entry) => entry.action === 'plan.workflow.update' && change(entry, 'name'))
      .map((entry) => change(entry, 'name'))
    assert.deepEqual(names, [
      { field: 'name', before: '流 v2', after: '流 v3' },
      { field: 'name', before: '流', after: '流 v2' },
    ])
    assert.deepEqual(change(wfEntries.find((entry) => change(entry, 'steps')), 'steps'), {
      field: 'steps',
      before: [],
      after: [step],
    })
    assert.deepEqual(change(wfEntries.find((entry) => change(entry, 'status')), 'status'), {
      field: 'status',
      before: 'paused',
      after: 'active',
    })
    const manual = wfEntries.find((entry) => entry.kind === 'run' && entry.run && entry.run.trigger === 'manual')
    assert.ok(manual)
    assert.equal(manual.run.state, 'succeeded')
    assert.equal(manual.run.message, '完成')
    assert.equal(manual.run.sessionId, 'ses_hist')

    const eventEntries = entriesOf(await history(workspaceId, ref('events', event.id)))
    const titles = eventEntries
      .filter((entry) => entry.action === 'plan.event.update' && change(entry, 'title'))
      .map((entry) => change(entry, 'title'))
    assert.deepEqual(titles, [
      { field: 'title', before: '会 v2', after: '会 v3' },
      { field: 'title', before: '会 v1', after: '会 v2' },
    ])
    const runs = eventEntries.filter((entry) => entry.kind === 'run').map((entry) => entry.run.message).sort()
    assert.deepEqual(runs, ['工作流已暂停，未运行', '错过'])
    assert.equal(eventEntries.some((entry) => entry.run && entry.run.sessionId === 'ses_hist'), false)
    const unboundEntries = entriesOf(await history(workspaceId, ref('events', unbound.payload.data.id)))
    assert.equal(unboundEntries.some((entry) => entry.kind === 'run'), false)
    assert.equal(unboundEntries.some((entry) => change(entry, 'workflowId')), false)

    const staleName = await send('PATCH', `/api/v1/plan/workflows/${encodeURIComponent(workflow.id)}`, {
      workspaceId,
      name: '流 nope',
      expectedUpdatedAt: workflow.updatedAt,
    })
    assert.equal(staleName.status, 409, JSON.stringify(staleName.payload))
    assert.equal(staleName.payload.error, 'conflict')
    const staleEvent = await send('PATCH', `/api/v1/plan/events/${encodeURIComponent(event.id)}`, {
      workspaceId,
      title: '会 nope',
      expectedUpdatedAt: event.updatedAt,
    })
    assert.equal(staleEvent.status, 409, JSON.stringify(staleEvent.payload))
    assert.equal(staleEvent.payload.error, 'conflict')
    const wfNow = await fetch(`${base}/api/v1/plan/workflows?workspaceId=${encodeURIComponent(workspaceId)}`)
    const wfBody = await readJson(wfNow)
    assert.equal(wfBody.data.find((row) => row.id === workflow.id).name, '流 v3')
  })

  test('confirmed and rejected task proposals show the proposed diff', async () => {
    const workspaceId = await createWorkspace()
    const created = await send('POST', '/api/v1/plan/tasks', { workspaceId, title: '原来的标题' })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const task = created.payload.data
    const proposed = await send('POST', '/api/v1/bridge/plan-task-propose', {
      workspaceId,
      op: 'update',
      taskId: task.id,
      title: '提案标题',
    })
    assert.equal(proposed.status, 401)
    const bridged = await fetch(`${base}/api/v1/bridge/plan-task-propose`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'x-fde-bridge-token': bridgeToken,
      },
      body: JSON.stringify({
        workspaceId,
        op: 'update',
        taskId: task.id,
        title: '提案标题',
      }),
    })
    const bridgedBody = await readJson(bridged)
    assert.equal(bridged.status, 200, JSON.stringify(bridgedBody))
    const proposalId = bridgedBody.data.proposalId
    const confirmed = await send('POST', `/api/v1/plan/task-proposals/${encodeURIComponent(proposalId)}/confirm`, {
      workspaceId,
      title: '请求体标题',
    })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.payload))
    const listed = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${encodeURIComponent(workspaceId)}`)
    const listedBody = await readJson(listed)
    assert.equal(listedBody.data.find((row) => row.id === task.id).title, '提案标题')

    const rejectedProposal = await fetch(`${base}/api/v1/bridge/plan-task-propose`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'x-fde-bridge-token': bridgeToken,
      },
      body: JSON.stringify({
        workspaceId,
        op: 'update',
        taskId: task.id,
        priority: 'high',
      }),
    })
    const rejectedBody = await readJson(rejectedProposal)
    assert.equal(rejectedProposal.status, 200, JSON.stringify(rejectedBody))
    const rejected = await send('POST', `/api/v1/plan/task-proposals/${encodeURIComponent(rejectedBody.data.proposalId)}/reject`, { workspaceId })
    assert.equal(rejected.status, 200, JSON.stringify(rejected.payload))

    const seen = entriesOf(await history(workspaceId, ref('tasks', task.id)))
    const confirmEntry = seen.find((entry) => entry.action === 'plan.task.confirm')
    assert.ok(confirmEntry)
    assert.equal(confirmEntry.actor, 'ai')
    assert.match(confirmEntry.label, /AI 提案/)
    assert.match(confirmEntry.label, /已确认/)
    assert.deepEqual(change(confirmEntry, 'title'), {
      field: 'title',
      before: '原来的标题',
      after: '提案标题',
    })
    const rejectEntry = seen.find((entry) => entry.action === 'plan.task.reject')
    assert.ok(rejectEntry)
    assert.match(rejectEntry.label, /已拒绝/)
    assert.deepEqual(change(rejectEntry, 'priority'), {
      field: 'priority',
      before: 'med',
      after: 'high',
    })
    const afterReject = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${encodeURIComponent(workspaceId)}`)
    const afterBody = await readJson(afterReject)
    assert.equal(afterBody.data.find((row) => row.id === task.id).priority, 'med')
    assert.equal(seen.some((entry) => entry.action === 'plan.task.propose'), false)
  })
})
