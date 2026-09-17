import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const origin = 'http://127.0.0.1:5173'
const dbPath = '/tmp/fde-x-plan-test.sqlite'
const port = 4397
const base = `http://127.0.0.1:${port}`
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let child

async function startServer() {
  await rm(dbPath, { force: true }).catch(() => undefined)
  await mkdir('/tmp/fde-x-plan-test-ws', { recursive: true })
  child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: '/tmp/fde-x-plan-test-ws',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return
    } catch { /* retry */ }
    await delay(50)
  }
  throw new Error('plan test server failed to start')
}

async function stopServer() {
  if (!child) return
  child.kill('SIGTERM')
  await delay(100)
}

test('plan CRUD, workspace isolation, status validation', async (t) => {
  await startServer()
  t.after(stopServer)

  const wsA = 'ws_plan_a'
  const wsB = 'ws_plan_b'
  for (const ws of [wsA, wsB]) {
    const created = await fetch(`${base}/api/v1/workspaces`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ws, name: ws, description: 'plan test' }),
    })
    assert.equal(created.status, 201)
  }

  const missing = await fetch(`${base}/api/v1/plan/tasks`)
  assert.equal(missing.status, 400)
  const missingBody = await missing.json()
  assert.equal(missingBody.ok, false)
  assert.equal(missingBody.error, 'missing_workspace_id')

  const createA = await fetch(`${base}/api/v1/plan/tasks`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: wsA, title: '验收 A' }),
  })
  assert.equal(createA.status, 201)
  const taskA = (await createA.json()).data
  assert.equal(taskA.title, '验收 A')
  assert.equal(taskA.status, 'todo')

  const createB = await fetch(`${base}/api/v1/plan/tasks`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId: wsB, title: '其它区' }),
  })
  assert.equal(createB.status, 201)

  const listA = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${wsA}`)
  const listABody = await listA.json()
  assert.equal(listABody.data.length, 1)
  assert.equal(listABody.data[0].title, '验收 A')

  const listB = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${wsB}`)
  const listBBody = await listB.json()
  assert.equal(listBBody.data.length, 1)
  assert.equal(listBBody.data[0].title, '其它区')

  const badStatus = await fetch(`${base}/api/v1/plan/tasks/${taskA.id}`, {
    method: 'PATCH',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'bogus' }),
  })
  assert.equal(badStatus.status, 422)
  const badBody = await badStatus.json()
  assert.equal(badBody.error, 'invalid_status')

  const done = await fetch(`${base}/api/v1/plan/tasks/${taskA.id}`, {
    method: 'PATCH',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done' }),
  })
  assert.equal(done.status, 200)
  const doneBody = await done.json()
  assert.equal(doneBody.data.status, 'done')
  assert.ok(doneBody.data.completedAt)

  const del = await fetch(`${base}/api/v1/plan/tasks/${taskA.id}`, {
    method: 'DELETE',
    headers: { Origin: origin },
  })
  assert.equal(del.status, 200)
  const after = await fetch(`${base}/api/v1/plan/tasks?workspaceId=${wsA}`)
  const afterBody = await after.json()
  assert.equal(afterBody.data.length, 0)
})
