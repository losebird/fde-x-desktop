import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conversationOf, letterIds, messageIdOf, parseMessageId, requestIdOf } from '../conversation.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'

function memStore() {
  let state = emptyState()
  return {
    async get() { return state },
    async update(fn) { await fn(state); return state },
  }
}

test('thread public rows carry message ids without a second store', async () => {
  const { requestPublic } = await import('../view.js')
  const row = requestPublic({
    id: 'req_1',
    kind: 'outgoing',
    excerpt: '先切',
    createdAt: 1,
    versions: [{ n: 1, from: 'me', body: '先切', at: 1 }],
    replies: [],
    attachments: [],
  })
  assert.equal(row.messages[0].id, 'req_1:v1')
})

test('threadOf packs conversations from the letter store', async () => {
  const { createView } = await import('../view.js')
  const { emptyState } = await import('../store.js')
  let state = emptyState()
  state.self = { id: 'me', keySeed: 'ab', displayName: 'Ace' }
  state.requests = {
    req_1: {
      id: 'req_1',
      kind: 'outgoing',
      status: 'open',
      from: 'me',
      to: ['them'],
      excerpt: '先切',
      createdAt: 1,
      versions: [{ n: 1, from: 'me', body: '先切', at: 1 }],
      replies: [],
    },
  }
  const viewing = createView({
    store: { get: async () => state, update: async (fn) => { await fn(state); return state } },
    now: () => 1,
    spillOnce: async () => undefined,
    ensureSelf: () => undefined,
    loadLookupToken: async () => undefined,
    loadConnToken: async () => undefined,
    publicLookups: () => [],
  })
  const got = await viewing.threadOf({ requestId: 'req_1:v1' })
  assert.equal(got.ok, true)
  assert.equal(got.conversations[0].id, 'req_1')
  assert.equal(got.conversations[0].messages[0].id, 'req_1:v1')
})

test('http letter routes accept messageId through one helper', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(join(here, '../http.js'), 'utf8')
  assert.match(src, /function letterId\(/)
  assert.match(src, /markRead\(letterId\(b\)/)
  assert.match(src, /withdraw\(letterId\(b\)/)
  assert.match(src, /confirmSend\(letterId\(b\)/)
})

test('messageId maps onto the live letter id, not a second store', () => {
  assert.deepEqual(parseMessageId('req_1:v2'), { requestId: 'req_1', turn: 'v2' })
  assert.equal(messageIdOf('req_1', 'r1'), 'req_1:r1')
  assert.equal(requestIdOf('req_1:v1'), 'req_1')
  assert.equal(requestIdOf({ messageId: 'req_9:r2' }), 'req_9')
  assert.equal(requestIdOf({ requestId: 'req_9' }), 'req_9')
  assert.deepEqual(letterIds('req_1'), { requestId: 'req_1', messageId: 'req_1:v1' })
  const conv = conversationOf({
    id: 'req_1',
    kind: 'outgoing',
    excerpt: '先切',
    createdAt: 1,
    versions: [{ n: 1, from: 'me', body: '先切', at: 1 }],
    replies: [{ from: 'them', body: '好', at: 2 }],
  })
  assert.equal(conv.requestId, 'req_1')
  assert.equal(conv.messages[0].id, 'req_1:v1')
  assert.equal(conv.messages[1].id, 'req_1:r1')
})

test('hold accepts a messageId and still touches the letter', async () => {
  const box = { A: null, B: null }
  async function sendA(_d, frame) {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') {
      const peer = await box.B.peerFor(frame.from)
      return box.B.receiveEnvelope(frame, peer)
    }
    return { ok: true }
  }
  async function sendB(_d, frame) {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.1:9527')
    return { ok: true }
  }
  box.A = createSecretary({ store: memStore(), now: () => 1, send: sendA })
  box.B = createSecretary({ store: memStore(), now: () => 1, send: sendB })
  await box.A.setDisplayName('Ace')
  await box.B.setDisplayName('林督')
  await box.B.mintPairCode()
  const hs = await box.A.handshake({ peerCode: (await box.B.snapshot()).pairCode.code, door: '10.0.0.2:9527' })
  await afterHandshake(box.A, box.B, hs)
  const peer = (await box.A.snapshot()).peers[0]
  const composed = await box.A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 's' })
  await box.A.confirmSend(composed.requestId)
  const held = await box.A.hold(messageIdOf(composed.requestId, 'v1'))
  assert.equal(held.ok !== false, true)
  const row = (await box.A.snapshot()).requests.find((item) => item.id === composed.requestId)
  assert.equal(row.held, true)
})
