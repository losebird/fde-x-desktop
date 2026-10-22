import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createIngest } from '../ingest.js'

async function waitFor(check, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('condition timed out')
}

test('canceling ingest aborts the active sidecar request', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsos-ingest-cancel-'))
  let completedRequests = 0
  const server = createServer((req) => {
    req.on('end', () => { completedRequests += 1 })
    req.resume()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const sidecar = {
    snapshot: () => ({ ready: true, port: server.address().port }),
    getApiKey: () => 'test',
  }
  const ingest = createIngest({ sidecar, getEyes: () => null, getExtract: () => null })
  try {
    ingest.start(cwd, 'session-1')
    await waitFor(() => ingest.snapshot(cwd).state === 'running')
    const cancelling = ingest.cancel(cwd)
    assert.equal(cancelling.state, 'canceling')
    await waitFor(() => ingest.snapshot(cwd).state === 'cancelled')
    await new Promise((resolve) => setTimeout(resolve, 25))
    assert.equal(completedRequests, 0)
  } finally {
    server.close()
    await rm(cwd, { recursive: true, force: true })
  }
})
