import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { requestSidecar } from '../sidecar-client.js'

async function withServer(handler, fn) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const sidecar = {
    snapshot: () => ({ ready: true, port: server.address().port }),
    getApiKey: () => 'secret',
  }
  try { await fn(sidecar) } finally { server.close() }
}

test('sidecar client returns structured timeout', async () => {
  await withServer(() => undefined, async (sidecar) => {
    const result = await requestSidecar(sidecar, { path: '/hang', timeoutMs: 20 })
    assert.equal(result.error, 'SIDECAR_TIMEOUT')
  })
})

test('sidecar client aborts active requests', async () => {
  await withServer(() => undefined, async (sidecar) => {
    const controller = new AbortController()
    const pending = requestSidecar(sidecar, { path: '/hang', signal: controller.signal, timeoutMs: 1000 })
    controller.abort()
    const result = await pending
    assert.equal(result.error, 'ABORTED')
  })
})

test('sidecar client enforces response size', async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: 'x'.repeat(2000) }))
  }, async (sidecar) => {
    const result = await requestSidecar(sidecar, { path: '/large', maxBytes: 100 })
    assert.equal(result.error, 'SIDECAR_RESPONSE_TOO_LARGE')
  })
})

test('sidecar client sends token and cwd', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ token: req.headers['x-api-key'], cwd: req.headers['x-dsh-cwd'] }))
  }, async (sidecar) => {
    const result = await requestSidecar(sidecar, { path: '/ok', cwd: '/workspace' })
    assert.deepEqual(result, { token: 'secret', cwd: '/workspace' })
  })
})

test('sidecar client omits non-latin1 cwd instead of throwing', async () => {
  await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ cwd: req.headers['x-dsh-cwd'] || null }))
  }, async (sidecar) => {
    const result = await requestSidecar(sidecar, { path: '/ok', cwd: '/tmp/中文工作区' })
    assert.equal(result.error, undefined)
    assert.equal(result.cwd, null)
  })
})
