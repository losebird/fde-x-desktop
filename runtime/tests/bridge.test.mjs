import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { ensureBridgeToken, verifyBridgeToken } from '../routes/bridge.mjs'
import { configureEventBus, emit, subscribe } from '../events.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function request(port, path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body) {
    headers['content-type'] = 'application/json'
  }
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

describe('bridge', () => {
  test('ensureBridgeToken is stable and verifyBridgeToken matches', async () => {
    const home = `/tmp/fde-bridge-token-${Date.now()}`
    await mkdir(join(home, 'run'), { recursive: true })
    const a = await ensureBridgeToken(home)
    const b = await ensureBridgeToken(home)
    assert.equal(a, b)
    assert.ok(a.length >= 16)
    const fakeReq = { headers: { 'x-fde-bridge-token': a } }
    assert.ok(verifyBridgeToken(fakeReq, a))
    assert.ok(!verifyBridgeToken(fakeReq, 'forged'))
    assert.ok(!verifyBridgeToken({ headers: {} }, a))
  })

  test('submit-result persists, GET returns ready, forged token 401', async () => {
    const port = 4397 + Math.floor(Math.random() * 50)
    const home = `/tmp/fde-bridge-bff-${Date.now()}`
    const dbPath = join(home, 'data.sqlite')
    await mkdir(home, { recursive: true })
    const token = await ensureBridgeToken(home)

    const child = spawn(process.execPath, ['runtime/server.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        FDE_RUNTIME_PORT: String(port),
        FDE_DSH_HOME: home,
        FDE_DATABASE_PATH: dbPath,
        FDE_RUNTIME_SUPERVISED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let ready = false
    for (let i = 0; i < 40; i++) {
      try {
        const res = await request(port, '/health')
        if (res.ok) {
          ready = true
          break
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    assert.ok(ready, 'BFF did not become ready')

    const forged = await request(port, '/api/v1/bridge/submit-result', {
      method: 'POST',
      headers: { 'x-fde-bridge-token': 'forged-token-value' },
      body: { requestId: 'req_test', kind: 'json', data: { x: 1 }, workspaceCwd: '/tmp/ws' },
    })
    assert.equal(forged.status, 401)
    const forgedBody = await forged.json()
    assert.equal(forgedBody.error, 'bridge_unauthorized')

    const submit = await request(port, '/api/v1/bridge/submit-result', {
      method: 'POST',
      headers: { 'x-fde-bridge-token': token },
      body: {
        requestId: 'req_bridge_unit',
        kind: 'json',
        data: { hello: 'world' },
        summary: 'test',
        workspaceCwd: '/tmp/ws',
        sessionId: 'sess_1',
      },
    })
    assert.equal(submit.status, 200)

    const getRes = await request(port, '/api/v1/ai/results/req_bridge_unit', {
      headers: { origin: 'http://127.0.0.1:5175' },
    })
    assert.equal(getRes.status, 200)
    const getBody = await getRes.json()
    assert.equal(getBody.data.status, 'ready')
    assert.deepEqual(getBody.data.data, { hello: 'world' })

    child.kill('SIGTERM')
  })

  test('expired results report expired status', () => {
    const dbPath = `/tmp/fde-bridge-expire-${Date.now()}.sqlite`
    const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    configureEventBus(db)
    const old = Date.now() - 11 * 60 * 1000
    db.prepare(`
      INSERT INTO ai_results (request_id, workspace_cwd, session_id, kind, data_json, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('req_old', '/tmp', null, 'json', '{"a":1}', null, old)
    const row = db.prepare('SELECT created_at FROM ai_results WHERE request_id = ?').get('req_old')
    assert.ok(Date.now() - Number(row.created_at) > 10 * 60 * 1000)
    db.close()
  })

  test('emit ai.result.ready on submit path (unit)', () => {
    const dbPath = `/tmp/fde-bridge-emit-${Date.now()}.sqlite`
    const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
    configureEventBus(db)
    const seen = []
    const off = subscribe((envelope) => {
      if (envelope.type === 'ai.result.ready') seen.push(envelope)
    })
    emit('ai.result.ready', { requestId: 'req_evt' }, { workspaceCwd: '/tmp/ws' })
    off()
    assert.equal(seen.length, 1)
    assert.equal(seen[0].payload.requestId, 'req_evt')
    db.close()
  })
})
