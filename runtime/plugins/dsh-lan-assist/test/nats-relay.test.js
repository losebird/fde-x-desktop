import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLanFirstTransport, createLanTransport } from '../transport.js'
import { RELAY_INLINE_MAX } from '../home.js'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createNatsTransport, deliveryId, inboxSubject, inviteLive, mintRelayInvite, packRelayCredsPath, packRelayUrl, relayUrl, setRelayStore, takeNatsInboxLock } from '../nats-relay.js'

test('relay invite is relay+device+session, never the pairing code', () => {
  const miss = mintRelayInvite({ deviceId: 'pk_ace' })
  assert.equal(miss.ok, false)
  assert.equal(miss.error, 'NO_RELAY')
  const got = mintRelayInvite({ relay: 'wss://relay.example/nats', deviceId: 'pk_ace', now: 1 })
  assert.equal(got.ok, true)
  assert.equal(got.invite.relay, 'wss://relay.example/nats')
  assert.equal(got.invite.device, 'pk_ace')
  assert.equal(got.invite.session.length, 16)
  assert.equal(got.invite.code, undefined)
  assert.equal(Object.keys(got.invite).sort().join(','), 'device,expiresAt,relay,session')
  assert.equal(inviteLive(got.invite, 1), true)
  assert.equal(inviteLive({ ...got.invite, revoked: true }, 1), false)
  assert.equal(inviteLive(got.invite, got.invite.expiresAt), false)
})

test('NATS connect can take official creds bytes, not a homemade jwt', async () => {
  let conf
  const { writeFile, mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'dsh-creds-'))
  const file = join(dir, 'device.creds')
  await writeFile(file, '-----BEGIN NATS USER JWT-----\nuser\n')
  const live = createNatsTransport({
    url: 'nats://127.0.0.1:4222',
    creds: file,
    connect: async (_url, opts) => {
      conf = opts
      return { publish: async () => undefined }
    },
  })
  await live.send('10.0.0.2:9527', { type: 'envelope', to: 'pk_lin', requestId: 'r1' })
  assert.ok(Buffer.isBuffer(conf.creds) || conf.authenticator)
})

test('relay settings pack nats url and absolute creds path', () => {
  assert.equal(packRelayUrl('http://x').ok, false)
  assert.equal(packRelayUrl('nats://127.0.0.1:4222').url, 'nats://127.0.0.1:4222')
  assert.equal(packRelayCredsPath('relative.creds').ok, false)
  assert.equal(packRelayCredsPath('/tmp/device.creds').ok, true)
})

test('relay is off without DSH_LAN_ASSIST_NATS', () => {
  const prev = process.env.DSH_LAN_ASSIST_NATS
  delete process.env.DSH_LAN_ASSIST_NATS
  setRelayStore({ url: '', credsPath: '' })
  try {
    assert.equal(relayUrl(), '')
    assert.equal(createNatsTransport(), null)
    const lazy = createNatsTransport({ lazy: true })
    assert.equal(lazy.status().configured, false)
  } finally {
    if (prev == null) delete process.env.DSH_LAN_ASSIST_NATS
    else process.env.DSH_LAN_ASSIST_NATS = prev
  }
})

test('NATS send publishes letter frames, not pairing hello', async () => {
  const published = []
  const relay = createNatsTransport({
    connect: async () => ({
      publish: async (subject, body) => {
        published.push({ subject, body })
      },
      subscribe: async () => [],
    }),
  })
  const hello = await relay.send('10.0.0.2:9527', { type: 'hello', to: 'pk_lin' })
  assert.equal(hello.ok, false)
  assert.equal(hello.error, 'NO_RELAY_PAIR')
  const posted = await relay.send('10.0.0.2:9527', { type: 'envelope', to: 'pk_lin', requestId: 'req_1' })
  assert.equal(posted.ok, true)
  assert.equal(relay.status().configured, true)
  assert.equal(relay.status().connected, true)
  assert.equal(published[0].subject, inboxSubject('pk_lin'))
  assert.match(published[0].body, /req_1/)
})

test('JetStream miss falls back to core publish, no dual send', async () => {
  const hits = []
  const relay = createNatsTransport({
    connect: async () => ({
      jetstream: () => ({
        publish: async () => { throw new Error('no stream') },
      }),
      publish: async () => { hits.push('core') },
    }),
  })
  const posted = await relay.send('10.0.0.2:9527', { type: 'envelope', to: 'pk_lin', requestId: 'req_fb', nonce: 'n' })
  assert.equal(posted.ok, true)
  assert.deepEqual(hits, ['core'])
})

