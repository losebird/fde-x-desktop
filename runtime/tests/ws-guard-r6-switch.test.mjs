import './support/no-stray-processes.mjs'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
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

async function startServer(dbPath) {
  const dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-r6-switch-'))
  await writeFile(join(dshHome, '.credentials.yaml'), 'keys: {}\n', 'utf8')
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
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
    throw new Error(`runtime did not start: ${stderr.slice(0, 800)}`)
  }
  return {
    base,
    uiToken,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(50)
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

test('leaving a workspace and coming back reloads that session list', async () => {
  const { sessionListWorkspaceId, takeSessionList } = await import('../../src/lib/ai-session-list.ts')
  const workspaces = [{ id: 'ws_a' }, { id: 'ws_b' }]
  const stored = {
    ws_a: [{ sessionId: 'sess-a', title: '甲区会话' }],
    ws_b: [{ sessionId: 'sess-b', title: '乙区会话' }],
  }
  const queried = []
  const list = async (workspaceId) => {
    queried.push(workspaceId)
    return stored[workspaceId] || []
  }
  const entered = sessionListWorkspaceId('', workspaces)
  assert.notEqual(entered, '')
  assert.equal(entered, 'ws_a')
  let snap = await takeSessionList(entered, list)
  assert.equal(snap.some((row) => row.sessionId === 'sess-a'), true)
  const away = sessionListWorkspaceId('ws_b', workspaces)
  snap = await takeSessionList(away, list)
  assert.equal(snap.some((row) => row.sessionId === 'sess-a'), false)
  assert.equal(snap.some((row) => row.sessionId === 'sess-b'), true)
  const back = sessionListWorkspaceId('ws_a', workspaces)
  snap = await takeSessionList(back, list)
  assert.deepEqual(queried, ['ws_a', 'ws_b', 'ws_a'])
  assert.equal(snap.some((row) => row.sessionId === 'sess-a'), true)
})

test('an empty active workspace id still names the default workspace', async () => {
  const { sessionListWorkspaceId } = await import('../../src/lib/ai-session-list.ts')
  const id = sessionListWorkspaceId('', [])
  assert.equal(id, 'ws_personal')
  assert.notEqual(id, '')
})

describe('sessions without a cwd', () => {
  let server
  let dbPath

  before(async () => {
    dbPath = `/tmp/fde-ws-r6-switch-${process.pid}.sqlite`
    await rm(dbPath, { force: true })
    const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    registerWorkspace(db, 'ws_a', '/ws-guard-a')
    db.close()
    server = await startServer(dbPath)
    const connect = await call(server, 'POST', '/api/v1/ai/connect')
    assert.equal(connect.status, 200, connect.text.slice(0, 400))
  })

  after(async () => {
    if (server) await server.stop()
    if (dbPath) await rm(dbPath, { force: true })
  })

  test('a session with no cwd is listed only for ws_personal', async () => {
  const created = await call(server, 'POST', '/api/v1/ai/sessions', { workspaceId: 'dsh-personal' })
  assert.equal(created.status, 201, created.text.slice(0, 400))
  const sessionId = created.payload?.data?.sessionId
  assert.equal(typeof sessionId, 'string')
  const personal = await call(server, 'GET', '/api/v1/ai/sessions?workspaceId=ws_personal')
  const omitted = await call(server, 'GET', '/api/v1/ai/sessions')
  const other = await call(server, 'GET', '/api/v1/ai/sessions?workspaceId=ws_a')
  assert.equal(personal.status, 200)
  assert.equal(idsOf(personal.payload).includes(sessionId), true)
  assert.equal(idsOf(omitted.payload).includes(sessionId), true)
  assert.equal(idsOf(other.payload).includes(sessionId), false)
  })
})
