import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const hostDouble = join(repoRoot, 'runtime/tests/fixtures/session-host-double.mjs')

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

async function startServer(dbPath, sessionRoot) {
  const dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-guard-r5-'))
  await writeFile(join(dshHome, '.credentials.yaml'), 'keys: {}\n', 'utf8')
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_DSH_SESSION_ROOT: sessionRoot,
      FDE_RUNTIME_SUPERVISED: '1',
      FDE_TEST_DSH_BIN: hostDouble,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  let base = ''
  let uiToken = ''
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const port = (stdout.match(/^FDE_LISTENING\s+(\d+)/m) || [])[1]
    uiToken = (stdout.match(/^FDE_UI_TOKEN\s+(\S+)/m) || [])[1] || ''
    if (port && uiToken) {
      base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  if (!base) {
    child.kill('SIGTERM')
    throw new Error(`runtime did not start: ${stderr.slice(0, 800)}\n${stdout.slice(0, 800)}`)
  }
  return {
    base,
    uiToken,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(50)
      spawn('pkill', ['-f', 'session-host-double.mjs'], { stdio: 'ignore' })
      await rm(dshHome, { recursive: true, force: true })
    },
  }
}

async function call(server, method, path, body) {
  const response = await fetch(`${server.base}${path}`, {
    method,
    headers: {
      Origin: server.base,
      'x-fde-ui-token': server.uiToken,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text.slice(0, 200) }
  }
  return { status: response.status, payload, text }
}

function idsOf(payload) {
  const items = payload?.data?.items
  return Array.isArray(items) ? items.map((item) => item.sessionId) : []
}

let server
let sessionRoot
let dbPath
let sessionA = ''
let sessionB = ''

before(async () => {
  dbPath = `/tmp/fde-ws-r5-${process.pid}.sqlite`
  sessionRoot = `/tmp/fde-ws-r5-sessions-${process.pid}`
  await rm(dbPath, { force: true })
  await rm(sessionRoot, { recursive: true, force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  db.close()
  server = await startServer(dbPath, sessionRoot)
  const connect = await call(server, 'POST', '/api/v1/ai/connect')
  assert.equal(connect.status, 200, connect.text.slice(0, 500))
  const createdA = await call(server, 'POST', '/api/v1/ai/sessions', { cwd: '/ws-guard-a' })
  const createdB = await call(server, 'POST', '/api/v1/ai/sessions', { cwd: '/ws-guard-b' })
  assert.equal(createdA.status, 201, createdA.text.slice(0, 400))
  assert.equal(createdB.status, 201, createdB.text.slice(0, 400))
  sessionA = createdA.payload?.data?.sessionId
  sessionB = createdB.payload?.data?.sessionId
  assert.equal(typeof sessionA, 'string')
  assert.equal(typeof sessionB, 'string')
  const titleA = await call(server, 'POST', `/api/v1/ai/sessions/${sessionA}/rename?workspaceId=ws_a`, { title: '标题A' })
  const titleB = await call(server, 'POST', `/api/v1/ai/sessions/${sessionB}/rename?workspaceId=ws_b`, { title: '标题B' })
  assert.equal(titleA.status, 200, titleA.text.slice(0, 300))
  assert.equal(titleB.status, 200, titleB.text.slice(0, 300))
  await mkdir(join(sessionRoot, 'b', sessionB), { recursive: true })
  await writeFile(join(sessionRoot, 'b', sessionB, 'session.jsonl'), '导出会话秘密\n', 'utf8')
})

after(async () => {
  if (server) await server.stop()
  if (dbPath) await rm(dbPath, { force: true })
  if (sessionRoot) await rm(sessionRoot, { recursive: true, force: true })
})

test('a workspace list does not contain another workspace session', async () => {
  const listed = await call(server, 'GET', '/api/v1/ai/sessions?workspaceId=ws_a')
  const omitted = await call(server, 'GET', '/api/v1/ai/sessions')
  assert.equal(listed.status, 200)
  assert.equal(idsOf(listed.payload).includes(sessionB), false)
  assert.equal(idsOf(listed.payload).includes(sessionA), true)
  assert.equal(omitted.status, 200)
  assert.equal(idsOf(omitted.payload).includes(sessionB), false)
  assert.equal(idsOf(omitted.payload).includes(sessionA), false)
})

test('reading another workspace session is 404', async () => {
  const read = await call(server, 'GET', `/api/v1/ai/sessions/${sessionB}?workspaceId=ws_a`)
  assert.equal(read.status, 404)
  assert.equal(read.text.includes('标题B'), false)
  assert.equal(read.payload?.error?.code, 'not_found')
})

test('prompting another workspace session is 404 and that session stays idle', async () => {
  const prompted = await call(server, 'POST', `/api/v1/ai/sessions/${sessionB}/prompt?workspaceId=ws_a`, { text: '外区提问' })
  const owner = await call(server, 'GET', `/api/v1/ai/sessions/${sessionB}?workspaceId=ws_b`)
  assert.equal(prompted.status, 404)
  assert.equal(prompted.payload?.data?.accepted, undefined)
  assert.equal(owner.status, 200)
  assert.equal(owner.payload?.data?.running, false)
  assert.equal(owner.payload?.data?.title, '标题B')
})

test('a fork stays in the original workspace', async () => {
  const forked = await call(server, 'POST', `/api/v1/ai/sessions/${sessionA}/fork?workspaceId=ws_a`)
  assert.equal(forked.status, 201)
  const forkedId = forked.payload?.data?.sessionId
  assert.equal(typeof forkedId, 'string')
  assert.notEqual(forkedId, sessionA)
  const owned = await call(server, 'GET', `/api/v1/ai/sessions/${forkedId}?workspaceId=ws_a`)
  const foreignList = await call(server, 'GET', '/api/v1/ai/sessions?workspaceId=ws_b')
  const ownedList = await call(server, 'GET', '/api/v1/ai/sessions?workspaceId=ws_a')
  assert.equal(owned.status, 200)
  assert.equal(owned.payload?.data?.cwd, '/ws-guard-a')
  assert.equal(idsOf(ownedList.payload).includes(forkedId), true)
  assert.equal(idsOf(foreignList.payload).includes(forkedId), false)
  const stolen = await call(server, 'POST', `/api/v1/ai/sessions/${sessionB}/fork?workspaceId=ws_a`)
  const foreignAfter = await call(server, 'GET', '/api/v1/ai/sessions?workspaceId=ws_b')
  assert.equal(stolen.status, 404)
  assert.equal(idsOf(foreignAfter.payload).includes(sessionB), true)
  assert.equal(foreignAfter.payload?.data?.items?.length, 1)
})

test('archive or rename from another workspace leaves a running session unchanged', async () => {
  const started = await call(server, 'POST', `/api/v1/ai/sessions/${sessionB}/prompt?workspaceId=ws_b`, { text: '本区开工' })
  assert.equal(started.status, 200)
  assert.equal(started.payload?.data?.accepted, true)
  const archived = await call(server, 'POST', `/api/v1/ai/sessions/${sessionB}/archive?workspaceId=ws_a`)
  const renamed = await call(server, 'POST', `/api/v1/ai/sessions/${sessionB}/rename?workspaceId=ws_a`, { title: '外区改名' })
  const owner = await call(server, 'GET', `/api/v1/ai/sessions/${sessionB}?workspaceId=ws_b`)
  assert.equal(archived.status, 404)
  assert.equal(renamed.status, 404)
  assert.equal(owner.status, 200)
  assert.equal(owner.payload?.data?.running, true)
  assert.equal(owner.payload?.data?.title, '标题B')
  assert.equal(Boolean(owner.payload?.data?.archived), false)
})

test('other session id mouths from another workspace are 404', async () => {
  const mouths = [
    ['GET', `/api/v1/ai/sessions/${sessionB}/export?workspaceId=ws_a`],
    ['POST', `/api/v1/ai/sessions/${sessionB}/cancel?workspaceId=ws_a`, { kind: 'foreign' }],
    ['GET', `/api/v1/ai/sessions/${sessionB}/commands?workspaceId=ws_a`],
    ['POST', `/api/v1/ai/sessions/${sessionB}/commands?workspaceId=ws_a`, { line: '/foreign' }],
    ['POST', `/api/v1/ai/sessions/${sessionB}/permission?workspaceId=ws_a`, { preset: 'full' }],
    ['POST', `/api/v1/ai/sessions/${sessionB}/preset?workspaceId=ws_a`, { agentPreset: 'foreign' }],
    ['POST', `/api/v1/ai/sessions/${sessionB}/attachments?workspaceId=ws_a`, { data: 'abc' }],
    ['POST', `/api/v1/ai/sessions/${sessionB}/approval?workspaceId=ws_a`, { outcome: 'rejected' }],
    ['POST', `/api/v1/ai/sessions/${sessionB}/model?workspaceId=ws_a`, { provider: 'x', model: 'y' }],
    ['GET', `/api/v1/ai/sessions/${sessionB}/follow?workspaceId=ws_a`],
    ['GET', `/api/v1/ai/sessions/${sessionB}/skills?workspaceId=ws_a`],
  ]
  for (const [method, path, body] of mouths) {
    const result = await call(server, method, path, body)
    assert.equal(result.status, 404, `${method} ${path} -> ${result.status} ${result.text.slice(0, 180)}`)
    assert.equal(result.text.includes('导出会话秘密'), false)
    assert.equal(result.text.includes('foreign-command'), false)
  }
  const owner = await call(server, 'GET', `/api/v1/ai/sessions/${sessionB}?workspaceId=ws_b`)
  assert.equal(owner.payload?.data?.title, '标题B')
  assert.equal(owner.payload?.data?.running, true)
})
