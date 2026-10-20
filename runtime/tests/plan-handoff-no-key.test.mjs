import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { handoffTask } from '../plan/handoff-run.mjs'

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const root = `/tmp/fde-handoff-no-key-${process.pid}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')
const port = 4454
const base = `http://127.0.0.1:${port}`

let child
let pageToken = ''

function pageHeaders() {
  return {
    Origin: origin,
    'Content-Type': 'application/json',
    ...(pageToken ? { 'x-fde-ui-token': pageToken } : {}),
  }
}

function serverEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/API_KEY|ANTHROPIC|OPENAI|GROK|DEEPSEEK|CREDENTIAL/i.test(key)) delete env[key]
  }
  env.FDE_RUNTIME_PORT = String(port)
  env.FDE_DATABASE_PATH = dbPath
  env.FDE_AI_WORKSPACE = workspaceCwd
  env.FDE_DSH_HOME = dshHome
  env.FDE_RUNTIME_SUPERVISED = '1'
  delete env.FDE_IUI_ARTIFACT
  return env
}

async function startServer() {
  pageToken = ''
  let stdout = ''
  let stderr = ''
  child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: serverEnv(),
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
      if (res.ok && pageToken) return
    } catch {}
    if (child.exitCode != null) break
    await delay(100)
  }
  throw new Error(`handoff server failed to start\n${stderr}\n${stdout}`)
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

function httpError(status, body) {
  const error = new Error(body?.error?.message || body?.message || `HTTP ${status}`)
  error.status = status
  error.code = body?.error?.code || body?.error || ''
  return error
}

test('a handoff with no model key gets 503 and the row stays doing and cancellable', async () => {
  const plan = readFileSync(new URL('../../src/pages/Plan.tsx', import.meta.url), 'utf8')
  assert.match(plan, /runTaskHandoff\(/)
  await rm(root, { recursive: true, force: true })
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  await startServer()
  try {
    const workspace = await fetch(`${base}/api/v1/workspaces`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ id: 'ws_nokey', name: 'ws_nokey', description: 'no key' }),
    })
    assert.equal(workspace.status, 201)
    const created = await fetch(`${base}/api/v1/plan/tasks`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ workspaceId: 'ws_nokey', title: '没有密钥的待办', sourceRef: 'biz:采购单:PO-1' }),
    })
    const createdBody = await readJson(created)
    assert.equal(created.status, 201, JSON.stringify(createdBody))
    const taskId = createdBody.data.id
    const requestId = 'req_nokey'
    let sessionStatus = 0
    let sessionCode = ''
    const outcome = await handoffTask({
      updateStatus: async (id, status) => {
        const res = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: pageHeaders(),
          body: JSON.stringify({ status }),
        })
        const body = await readJson(res)
        if (!res.ok) throw httpError(res.status, body)
        return body.data
      },
      createSession: async (input) => {
        const res = await fetch(`${base}/api/v1/ai/sessions`, {
          method: 'POST',
          headers: pageHeaders(),
          body: JSON.stringify(input),
        })
        const body = await readJson(res)
        sessionStatus = res.status
        sessionCode = body?.error?.code || ''
        if (!res.ok) throw httpError(res.status, body)
        return body.data
      },
      startRun: async (id, input) => {
        const res = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(id)}/ai-runs`, {
          method: 'POST',
          headers: pageHeaders(),
          body: JSON.stringify(input),
        })
        const body = await readJson(res)
        if (!res.ok) throw httpError(res.status, body)
        return body.data
      },
      prompt: async () => {
        throw new Error('prompt should not run when session create fails')
      },
    }, {
      taskId,
      cwd: workspaceCwd,
      preset: 'standard',
      sessionTitle: '待办 · 没有密钥的待办',
      prompt: '只处理这一条',
      requestId,
      markDoing: true,
    })
    assert.equal(sessionStatus, 503, sessionCode)
    assert.equal(sessionCode, 'ai/not-connected')
    assert.equal(outcome.sessionStatus, 503)
    const listed = await fetch(`${base}/api/v1/plan/tasks?workspaceId=ws_nokey`, { headers: pageHeaders() })
    const listedBody = await readJson(listed)
    const row = (listedBody.data || []).find((item) => item.id === taskId)
    assert.equal(row && row.status, 'doing')
    const cancelled = await fetch(`${base}/api/v1/plan/tasks/${encodeURIComponent(taskId)}/ai-runs`, {
      method: 'POST',
      headers: pageHeaders(),
      body: JSON.stringify({ op: 'cancel' }),
    })
    const cancelledBody = await readJson(cancelled)
    assert.equal(cancelled.status, 200, JSON.stringify(cancelledBody))
    assert.equal(cancelledBody.data.state, 'cancelled')
    const after = await fetch(`${base}/api/v1/plan/tasks?workspaceId=ws_nokey`, { headers: pageHeaders() })
    const afterBody = await readJson(after)
    const afterRow = (afterBody.data || []).find((item) => item.id === taskId)
    assert.equal(afterRow && afterRow.status, 'doing')
  } finally {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  }
})
