import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { dispatchWorkflowEnvelope, tickWorkflowCrons } from '../plan/workflow-triggers.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

function delayDef() {
  return JSON.stringify({
    steps: [{ id: 's1', kind: 'delay', label: '等待', config: { waitSeconds: 0 } }],
  })
}

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify({ cwd }), now, now)
}

function insertWorkflow(db, { id, workspaceId, trigger, status = 'active' }) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, workspaceId, id, status, JSON.stringify(trigger), delayDef(), now, now)
}

function runtime() {
  return {
    status: () => ({ connected: true }),
    origin: 'http://127.0.0.1:9',
    cookie: 'c',
    dshHome: '/tmp/fde-x-trigger-unused',
    async call() {
      return { sessionId: 'session-none' }
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/end' } }
    },
  }
}

async function waitRun(db, workflowId) {
  const started = Date.now()
  while (Date.now() - started < 4000) {
    const row = db.prepare('SELECT state FROM workflow_runs WHERE workflow_id = ? ORDER BY created_at DESC').get(workflowId)
    if (row && row.state !== 'queued' && row.state !== 'running') return row
    await new Promise((resolve) => setImmediate(resolve))
  }
  return db.prepare('SELECT state FROM workflow_runs WHERE workflow_id = ? ORDER BY created_at DESC').get(workflowId)
}

test('定时到点会跑，同一分钟不重复，开机前的分钟跳过', async () => {
  const dbPath = join(tmpdir(), `fde-x-cron-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  try {
    insertWorkspace(db, 'ws_c', '/tmp/ws-c')
    insertWorkflow(db, { id: 'wf_cron', workspaceId: 'ws_c', trigger: { kind: 'cron', expr: '16 18 * * *', tz: 'Asia/Shanghai' } })
    const now = new Date('2026-11-11T10:16:20.000Z')
    const bootedAt = new Date('2026-11-11T10:14:00.000Z')
    const first = tickWorkflowCrons({ db, aiRuntime: runtime() }, { now, bootedAt })
    assert.equal(first.started.length, 1)
    await waitRun(db, 'wf_cron')
    const second = tickWorkflowCrons({ db, aiRuntime: runtime() }, { now, bootedAt })
    assert.equal(second.started.some((row) => row.already), true)
    const rows = db.prepare('SELECT trigger_json, schedule_key FROM workflow_runs WHERE workflow_id = ?').all('wf_cron')
    assert.equal(rows.length, 1)
    assert.equal(JSON.parse(rows[0].trigger_json).kind, 'cron')
    assert.equal(rows[0].schedule_key.startsWith('cron:wf_cron@'), true)

    const dbPath2 = join(tmpdir(), `fde-x-cron-miss-${process.pid}.sqlite`)
    const db2 = openDatabase(dbPath2, migrations)
    insertWorkspace(db2, 'ws_m', '/tmp/ws-m')
    insertWorkflow(db2, { id: 'wf_miss', workspaceId: 'ws_m', trigger: { kind: 'cron', expr: '16 18 * * *', tz: 'Asia/Shanghai' } })
    tickWorkflowCrons({ db: db2, aiRuntime: runtime() }, {
      now: new Date('2026-11-11T10:16:20.000Z'),
      bootedAt: new Date('2026-11-11T10:16:10.000Z'),
    })
    assert.equal(db2.prepare('SELECT COUNT(*) AS n FROM workflow_runs').get().n, 0)
    db2.close()
    await rm(dbPath2, { force: true })
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('任务完成、文件保存、新订单、收到 IM、关键字会开跑；改行和暂停不会', async () => {
  const dbPath = join(tmpdir(), `fde-x-evt-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const deps = { db, aiRuntime: runtime() }
  try {
    insertWorkspace(db, 'ws_e', '/tmp/ws-e')
    insertWorkflow(db, { id: 'wf_done', workspaceId: 'ws_e', trigger: { kind: 'event', on: 'task.done' } })
    insertWorkflow(db, { id: 'wf_file', workspaceId: 'ws_e', trigger: { kind: 'event', on: 'file.save' } })
    insertWorkflow(db, { id: 'wf_order', workspaceId: 'ws_e', trigger: { kind: 'event', on: 'order.new' } })
    insertWorkflow(db, { id: 'wf_im', workspaceId: 'ws_e', trigger: { kind: 'event', on: 'im.received' } })
    insertWorkflow(db, { id: 'wf_kw', workspaceId: 'ws_e', trigger: { kind: 'keyword', patterns: ['触发核关键字'] } })
    insertWorkflow(db, { id: 'wf_pause', workspaceId: 'ws_e', status: 'paused', trigger: { kind: 'event', on: 'task.done' } })

    dispatchWorkflowEnvelope(deps, {
      type: 'task.changed',
      workspaceCwd: '/tmp/ws-e',
      payload: { id: 'task_1', op: 'update', status: 'done' },
    })
    dispatchWorkflowEnvelope(deps, {
      type: 'file.save',
      workspaceCwd: '/tmp/ws-e',
      payload: { path: 'a.txt' },
    })
    dispatchWorkflowEnvelope(deps, {
      type: 'biz.write.done',
      workspaceCwd: '/tmp/ws-e',
      payload: { kind: '销售订单', action: '新建', recordNo: 'SO-1' },
    })
    dispatchWorkflowEnvelope(deps, {
      type: 'biz.write.done',
      workspaceCwd: '/tmp/ws-e',
      payload: { kind: '销售订单', action: '改行', recordNo: 'SO-1' },
    })
    dispatchWorkflowEnvelope(deps, {
      type: 'im.message.received',
      workspaceCwd: null,
      payload: { requestId: 'req_1', text: '请看 触发核关键字', workspace: '/tmp/ws-e' },
    })

    await waitRun(db, 'wf_done')
    await waitRun(db, 'wf_file')
    await waitRun(db, 'wf_order')
    await waitRun(db, 'wf_im')
    await waitRun(db, 'wf_kw')

    const count = (id) => db.prepare('SELECT COUNT(*) AS n FROM workflow_runs WHERE workflow_id = ?').get(id).n
    assert.equal(count('wf_done'), 1)
    assert.equal(count('wf_file'), 1)
    assert.equal(count('wf_order'), 1)
    assert.equal(count('wf_im'), 1)
    assert.equal(count('wf_kw'), 1)
    assert.equal(count('wf_pause'), 0)
    const order = db.prepare('SELECT trigger_json FROM workflow_runs WHERE workflow_id = ?').get('wf_order')
    assert.equal(JSON.parse(order.trigger_json).on, 'order.new')
  } finally {
    db.close()
    await rm(dbPath, { force: true })
  }
})

test('BFF cron tick wraps sync tickWorkflowCrons in Promise.resolve', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8')
  assert.match(source, /Promise\.resolve\(tickWorkflowCrons\(/)
  assert.equal(source.includes('tickWorkflowCrons({ db, aiRuntime }, clock).catch('), false)
})

test('计划页不再写只保存不执行', () => {
  const source = readFileSync(new URL('../../src/pages/Plan.tsx', import.meta.url), 'utf8')
  assert.equal(source.includes('本版仅保存，不自动执行'), false)
  assert.equal(source.includes('tickWorkflowCrons'), false)
  assert.equal(source.includes('启用后，定时到点'), true)
})
