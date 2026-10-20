import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

function insertApp(db, id, workspaceId, name) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO business_apps (
      id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'generated', 'draft', 1, '{}', ?, ?)
  `).run(id, workspaceId, name, now, now)
}

async function startServer(dbPath) {
  const dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-guard-home-'))
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_RUNTIME_SUPERVISED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  let base = ''
  let uiToken = ''
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
    throw new Error(`runtime did not start: ${stderr.slice(0, 500)}\n${stdout.slice(0, 500)}`)
  }
  return {
    base,
    uiToken,
    dshHome,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(50)
      await rm(dshHome, { recursive: true, force: true })
    },
  }
}

async function writeJson(server, path, body) {
  const response = await fetch(`${server.base}${path}`, {
    method: 'PUT',
    headers: {
      Origin: server.base,
      'Content-Type': 'application/json',
      'x-fde-ui-token': server.uiToken,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  return { status: response.status, payload }
}

test('a business app in workspace B stays unchanged when workspace A or no workspace writes it', async () => {
  const dbPath = `/tmp/fde-ws-guard-p0-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  insertApp(db, 'app_from_a', 'ws_b', '原名')
  insertApp(db, 'app_bare', 'ws_b', '原名')
  insertApp(db, 'app_del', 'ws_b', '待删')
  db.close()

  const server = await startServer(dbPath)
  try {
    const asA = await writeJson(server, '/api/v1/business/apps/app_from_a?workspaceId=ws_a', { name: '被串改' })
    const bare = await writeJson(server, '/api/v1/business/apps/app_bare', { name: '无区改' })
    const removed = await fetch(`${server.base}/api/v1/apps/app_del?workspaceId=ws_a`, {
      method: 'DELETE',
      headers: {
        Origin: server.base,
        'x-fde-ui-token': server.uiToken,
      },
    })
    const removedPayload = await removed.json()
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const fromA = check.prepare('SELECT name FROM business_apps WHERE id = ?').get('app_from_a')
    const fromBare = check.prepare('SELECT name FROM business_apps WHERE id = ?').get('app_bare')
    const trashed = check.prepare('SELECT deleted_at FROM business_apps WHERE id = ?').get('app_del')
    check.close()
    assert.deepEqual({
      fromA: fromA.name,
      fromBare: fromBare.name,
      deletedAt: String(trashed.deleted_at || ''),
      asA: asA.status,
      asACode: asA.payload.error?.code,
      bare: bare.status,
      bareCode: bare.payload.error?.code,
      removed: removed.status,
      removedCode: removedPayload.error?.code,
    }, {
      fromA: '原名',
      fromBare: '原名',
      deletedAt: '',
      asA: 404,
      asACode: 'not_found',
      bare: 404,
      bareCode: 'not_found',
      removed: 404,
      removedCode: 'not_found',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('an unknown workspace id, with or without a path, is missing_workspace', async () => {
  const dbPath = `/tmp/fde-ws-guard-a-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  db.close()
  const server = await startServer(dbPath)
  try {
    const byId = await fetch(`${server.base}/api/v1/business/apps?workspaceId=ws_missing`)
    const byIdPayload = await byId.json()
    const byPath = await fetch(`${server.base}/api/v1/business/apps?workspaceCwd=/y-not-registered`)
    const byPathPayload = await byPath.json()
    assert.deepEqual({
      byId: byId.status,
      byIdCode: byIdPayload.error?.code,
      byPath: byPath.status,
      byPathCode: byPathPayload.error?.code,
    }, {
      byId: 404,
      byIdCode: 'missing_workspace',
      byPath: 404,
      byPathCode: 'missing_workspace',
    })
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('pending events for an unregistered absolute path are missing_workspace', async () => {
  const dbPath = `/tmp/fde-ws-guard-d-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  db.close()
  const server = await startServer(dbPath)
  try {
    const response = await fetch(`${server.base}/api/v1/events/pending?cwd=/y-not-registered`)
    const payload = await response.json()
    assert.equal(response.status, 404)
    assert.equal(payload.error.code, 'missing_workspace')
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('catalog stream rejects an unregistered workspace path', async () => {
  const dbPath = `/tmp/fde-ws-guard-stream-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  db.close()
  const server = await startServer(dbPath)
  try {
    const response = await fetch(`${server.base}/api/v1/catalog/stream?kind=file&action=list&cwd=/y-not-registered`)
    const status = response.status
    const text = status === 200 ? '' : await response.text()
    await response.body?.cancel().catch(() => {})
    assert.equal(status, 404)
    assert.equal(JSON.parse(text).error.code, 'missing_workspace')
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})
