import { spawn } from 'node:child_process'
import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const marker = '本区开工'

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

async function reapHome(home) {
  let names = []
  try {
    names = await readdir('/proc')
  } catch {
    return
  }
  const needle = home
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue
    let env = ''
    try {
      env = await readEnv(name)
    } catch {
      continue
    }
    if (!env.includes(needle)) continue
    try {
      process.kill(Number(name), 'SIGTERM')
    } catch { /* already gone */ }
  }
}

async function readEnv(pid) {
  const { readFile } = await import('node:fs/promises')
  const raw = await readFile(`/proc/${pid}/environ`)
  return raw.toString('utf8')
}

async function startServer(dbPath, dshHome, dirA) {
  const credentials = join(dshHome, '.credentials.yaml')
  await writeFile(credentials, '', { mode: 0o600 })
  await chmod(credentials, 0o600)
  const env = { ...process.env }
  delete env.FDE_TEST_DSH_BIN
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_AI_WORKSPACE: dirA,
      FDE_RUNTIME_SUPERVISED: '1',
      DSH_TELEMETRY_DISABLED: '1',
      DSH_LAN_ASSIST_PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  let base = ''
  let uiToken = ''
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const port = (stdout.match(/^FDE_LISTENING\s+(\d+)/m) || [])[1]
    uiToken = (stdout.match(/^FDE_UI_TOKEN\s+(\S+)/m) || [])[1] || ''
    if (port && uiToken) {
      base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(250)
  }
  if (!base) {
    child.kill('SIGTERM')
    throw new Error(`runtime did not start: ${stderr.slice(-1200)}\n${stdout.slice(-1200)}`)
  }
  return {
    base,
    uiToken,
    log: () => `${stderr.slice(-1500)}\n${stdout.slice(-1500)}`,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(200)
      await reapHome(dshHome)
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
    payload = { raw: text.slice(0, 400) }
  }
  return { status: response.status, payload, text }
}

let server
let dshHome
let dbPath
let dirA
let dirB
let sessionB = ''

before(async () => {
  dbPath = `/tmp/fde-ws-r6-${process.pid}.sqlite`
  dshHome = await mkdtemp(join(tmpdir(), 'fde-ws-r6-home-'))
  dirA = await mkdtemp(join(tmpdir(), 'fde-ws-r6-a-'))
  dirB = await mkdtemp(join(tmpdir(), 'fde-ws-r6-b-'))
  await rm(dbPath, { force: true })
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  registerWorkspace(db, 'ws_a', dirA)
  registerWorkspace(db, 'ws_b', dirB)
  db.close()
  server = await startServer(dbPath, dshHome, dirA)
  const connect = await call(server, 'POST', '/api/v1/ai/connect')
  assert.equal(connect.status, 200, `${connect.text.slice(0, 800)}\n${server.log()}`)
  const created = await call(server, 'POST', '/api/v1/ai/sessions', { cwd: dirB })
  assert.equal(created.status, 201, created.text.slice(0, 800))
  sessionB = String(created.payload?.data?.sessionId || '')
  assert.equal(sessionB.length > 0, true, created.text.slice(0, 400))
}, { timeout: 180_000 })

after(async () => {
  if (server) await server.stop()
  if (dbPath) await rm(dbPath, { force: true })
  if (dshHome) await rm(dshHome, { recursive: true, force: true })
  if (dirA) await rm(dirA, { recursive: true, force: true })
  if (dirB) await rm(dirB, { recursive: true, force: true })
})

test('a live session corpus read from another workspace is 404', async () => {
  const prompted = call(
    server,
    'POST',
    `/api/v1/ai/sessions/${encodeURIComponent(sessionB)}/prompt?cwd=${encodeURIComponent(dirB)}`,
    { text: marker },
  )
  let owner = { status: 0, text: '', payload: {} }
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    owner = await call(server, 'GET', `/api/v1/corpus/session:${encodeURIComponent(sessionB)}?cwd=${encodeURIComponent(dirB)}`)
    if (owner.status === 200 && owner.text.includes(marker)) break
    await delay(400)
  }
  const promptResult = await Promise.race([
    prompted,
    delay(1_000).then(() => ({ status: 0, text: 'prompt still running' })),
  ])
  assert.equal(owner.status, 200, `owner ${owner.status} prompt ${promptResult.status} ${promptResult.text?.slice?.(0, 300) || ''} body ${owner.text.slice(0, 500)}`)
  assert.equal(owner.text.includes(marker), true, owner.text.slice(0, 500))
  const foreign = await call(server, 'GET', `/api/v1/corpus/session:${encodeURIComponent(sessionB)}?cwd=${encodeURIComponent(dirA)}`)
  assert.equal(foreign.status, 404, foreign.text.slice(0, 800))
  assert.equal(foreign.text.includes(marker), false, foreign.text.slice(0, 800))
  assert.equal(foreign.payload?.error?.code, 'not_found')
}, { timeout: 120_000 })

test('real host memory usage status is recorded for both workspaces', async () => {
  const ready = await call(server, 'GET', '/api/v1/memory/ready')
  const usageA = await call(server, 'GET', `/api/v1/memory/usage?cwd=${encodeURIComponent(dirA)}`)
  const usageB = await call(server, 'GET', `/api/v1/memory/usage?cwd=${encodeURIComponent(dirB)}`)
  const omitted = await call(server, 'GET', '/api/v1/memory/usage')
  const deps = await call(server, 'GET', `/api/v1/memory/deps?cwd=${encodeURIComponent(dirA)}`)
  const record = {
    ready: ready.status,
    readyBody: ready.payload,
    usageA: usageA.status,
    usageABody: usageA.payload,
    usageB: usageB.status,
    usageBBody: usageB.payload,
    omitted: omitted.status,
    omittedBody: omitted.payload,
    deps: deps.status,
    depsBody: deps.payload,
  }
  console.log(`USAGE_RECORD ${JSON.stringify(record)}`)
  await writeFile('/tmp/ws-r6-usage.json', JSON.stringify(record, null, 2))
  assert.equal(usageA.status === 401 || usageA.status === 403, false, usageA.text.slice(0, 400))
  assert.equal(typeof usageA.status, 'number')
})
