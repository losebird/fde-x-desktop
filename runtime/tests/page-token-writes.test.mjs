import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
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
const root = `/tmp/fde-s3-writes-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')

let child
let base = ''
let pageToken = ''

function openDb(readOnly = true) {
  return new DatabaseSync(dbPath, readOnly ? { readOnly: true } : undefined)
}

function scalar(sql) {
  const db = openDb()
  try {
    return Number(db.prepare(sql).get().n)
  } finally {
    db.close()
  }
}

function taskCount() {
  return scalar('SELECT COUNT(*) AS n FROM tasks')
}

function workflowCount() {
  return scalar('SELECT COUNT(*) AS n FROM workflows')
}

function eventCount() {
  return scalar('SELECT COUNT(*) AS n FROM calendar_events')
}

function auditCount() {
  return scalar('SELECT COUNT(*) AS n FROM audit_entries')
}

function auditFor(action) {
  const db = openDb()
  try {
    return db.prepare('SELECT action, outcome FROM audit_entries WHERE action = ?').all(action)
  } finally {
    db.close()
  }
}

async function readBridgeToken() {
  const tokenPath = join(dshHome, 'run', 'bridge.token')
  for (let i = 0; i < 20; i += 1) {
    if (existsSync(tokenPath)) return String(await readFile(tokenPath, 'utf8')).trim()
    await delay(50)
  }
  throw new Error('bridge token missing')
}

async function ledgerVisit() {
  const created = await send('/api/v1/apps', {
    token: pageToken,
    body: { spec: SUPPLIER_VISITS_SPEC, workspaceCwd },
  })
  assert.equal(created.status, 201, JSON.stringify(created.payload))
  const activated = await send(`/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {
    token: pageToken,
    body: {},
  })
  assert.equal(activated.status, 200, JSON.stringify(activated.payload))
  const inserted = await send('/api/v1/apps/supplier-visits/visit', {
    token: pageToken,
    body: {
      supplier: 'ACME',
      visit_date: '2026-09-01',
      status: '计划',
      workspaceCwd,
    },
  })
  assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
  return { appId: created.payload.data.appId, rid: inserted.payload.data.id }
}

