import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { openDatabase } from '../db.mjs'
import { inDueSoonWindow, tickDueSoon, tickMcpHealth } from '../notify-watch.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

test('date-only due is in the 24h window the day before', () => {
  const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
  assert.equal(inDueSoonWindow('2026-11-03', now), true)
  assert.equal(inDueSoonWindow('2026-11-04', now), false)
  assert.equal(inDueSoonWindow('2026-11-01', now), false)
})

test('tickDueSoon fires once per task due stamp', async () => {
  const dbPath = join(tmpdir(), `fde-notify-due-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const nowIso = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws1', 'w', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd: '/tmp/ws1' }), nowIso, nowIso)
  const due = '2026-11-03'
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, due_at, created_at, updated_at)
    VALUES ('t1', 'ws1', '写周报', '', 'todo', 'med', ?, ?, ?)
  `).run(due, nowIso, nowIso)
  const events = []
  const clock = new Date(2026, 10, 2, 15, 0, 0)
  const first = tickDueSoon(db, { now: clock, emitFn: (type, payload, meta) => events.push({ type, payload, meta }) })
  const second = tickDueSoon(db, { now: clock, emitFn: (type, payload, meta) => events.push({ type, payload, meta }) })
  assert.deepEqual(first, ['t1'])
  assert.deepEqual(second, [])
  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'task.due.soon')
  assert.equal(events[0].payload.title, '写周报')
  db.close()
  await rm(dbPath, { force: true })
  await rm(`${dbPath}-wal`, { force: true }).catch(() => {})
  await rm(`${dbPath}-shm`, { force: true }).catch(() => {})
})

test('tickMcpHealth notifies only on falling edge', async () => {
  const state = new Map()
  const events = []
  const emitFn = (type, payload) => events.push({ type, payload })
  const down = async () => ({ ok: false, message: 'timeout' })
  const up = async () => ({ ok: true, message: 'MCP 可达' })
  const entries = [{ serverName: 'playwright', transport: 'stdio', command: 'npx' }]
  await tickMcpHealth({ listEntries: async () => entries, checkHealth: down, state, emitFn })
  assert.equal(events.length, 0)
  await tickMcpHealth({ listEntries: async () => entries, checkHealth: up, state, emitFn })
  await tickMcpHealth({ listEntries: async () => entries, checkHealth: down, state, emitFn })
  assert.equal(events.length, 1)
  assert.equal(events[0].payload.serverName, 'playwright')
  await tickMcpHealth({ listEntries: async () => entries, checkHealth: down, state, emitFn })
  assert.equal(events.length, 1)
})