test('JetStream publish uses deliveryId as Nats-Msg-Id', async () => {
  const published = []
  const relay = createNatsTransport({
    connect: async () => ({
      jetstream: () => ({
        publish: async (subject, body, opts) => {
          published.push({ subject, body, msgID: opts && opts.msgID })
        },
      }),
    }),
  })
  const frame = { type: 'envelope', to: 'pk_lin', requestId: 'req_9', nonce: 'ab' }
  const posted = await relay.send('10.0.0.2:9527', frame)
  assert.equal(posted.ok, true)
  assert.equal(published[0].msgID, deliveryId(frame))
  assert.equal(published[0].msgID, 'req_9:pk_lin:ab')
})

test('oversize relay frames go to object store, not the inbox payload', async () => {
  const blobs = new Map()
  const published = []
  const dir = await mkdtemp(join(tmpdir(), 'dsh-quota-'))
  const relay = createNatsTransport({
    quotaFile: join(dir, 'q.json'),
    objects: () => ({
      put: async (name, body) => { blobs.set(name, body) },
      get: async (name) => blobs.get(name),
    }),
    connect: async () => ({
      jetstream: () => ({
        publish: async (subject, body) => { published.push(JSON.parse(body)) },
      }),
    }),
  })
  const frame = {
    type: 'envelope',
    to: 'pk_lin',
    requestId: 'req_big',
    nonce: 'n1',
    box: 'x'.repeat(RELAY_INLINE_MAX),
  }
  const posted = await relay.send('10.0.0.2:9527', frame)
  assert.equal(posted.ok, true)
  assert.equal(published[0].type, 'relay-object')
  assert.ok(blobs.size === 1)
  const huge = createNatsTransport({
    connect: async () => ({
      jetstream: () => ({ publish: async () => undefined }),
    }),
  })
  const refused = await huge.send('10.0.0.2:9527', frame)
  assert.equal(refused.ok, false)
  assert.equal(refused.error, 'TOO_BIG')
})

test('object store quota refuses a second oversize put', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-quota2-'))
  const blobs = new Map()
  const relay = createNatsTransport({
    quota: RELAY_INLINE_MAX + 200,
    quotaFile: join(dir, 'q.json'),
    objects: () => ({
      put: async (name, body) => { blobs.set(name, body) },
      get: async (name) => blobs.get(name),
    }),
    connect: async () => ({
      jetstream: () => ({ publish: async () => undefined }),
    }),
  })
  const frame = {
    type: 'envelope',
    from: 'pk_ace',
    to: 'pk_lin',
    requestId: 'req_q',
    nonce: 'n1',
    box: 'x'.repeat(RELAY_INLINE_MAX),
  }
  assert.equal((await relay.send('d', frame)).ok, true)
  const again = await relay.send('d', { ...frame, requestId: 'req_q2', nonce: 'n2' })
  assert.equal(again.ok, false)
  assert.equal(again.error, 'QUOTA')
})

test('nats inbox lock is exclusive per assist home', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-lock-'))
  const a = await takeNatsInboxLock(dir)
  assert.equal(typeof a, 'function')
  const b = await takeNatsInboxLock(dir)
  assert.equal(b, null)
  await a()
  const c = await takeNatsInboxLock(dir)
  assert.equal(typeof c, 'function')
  await c()
})

test('lan-first uses NATS only after LAN fail, no dual send', async () => {
  const hits = []
  const lan = createLanTransport({
    send: async () => {
      hits.push('lan')
      return { ok: false, error: 'UNREACHABLE' }
    },
  })
  const relay = createNatsTransport({
    connect: async () => ({
      publish: async () => { hits.push('nats') },
      subscribe: async () => [],
    }),
  })
  const transport = createLanFirstTransport({ lan, relay })
  const got = await transport.send('10.0.0.9:9527', { type: 'envelope', to: 'pk_lin' }, { timeoutMs: 2000 })
  assert.equal(got.ok, true)
  assert.equal(got.via, 'relay')
  assert.deepEqual(hits, ['lan', 'nats'])
})
