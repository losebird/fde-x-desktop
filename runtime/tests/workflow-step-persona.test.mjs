import assert from 'node:assert/strict'
import http from 'node:http'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { openDatabase } from '../db.mjs'
import { handlePlanRequest } from '../routes/plan.mjs'

const migrations = join(import.meta.dirname, '..', 'migrations')

function insertWorkspace(db, id) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, ?, '', 'active', '{}', ?, ?)
  `).run(id, id, now, now)
}

function serve(db) {
  return http.createServer(async (request, response) => {
    const raw = []
    for await (const chunk of request) raw.push(chunk)
    const parsed = raw.length ? JSON.parse(Buffer.concat(raw).toString('utf8')) : {}
    const url = new URL(request.url, 'http://127.0.0.1')
    const handled = await handlePlanRequest(request, response, url, {
      db,
      enqueueEvent() {},
      readJson: async () => parsed,
      aiRuntime: null,
    }, 'corr_persona')
    if (!handled && !response.headersSent) {
      response.writeHead(404)
      response.end()
    }
  })
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

test('保存工作流时丢掉没人读的 config.persona', async () => {
  const dbPath = join(tmpdir(), `fde-x-step-persona-${process.pid}.sqlite`)
  const db = openDatabase(dbPath, migrations)
  insertWorkspace(db, 'ws_persona')
  const server = serve(db)
  const port = await listen(server)
  try {
    const created = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows`, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws_persona',
        name: '人设尾巴',
        steps: [
          { id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', persona: { text: 'hack' } } },
          { id: 's2', kind: 'ai', label: 'AI', config: { prompt: '继续' } },
        ],
      }),
    })
    const createdBody = await created.json()
    assert.equal(created.status, 201, JSON.stringify(createdBody))
    const createdStep = createdBody.data.steps[0]
    assert.equal(createdStep.config.prompt, '跑')
    assert.equal(Object.hasOwn(createdStep.config, 'persona'), false)
    assert.equal(Object.hasOwn(createdBody.data.steps[1].config, 'persona'), false)
    const stored = db.prepare('SELECT definition_json FROM workflows WHERE id = ?').get(createdBody.data.id)
    const definition = JSON.parse(stored.definition_json)
    assert.equal(Object.hasOwn(definition.steps[0].config, 'persona'), false)
    assert.equal(definition.steps[1].config.prompt, '继续')

    const patched = await fetch(`http://127.0.0.1:${port}/api/v1/plan/workflows/${createdBody.data.id}`, {
      method: 'PATCH',
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '改', persona: { text: 'still' } } }],
      }),
    })
    const patchedBody = await patched.json()
    assert.equal(patched.status, 200, JSON.stringify(patchedBody))
    assert.equal(patchedBody.data.steps[0].config.prompt, '改')
    assert.equal(Object.hasOwn(patchedBody.data.steps[0].config, 'persona'), false)
    const again = db.prepare('SELECT definition_json FROM workflows WHERE id = ?').get(createdBody.data.id)
    assert.equal(Object.hasOwn(JSON.parse(again.definition_json).steps[0].config, 'persona'), false)
  } finally {
    server.close()
    db.close()
    await rm(dbPath, { force: true })
  }
})