function taskTitle(id) {
  const db = openDb()
  try {
    const row = db.prepare('SELECT title FROM tasks WHERE id = ?').get(id)
    return row ? row.title : null
  } finally {
    db.close()
  }
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
      FDE_RUNTIME_SUPERVISED: '1',
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
    if (match && pageToken) {
      base = `http://127.0.0.1:${match[1]}`
      const res = await fetch(`${base}/health`).catch(() => null)
      if (res?.ok) return
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  throw new Error(`page-token write server failed to start\n${stderr}\n${stdout}`)
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

async function send(path, { method = 'POST', body, token, origin: requestOrigin = origin } = {}) {
  const headers = { Origin: requestOrigin }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['x-fde-ui-token'] = token
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  return { status: res.status, payload }
}

async function boot(t) {
  await startServer()
  t.after(async () => {
    await stopServer()
    await rm(root, { recursive: true, force: true })
  })
  assert.match(pageToken, /^[0-9a-f]{64}$/u)
}

describe('remaining writes require the page token', { concurrency: 1 }, () => {
  test('forged allowlisted Origin cannot create a plan task', async (t) => {
    await boot(t)
    const before = taskCount()
    const audits = auditCount()
    const created = await send('/api/v1/plan/tasks', {
      body: { workspaceId: 'ws_personal', title: '伪造来源' },
    })
    assert.equal(created.status, 401, JSON.stringify(created.payload))
    assert.equal(taskCount(), before)
    assert.equal(auditCount(), audits)
  })

  test('forged allowlisted Origin cannot patch a plan task', async (t) => {
    await boot(t)
    const created = await send('/api/v1/plan/tasks', {
      token: pageToken,
      body: { workspaceId: 'ws_personal', title: '原标题' },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const id = created.payload.data.id
    const audits = auditCount()
    const patched = await send(`/api/v1/plan/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { title: '被改掉' },
    })
    assert.equal(patched.status, 401, JSON.stringify(patched.payload))
    assert.equal(taskTitle(id), '原标题')
    assert.equal(auditCount(), audits)
  })

  test('forged allowlisted Origin cannot create a workflow', async (t) => {
    await boot(t)
    const before = workflowCount()
    const created = await send('/api/v1/plan/workflows', {
      body: { workspaceId: 'ws_personal', name: '伪造流' },
    })
    assert.equal(created.status, 401, JSON.stringify(created.payload))
    assert.equal(workflowCount(), before)
  })

  test('forged allowlisted Origin cannot create a plan event', async (t) => {
    await boot(t)
    const before = eventCount()
    const created = await send('/api/v1/plan/events', {
      body: {
        workspaceId: 'ws_personal',
        title: '伪造日程',
        startAt: '2026-10-02T01:00:00.000Z',
        endAt: '2026-10-02T02:00:00.000Z',
      },
    })
    assert.equal(created.status, 401, JSON.stringify(created.payload))
    assert.equal(eventCount(), before)
  })

  test('forged allowlisted Origin cannot delete an app record', async (t) => {
    await boot(t)
    const created = await send('/api/v1/apps', {
      token: pageToken,
      body: { spec: SUPPLIER_VISITS_SPEC, workspaceCwd },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const appId = created.payload.data.appId
    const activated = await send(`/api/v1/apps/${encodeURIComponent(appId)}/activate`, {
      token: pageToken,
      body: {},
    })
    assert.equal(activated.status, 200, JSON.stringify(activated.payload))
    const inserted = await send('/api/v1/apps/supplier-visits/visit', {
      token: pageToken,
      body: {
        supplier: 'ACME',
        visit_date: '2026-09-01',
        status: '计划',
        workspaceCwd,
      },
    })
    assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
    const rid = inserted.payload.data.id
    const removed = await send(
      `/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
      { method: 'DELETE' },
    )
    assert.equal(removed.status, 401, JSON.stringify(removed.payload))
    const got = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    )
    const gotBody = await got.json()
    assert.equal(got.status, 200)
    assert.equal(gotBody.data.status, '计划')
  })

  test('forged allowlisted Origin cannot mark-follow', async (t) => {
    await boot(t)
    const created = await send('/api/v1/apps', {
      token: pageToken,
      body: { spec: SUPPLIER_VISITS_SPEC, workspaceCwd },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const activated = await send(`/api/v1/apps/${encodeURIComponent(created.payload.data.appId)}/activate`, {
      token: pageToken,
      body: {},
    })
    assert.equal(activated.status, 200, JSON.stringify(activated.payload))
    const inserted = await send('/api/v1/apps/supplier-visits/visit', {
      token: pageToken,
      body: {
        supplier: 'ACME',
        visit_date: '2026-09-01',
        status: '计划',
        workspaceCwd,
      },
    })
    assert.equal(inserted.status, 201, JSON.stringify(inserted.payload))
    const rid = inserted.payload.data.id
    const followed = await send('/api/v1/apps/supplier-visits/actions/mark-follow', {
      body: { rids: [rid], workspaceCwd },
    })
    assert.equal(followed.status, 401, JSON.stringify(followed.payload))
    const got = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    )
    const gotBody = await got.json()
    assert.equal(got.status, 200)
    assert.equal(gotBody.data.status, '计划')
  })

  test('forged allowlisted Origin cannot mkdir a workspace file', async (t) => {
    await boot(t)
    const dir = join(workspaceCwd, 's3-probe')
    const created = await send('/api/v1/files/mkdir', { body: { name: 's3-probe' } })
    assert.equal(created.status, 401, JSON.stringify(created.payload))
    assert.equal(existsSync(dir), false)
  })

  test('forged allowlisted Origin cannot post an IM draft', async (t) => {
    await boot(t)
    const drafted = await send('/api/v1/im/draft', { body: { text: 'x' } })
    assert.equal(drafted.status, 401, JSON.stringify(drafted.payload))
  })

  test('forged allowlisted Origin cannot write an MCP archive entry', async (t) => {
    await boot(t)
    const saved = await send('/api/v1/mcp/servers', { body: { serverName: '' } })
    assert.equal(saved.status, 401, JSON.stringify(saved.payload))
  })

  test('forged allowlisted Origin cannot write a skill bundle file', async (t) => {
    await boot(t)
    const saved = await send('/api/v1/skills/bundle/file', {
      method: 'PUT',
      body: { path: '', rel: '', text: 'x' },
    })
    assert.equal(saved.status, 401, JSON.stringify(saved.payload))
  })

  test('forged allowlisted Origin cannot create an AI session', async (t) => {
    await boot(t)
    const created = await send('/api/v1/ai/sessions', { body: { workspaceId: 'ws_personal' } })
    assert.equal(created.status, 401, JSON.stringify(created.payload))
  })

  test('forged allowlisted Origin cannot write a model credential', async (t) => {
    await boot(t)
    const credPath = join(dshHome, '.credentials.yaml')
    const before = existsSync(credPath) ? await readFile(credPath, 'utf8') : ''
    const saved = await send('/api/v1/ai/credentials', {
      body: { name: 'S3_CANARY', value: 'not-a-real-secret' },
    })
    assert.equal(saved.status, 401, JSON.stringify(saved.payload))
    const after = existsSync(credPath) ? await readFile(credPath, 'utf8') : ''
    assert.equal(after, before)
  })

  test('forged allowlisted Origin cannot save memory settings', async (t) => {
    await boot(t)
    const saved = await send('/api/v1/memory/settings', { body: { enabled: false } })
    assert.equal(saved.status, 401, JSON.stringify(saved.payload))
  })

  test('forged allowlisted Origin cannot run a briefing', async (t) => {
    await boot(t)
    const ran = await send('/api/v1/briefing/run', {
      body: { workspaceCwd, mode: 'internal-only' },
    })
    assert.equal(ran.status, 401, JSON.stringify(ran.payload))
  })

  test('page token creates a plan task and writes one audit row', async (t) => {
    await boot(t)
    const before = auditCount()
    const created = await send('/api/v1/plan/tasks', {
      token: pageToken,
      body: { workspaceId: 'ws_personal', title: '带令牌' },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    assert.equal(created.payload.data.title, '带令牌')
    assert.equal(auditCount(), before + 1)
    const rows = auditFor('plan.task.insert')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].outcome, 'succeeded')
  })

  test('page token patches a plan task and writes one audit row', async (t) => {
    await boot(t)
    const created = await send('/api/v1/plan/tasks', {
      token: pageToken,
      body: { workspaceId: 'ws_personal', title: '原标题' },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    const id = created.payload.data.id
    const before = auditCount()
    const patched = await send(`/api/v1/plan/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token: pageToken,
      body: { title: '改后' },
    })
    assert.equal(patched.status, 200, JSON.stringify(patched.payload))
    assert.equal(patched.payload.data.title, '改后')
    assert.equal(taskTitle(id), '改后')
    assert.equal(auditCount(), before + 1)
    assert.equal(auditFor('plan.task.update').length, 1)
  })

  test('page token creates a workflow and writes one audit row', async (t) => {
    await boot(t)
    const before = auditCount()
    const created = await send('/api/v1/plan/workflows', {
      token: pageToken,
      body: { workspaceId: 'ws_personal', name: '带令牌流' },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    assert.equal(created.payload.data.name, '带令牌流')
    assert.equal(auditCount(), before + 1)
    assert.equal(auditFor('plan.workflow.insert')[0].outcome, 'succeeded')
  })

  test('bridge token is not accepted as the page token', async (t) => {
    await boot(t)
    const bridgeToken = await readBridgeToken()
    assert.notEqual(bridgeToken, pageToken)
    const before = taskCount()
    const created = await send('/api/v1/plan/tasks', {
      token: bridgeToken,
      body: { workspaceId: 'ws_personal', title: '桥令牌' },
    })
    assert.equal(created.status, 401, JSON.stringify(created.payload))
    assert.equal(taskCount(), before)
    assert.equal(auditCount(), 0)
  })

  test('a page token does not bypass a forbidden Origin', async (t) => {
    await boot(t)
    const before = taskCount()
    const created = await send('/api/v1/plan/tasks', {
      token: pageToken,
      origin: 'http://evil.example',
      body: { workspaceId: 'ws_personal', title: '越权' },
    })
    assert.equal(created.status, 403, JSON.stringify(created.payload))
    assert.equal(taskCount(), before)
  })

  test('page token deletes an app record', async (t) => {
    await boot(t)
    const { rid } = await ledgerVisit()
    const removed = await send(
      `/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
      { method: 'DELETE', token: pageToken },
    )
    assert.equal(removed.status, 200, JSON.stringify(removed.payload))
    const got = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    )
    assert.equal(got.status, 404)
  })

  test('page token mark-follow updates the record', async (t) => {
    await boot(t)
    const { rid } = await ledgerVisit()
    const followed = await send('/api/v1/apps/supplier-visits/actions/mark-follow', {
      token: pageToken,
      body: { rids: [rid], workspaceCwd },
    })
    assert.equal(followed.status, 200, JSON.stringify(followed.payload))
    const got = await fetch(
      `${base}/api/v1/apps/supplier-visits/visit/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    )
    const gotBody = await got.json()
    assert.equal(got.status, 200)
    assert.equal(gotBody.data.status, '需跟进')
  })

  test('page token mkdir and credential writes keep their current results', async (t) => {
    await boot(t)
    const dir = join(workspaceCwd, 's3-probe')
    const created = await send('/api/v1/files/mkdir', {
      token: pageToken,
      body: { name: 's3-probe' },
    })
    assert.equal(created.status, 201, JSON.stringify(created.payload))
    assert.equal(existsSync(dir), true)
    const credPath = join(dshHome, '.credentials.yaml')
    const saved = await send('/api/v1/ai/credentials', {
      token: pageToken,
      body: { name: 'S3_CANARY', value: 'not-a-real-secret' },
    })
    assert.equal(saved.status, 200, JSON.stringify(saved.payload))
    const text = await readFile(credPath, 'utf8')
    assert.equal(text.includes('S3_CANARY'), true)
  })

  test('page token leaves handler results that were already not 2xx', async (t) => {
    await boot(t)
    const drafted = await send('/api/v1/im/draft', { token: pageToken, body: { text: 'x' } })
    assert.equal(drafted.status, 503, JSON.stringify(drafted.payload))
    const mcp = await send('/api/v1/mcp/servers', { token: pageToken, body: { serverName: '' } })
    assert.equal(mcp.status, 400, JSON.stringify(mcp.payload))
    const skill = await send('/api/v1/skills/bundle/file', {
      method: 'PUT',
      token: pageToken,
      body: { path: '', rel: '', text: 'x' },
    })
    assert.equal(skill.status, 403, JSON.stringify(skill.payload))
    const session = await send('/api/v1/ai/sessions', {
      token: pageToken,
      body: { workspaceId: 'ws_personal' },
    })
    assert.equal(session.status, 503, JSON.stringify(session.payload))
    const memory = await send('/api/v1/memory/settings', {
      token: pageToken,
      body: { enabled: false },
    })
    assert.equal(memory.status, 503, JSON.stringify(memory.payload))
    const briefing = await send('/api/v1/briefing/run', {
      token: pageToken,
      body: { workspaceCwd, mode: 'internal-only' },
    })
    assert.equal(briefing.status, 400, JSON.stringify(briefing.payload))
  })

  test('public share insert stays open without a page token', async (t) => {
    await boot(t)
    const { appId } = await ledgerVisit()
    const shared = await send(`/api/v1/apps/${encodeURIComponent(appId)}/share`, {
      token: pageToken,
      body: {},
    })
    assert.equal(shared.status, 200, JSON.stringify(shared.payload))
    const shareId = shared.payload.data.shareId
    const inserted = await fetch(`${base}/api/v1/app-share/${encodeURIComponent(shareId)}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier: 'SHARE',
        visit_date: '2026-09-02',
        status: '计划',
      }),
    })
    const body = await inserted.json()
    assert.equal(inserted.status, 201, JSON.stringify(body))
    assert.equal(body.data.supplier, 'SHARE')
  })
})
