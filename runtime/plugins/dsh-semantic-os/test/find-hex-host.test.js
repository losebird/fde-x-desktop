import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { handleProduct } from '../product.js'

function mockReq(body) {
  const buf = Buffer.from(JSON.stringify(body))
  const req = new EventEmitter()
  req.method = 'POST'
  req.headers = { 'content-type': 'application/json' }
  req.destroy = () => {}
  setImmediate(() => {
    req.emit('data', buf)
    req.emit('end')
  })
  return req
}

function mockRes() {
  const out = {}
  return {
    out,
    writeHead(status, headers) {
      out.status = status
      out.headers = headers
    },
    end(buf) {
      out.body = JSON.parse(Buffer.from(buf).toString())
    },
  }
}

test('POST /find on an 8-hex tail does not search and returns empty excerpts', async () => {
  let searched = false
  const sidecar = {
    snapshot: () => ({ ready: true, port: 1 }),
  }
  const res = mockRes()
  await handleProduct(
    mockReq({ query: '90b52feb', cwd: '/ws/os' }),
    res,
    new URL('http://127.0.0.1/semantic-os/find'),
    {
      sidecar,
      ingest: { snapshot() { searched = true } },
    },
  )
  assert.equal(res.out.status, 200)
  assert.equal(res.out.body.excerptStatus, 'empty')
  assert.equal(res.out.body.excerpts.length, 0)
  assert.equal(res.out.body.items.length, 0)
  assert.equal(res.out.body.excerptEmptyReason, '这一场没有摘录')
  assert.equal(searched, false)
})
