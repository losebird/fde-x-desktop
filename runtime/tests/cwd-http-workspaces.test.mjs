import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { insertBizSurface, openDatabase } from '../db.mjs'
import { getOrCreateDefinition } from '../briefing/store.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const migrations = join(repoRoot, 'runtime/migrations')
const badWorkspaces = ['a/b', '..', 'proj', '']

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

async function startServer(label, env) {
  const port = 25000 + ((process.pid + label.length * 13) % 15000)
  const dbPath = `/tmp/fde-cwd-http-ws-${label}-${Date.now()}.sqlite`
  const db = openDatabase(dbPath, migrations)
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let childStderr = ''
  child.stderr.on('data', (chunk) => { childStderr += chunk.toString() })
  const base = `http://127.0.0.1:${port}`
  let healthy = false
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const health = await fetch(`${base}/health`)
      if (health.ok) {
        healthy = true
        break
      }
    } catch {
    }
    await delay(100)
  }
  if (!healthy) {
    child.kill('SIGTERM')
    db.close()
    throw new Error(`runtime did not start: ${childStderr.slice(0, 500)}`)
  }
  return {
    base,
    db,
    stop: async () => {
      child.kill('SIGTERM')
      db.close()
      await delay(100)
    },
  }
}

test('GET /api/v1/biz/surfaces with C:/x returns only that workspace', { timeout: 30_000 }, async () => {
  const fallback = '/tmp/fde-cwd-surfaces-default'
  await mkdir(fallback, { recursive: true })
  const server = await startServer('surfaces', { FDE_AI_WORKSPACE: fallback })
  const win = insertBizSurface(server.db, { workspaceCwd: 'C:\\x\\', kind: 'visit', action: 'write', createdAt: 2 })
  const fallbackRow = insertBizSurface(server.db, { workspaceCwd: fallback, kind: 'visit', action: 'write', createdAt: 1 })
  try {
    const response = await fetch(`${server.base}/api/v1/biz/surfaces?workspace=${encodeURIComponent('C:/x')}&limit=20`)
    assert.equal(response.status, 200)
    const ids = (await response.json()).items.map((item) => item.id)
    assert.deepEqual(ids, [win])
    assert.equal(ids.includes(fallbackRow), false)
  } finally {
    await server.stop()
  }
})

test('GET /api/v1/biz/surfaces rejects a workspace that is not absolute', { timeout: 30_000 }, async () => {
  const fallback = '/tmp/fde-cwd-surfaces-bad'
  await mkdir(fallback, { recursive: true })
  const server = await startServer('surfaces-bad', { FDE_AI_WORKSPACE: fallback })
  insertBizSurface(server.db, { workspaceCwd: fallback, kind: 'visit', action: 'write', createdAt: 1 })
  try {
    const problems = []
    for (const workspace of badWorkspaces) {
      const response = await fetch(`${server.base}/api/v1/biz/surfaces?workspace=${encodeURIComponent(workspace)}&limit=20`)
      if (response.status !== 400) problems.push(`surfaces ${JSON.stringify(workspace)} status ${response.status}`)
    }
    assert.deepEqual(problems, [])
  } finally {
    await server.stop()
  }
})

test('GET /api/v1/files with C:/x lists that workspace', { timeout: 30_000 }, async () => {
  const winDir = join(repoRoot, 'C:', 'x')
  await mkdir(winDir, { recursive: true })
  await writeFile(join(winDir, 'win-marker.txt'), 'win')
  const server = await startServer('files', { FDE_AI_WORKSPACE: repoRoot })
  try {
    const response = await fetch(`${server.base}/api/v1/files?cwd=${encodeURIComponent('C:/x')}`)
    assert.equal(response.status, 200)
    const names = (await response.json()).data.entries.map((entry) => entry.name)
    assert.deepEqual(names, ['win-marker.txt'])
  } finally {
    await server.stop()
    await rm(join(repoRoot, 'C:'), { recursive: true, force: true })
  }
})

test('GET /api/v1/files rejects a cwd that is not absolute', { timeout: 30_000 }, async () => {
  const server = await startServer('files-bad', { FDE_AI_WORKSPACE: repoRoot })
  try {
    const problems = []
    for (const cwd of badWorkspaces) {
      const response = await fetch(`${server.base}/api/v1/files?cwd=${encodeURIComponent(cwd)}`)
      if (response.status !== 400) problems.push(`files ${JSON.stringify(cwd)} status ${response.status}`)
    }
    assert.deepEqual(problems, [])
  } finally {
    await server.stop()
  }
})

