import assert from 'node:assert/strict'
import http from 'node:http'
import { describe, test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'
import { startWorkflowRun } from '../plan/workflow-run.mjs'
import { bootWorkflowHost, waitForProbe } from './support/workflow-host.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')
const THREE = ['fde_app_records_propose', 'fde_app_records_query', 'fde_plan_task_propose']
const DENY = '工作流步骤不能调用这个工具'
const MISMATCH = '工作流会话可见工具和这一步选中的工具不一致，未运行'
const QUERY = 'fde_app_records_query'

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify({ cwd }), now, now)
}

function insertWorkflow(db, id, workspaceId, steps) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '验收流', 'paused', ?, ?, 1, ?, ?)
  `).run(id, workspaceId, JSON.stringify({ kind: 'manual' }), JSON.stringify({ steps }), now, now)
}

function installTrace(db) {
  db.exec(`
    CREATE TABLE run_state_trace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      state TEXT NOT NULL
    );
    CREATE TRIGGER trace_workflow_run_state
    AFTER UPDATE OF state ON workflow_runs
    BEGIN
      INSERT INTO run_state_trace (run_id, state) VALUES (NEW.id, NEW.state);
    END;
  `)
}

async function waitForTerminal(db, runId) {
  const started = Date.now()
  while (Date.now() - started < 8000) {
    const row = db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(runId)
    if (row && row.state !== 'queued' && row.state !== 'running') return row.state
    await new Promise((resolve) => setImmediate(resolve))
  }
  return db.prepare('SELECT state FROM workflow_runs WHERE id = ?').get(runId)?.state
}

function stubRuntime(host, calls) {
  const call = host.core.call.bind(host.core)
  host.core.call = async (endpoint, args, signal) => {
    calls.push(endpoint)
    return call(endpoint, args, signal)
  }
  host.core.stream = async function* () {
    yield { type: 'event', event: { type: 'turn/end' } }
  }
}

describe('真 Host 上按步骤放行工具', { concurrency: 1 }, () => {
  test('选一个只读工具后可见工具就是这一个，未选中的调用被拒绝，普通会话仍是 44 个', async () => {
    const host = await bootWorkflowHost({ callTool: 'fde_plan_task_propose' })
    const dbPath = join(tmpdir(), `fde-x-tool-pick-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      await host.core.call('session/create', {
        request: { cwd: host.cwd, agentPreset: 'standard' },
      })
      const standard = await waitForProbe(host.probeDir, 'standard')
      assert.equal(standard.names.length, 44)
      assert.equal(standard.preset, 'danger-full-access')
      assert.equal(standard.approvalPolicy, 'never')
      assert.equal(standard.bashWithAgent.isError, false)
      assert.match(standard.bashWithAgent.text, /^RAN/)
      assert.equal(standard.approvalAsked, 0)

      insertWorkspace(db, 'ws_pick', host.cwd)
      insertWorkflow(db, 'wf_pick', 'ws_pick', [{
        id: 's1',
        kind: 'ai',
        label: 'AI',
        config: { prompt: '只查询', tools: [QUERY] },
      }])
      const calls = []
      stubRuntime(host, calls)
      const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
        workflowId: 'wf_pick',
        workspaceId: 'ws_pick',
        correlationId: 'corr_pick',
        trigger: { kind: 'manual' },
      })
      await waitForTerminal(db, ticket.id)
      const seen = await waitForProbe(host.probeDir, 'fde-workflow')
      assert.deepEqual(seen.names, [QUERY])
      assert.equal(seen.extraCall.text, `Error: ${DENY}`)
      assert.equal(seen.bashWithAgent.text, `Error: ${DENY}`)
      assert.equal(calls.includes('session/prompt'), true)
      const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
      assert.equal(run.state, 'succeeded')
      assert.deepEqual(JSON.parse(run.output_json).tools, [QUERY])
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('旧步骤没有 tools 字段时仍按三个工具运行并记录放行清单', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-tool-legacy-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      insertWorkspace(db, 'ws_old', host.cwd)
      insertWorkflow(db, 'wf_old', 'ws_old', [{
        id: 's1',
        kind: 'ai',
        label: 'AI',
        config: { prompt: '汇总这条记录' },
      }])
      stubRuntime(host, [])
      const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
        workflowId: 'wf_old',
        workspaceId: 'ws_old',
        correlationId: 'corr_old',
        trigger: { kind: 'manual' },
      })
      await waitForTerminal(db, ticket.id)
      const seen = await waitForProbe(host.probeDir, 'fde-workflow')
      assert.deepEqual(seen.names, THREE)
      const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
      assert.equal(run.state, 'succeeded')
      assert.deepEqual(JSON.parse(run.output_json).tools, THREE)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('可见工具和选中的不一致时 run 从 queued 直接失败且不发送步骤', async () => {
    const host = await bootWorkflowHost({ leak: true })
    const dbPath = join(tmpdir(), `fde-x-tool-mismatch-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      insertWorkspace(db, 'ws_mis', host.cwd)
      insertWorkflow(db, 'wf_mis', 'ws_mis', [{
        id: 's1',
        kind: 'ai',
        label: 'AI',
        config: { prompt: '只查询', tools: [QUERY] },
      }])
      installTrace(db)
      const calls = []
      stubRuntime(host, calls)
      const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
        workflowId: 'wf_mis',
        workspaceId: 'ws_mis',
        correlationId: 'corr_mis',
        trigger: { kind: 'manual' },
      })
      await waitForTerminal(db, ticket.id)
      assert.equal(calls.includes('session/prompt'), false)
      assert.deepEqual(
        db.prepare('SELECT state FROM run_state_trace WHERE run_id = ? ORDER BY id').all(ticket.id).map((row) => row.state),
        ['failed'],
      )
      const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
      assert.equal(JSON.parse(step.error_json).message, MISMATCH)
      const run = db.prepare('SELECT output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
      assert.equal(run.output_json, null)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('选了 bash 时在当前权限下直接执行且不发出审批', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-tool-bash-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    try {
      insertWorkspace(db, 'ws_bash', host.cwd)
      insertWorkflow(db, 'wf_bash', 'ws_bash', [{
        id: 's1',
        kind: 'ai',
        label: 'AI',
        config: { prompt: '跑一条命令', tools: ['bash'] },
      }])
      stubRuntime(host, [])
      const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
        workflowId: 'wf_bash',
        workspaceId: 'ws_bash',
        correlationId: 'corr_bash',
        trigger: { kind: 'manual' },
      })
      await waitForTerminal(db, ticket.id)
      const seen = await waitForProbe(host.probeDir, 'fde-workflow')
      assert.deepEqual(seen.names, ['bash'])
      assert.equal(seen.preset, 'danger-full-access')
      assert.equal(seen.approvalPolicy, 'never')
      assert.equal(seen.approvalAsked, 0)
      assert.equal(seen.bashWithAgent.isError, false)
      assert.match(seen.bashWithAgent.text, /^RAN/)
      const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
      assert.equal(run.state, 'succeeded')
      assert.deepEqual(JSON.parse(run.output_json).tools, ['bash'])
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })
})

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

async function readRaw(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

describe('真 Host 上的工具清单和保存', { concurrency: 1 }, () => {
  test('未知工具和未标只读的 MCP 工具归入 danger，危险工具未确认时 422 且不写库', async () => {
    const host = await bootWorkflowHost({ extra: true })
    const dbPath = join(tmpdir(), `fde-x-tool-save-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    insertWorkspace(db, 'ws_save', host.cwd)
    const server = http.createServer(async (request, response) => {
      const raw = await readRaw(request)
      const parsed = raw ? JSON.parse(raw) : {}
      const url = new URL(request.url, 'http://127.0.0.1')
      const handled = await handlePlanRequest(request, response, url, {
        db,
        enqueueEvent() {},
        readJson: async () => parsed,
        aiRuntime: host.core,
      }, 'corr_save')
      if (!handled && !response.headersSent) {
        response.writeHead(404)
        response.end()
      }
    })
    const port = await listen(server)
    try {
      const catalog = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflow-tools?workspaceId=ws_save`)
      const catalogBody = await catalog.json()
      assert.equal(catalog.status, 200)
      const tools = catalogBody.data.tools
      const tier = (name) => tools.find((row) => row.name === name)?.tier
      assert.equal(tier('fde_app_records_query'), 'read')
      assert.equal(tier('fde_app_records_propose'), 'propose')
      assert.equal(tier('fde_plan_task_propose'), 'propose')
      assert.equal(tier('bash'), 'danger')
      assert.equal(tier('mcp__probe__bare'), 'danger')
      assert.equal(tier('mcp__probe__ro'), 'read')
      assert.equal(tools.some((row) => row.name === 'not_a_known_tool'), false)

      async function post(body) {
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows`, {
          method: 'POST',
          headers: {
            Origin: 'http://127.0.0.1:5173',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ workspaceId: 'ws_save', name: '工具流', ...body }),
        })
        const payload = await response.json()
        return { status: response.status, payload }
      }

      const before = db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n
      const audits = db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get().n
      const denied = await post({
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools: ['bash'] } }],
      })
      assert.equal(denied.status, 422)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n, before)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get().n, audits)

      const unknown = await post({
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools: ['not_a_known_tool'] } }],
      })
      assert.equal(unknown.status, 422)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n, before)

      const empty = await post({
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools: [] } }],
      })
      assert.equal(empty.status, 422)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n, before)

      const saved = await post({
        confirmDanger: ['bash'],
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools: ['bash', QUERY] } }],
      })
      assert.equal(saved.status, 201, JSON.stringify(saved.payload))
      const row = db.prepare('SELECT definition_json FROM workflows WHERE id = ?').get(saved.payload.data.id)
      const stored = JSON.parse(row.definition_json).steps[0].config.tools
      assert.deepEqual(stored, ['bash', QUERY])
      const audit = db.prepare(`SELECT details_json FROM audit_entries WHERE action = 'plan.workflow.tools'`).get()
      const details = JSON.parse(audit.details_json)
      assert.deepEqual(details.before, [])
      assert.deepEqual(details.danger, ['bash'])
      assert.deepEqual(details.after[0].tools, ['bash', QUERY])
    } finally {
      server.close()
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })
})
