import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { insertBizWriteAudit, listBizWriteAudits, openDatabase } from '../db.mjs'
import { configureEventBus, emit } from '../events.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const migrations = join(repoRoot, 'runtime/migrations')
const origin = 'http://127.0.0.1:5173'

function openTemp(name) {
  return openDatabase(`/tmp/fde-cwd-audit-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`, migrations)
}

test('listBizWriteAudits returns every stored spelling of the queried workspace', () => {
  const db = openTemp('audits')
  insertBizWriteAudit(db, {
    workspaceCwd: 'C:\\biz\\',
    traceId: 'slash',
    kind: 'visit',
    action: 'write',
    writtenAt: 1,
  })
  insertBizWriteAudit(db, {
    workspaceCwd: 'C:/biz',
    traceId: 'bare',
    kind: 'visit',
    action: 'write',
    writtenAt: 2,
  })
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws/',
    traceId: 'unix',
    kind: 'visit',
    action: 'write',
    writtenAt: 3,
  })
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/other',
    traceId: 'other',
    kind: 'visit',
    action: 'write',
    writtenAt: 4,
  })

  const fromCanonical = listBizWriteAudits(db, 'c:/biz').map((row) => row.traceId).sort()
  const fromBackslash = listBizWriteAudits(db, 'C:\\biz').map((row) => row.traceId).sort()
  const fromUnix = listBizWriteAudits(db, '/tmp/ws').map((row) => row.traceId)
  const stored = db.prepare('SELECT workspace_cwd FROM biz_write_audit ORDER BY written_at').all().map((row) => row.workspace_cwd)

  assert.deepEqual(fromCanonical, ['bare', 'slash'])
  assert.deepEqual(fromBackslash, ['bare', 'slash'])
  assert.deepEqual(fromUnix, ['unix'])
  assert.equal(listBizWriteAudits(db, '/tmp/other').some((row) => row.traceId === 'unix'), false)
  assert.deepEqual(stored, ['C:\\biz\\', 'C:/biz', '/tmp/ws/', '/tmp/other'])
  db.close()
})

function sseBody(port, workspace, since) {
  const params = new URLSearchParams()
  if (workspace !== undefined) params.set('workspace', workspace)
  if (since) params.set('since', since)
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/api/v1/events?${params.toString()}`,
      headers: { Origin: origin },
    }, (res) => {
      let body = ''
      const timer = setTimeout(() => {
        req.destroy()
        resolve({ status: res.statusCode, body })
      }, 500)
      res.on('data', (chunk) => { body += chunk.toString() })
      res.on('end', () => {
        clearTimeout(timer)
        resolve({ status: res.statusCode, body })
      })
      res.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })
    req.on('error', (error) => {
      if (error.code === 'ECONNRESET') return
      reject(error)
    })
    req.end()
  })
}

test('HTTP /api/v1/events routes filter a Windows workspace query', { timeout: 30_000 }, async () => {
  const port = 20000 + (process.pid % 20000)
  const dbPath = `/tmp/fde-cwd-events-http-${Date.now()}.sqlite`
  await mkdir('/tmp/fde-x-files-smoke', { recursive: true })
  const seed = openDatabase(dbPath, migrations)
  configureEventBus(seed)
  const seededMine = emit('task.changed', { mark: 'mine' }, { workspaceCwd: 'C:\\proj\\' })
  const seededOther = emit('task.changed', { mark: 'other' }, { workspaceCwd: '/other/ws' })
  seed.prepare('UPDATE outbox_events SET workspace_cwd = ? WHERE id = ?').run('C:\\proj\\', seededMine)
  seed.close()

  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: '/tmp/fde-x-files-smoke',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let childStderr = ''
  child.stderr.on('data', (chunk) => { childStderr += chunk.toString() })
  const base = `http://127.0.0.1:${port}`

  try {
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
    if (!healthy) throw new Error(`runtime did not start: ${childStderr.slice(0, 500)}`)

    const recent = async (workspace) => {
      const response = await fetch(`${base}/api/v1/events/recent?workspace=${encodeURIComponent(workspace)}&limit=50`, {
        headers: { Origin: origin },
      })
      assert.equal(response.status, 200)
      const json = await response.json()
      return json.items.map((item) => item.id)
    }

    const pending = await fetch(`${base}/api/v1/events/pending?workspace=${encodeURIComponent('C:/proj')}&limit=50`)
    assert.equal(pending.status, 200)
    const pendingJson = await pending.json()
    const pendingIds = pendingJson.items.map((item) => item.id)
    assert.equal(pendingIds.includes(seededMine), true)
    assert.equal(pendingIds.includes(seededOther), false)

    const misses = []
    for (const workspace of ['C:/proj', 'C:\\proj', 'c:/proj']) {
      const ids = await recent(workspace)
      if (!ids.includes(seededMine)) misses.push(`recent ${workspace} dropped the workspace event`)
      if (ids.includes(seededOther)) misses.push(`recent ${workspace} included another workspace`)
    }

    const unix = await recent('/other/ws')
    assert.equal(unix.includes(seededOther), true)
    assert.equal(unix.includes(seededMine), false)

    const absentRecent = await fetch(`${base}/api/v1/events/recent?limit=50`, { headers: { Origin: origin } })
    assert.equal(absentRecent.status, 200)
    const absentIds = (await absentRecent.json()).items.map((item) => item.id)
    assert.equal(absentIds.includes(seededMine), true)
    assert.equal(absentIds.includes(seededOther), true)

    const relativeRecent = await fetch(`${base}/api/v1/events/recent?workspace=${encodeURIComponent('proj')}&limit=50`, {
      headers: { Origin: origin },
    })
    assert.equal(relativeRecent.status, 400)
    const relativeSse = await sseBody(port, 'proj')
    assert.equal(relativeSse.status, 400)
    assert.equal(relativeSse.body.includes(seededOther), false)

    for (const workspace of ['C:/proj', 'C:\\proj', 'c:/proj']) {
      const stream = await sseBody(port, workspace)
      assert.equal(stream.status, 200, workspace)
      if (!stream.body.includes(seededMine)) misses.push(`sse ${workspace} dropped the workspace event`)
      if (stream.body.includes(seededOther)) misses.push(`sse ${workspace} included another workspace`)
    }

    assert.deepEqual(misses, [])
  } finally {
    child.kill('SIGTERM')
    await delay(100)
  }
})

