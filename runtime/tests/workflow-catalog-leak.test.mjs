import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')
const USER_SESSION = 'sess_user'
const PRESETS = [
  { id: 'standard', name: '标准' },
  { id: 'writer', name: '写作' },
  { id: 'coder', name: '编码' },
]

function insertWorkspace(db) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', ?, ?, ?)
  `).run('ws_catalog', 'ws_catalog', JSON.stringify({ cwd: '/tmp/fde-x-catalog' }), now, now)
}

function sidebarTitle(row) {
  const values = row.projections && row.projections.values
  const title = values && typeof values.title === 'string' ? values.title.trim() : ''
  return title || '未命名会话'
}

function visibleSidebar(sessions, archived) {
  return sessions
    .filter((row) => !archived.has(row.sessionId))
    .map((row) => ({ sessionId: row.sessionId, title: sidebarTitle(row), blank: row.blank === true }))
}

function catalogRuntime() {
  const sessions = [{
    sessionId: USER_SESSION,
    blank: false,
    projections: { values: { title: '已有的会话', agentPreset: 'standard' } },
  }]
  const archived = new Set()
  let seq = 0
  const aiRuntime = {
    origin: 'http://catalog.test',
    cookie: 'sid=1',
    async call(endpoint, args) {
      if (endpoint === 'session/create') {
        const sessionId = `probe_${++seq}`
        sessions.push({
          sessionId,
          blank: true,
          projections: { values: { agentPreset: args && args.request && args.request.agentPreset } },
        })
        return { sessionId }
      }
      if (endpoint === 'workspace/archiveSession') {
        const sessionId = args && args.request && args.request.sessionId
        if (sessionId) archived.add(sessionId)
        return {}
      }
      throw new Error(`unexpected ${endpoint}`)
    },
  }
  const fetchImpl = async (input) => {
    const url = new URL(String(input))
    const sessionId = url.searchParams.get('sessionId') || ''
    const gone = sessionId && (archived.has(sessionId) || !sessions.some((row) => row.sessionId === sessionId))
    if (url.pathname === '/fde-session/preset-inventory') {
      return Response.json({ ok: true, presets: PRESETS })
    }
    if (url.pathname === '/fde-session/tool-catalog') {
      if (gone) return Response.json({ ok: false }, { status: 404 })
      return Response.json({
        ok: true,
        tools: [
          { name: 'read', readOnly: true, grantable: true },
          { name: 'bash', readOnly: false, grantable: true },
        ],
      })
    }
    if (url.pathname === '/fde-session/preset-snapshot') {
      if (gone) return Response.json({ ok: false }, { status: 404 })
      return Response.json({
        ok: true,
        tools: [{ name: 'read', readOnly: true }],
        persona: { text: '人设', complete: true },
      })
    }
    return Response.json({ ok: false }, { status: 404 })
  }
  return { aiRuntime, sessions, archived, fetchImpl }
}

async function getTools(db, aiRuntime) {
  let status = 0
  let raw = ''
  const response = {
    writeHead(code) { status = code },
    end(body) { raw = body || '' },
  }
  const url = new URL('/api/v1/plan/workflow-tools?workspaceId=ws_catalog', 'http://127.0.0.1')
  await handlePlanRequest({ method: 'GET', headers: {} }, response, url, {
    db,
    enqueueEvent() {},
    readJson: async () => ({}),
    aiRuntime,
  }, 'corr_catalog')
  return { status, body: raw ? JSON.parse(raw) : null }
}

test('工作流工具清单不把未命名会话留在进行中列表', async () => {
  const previous = globalThis.fetch
  const dbPath = join(tmpdir(), `fde-x-catalog-leak-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  const { aiRuntime, sessions, archived, fetchImpl } = catalogRuntime()
  globalThis.fetch = fetchImpl
  try {
    insertWorkspace(db)
    const before = visibleSidebar(sessions, archived)
    const first = await getTools(db, aiRuntime)
    const mid = visibleSidebar(sessions, archived)
    const second = await getTools(db, aiRuntime)
    const after = visibleSidebar(sessions, archived)

    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.equal(second.status, 200, JSON.stringify(second.body))
    for (const body of [first.body, second.body]) {
      assert.deepEqual(body.data.presets.map((row) => row.id), ['coder', 'standard', 'writer'])
      assert.deepEqual(body.data.tools.map((row) => row.name), ['bash', 'read'])
    }
    assert.deepEqual(before, [{ sessionId: USER_SESSION, title: '已有的会话', blank: false }])
    assert.deepEqual(mid, before)
    assert.deepEqual(after, before)
    assert.equal(archived.has(USER_SESSION), false)
  } finally {
    globalThis.fetch = previous
    db.close()
    await rm(dbPath, { force: true })
  }
})
