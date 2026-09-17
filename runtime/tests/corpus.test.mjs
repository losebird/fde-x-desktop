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
