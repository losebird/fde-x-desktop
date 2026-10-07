import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHostRpcValue } from '../dsh-core.mjs'

test('parseHostRpcValue splices multipart byte attachments onto data', async () => {
  const rpcId = 'rpc-bytes-1'
  const payload = new Uint8Array([104, 105])
  const form = new FormData()
  form.set('metadata', JSON.stringify({
    type: 'server-response',
    rpcId,
    result: { ok: true, value: { data: null, eof: true, offset: 0 } },
    attachments: [{ codec: 'bytes', part: 'p0', path: ['data'] }],
  }))
  form.set('p0', new Blob([payload]))
  const response = new Response(form)
  const value = await parseHostRpcValue(response, rpcId, 'workspaceFiles/readBytes')
  assert.ok(value.data instanceof Uint8Array)
  assert.equal(Buffer.from(value.data).toString('utf8'), 'hi')
})
