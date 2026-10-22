import './support/no-stray-processes.mjs'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalHandler } from '../plugins/dsh-lan-assist/http.js'
import { createView } from '../plugins/dsh-lan-assist/view.js'

const pluginDir = fileURLToPath(new URL('../plugins/dsh-lan-assist/', import.meta.url))

function rejectsNoNatsIdle(status, sent) {
  const idle = !status || status.state === 'idle' || status.state == null
  if (sent && sent.error === 'NO_NATS' && idle && !status.error) return true
  return false
}

test('NO_NATS alone does not pass', () => {
  assert.equal(rejectsNoNatsIdle({ state: 'idle' }, { ok: false, error: 'NO_NATS' }), true)
  assert.equal(rejectsNoNatsIdle({ state: 'error', error: 'NATS_DEPENDENCY_MISSING' }, { ok: false, error: 'NATS_DEPENDENCY_MISSING' }), false)
})

test('missing nats module sets status error and does not return NO_NATS', async () => {
  const dest = await mkdtemp(join(tmpdir(), 'dla-nonats-'))
  await cp(pluginDir, dest, {
    recursive: true,
    filter: (src) => !src.split('/').includes('node_modules') && !src.split('/').includes('test'),
  })
  const relayImport = './' + 'nats-relay.js'
  const script = `
    import { createNatsTransport } from '${relayImport}'
    const transport = createNatsTransport({ lazy: true, url: 'nats://127.0.0.1:1' })
    const sent = await transport.send('door', { type: 'letter', to: 'pk_peer', from: 'pk_self' })
    const status = transport.status()
    process.stdout.write(JSON.stringify({ sent, status }))
  `
  await writeFile(join(dest, 'run-missing-nats.mjs'), script)
  try {
    const ran = spawnSync(process.execPath, ['run-missing-nats.mjs'], {
      cwd: dest,
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, DSH_LAN_ASSIST_NATS: 'nats://127.0.0.1:1', NODE_PATH: '' },
    })
    assert.equal(ran.status, 0, ran.stderr)
    const got = JSON.parse(ran.stdout)
    assert.equal(got.status.error, 'NATS_DEPENDENCY_MISSING')
    assert.equal(got.sent.error, 'NATS_DEPENDENCY_MISSING')
    assert.equal(rejectsNoNatsIdle({ state: 'idle' }, got.sent), false)
  } finally {
    await rm(dest, { recursive: true, force: true })
  }
})

test('GET /lan-assist/state returns relay.error', async () => {
  const view = createView({
    store: {
      get: async () => ({ self: { id: 'me', keySeed: 'k' }, peers: {}, requests: {}, ledger: [] }),
      update: async (fn) => fn({}),
    },
    now: () => 0,
    port: 0,
    opts: {
      relayStatus: () => ({ configured: true, connected: false, error: 'NATS_DEPENDENCY_MISSING' }),
    },
    spillOnce: async () => {},
    ensureSelf: (state) => state,
    loadLookupToken: async () => {},
    loadConnToken: async () => {},
    publicLookups: () => [],
    publicLookup: () => ({}),
    lookupReady: () => false,
  })
  const handler = createLocalHandler({
    secretary: view,
    lan: { doors: () => [] },
    sse: { add() {}, remove() {} },
  })
  const server = createServer((req, res) => { handler(req, res) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/lan-assist/state`)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.relay.error, 'NATS_DEPENDENCY_MISSING')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
