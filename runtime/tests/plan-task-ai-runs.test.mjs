import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const root = `/tmp/fde-task-ai-runs-${process.pid}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')
const port = 4421
const base = `http://127.0.0.1:${port}`

let child
let pageToken = ''
let bridgeToken = ''

function proposeToolSource() {
  const src = readFileSync(new URL('../fde-x-dsh-bridge/lib/tools.js', import.meta.url), 'utf8')
  const start = src.indexOf("name: 'fde_plan_task_propose'")
  const end = src.indexOf("name: 'fde_briefing_submit'")
  return src.slice(start, end)
}

test('fde_plan_task_propose schema names sourceRef and the legal prefixes', () => {
  const block = proposeToolSource()
  assert.match(block, /sourceRef:\s*\{/)
  assert.match(block, /app:/)
  assert.match(block, /biz:/)
  assert.match(block, /im:/)
  assert.match(block, /fde-task:/)
})

function pageHeaders(token = pageToken) {
  return {
    Origin: origin,
    'Content-Type': 'application/json',
    ...(token ? { 'x-fde-ui-token': token } : {}),
  }
}

async function startServer() {
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
        bridgeToken = String(await readFile(join(dshHome, 'run', 'bridge.token'), 'utf8')).trim()
        if (bridgeToken) return
      }
    } catch { /* retry */ }
    if (child.exitCode != null) break
    await delay(100)
  }
  throw new Error(`task ai-run server failed to start\n${stderr}\n${stdout}`)
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

test('task writes reject a bad sourceRef and an ai run is one row that survives restart', async () => {
  await rm(root, { recursive: true, force: true })
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  await startServer()
  try {
    const workspace = await fetch(`${base}/api/v1/workspaces`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ id: 'ws_ai_run', name: 'ws_ai_run', description: 'ai run' }),
    })
    assert.equal(workspace.status, 201)

    const bad = await fetch(`${base}/api/v1/plan/tasks`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ workspaceId: 'ws_ai_run', title: '坏来源', sourceRef: 'memory:aa' }),
    })
    const badBody = await readJson(bad)
    assert.equal(bad.status, 422, JSON.stringify(badBody))
    assert.equal(badBody.error, 'invalid_source_ref')

    const created = await fetch(`${base}/api/v1/plan/tasks`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ workspaceId: 'ws_ai_run', title: '回复供应商报价', sourceRef: 'biz:采购单:PO-2026-001' }),
    })
    const createdBody = await readJson(created)
    assert.equal(created.status, 201, JSON.stringify(createdBody))
    const taskId = createdBody.data.id
    assert.equal(createdBody.data.sourceRef, 'biz:采购单:PO-2026-001')

    const patched = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: pageHeaders(),
      body: JSON.stringify({ sourceRef: 'im:req_1' }),
    })
    const patchedBody = await readJson(patched)
    assert.equal(patched.status, 200, JSON.stringify(patchedBody))
    assert.equal(patchedBody.data.sourceRef, 'im:req_1')

    const rejected = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: pageHeaders(),
      body: JSON.stringify({ sourceRef: 'app:orders' }),
    })
    const rejectedBody = await readJson(rejected)
    assert.equal(rejected.status, 422, JSON.stringify(rejectedBody))
    assert.equal(rejectedBody.error, 'invalid_source_ref')

    const proposed = await fetch(`${base}/api/v1/bridge/plan-task-propose`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        'x-fde-bridge-token': bridgeToken,
      },
      body: JSON.stringify({
        workspaceId: 'ws_ai_run',
        op: 'insert',
        title: '坏提案',
        sourceRef: 'javascript:alert(1)',
      }),
    })
    const proposedBody = await readJson(proposed)
    assert.equal(proposed.status, 422, JSON.stringify(proposedBody))
    assert.equal(proposedBody.error, 'invalid_source_ref')

    const missingToken = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`, {
      method: 'POST',
      headers: pageHeaders(''),
      body: JSON.stringify({ sessionId: 'sess_1', requestId: 'req_1' }),
    })
    assert.equal(missingToken.status, 401)

    const started = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ sessionId: 'sess_1', requestId: 'req_1' }),
    })
    const startedBody = await readJson(started)
    assert.equal(started.status, 201, JSON.stringify(startedBody))
    assert.equal(startedBody.data.sessionId, 'sess_1')
    assert.equal(startedBody.data.state, 'running')

    const again = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ sessionId: 'sess_2', requestId: 'req_2' }),
    })
    const againBody = await readJson(again)
    assert.equal(again.status, 409, JSON.stringify(againBody))
    assert.match(String(againBody.message || ''), /已在处理/)

    await stopServer()
    await startServer()

    const listed = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`)
    const listedBody = await readJson(listed)
    assert.equal(listed.status, 200, JSON.stringify(listedBody))
    const runs = listedBody.data.runs || listedBody.data
    const running = (Array.isArray(runs) ? runs : []).find((row) => row.state === 'running')
    assert.equal(running?.sessionId, 'sess_1')

    const cancelled = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ op: 'cancel' }),
    })
    const cancelledBody = await readJson(cancelled)
    assert.equal(cancelled.status, 200, JSON.stringify(cancelledBody))
    assert.equal(cancelledBody.data.state, 'cancelled')

    const restarted = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ sessionId: 'sess_3', requestId: 'req_3' }),
    })
    const restartedBody = await readJson(restarted)
    assert.equal(restarted.status, 201, JSON.stringify(restartedBody))
    assert.equal(restartedBody.data.sessionId, 'sess_3')
  } finally {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  }
})
