import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, createId } from '../db.mjs'
import { handleCorpusRoute } from '../routes/corpus.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dbPath = '/tmp/fde-x-corpus-test.sqlite'

async function withServer(handler) {
  const server = createServer((req, res) => {
    void handler(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

test('task prefix resolves from sqlite', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const taskId = createId('task')
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO tasks (id, workspace_id, title, notes, status, priority, created_at, updated_at)
    VALUES (?, 'ws_personal', '写完规格', '备注', 'done', 'med', ?, ?)
  `).run(taskId, now, now)
  const aiRuntime = { lanAssist: async () => ({}) }
  const { base, close } = await withServer(async (request, response) => {
    const url = new URL(request.url, base)
    const handled = await handleCorpusRoute(request, response, url, {
      db,
      aiRuntime,
      correlationId: 'corr',
    })
    if (!handled) {
      response.writeHead(404)
      response.end()
    }
  })
  const res = await fetch(`${base}/api/v1/corpus/task:${taskId}`)
  const body = await res.json()
  await close()
  assert.equal(body.ok, true)
  assert.equal(body.title, '写完规格')
  assert.match(body.text, /备注/)
  assert.equal(body.href.panel, 'plan')
})

test('unknown id returns 404', async () => {
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = { lanAssist: async () => ({}) }
  const { base, close } = await withServer(async (request, response) => {
    const url = new URL(request.url, base)
    await handleCorpusRoute(request, response, url, { db, aiRuntime, correlationId: 'corr' })
  })
  const res = await fetch(`${base}/api/v1/corpus/unknown:foo`)
  const body = await res.json()
  await close()
  assert.equal(res.status, 404)
  assert.equal(body.ok, false)
})

test('biz corpus returns noted original speech, never JSON dump', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const { insertBizWriteAudit } = await import('../db.mjs')
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws-corpus',
    traceId: 'trace_origin_speech',
    kind: '项目任务',
    action: '改行',
    recordNo: 'row_pk_9',
    sessionId: '',
    source: 'ai',
    changes: [{ field: 'status', from: 'a', to: 'b' }],
    lookupBind: { speech: '把那一行状态改回去' },
  })
  const aiRuntime = {
    lanAssist: async () => ({ ok: true, row: { id: 'trace_origin_speech', kind: 'receipt', summary: JSON.stringify({ ok: true }) } }),
  }
  const { base, close } = await withServer(async (request, response) => {
    const url = new URL(request.url, base)
    await handleCorpusRoute(request, response, url, { db, aiRuntime, correlationId: 'corr' })
  })
  const res = await fetch(`${base}/api/v1/corpus/${encodeURIComponent('biz:trace_origin_speech')}`)
  const body = await res.json()
  await close()
  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.title, '当时原文')
  assert.equal(body.text, '把那一行状态改回去')
  assert.equal(body.text.includes('{'), false)
})

test('biz corpus explains when there is no session or noted speech', async () => {
  await rm('/tmp/fde-x-corpus-empty.sqlite', { force: true }).catch(() => undefined)
  const emptyDb = '/tmp/fde-x-corpus-empty.sqlite'
  const db = openDatabase(emptyDb, join(repoRoot, 'runtime/migrations'))
  const { insertBizWriteAudit } = await import('../db.mjs')
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws-corpus',
    traceId: 'trace_no_origin',
    kind: '项目任务',
    action: '改行',
    recordNo: 'row_pk_8',
    sessionId: '',
    source: 'workstation',
    changes: [{ field: 'status', from: 'a', to: 'b' }],
    lookupBind: {},
  })
  const aiRuntime = { lanAssist: async () => ({ ok: false, error: 'NO_CWD' }) }
  const { base, close } = await withServer(async (request, response) => {
    const url = new URL(request.url, base)
    await handleCorpusRoute(request, response, url, { db, aiRuntime, correlationId: 'corr' })
  })
  const res = await fetch(`${base}/api/v1/corpus/${encodeURIComponent('biz:trace_no_origin')}`)
  const body = await res.json()
  await close()
  assert.equal(res.status, 200)
  assert.equal(body.ok, false)
  assert.match(String(body.message || ''), /工作台写入/)
  assert.equal(String(body.text || '').startsWith('{'), false)
})

test('biz corpus reads session user turns and skips JSON dumps', async () => {
  const { mkdir, writeFile, rm } = await import('node:fs/promises')
  const sessionRoot = '/tmp/fde-x-corpus-sessions'
  await rm(sessionRoot, { recursive: true, force: true }).catch(() => undefined)
  const sid = 'session-origin-text'
  await mkdir(join(sessionRoot, 'ws', sid), { recursive: true })
  await writeFile(join(sessionRoot, 'ws', sid, 'session.v3.jsonl'), [
    JSON.stringify({ type: 'session/header', data: { id: sid } }),
    JSON.stringify({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '停用客户还有哪些没关的工单？' }] } }),
    JSON.stringify({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '{"ok":false,"corpus_unavailable":true}' }] } }),
    '',
  ].join('\n'), 'utf8')
  const prev = process.env.FDE_DSH_SESSION_ROOT
  process.env.FDE_DSH_SESSION_ROOT = sessionRoot
  await rm('/tmp/fde-x-corpus-session.sqlite', { force: true }).catch(() => undefined)
  const db = openDatabase('/tmp/fde-x-corpus-session.sqlite', join(repoRoot, 'runtime/migrations'))
  const { insertBizWriteAudit } = await import('../db.mjs')
  insertBizWriteAudit(db, {
    workspaceCwd: '/tmp/ws-corpus',
    traceId: 'trace_session_origin',
    kind: '项目任务',
    action: '改行',
    recordNo: 'row_pk_7',
    sessionId: sid,
    source: 'ai',
    changes: [{ field: 'status', from: 'a', to: 'b' }],
    lookupBind: {},
  })
  const aiRuntime = { lanAssist: async () => ({ ok: true, row: { id: 'trace_session_origin', sessionId: sid } }) }
  const { base, close } = await withServer(async (request, response) => {
    const url = new URL(request.url, base)
    await handleCorpusRoute(request, response, url, { db, aiRuntime, correlationId: 'corr' })
  })
  try {
    const res = await fetch(`${base}/api/v1/corpus/${encodeURIComponent('biz:trace_session_origin')}`)
    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.title, '当时原文')
    assert.match(String(body.text || ''), /停用客户还有哪些没关的工单/)
    assert.equal(String(body.text || '').includes('corpus_unavailable'), false)
  } finally {
    await close()
    if (prev === undefined) delete process.env.FDE_DSH_SESSION_ROOT
    else process.env.FDE_DSH_SESSION_ROOT = prev
  }
})

