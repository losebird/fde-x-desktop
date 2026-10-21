import './support/no-stray-processes.mjs'
import http from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../db.mjs'
import { startWorkflowRun } from '../plan/workflow-run.mjs'

const home = join(tmpdir(), `fde-x-tool-approval-${process.pid}`)
process.env.FDE_DSH_HOME = home
mkdirSync(join(home, 'run'), { recursive: true })
writeFileSync(join(home, 'run', 'bridge-tools.json'), `${JSON.stringify({
  ok: true,
  workflowLimit: true,
  tools: ['fde_app_records_query', 'fde_app_records_propose', 'fde_plan_task_propose'],
})}\n`)

const migrations = join(import.meta.dirname, '..', 'migrations')
const BLOCK = '当前权限会要求确认，这一步选了会直接执行的工具，未运行'

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

test('选中的危险工具会要求确认时，run 失败且不发送步骤', async () => {
  const dbPath = join(tmpdir(), `fde-x-tool-approval-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_ask', 'ws_ask', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd: '/tmp/fde-x-tool-approval-cwd' }), now, now)
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES ('wf_ask', 'ws_ask', '验收流', 'paused', ?, ?, 1, ?, ?)
  `).run(
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify({
      steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools: ['bash'] } }],
    }),
    now,
    now,
  )
  const bridge = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.method === 'GET' && url.pathname === '/fde-session/visible-tools') {
      const body = JSON.stringify({ ok: true, tools: ['bash'], approval: 'ask' })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(body)
      return
    }
    response.writeHead(404)
    response.end()
  })
  const port = await listen(bridge)
  const calls = []
  const aiRuntime = {
    origin: `http://127.0.0.1:${port}`,
    cookie: 'sid=test',
    dshHome: home,
    status: () => ({ connected: true }),
    async call(endpoint, args) {
      calls.push(endpoint)
      if (endpoint === 'session/create') return { sessionId: (args && args.request && args.request.sessionId) || 'session-ask' }
      return {}
    },
    async *stream() {
      yield { type: 'event', event: { type: 'turn/end' } }
    },
  }
  try {
    const ticket = startWorkflowRun({ db, aiRuntime }, {
      workflowId: 'wf_ask',
      workspaceId: 'ws_ask',
      correlationId: 'corr_ask',
      trigger: { kind: 'manual' },
    })
    const started = Date.now()
    let state = 'queued'
    while (Date.now() - started < 4000) {
      state = db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(ticket.id).state
      if (state !== 'queued' && state !== 'running') break
      await new Promise((resolve) => setImmediate(resolve))
    }
    assert.equal(state, 'failed')
    assert.equal(calls.includes('session/prompt'), false)
    const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
    assert.equal(JSON.parse(step.error_json).message, BLOCK)
    assert.equal(db.prepare('SELECT output_json FROM workflow_runs WHERE id = ?').get(ticket.id).output_json, null)
  } finally {
    bridge.close()
    db.close()
    await rm(dbPath, { force: true })
  }
})
