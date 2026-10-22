import './support/no-stray-processes.mjs'
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

async function startServer(dbPath) {
  const dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-guard-r4-'))
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
    stop: async () => {
      child.kill('SIGTERM')
      await delay(50)
      await rm(dshHome, { recursive: true, force: true })
    },
  }
}

async function call(server, method, path) {
  const response = await fetch(`${server.base}${path}`, {
    method,
    headers: { Origin: server.base, 'x-fde-ui-token': server.uiToken },
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

test('a workspace cannot read another workspace briefing', async () => {
  const dbPath = `/tmp/fde-ws-r4-brief-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO briefing_definitions (
      id, workspace_id, name, status, sources_json, sections_json, filters_json, delivery_json, template_json, created_at, updated_at
    ) VALUES ('bdef_b', 'ws_b', '早报', 'active', '[]', '[]', '{}', '{}', '{}', ?, ?)
  `).run(now, now)
  db.prepare(`
    INSERT INTO briefings (id, definition_id, state, content_json, generated_at, created_at, workspace_cwd)
    VALUES ('brf_b', 'bdef_b', 'ready', ?, ?, ?, '/ws-guard-b')
  `).run(JSON.stringify({ status: 'ready', summary: '早报秘密', sections: [] }), now, now)
  db.close()
  const server = await startServer(dbPath)
  try {
    const byId = await call(server, 'GET', '/api/v1/briefing/brf_b?workspace=/ws-guard-a')
    const corpus = await call(server, 'GET', '/api/v1/corpus/briefing%3Abrf_b?cwd=/ws-guard-a')
    assert.equal(byId.status, 404)
    assert.equal(byId.text.includes('早报秘密'), false)
    assert.equal(corpus.status, 404)
    assert.equal(corpus.text.includes('早报秘密'), false)
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('a workspace cannot read another workspace biz audit by trace id', async () => {
  const dbPath = `/tmp/fde-ws-r4-audit-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  db.prepare(`
    INSERT INTO biz_write_audit (
      id, workspace_cwd, trace_id, kind, action, record_no, changes_json, columns_json, written_at
    ) VALUES ('aud_b', '/ws-guard-b', 'trace_b', 'visit', 'insert', 'NO-9', ?, '[]', 1)
  `).run(JSON.stringify([{ field: 'note', after: '审计秘密' }]))
  db.close()
  const server = await startServer(dbPath)
  try {
    const read = await call(server, 'GET', '/api/v1/biz/traces?workspace=/ws-guard-a&traceId=trace_b')
    assert.equal(read.status, 404)
    assert.equal(read.text.includes('审计秘密'), false)
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})

test('refreshing one workspace lamp does not rewrite another workspace connection', async () => {
  const dbPath = `/tmp/fde-ws-r4-lamp-${process.pid}.sqlite`
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', '/ws-guard-a')
  registerWorkspace(db, 'ws_b', '/ws-guard-b')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO business_connections (
      id, workspace_id, name, provider, connection_kind, status, config_json, credential_ref, capabilities_json, created_at, updated_at
    ) VALUES ('conn_b', 'ws_b', '灯', 'lan-assist', 'adapter', 'error', '{}', NULL, '[]', ?, ?)
  `).run(now, now)
  db.close()
  const server = await startServer(dbPath)
  try {
    const listed = await call(server, 'GET', '/api/v1/business/connections?workspaceId=ws_a')
    const check = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    const status = check.prepare(`SELECT status FROM business_connections WHERE id = 'conn_b'`).get().status
    check.close()
    assert.equal(listed.status, 200)
    assert.equal(status, 'error')
  } finally {
    await server.stop()
    await rm(dbPath, { force: true })
  }
})