const defaultWorkspace = '/tmp/fde-x-files-smoke'
const badWorkspaces = ['a/b', '..', 'proj', '']

async function startWorkspaceServer(label) {
  const port = 23000 + ((process.pid + label.length * 17) % 20000)
  const dbPath = `/tmp/fde-cwd-http-${label}-${Date.now()}.sqlite`
  await mkdir(defaultWorkspace, { recursive: true })
  const seed = openDatabase(dbPath, migrations)
  configureEventBus(seed)
  const seededMine = emit('task.changed', { mark: 'mine' }, { workspaceCwd: 'C:\\proj\\' })
  const seededOther = emit('task.changed', { mark: 'other' }, { workspaceCwd: '/other/ws' })
  seed.prepare('UPDATE outbox_events SET workspace_cwd = ? WHERE id = ?').run('C:\\proj\\', seededMine)
  insertBizWriteAudit(seed, {
    workspaceCwd: 'C:\\x\\',
    traceId: 'trace-win',
    kind: 'visit',
    action: 'write',
    recordNo: 'WIN',
    writtenAt: 10,
  })
  insertBizWriteAudit(seed, {
    workspaceCwd: defaultWorkspace,
    traceId: 'trace-default',
    kind: 'visit',
    action: 'write',
    recordNo: 'DEF',
    writtenAt: 11,
  })
  insertBizWriteAudit(seed, {
    workspaceCwd: '/tmp/other-ws',
    traceId: 'trace-other',
    kind: 'visit',
    action: 'write',
    recordNo: 'OTH',
    writtenAt: 12,
  })
  seed.close()
  const child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: dbPath,
      FDE_AI_WORKSPACE: defaultWorkspace,
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
    throw new Error(`runtime did not start: ${childStderr.slice(0, 500)}`)
  }
  return {
    port,
    base,
    seededMine,
    seededOther,
    stop: async () => {
      child.kill('SIGTERM')
      await delay(100)
    },
  }
}

test('GET /api/v1/biz/traces with C:/x returns only that workspace', { timeout: 30_000 }, async () => {
  const server = await startWorkspaceServer('traces')
  try {
    const response = await fetch(`${server.base}/api/v1/biz/traces?workspace=${encodeURIComponent('C:/x')}&limit=50`)
    assert.equal(response.status, 200)
    const json = await response.json()
    const ids = (json.data?.rows || []).map((row) => row.traceId || row.id)
    assert.deepEqual(ids.filter((id) => ['trace-win', 'trace-default', 'trace-other'].includes(id)).sort(), ['trace-win'])
  } finally {
    await server.stop()
  }
})

test('HTTP biz and event routes reject a workspace that is not absolute', { timeout: 45_000 }, async () => {
  const server = await startWorkspaceServer('invalid')
  try {
    const problems = []
    for (const workspace of badWorkspaces) {
      const recent = await fetch(`${server.base}/api/v1/events/recent?workspace=${encodeURIComponent(workspace)}&limit=50`, {
        headers: { Origin: origin },
      })
      if (recent.status !== 400) problems.push(`recent ${JSON.stringify(workspace)} status ${recent.status}`)
      const stream = await sseBody(server.port, workspace, server.seededMine)
      if (stream.status !== 400) problems.push(`sse ${JSON.stringify(workspace)} status ${stream.status}`)
      if (stream.body.includes(server.seededOther)) problems.push(`sse ${JSON.stringify(workspace)} leaked another workspace`)
      const traces = await fetch(`${server.base}/api/v1/biz/traces?workspace=${encodeURIComponent(workspace)}&limit=50`)
      if (traces.status !== 400) problems.push(`traces ${JSON.stringify(workspace)} status ${traces.status}`)
    }
    assert.deepEqual(problems, [])
  } finally {
    await server.stop()
  }
})

test('HTTP biz and event routes keep the no-workspace default', { timeout: 30_000 }, async () => {
  const server = await startWorkspaceServer('absent')
  try {
    const recent = await fetch(`${server.base}/api/v1/events/recent?limit=50`, { headers: { Origin: origin } })
    assert.equal(recent.status, 200)
    const recentIds = (await recent.json()).items.map((item) => item.id)
    assert.equal(recentIds.includes(server.seededMine), true)
    assert.equal(recentIds.includes(server.seededOther), true)

    const stream = await sseBody(server.port)
    assert.equal(stream.status, 200)
    assert.equal(stream.body.includes(server.seededMine), true)
    assert.equal(stream.body.includes(server.seededOther), true)

    const traces = await fetch(`${server.base}/api/v1/biz/traces?limit=50`)
    assert.equal(traces.status, 200)
    const ids = ((await traces.json()).data?.rows || []).map((row) => row.traceId || row.id)
    assert.equal(ids.includes('trace-default'), true)
    assert.equal(ids.includes('trace-win'), false)
    assert.equal(ids.includes('trace-other'), false)
  } finally {
    await server.stop()
  }
})
