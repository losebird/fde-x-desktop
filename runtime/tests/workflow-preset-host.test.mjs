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
const QUERY = 'fde_app_records_query'
const EXCLUDED = 'preset_only_probe'

function insertWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run(id, id, JSON.stringify({ cwd }), now, now)
}

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

function planServer(db, host) {
  return http.createServer(async (request, response) => {
    const raw = await readRaw(request)
    const parsed = raw ? JSON.parse(raw) : {}
    const url = new URL(request.url, 'http://127.0.0.1')
    try {
      const handled = await handlePlanRequest(request, response, url, {
        db,
        enqueueEvent() {},
        readJson: async () => parsed,
        aiRuntime: host.core,
      }, 'corr_preset')
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

describe('真 Host 上从预设带入工具', { concurrency: 1 }, () => {
  test('预设列出的工具等于该预设会话的可见工具，危险预设未确认时 422 且不写库', async () => {
    const host = await bootWorkflowHost({ presetOnly: true })
    const dbPath = join(tmpdir(), `fde-x-preset-list-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    insertWorkspace(db, 'ws_preset', host.cwd)
    const server = planServer(db, host)
    const port = await listen(server)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflow-tools?workspaceId=ws_preset`)
      const body = await response.json()
      assert.equal(response.status, 200)
      const presets = body.data.presets
      assert.ok(Array.isArray(presets) && presets.length > 0)
      const standard = presets.find((row) => row.id === 'standard')
      assert.ok(standard)
      const standardSeen = await waitForProbe(host.probeDir, 'standard')
      assert.equal(standardSeen.names.length, 44)
      assert.equal(standardSeen.names.includes(EXCLUDED), false)
      assert.deepEqual(standard.tools.map((tool) => tool.name), standardSeen.names)
      assert.equal(standard.hasDanger, true)

      let excluded = null
      for (const preset of presets) {
        assert.equal(typeof preset.name, 'string')
        assert.ok(preset.name.length > 0)
        if (typeof preset.unavailable === 'string') {
          assert.ok(preset.unavailable.length > 0)
          assert.deepEqual(preset.tools, [])
          assert.equal(preset.hasDanger, false)
          continue
        }
        const seen = await waitForProbe(host.probeDir, preset.id)
        assert.deepEqual(preset.tools.map((tool) => tool.name), seen.names)
        const danger = preset.tools.some((tool) => tool.selectable === true && tool.tier === 'danger')
        assert.equal(preset.hasDanger, danger)
        for (const tool of preset.tools) {
          assert.equal(typeof tool.tier, 'string')
          if (tool.selectable === false) {
            assert.equal(typeof tool.reason, 'string')
            assert.ok(tool.reason.length > 0)
          }
          if (tool.name === EXCLUDED) excluded = tool
        }
      }
      if (excluded) {
        assert.equal(excluded.selectable, false)
        assert.ok(excluded.reason.length > 0)
      }

      const dangerPreset = presets.find((row) => row.hasDanger && row.id !== 'fde-workflow')
      assert.ok(dangerPreset)
      const selected = dangerPreset.tools.filter((tool) => tool.selectable === true).map((tool) => tool.name)
      assert.ok(selected.some((name) => dangerPreset.tools.find((tool) => tool.name === name).tier === 'danger'))
      const before = db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n
      const audits = db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get().n
      const denied = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows`, {
        method: 'POST',
        headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_preset',
          name: '预设流',
          steps: [{
            id: 's1',
            kind: 'ai',
            label: 'AI',
            config: { prompt: '跑', tools: selected, presetId: dangerPreset.id },
          }],
        }),
      })
      const deniedBody = await denied.json()
      assert.equal(denied.status, 422, JSON.stringify(deniedBody))
      assert.match(deniedBody.message, /确认/)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n, before)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get().n, audits)
    } finally {
      server.close()
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('带入预设后删掉一个工具，可见工具等于最终清单，并且人设来自该预设', async () => {
    const host = await bootWorkflowHost({ presetOnly: true })
    const dbPath = join(tmpdir(), `fde-x-preset-run-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    insertWorkspace(db, 'ws_preset_run', host.cwd)
    const server = planServer(db, host)
    const port = await listen(server)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflow-tools?workspaceId=ws_preset_run`)
      const body = await response.json()
      const presets = body.data.presets
      const source = presets.find((row) => row.id !== 'fde-workflow' && row.persona && row.persona.text && row.hasDanger)
      const workflowPreset = presets.find((row) => row.id === 'fde-workflow')
      assert.ok(source)
      assert.ok(workflowPreset)
      assert.notEqual(source.persona.text, workflowPreset.persona.text)
      const imported = source.tools.filter((tool) => tool.selectable === true && tool.blocksRun !== true).map((tool) => tool.name)
      const removed = imported[imported.length - 1]
      const kept = imported.filter((name) => name !== removed)
      assert.ok(kept.length > 0)
      assert.equal(kept.includes(removed), false)
      const danger = kept.filter((name) => source.tools.find((tool) => tool.name === name).tier === 'danger').sort()
      const saved = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows`, {
        method: 'POST',
        headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_preset_run',
          name: '删一个',
          confirmDanger: danger,
          steps: [{
            id: 's1',
            kind: 'ai',
            label: 'AI',
            config: { prompt: '跑', tools: kept, presetId: source.id },
          }],
        }),
      })
      const savedBody = await saved.json()
      assert.equal(saved.status, 201, JSON.stringify(savedBody))
      const calls = []
      stubRuntime(host, calls)
      const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
        workflowId: savedBody.data.id,
        workspaceId: 'ws_preset_run',
        correlationId: 'corr_preset_run',
        trigger: { kind: 'manual' },
      })
      await waitForTerminal(db, ticket.id)
      const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
      const stepRow = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
      assert.equal(run.state, 'succeeded', stepRow && stepRow.error_json)
      const output = JSON.parse(run.output_json)
      assert.deepEqual(output.tools, [...kept].sort())
      const seen = await waitForProbe(host.probeDir, output.sessionId)
      assert.deepEqual(seen.names, [...kept].sort())
      assert.equal(seen.personaPrefix, source.persona.text)
      assert.notEqual(seen.personaPrefix, workflowPreset.persona.text)
      assert.equal(calls.includes('session/prompt'), true)
    } finally {
      server.close()
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('只改 presetId 时放行的工具不变', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-preset-id-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    insertWorkspace(db, 'ws_preset_id', host.cwd)
    const server = planServer(db, host)
    const port = await listen(server)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflow-tools?workspaceId=ws_preset_id`)
      const body = await response.json()
      const presets = body.data.presets
      const standard = presets.find((row) => row.id === 'standard')
      const workflowPreset = presets.find((row) => row.id === 'fde-workflow')
      assert.ok(standard && standard.persona && standard.persona.text)
      assert.ok(workflowPreset && workflowPreset.persona && workflowPreset.persona.text)
      assert.notEqual(standard.persona.text, workflowPreset.persona.text)
      const calls = []
      stubRuntime(host, calls)

      async function runWith(presetId) {
        const now = new Date().toISOString()
        const id = `wf_${presetId}`
        db.prepare(`
          INSERT INTO workflows
            (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
          VALUES (?, 'ws_preset_id', ?, 'paused', ?, ?, 1, ?, ?)
        `).run(
          id,
          presetId,
          JSON.stringify({ kind: 'manual' }),
          JSON.stringify({
            steps: [{
              id: 's1',
              kind: 'ai',
              label: 'AI',
              config: { prompt: '只查询', tools: [QUERY], presetId },
            }],
          }),
          now,
          now,
        )
        const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
          workflowId: id,
          workspaceId: 'ws_preset_id',
          correlationId: `corr_${presetId}`,
          trigger: { kind: 'manual' },
        })
        await waitForTerminal(db, ticket.id)
        const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
        const output = run && run.output_json ? JSON.parse(run.output_json) : null
        const seen = output && output.sessionId ? await waitForProbe(host.probeDir, output.sessionId) : null
        return { seen, run }
      }

      const first = await runWith('standard')
      assert.equal(first.run.state, 'succeeded')
      assert.deepEqual(first.seen.names, [QUERY])
      assert.deepEqual(JSON.parse(first.run.output_json).tools, [QUERY])
      assert.equal(first.seen.personaPrefix, standard.persona.text)

      const second = await runWith('fde-workflow')
      assert.equal(second.run.state, 'succeeded')
      assert.deepEqual(second.seen.names, [QUERY])
      assert.deepEqual(JSON.parse(second.run.output_json).tools, [QUERY])
      assert.equal(second.seen.personaPrefix, workflowPreset.persona.text)
      assert.notEqual(second.seen.personaPrefix, first.seen.personaPrefix)
    } finally {
      server.close()
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })

  test('注入文本没有占位符，写出最终工具清单，只改 presetId 不改放行', async () => {
    const host = await bootWorkflowHost()
    const dbPath = join(tmpdir(), `fde-x-preset-render-${process.pid}.sqlite`)
    const db = openDatabase(dbPath, migrations)
    insertWorkspace(db, 'ws_render', host.cwd)
    const calls = []
    stubRuntime(host, calls)
    const line = '本步只能使用这些工具：fde_app_records_query'
    try {
      async function runWith(presetId) {
        const now = new Date().toISOString()
        const id = `wf_render_${presetId}`
        db.prepare(`
          INSERT INTO workflows
            (id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at)
          VALUES (?, 'ws_render', ?, 'paused', ?, ?, 1, ?, ?)
        `).run(
          id,
          presetId,
          JSON.stringify({ kind: 'manual' }),
          JSON.stringify({
            steps: [{
              id: 's1',
              kind: 'ai',
              label: 'AI',
              config: { prompt: '只查询', tools: [QUERY], presetId },
            }],
          }),
          now,
          now,
        )
        const ticket = startWorkflowRun({ db, aiRuntime: host.core }, {
          workflowId: id,
          workspaceId: 'ws_render',
          correlationId: `corr_render_${presetId}`,
          trigger: { kind: 'manual' },
        })
        await waitForTerminal(db, ticket.id)
        const run = db.prepare('SELECT state, output_json FROM workflow_runs WHERE id = ?').get(ticket.id)
        const stepRow = db.prepare('SELECT error_json FROM workflow_run_steps WHERE run_id = ?').get(ticket.id)
        assert.equal(run.state, 'succeeded', stepRow && stepRow.error_json)
        const output = JSON.parse(run.output_json)
        assert.deepEqual(output.tools, [QUERY])
        const seen = await waitForProbe(host.probeDir, output.sessionId)
        assert.deepEqual(seen.names, [QUERY])
        assert.equal(seen.personaPrefix.includes('{{'), false, seen.personaPrefix)
        assert.equal(seen.personaPrefix.includes(line), true, seen.personaPrefix)
        assert.equal(seen.personaPrefix.includes('bash'), false, seen.personaPrefix)
        assert.deepEqual(seen.promptSections, [seen.personaPrefix])
        return seen.personaPrefix
      }

      const injected = {}
      for (const presetId of ['standard', 'cordis', 'ptc']) {
        injected[presetId] = await runWith(presetId)
      }
      const workflowText = await runWith('fde-workflow')
      assert.notEqual(workflowText, injected.standard)
      assert.equal(calls.includes('session/prompt'), true)
    } finally {
      db.close()
      await rm(dbPath, { force: true })
      await host.stop()
    }
  })
})
