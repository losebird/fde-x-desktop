import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLanServer, postFrame } from '../lan.js'
import { createLanFirstTransport, createLanTransport } from '../transport.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'

function memStore() {
  let state = emptyState()
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
}

test('two LAN mouths pair and deliver one envelope', async () => {
  const portA = 19001
  const portB = 19002
  const box = { A: null, B: null }
  const lanA = createLanServer({
    port: portA,
    host: '127.0.0.1',
    onFrame: async (frame) => {
      if (frame.type === 'hello') return box.A.acceptHello(frame, `127.0.0.1:${portB}`)
      const peer = await box.A.peerFor(frame.from)
      if (!peer) return { ok: false, error: 'KEY_REJECT' }
      if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, peer)
      return { ok: false, error: 'UNKNOWN' }
    },
  })
  const lanB = createLanServer({
    port: portB,
    host: '127.0.0.1',
    onFrame: async (frame) => {
      if (frame.type === 'hello') return box.B.acceptHello(frame, `127.0.0.1:${portA}`)
      const peer = await box.B.peerFor(frame.from)
      if (!peer) return { ok: false, error: 'KEY_REJECT' }
      if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, peer)
      return { ok: false, error: 'UNKNOWN' }
    },
  })
  box.A = createSecretary({
    store: memStore(),
    port: portA,
    send: (door, frame) => postFrame(door, frame),
  })
  box.B = createSecretary({
    store: memStore(),
    port: portB,
    send: (door, frame) => postFrame(door, frame),
  })
  await lanA.start()
  await lanB.start()
  try {
    await box.A.setDisplayName('Ace')
    await box.B.setDisplayName('林督')
    await box.A.mintPairCode()
    await box.B.mintPairCode()
    const bCode = (await box.B.snapshot()).pairCode.code
    const hs = await box.A.handshake({ peerCode: bCode, door: `127.0.0.1:${portB}` })
    assert.equal(hs.ok, true)
    const done = await afterHandshake(box.A, box.B, hs)
    const composed = await box.A.compose({
      excerpt: '先切 10%',
      to: [done.peers[0].id],
      sessionId: 'sess-gray',
    })
    await box.A.confirmSend(composed.requestId)
    const incoming = (await box.B.snapshot()).requests
    assert.equal(incoming.length, 1)
    assert.equal(incoming[0].excerpt, '先切 10%')
  } finally {
    await lanA.stop()
    await lanB.stop()
  }
})

test('LAN frame has no browser CORS headers', async () => {
  const lan = createLanServer({
    port: 19003,
    host: '127.0.0.1',
    onFrame: async () => ({ ok: true }),
  })
  await lan.start()
  try {
    const res = await fetch('http://127.0.0.1:19003/who')
    assert.equal(res.headers.get('access-control-allow-origin'), null)
    const pre = await fetch('http://127.0.0.1:19003/frame', { method: 'OPTIONS' })
    assert.equal(pre.status, 204)
    assert.equal(pre.headers.get('access-control-allow-origin'), null)
  } finally {
    await lan.stop()
  }
})

test('LanTransport send is the LAN postFrame seam', async () => {
  const seen = []
  const transport = createLanTransport({
    send: async (door, frame, opts) => {
      seen.push({ door, type: frame && frame.type, timeoutMs: opts && opts.timeoutMs })
      return { ok: true, via: 'lan' }
    },
  })
  assert.equal(transport.name, 'lan')
  const got = await transport.send('127.0.0.1:9527', { type: 'hello' }, { timeoutMs: 8000 })
  assert.equal(got.ok, true)
  assert.deepEqual(seen, [{ door: '127.0.0.1:9527', type: 'hello', timeoutMs: 8000 }])
  const live = createLanTransport()
  const missed = await live.send('not-a-door', { type: 'hello' })
  assert.equal(missed.ok, false)
  assert.equal(missed.error, 'BAD_DOOR')
})

test('lan-first does not dual-send; relay only after LAN fail', async () => {
  const hits = []
  const lan = createLanTransport({
    send: async () => {
      hits.push('lan')
      return { ok: false, error: 'UNREACHABLE' }
    },
  })
  const relay = {
    async send() {
      hits.push('relay')
      return { ok: true }
    },
  }
  const transport = createLanFirstTransport({ lan, relay })
  const got = await transport.send('10.0.0.2:9527', { type: 'envelope' }, { timeoutMs: 2000 })
  assert.equal(got.ok, true)
  assert.equal(got.via, 'relay')
  assert.deepEqual(hits, ['lan', 'relay'])
  const direct = createLanFirstTransport({
    lan: createLanTransport({ send: async () => ({ ok: true }) }),
    relay: { async send() { hits.push('nope'); return { ok: true } } },
  })
  const ok = await direct.send('10.0.0.2:9527', { type: 'envelope' })
  assert.equal(ok.via, 'lan')
  assert.ok(!hits.includes('nope'))
})
