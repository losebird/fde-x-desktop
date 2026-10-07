import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { LIVE_PATH, LIVE_PROBE_MS, liveProbeBody, probeRuntimeLive, withProbeTimeout } from '../live-probe.mjs'

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

test('liveProbeBody is a local liveness payload', () => {
  assert.deepEqual(liveProbeBody(), { service: 'fde-x-runtime', live: true })
  assert.equal(LIVE_PATH, '/live')
  assert.equal(LIVE_PROBE_MS, 1000)
})

test('probeRuntimeLive returns true for an immediate 200', async () => {
  const { server, port } = await listen((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(liveProbeBody()))
  })
  try {
    const ok = await probeRuntimeLive(`http://127.0.0.1:${port}${LIVE_PATH}`)
    assert.equal(ok, true)
  } finally {
    server.close()
  }
})

test('probeRuntimeLive times out a hung listener instead of waiting the reload budget', async () => {
  const { server, port } = await listen(() => {
    /* never respond */
  })
  const started = Date.now()
  try {
    const ok = await probeRuntimeLive(`http://127.0.0.1:${port}${LIVE_PATH}`, undefined, 150)
    assert.equal(ok, false)
    assert.ok(Date.now() - started < 800)
  } finally {
    server.close()
  }
})

test('withProbeTimeout rejects a hung adapter call', async () => {
  const started = Date.now()
  await assert.rejects(
    withProbeTimeout(new Promise(() => { /* hang */ }), 80),
    /live-probe-timeout/,
  )
  assert.ok(Date.now() - started < 400)
})
