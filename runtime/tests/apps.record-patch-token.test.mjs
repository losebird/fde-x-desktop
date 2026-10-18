import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5174'
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-s1-record-patch-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')

let child
let base = ''
let pageToken = ''

function auditCount() {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM audit_entries').get()
    return Number(row.n)
  } finally {
    db.close()
  }
}

function clearAudit() {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA busy_timeout = 5000;')
  db.exec('DELETE FROM audit_entries;')
  db.close()
}

async function startServer() {
  await rm(root, { recursive: true, force: true })
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_AI_WORKSPACE: workspaceCwd,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
    const tokenMatch = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(stdout)
    if (tokenMatch) pageToken = tokenMatch[1]
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  for (let i = 0; i < 100; i += 1) {
    const match = /^FDE_LISTENING\s+(\d+)/m.exec(stdout)
    if (match) {
      base = `http://127.0.0.1:${match[1]}`
      const res = await fetch(`${base}/health`).catch(() => null)
      if (res?.ok) return
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  throw new Error(`record patch server failed to start\n${stderr}\n${stdout}`)
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

async function writeJson(path, body, method) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  return { status: res.status, payload }
}

describe('record patch page token', { concurrency: 1 }, () => {
test('forged allowlisted Origin cannot patch an existing record without a page token', async (t) => {
  await startServer()
  t.after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })

  const created = await writeJson('/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST')
  assert.equal(created.status, 201, JSON.stringify(created.payload))
  const appId = created.payload.data.appId

  const activated = await writeJson(`/api/v1/apps/${encodeURIComponent(appId)}/activate`, {}, 'POST')
  assert.equal(activated.status, 200, JSON.stringify(activated.payload))

  const inserted = await writeJson('/api/v1/apps/supplier-visits/visit', {
    supplier: 'ACME',
    visit_date: '2026-09-01',
    status: '计划',
    workspaceCwd,
  }, 'POST')
  assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
  const rid = inserted.payload.data.id
  assert.equal(inserted.payload.data.status, '计划')

  clearAudit()
  assert.equal(auditCount(), 0)

  const patched = await fetch(
    `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    {
      method: 'PATCH',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '已拜访' }),
    },
  )
  assert.equal(patched.status, 401, 'forged allowlisted Origin without a page token must be rejected')

  const got = await fetch(
    `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
  )
  const gotBody = await got.json()
  assert.equal(got.status, 200)
  assert.equal(gotBody.data.status, '计划')
  assert.equal(auditCount(), 0)

  const forbidden = await fetch(
    `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    {
      method: 'PATCH',
      headers: { Origin: 'http://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: '已拜访' }),
    },
  )
  assert.equal(forbidden.status, 403)
})

async function patchVisit(rid, headers, status) {
  return fetch(
    `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    {
      method: 'PATCH',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ status }),
    },
  )
}

async function insertVisit() {
  const inserted = await writeJson('/api/v1/apps/supplier-visits/visit', {
    supplier: 'ACME',
    visit_date: '2026-09-01',
    status: '计划',
    workspaceCwd,
  }, 'POST')
  assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
  return inserted.payload.data.id
}

test('page token patches the record and writes one audit row', async (t) => {
  await startServer()
  t.after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })
  assert.match(pageToken, /^[0-9a-f]{64}$/u)

  const created = await writeJson('/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST')
  assert.equal(created.status, 201, JSON.stringify(created.payload))
  const activated = await writeJson(`/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {}, 'POST')
  assert.equal(activated.status, 200, JSON.stringify(activated.payload))
  const rid = await insertVisit()
  clearAudit()

  const patched = await patchVisit(rid, { 'x-fde-ui-token': pageToken }, '已拜访')
  assert.equal(patched.status, 200)
  const got = await fetch(
    `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
  )
  const gotBody = await got.json()
  assert.equal(gotBody.data.status, '已拜访')
  assert.equal(auditCount(), 1)
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const row = db.prepare('SELECT action, outcome FROM audit_entries').get()
    assert.equal(row.action, 'app.record.patch')
    assert.equal(row.outcome, 'succeeded')
  } finally {
    db.close()
  }

  const environ = await readFile(`/proc/${child.pid}/environ`)
  assert.equal(environ.includes(Buffer.from(pageToken)), false)
  const names = await readdir(join(dshHome, 'run'))
  for (const name of names) {
    const text = await readFile(join(dshHome, 'run', name), 'utf8')
    assert.equal(text.includes(pageToken), false, name)
  }
})

test('bridge token is not accepted as the page token', async (t) => {
  await startServer()
  t.after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })
  const bridgeToken = String(await readFile(join(dshHome, 'run', 'bridge.token'), 'utf8')).trim()
  assert.notEqual(bridgeToken, pageToken)

  const created = await writeJson('/api/v1/apps', { spec: SUPPLIER_VISITS_SPEC, workspaceCwd }, 'POST')
  assert.equal(created.status, 201, JSON.stringify(created.payload))
  const activated = await writeJson(`/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {}, 'POST')
  assert.equal(activated.status, 200, JSON.stringify(activated.payload))
  const rid = await insertVisit()
  clearAudit()

  const patched = await patchVisit(rid, { 'x-fde-ui-token': bridgeToken }, '已拜访')
  assert.equal(patched.status, 401)
  const got = await fetch(
    `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
  )
  const gotBody = await got.json()
  assert.equal(gotBody.data.status, '计划')
  assert.equal(auditCount(), 0)
})

test('forged origin can still create a plan task', async (t) => {
  await startServer()
  t.after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })
  const created = await writeJson('/api/v1/plan/tasks', { workspaceId: 'ws_personal', title: '仍可写入' }, 'POST')
  assert.equal(created.status, 201, JSON.stringify(created.payload))
})
})
