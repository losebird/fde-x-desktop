import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { handlePlanRequest } from '../routes/plan.mjs'
import { openDatabase } from '../db.mjs'
import { stageWorkflowAllow } from '../fde-x-dsh-bridge/lib/workflow-limit.js'
import { startWorkflowRun } from '../plan/workflow-run.mjs'
import { bootWorkflowHost, waitForProbe } from './support/workflow-host.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')
const QUERY = 'fde_app_records_query'
const JOB_WAIT = '这一步选了会停下来等后台任务的工具，无人值守不能运行'
const UNCONFIRMED = '工作流预设未能限制工具'

function modeBits(path) {
  return statSync(path).mode & 0o777
}

function allowDir(home) {
  return join(home, 'run', 'workflow-allow')
}

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify({ cwd }), now, now)
}

function insertWorkflow(db, id, workspaceId, tools) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workflows
      (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
    VALUES (?, ?, '放行', 'paused', ?, ?, 1, ?, ?)
  `).run(
    id,
    workspaceId,
    JSON.stringify({ kind: 'manual' }),
    JSON.stringify({
      steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools } }],
    }),
    now,
    now,
  )
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

describe('真 Host 上的 allow 文件和会停住的工具', { concurrency: 1 }, () => {
  test('新建的 allow 文件是 0600，目录是 0700，已有目录会被收紧', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-allow-mode-'))
    try {
      const dir = allowDir(home)
      mkdirSync(dir, { recursive: true, mode: 0o755 })
      chmodSync(dir, 0o755)
      stageWorkflowAllow('session-mode-check', [QUERY], home)
      assert.equal(modeBits(dir), 0o700)
      assert.equal(modeBits(join(dir, 'session-mode-check.json')), 0o600)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  test('创建会话失败时清掉这一步的 allow 文件', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fde-allow-fail-'))
    const previous = process.env.FDE_DSH_HOME
    process.env.FDE_DSH_HOME = home
    const dbPath = join(home, 'fail.sqlite')
    const db = openDatabase(dbPath, migrations)
    try {
      mkdirSync(join(home, 'run'), { recursive: true })
      writeFileSync(join(home, 'run', 'bridge-tools.json'), `${JSON.stringify({ ok: true, workflowLimit: true })}\n`)
      insertWorkspace(db, 'ws_fail', '/tmp/fde-allow-fail-cwd')
      insertWorkflow(db, 'wf_fail', 'ws_fail', [QUERY])
      const aiRuntime = {
        dshHome: home,
        status: () => ({ connected: true }),
        async call() {
          throw new Error('session create failed')
        },
        async *stream() {},
      }
      const ticket = startWorkflowRun({ db, aiRuntime }, {
        workflowId: 'wf_fail',
        workspaceId: 'ws_fail',
        correlationId: 'corr_allow_fail',
        trigger: { kind: 'manual' },
      })
      await waitForTerminal(db, ticket.id)
      const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
      assert.equal(JSON.parse(step.error_json).message, 'session create failed')
      const names = existsSync(allowDir(home)) ? readdirSync(allowDir(home)) : []
      assert.deepEqual(names, [])
    } finally {
      db.close()
      if (previous === undefined) delete process.env.FDE_DSH_HOME
      else process.env.FDE_DSH_HOME = previous
      await rm(home, { recursive: true, force: true })
    }
  })

  test('启动清掉残留 allow 文件，损坏的文件在创建失败后也不留', async () => {
    const host = await bootWorkflowHost({ staleAllow: true })
    try {
      const dir = allowDir(host.home)
      assert.equal(existsSync(join(dir, 'session-stale-allow.json')), false)
      assert.equal(modeBits(dir), 0o700)

      const sessionId = 'session-corruptallow'
      const corrupt = join(dir, `${sessionId}.json`)
      writeFileSync(corrupt, '{')
      await assert.rejects(
        () => host.core.call('session/create', {
          request: { cwd: host.cwd, agentPreset: 'fde-workflow', sessionId },
        }),
        (error) => {
          assert.match(String(error && error.message), new RegExp(UNCONFIRMED))
          return true
        },
      )
      assert.equal(existsSync(corrupt), false)

      const dbPath = join(tmpdir(), `fde-allow-done-${process.pid}.sqlite`)
      const db = openDatabase(dbPath, migrations)
      try {
        insertWorkspace(db, 'ws_done', host.cwd)
        insertWorkflow(db, 'wf_done', 'ws_done', [QUERY])
        const calls = []
        const call = host.core.call.bind(host.core)
        host.core.call = async (endpoint, args, signal) => {
          calls.push(endpoint)
          return call(endpoint, args, signal)
        }
        host.core.stream = async function* () {
          yield { type: 'event', event: { type: 'turn/end' } }
        }
        const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
          workflowId: 'wf_done',
          workspaceId: 'ws_done',
          correlationId: 'corr_allow_done',
          trigger: { kind: 'manual' },
        })
        const state = await waitForTerminal(db, ticket.id)
        assert.equal(state, 'succeeded')
        assert.equal(calls.includes('session/prompt'), true)
        const left = readdirSync(dir).filter((name) => name.endsWith('.json'))
        assert.deepEqual(left, [])
        await host.core.call('session/create', {
          request: { cwd: host.cwd, agentPreset: 'standard' },
        })
        const standard = await waitForProbe(host.probeDir, 'standard')
        assert.equal(standard.names.length, 44)
      } finally {
        db.close()
        await rm(dbPath, { force: true })
      }
    } finally {
      await host.stop()
    }
  })

  test('选了 job_output 时运行在开会话前失败，并且不会挂住', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-allow-job-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    insertWorkspace(db, 'ws_job', host.cwd)
    const server = http.createServer(async (request, response) => {
      const raw = []
      for await (const chunk of request) raw.push(chunk)
      const parsed = raw.length ? JSON.parse(Buffer.concat(raw).toString('utf8')) : {}
      const url = new URL(request.url, 'http://127.0.0.1')
      try {
        const handled = await handlePlanRequest(request, response, url, {
          db,
          enqueueEvent() {},
          readJson: async () => parsed,
          aiRuntime: host.core,
        }, 'corr_job')
        if (!handled && !response.headersSent) {
          response.writeHead(404)
          response.end()
        }
      } catch (error) {
        if (!response.headersSent) {
          response.writeHead(500)
          response.end(error instanceof Error ? error.message : '失败')
        }
      }
    })
    const port = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve(server.address().port))
    })
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflow-tools?workspaceId=ws_job`)
      const body = await response.json()
      const listed = body.data.tools.find((row) => row.name === 'job_output')
      assert.ok(listed)
      assert.equal(listed.tier, 'wait')
      const standard = body.data.presets.find((row) => row.id === 'standard')
      const presetJob = standard.tools.find((row) => row.name === 'job_output')
      assert.equal(presetJob.tier, 'wait')
      assert.equal(presetJob.blocksRun, true)

      insertWorkflow(db, 'wf_job', 'ws_job', ['job_output'])
      const calls = []
      const call = host.core.call.bind(host.core)
      host.core.call = async (endpoint, args, signal) => {
        calls.push(endpoint)
        return call(endpoint, args, signal)
      }
      host.core.stream = async function* () {
        yield { type: 'event', event: { type: 'turn/end' } }
      }
      const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
        workflowId: 'wf_job',
        workspaceId: 'ws_job',
        correlationId: 'corr_job_run',
        trigger: { kind: 'manual' },
      })
      const state = await waitForTerminal(db, ticket.id)
      const step = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
      assert.equal(state, 'failed', step && step.error_json)
      assert.equal(JSON.parse(step.error_json).message, JOB_WAIT)
      assert.equal(calls.includes('session/create'), false)
      assert.equal(calls.includes('session/prompt'), false)
    } finally {
      server.close()
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })
})
