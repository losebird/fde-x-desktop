import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLanServer, postFrame } from '../lan.js'
import { createSecretary } from '../secretary.js'
import { createStore } from '../store.js'
import { afterHandshake } from './pair-finish.js'

test('two disk mailboxes pair, send, reply, hold, then adopt', async () => {
  const rootA = await mkdtemp(join(tmpdir(), 'dla-a-'))
  const rootB = await mkdtemp(join(tmpdir(), 'dla-b-'))
  const portA = 19011
  const portB = 19012
  const box = { A: null, B: null }
  const lanA = createLanServer({
    port: portA,
    host: '127.0.0.1',
    onFrame: async (frame) => {
      if (frame.type === 'hello') return box.A.acceptHello(frame, `127.0.0.1:${portB}`)
      const peer = await box.A.peerFor(frame.from)
      if (!peer) return { ok: false, error: 'KEY_REJECT' }
      if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, peer)
      if (frame.type === 'reply') return box.A.receiveReply(frame, peer)
      if (frame.type === 'ack') return box.A.receiveAck(frame, peer)
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
      if (frame.type === 'reply') return box.B.receiveReply(frame, peer)
      if (frame.type === 'ack') return box.B.receiveAck(frame, peer)
      return { ok: false, error: 'UNKNOWN' }
    },
  })
  box.A = createSecretary({
    store: createStore({ root: rootA }),
    port: portA,
    send: (door, frame) => postFrame(door, frame),
  })
  box.B = createSecretary({
    store: createStore({ root: rootB }),
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
    const dock = await box.A.dock('sess-gray')
    assert.equal(dock.mode, 'presend')
    await box.A.confirmSend(composed.requestId)
    const incoming = (await box.B.snapshot()).requests[0]
    assert.equal(incoming.excerpt, '先切 10%')
    await box.B.reply({ requestId: incoming.id, body: '先切 10%。回滚今晚改完。' })
    await box.A.hold(composed.requestId)
    const held = (await box.A.snapshot()).requests.find((row) => row.id === composed.requestId)
    assert.equal(held.held, true)
    assert.equal(held.adopted, false)
    const adopted = await box.A.adopt(composed.requestId)
    assert.equal(adopted.ok, true)
    assert.match(adopted.followup.text, /林督/)
    assert.equal(adopted.followup.sessionId, 'sess-gray')
    const home = join(rootA, 'lan-assist')
    const mode = (await stat(join(home, 'state.json'))).mode & 0o777
    if (process.platform !== 'win32') assert.equal(mode, 0o600)
    await box.A.setLookup({ baseUrl: 'https://nb.example', token: 'secret-ticket' })
    const disk = await readFile(join(home, 'state.json'), 'utf8')
    assert.doesNotMatch(disk, /secret-ticket/)
    assert.doesNotMatch(disk, /privateKey/)
    const secrets = JSON.parse(await readFile(join(home, 'secrets.json'), 'utf8'))
    assert.equal(secrets.lookupToken, 'secret-ticket')
  } finally {
    await lanA.stop()
    await lanB.stop()
    await rm(rootA, { recursive: true, force: true })
    await rm(rootB, { recursive: true, force: true })
  }
})

test('corrupt mailbox file does not throw on snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dla-bad-'))
  const home = join(root, 'lan-assist')
  await mkdir(home, { recursive: true })
  await writeFile(join(home, 'state.json'), 'not-json', 'utf8')
  const A = createSecretary({ store: createStore({ root }), now: () => 1, send: async () => ({ ok: false }) })
  const view = await A.snapshot()
  assert.ok(view.self && view.self.id)
  await writeFile(join(home, 'state.json'), 'null', 'utf8')
  const B = createSecretary({ store: createStore({ root }), now: () => 1, send: async () => ({ ok: false }) })
  const again = await B.snapshot()
  assert.ok(again.self && again.self.id)
  await rm(root, { recursive: true, force: true })
})