test('GET /api/v1/briefing/latest with C:/x returns that workspace definition', { timeout: 30_000 }, async () => {
  const fallback = '/tmp/fde-cwd-brief-default'
  await mkdir(fallback, { recursive: true })
  const server = await startServer('brief', { FDE_AI_WORKSPACE: fallback })
  registerWorkspace(server.db, 'ws_brief_default', fallback)
  registerWorkspace(server.db, 'ws_brief_win', 'C:/x')
  const fallbackDef = getOrCreateDefinition(server.db, fallback)
  const winDef = getOrCreateDefinition(server.db, 'C:/x')
  server.db.prepare('UPDATE briefing_definitions SET name = ? WHERE id = ?').run('default-brief', fallbackDef.id)
  server.db.prepare('UPDATE briefing_definitions SET name = ? WHERE id = ?').run('win-brief', winDef.id)
  try {
    const response = await fetch(`${server.base}/api/v1/briefing/latest?workspace=${encodeURIComponent('C:/x')}`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.data.definition.id, winDef.id)
    assert.equal(body.data.definition.name, 'win-brief')
    assert.equal(body.data.definition.workspaceCwd, 'C:/x')
  } finally {
    await server.stop()
  }
})

test('GET /api/v1/briefing/latest rejects a workspace that is not absolute', { timeout: 30_000 }, async () => {
  const fallback = '/tmp/fde-cwd-brief-bad'
  await mkdir(fallback, { recursive: true })
  const server = await startServer('brief-bad', { FDE_AI_WORKSPACE: fallback })
  registerWorkspace(server.db, 'ws_brief_bad', fallback)
  getOrCreateDefinition(server.db, fallback)
  try {
    const problems = []
    for (const workspace of badWorkspaces) {
      const response = await fetch(`${server.base}/api/v1/briefing/latest?workspace=${encodeURIComponent(workspace)}`)
      if (response.status !== 400) problems.push(`briefing ${JSON.stringify(workspace)} status ${response.status}`)
    }
    assert.deepEqual(problems, [])
  } finally {
    await server.stop()
  }
})

test('a Windows runtime cwd is used when the request omits workspace', { timeout: 30_000 }, async () => {
  const resolvedFallback = resolve('C:/rt')
  await mkdir(resolvedFallback, { recursive: true })
  const server = await startServer('runtime', { FDE_AI_WORKSPACE: 'C:/rt' })
  const win = insertBizSurface(server.db, { workspaceCwd: 'C:/rt', kind: 'visit', action: 'write', createdAt: 2 })
  const resolvedRow = insertBizSurface(server.db, { workspaceCwd: resolvedFallback, kind: 'visit', action: 'write', createdAt: 1 })
  try {
    const response = await fetch(`${server.base}/api/v1/biz/surfaces?limit=20`)
    assert.equal(response.status, 200)
    const ids = (await response.json()).items.map((item) => item.id)
    assert.deepEqual(ids, [win])
    assert.equal(ids.includes(resolvedRow), false)
  } finally {
    await server.stop()
    await rm(join(repoRoot, 'C:'), { recursive: true, force: true })
  }
})

test('surfaces files and briefing keep the no-workspace default', { timeout: 30_000 }, async () => {
  const fallback = '/tmp/fde-cwd-omit-default'
  await mkdir(fallback, { recursive: true })
  await writeFile(join(fallback, 'default-marker.txt'), 'default')
  const server = await startServer('omit', { FDE_AI_WORKSPACE: fallback })
  const fallbackSurface = insertBizSurface(server.db, { workspaceCwd: fallback, kind: 'visit', action: 'write', createdAt: 1 })
  insertBizSurface(server.db, { workspaceCwd: 'C:/x', kind: 'visit', action: 'write', createdAt: 2 })
  registerWorkspace(server.db, 'ws_omit_default', fallback)
  registerWorkspace(server.db, 'ws_omit_win', 'C:/x')
  const fallbackDef = getOrCreateDefinition(server.db, fallback)
  getOrCreateDefinition(server.db, 'C:/x')
  server.db.prepare('UPDATE briefing_definitions SET name = ? WHERE id = ?').run('default-brief', fallbackDef.id)
  try {
    const surfaces = await fetch(`${server.base}/api/v1/biz/surfaces?limit=20`)
    assert.equal(surfaces.status, 200)
    assert.deepEqual((await surfaces.json()).items.map((item) => item.id), [fallbackSurface])

    const files = await fetch(`${server.base}/api/v1/files`)
    assert.equal(files.status, 200)
    const names = (await files.json()).data.entries.map((entry) => entry.name)
    assert.equal(names.includes('default-marker.txt'), true)

    const latest = await fetch(`${server.base}/api/v1/briefing/latest`)
    assert.equal(latest.status, 200)
    assert.equal((await latest.json()).data.definition.id, fallbackDef.id)
  } finally {
    await server.stop()
  }
})
