import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import {
  configureEventBus,
  emit,
  envelopeFromRow,
  listEventsAfter,
  listRecentEvents,
  matchesWorkspaceFilter,
  subscribe,
} from '../events.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const origin = 'http://127.0.0.1:5173'

describe('event bus', { concurrency: 1 }, () => {
test('emit persists and subscribe receives', async () => {
  const dbPath = `/tmp/fde-events-unit-${Date.now()}.sqlite`
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  configureEventBus(db)
  const seen = []
  const off = subscribe((envelope) => {
    seen.push(envelope)
  })
  const id = emit('task.changed', { id: 't1', op: 'insert' }, {
    workspaceCwd: '/tmp/ws',
    source: 'bff',
  })
  off()
  assert.equal(seen.length, 1)
  assert.equal(seen[0].id, id)
  const row = db.prepare('SELECT * FROM outbox_events WHERE id = ?').get(id)
  assert.ok(row)
  assert.equal(row.event_type, 'task.changed')
  db.close()
})

test('since replay order and workspace filter', () => {
  const dbPath = `/tmp/fde-events-replay-${Date.now()}.sqlite`
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  configureEventBus(db)
  const a = emit('im.unread.changed', { total: 1, byPeer: {} }, { workspaceCwd: '/a' })
  const b = emit('im.unread.changed', { total: 2, byPeer: {} }, { workspaceCwd: '/b' })
  const c = emit('im.unread.changed', { total: 3, byPeer: {} }, { workspaceCwd: '/a' })
  const afterA = listEventsAfter(db, { sinceId: a, workspaceCwd: '/a' })
  assert.deepEqual(afterA.map((item) => item.id), [c])
  const allAfterA = listEventsAfter(db, { sinceId: a })
  assert.deepEqual(new Set(allAfterA.map((item) => item.id)), new Set([b, c]))
  assert.ok(matchesWorkspaceFilter(envelopeFromRow(db.prepare('SELECT * FROM outbox_events WHERE id = ?').get(b)), '/b'))
  assert.ok(!matchesWorkspaceFilter(envelopeFromRow(db.prepare('SELECT * FROM outbox_events WHERE id = ?').get(b)), '/a'))
  assert.equal(b, listRecentEvents(db, { type: 'im.unread.changed', limit: 10 }).find((item) => item.id === b)?.id)
  db.close()
})

test('SSE origin 403 and connection limit 429', { timeout: 45_000 }, async () => {
  const port = 4480 + (process.pid % 80)
  const dbPath = `/tmp/fde-events-http-${Date.now()}.sqlite`
  await mkdir('/tmp/fde-x-files-smoke', { recursive: true })
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
  const base = `http://127.0.0.1:${port}`
  const sockets = []
  let childStderr = ''
  child.stderr.on('data', (chunk) => { childStderr += chunk.toString() })
  try {
    let healthy = false
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const health = await fetch(`${base}/health`)
        if (health.ok) {
          healthy = true
          break
        }
      } catch {
        // wait
      }
      await delay(50)
    }
    if (!healthy) throw new Error(`runtime did not start: ${childStderr.slice(0, 400)}`)

    const forbidden = await fetch(`${base}/api/v1/events`, { headers: { Origin: 'http://evil.example' } })
    assert.equal(forbidden.status, 403)

    const openSse = () => new Promise((resolve, reject) => {
      const req = httpRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/events?workspace=/tmp/ws',
        headers: { Origin: origin },
      }, (res) => {
        resolve({ req, res })
      })
      req.on('error', reject)
      req.end()
    })

    for (let i = 0; i < 32; i += 1) {
      const conn = await openSse()
      assert.equal(conn.res.statusCode, 200)
      sockets.push(conn)
    }
    const overflowStatus = await new Promise((resolve, reject) => {
      const req = httpRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/events',
        headers: { Origin: origin },
      }, (res) => {
        res.resume()
        resolve(res.statusCode)
      })
      req.setTimeout(5000, () => {
        req.destroy()
        reject(new Error('overflow request timed out'))
      })
      req.on('error', reject)
      req.end()
    })
    assert.equal(overflowStatus, 429)
  } finally {
    child.kill('SIGTERM')
    for (const conn of sockets) {
      try {
        conn.req.destroy()
        conn.res.destroy()
      } catch {
        // ignore
      }
    }
    await delay(100)
  }
})
})
