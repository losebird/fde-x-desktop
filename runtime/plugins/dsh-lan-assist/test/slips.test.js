import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'
import { actorLooksUnstable, buildAdoptSlip, buildMailSlip, writeAdoptSlip, writeMailSlip } from '../slips.js'
import { packAdvice, readLeftIds } from '../semantic.js'

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

function connect(extraA = {}, extraB = {}) {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'ack') return box.B.receiveAck(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'ack') return box.A.receiveAck(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true, path: ':mem:' }), ...extraA })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip: async () => ({ ok: true, path: ':mem:' }), ...extraB })
  return box
}

async function paired(extraA = {}) {
  const { A, B } = connect(extraA, extraA)
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  const done = await afterHandshake(A, B, hs)
  return { A, B, peer: done.peers[0] }
}

test('adopt slip rejects unstable actor and empty body', () => {
  assert.equal(actorLooksUnstable('10.0.0.8'), true)
  assert.equal(actorLooksUnstable('pk_ace_c91e'), false)
  assert.equal(buildAdoptSlip({ requestId: 'r1', actor: '10.0.0.8', quote: 'x' }).ok, false)
  assert.equal(buildAdoptSlip({ requestId: 'r1', actor: 'pk_ace', quote: '' }).ok, false)
})

test('written slip matches semantic-os parseSlip contract', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dla-slip-'))
  try {
    const packed = buildAdoptSlip({
      requestId: 'req-kitchen-1',
      sessionId: 'session-abc',
      actor: 'peer-stable-kitchen',
      quote: '【同事 林督 回信】先切 10%。',
      toIds: ['peer-stable-kitchen'],
      adoptedAt: '2026-08-20T00:00:00Z',
    })
    assert.equal(packed.ok, true)
    const written = await writeAdoptSlip(packed.slip, dir)
    assert.equal(written.ok, true)
    const raw = JSON.parse(await readFile(written.path, 'utf8'))
    const { parseSlip } = await import('/Users/zxz/Documents/ai-project/dsh-semantic-os/slips.js')
    const parsed = parseSlip(raw)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.slip.requestId, 'req-kitchen-1')
    assert.equal(parsed.slip.quote, '【同事 林督 回信】先切 10%。')
    assert.equal(parsed.slip.actor, 'peer-stable-kitchen')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('mail slip is an archive, not a decision', async () => {
  const packed = buildMailSlip({
    requestId: 'req_a',
    turn: 'send',
    sessionId: 'sess-gray',
    workspace: '/ws/kitchen',
    actor: 'pk_ace',
    fromName: 'Ace',
    quote: '先切 10%',
    toIds: ['pk_lin'],
    at: '2026-08-29T00:00:00.000Z',
  })
  assert.equal(packed.ok, true)
  assert.equal(packed.slip.kind, 'mail')
  assert.equal(packed.slip.id, 'req_a.send')
  assert.equal(packed.slip.workspace, '/ws/kitchen')
  assert.match(packed.slip.quote, /Ace/)
  assert.match(packed.slip.quote, /先切 10%/)
  assert.equal(buildMailSlip({ requestId: 'req_a', actor: '10.0.0.8', quote: 'x' }).ok, false)
  assert.equal(buildMailSlip({ requestId: 'req_a', actor: 'pk_ace', quote: '' }).ok, false)

  const dir = await mkdtemp(join(tmpdir(), 'dla-mail-'))
  try {
    const written = await writeMailSlip(packed.slip, dir)
    assert.equal(written.ok, true)
    const raw = JSON.parse(await readFile(written.path, 'utf8'))
    assert.equal(raw.kind, 'mail')
    assert.equal(raw.id, 'req_a.send')
    const { parseSlip } = await import('/Users/zxz/Documents/ai-project/dsh-semantic-os/slips.js')
    const parsed = parseSlip(raw)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.slip.kind, 'mail')
    assert.equal(parsed.slip.workspace, '/ws/kitchen')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('send and receive write mail archive; adopt still uses writeSlip', async () => {
  const archive = []
  const { A, B, peer } = await paired({
    writeArchive: async (args) => {
      archive.push(args)
      return { ok: true, path: ':mem:' }
    },
  })
  const composed = await A.compose({
    excerpt: '先切 10%',
    to: [peer.id],
    sessionId: 'sess-gray',
    workspace: '/ws/kitchen',
  })
  await A.confirmSend(composed.requestId)
  const sent = archive.find((row) => row.turn === 'send')
  const recv = archive.find((row) => row.turn === 'recv')
  assert.ok(sent)
  assert.ok(recv)
  assert.equal(sent.workspace, '/ws/kitchen')
  assert.match(sent.quote, /先切 10%/)

  const incoming = (await B.snapshot()).requests[0]
  assert.ok(incoming)
  assert.equal(recv.requestId, incoming.id)
  assert.equal(recv.workspace, '/ws/kitchen')

  await B.reply({ requestId: incoming.id, body: '先切 10%。回滚今晚改完。' })
  assert.ok(archive.some((row) => String(row.turn || '').startsWith('out.')))
  const got = await A.snapshot()
  const letter = got.requests.find((row) => row.id === composed.requestId)
  assert.ok(letter.replies && letter.replies.length)
  assert.ok(archive.some((row) => String(row.turn || '').startsWith('r')))
})

test('hold writes no slip; adopt writes one; slip failure still followups', async () => {
  const slips = []
  const { A, B, peer } = await paired({
    writeSlip: async (args) => {
      slips.push(args)
      return { ok: true, path: ':mem:' }
    },
  })
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '先切 10%。回滚今晚改完。' })
  await A.hold(composed.requestId)
  assert.equal(slips.length, 0)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
  assert.equal(slips.length, 1)
  assert.equal(slips[0].requestId, composed.requestId)
  assert.match(slips[0].quote, /林督/)

  const { A: C, B: D, peer: p2 } = await paired({
    writeSlip: async () => { throw new Error('disk full') },
  })
  const c2 = await C.compose({ excerpt: '先切 20%', to: [p2.id], sessionId: 'sess-gray' })
  await C.confirmSend(c2.requestId)
  await D.reply({ requestId: (await D.snapshot()).requests[0].id, body: '可以。' })
  const adopted2 = await C.adopt(c2.requestId)
  assert.equal(adopted2.ok, true)
  assert.ok(adopted2.followup)
  assert.equal(adopted2.slip.ok, false)
})

test('left roster reclaims hold and does not unpair', async () => {
  const mem = memStore()
  const solo = createSecretary({ store: mem, now: () => 2, send: async () => ({ ok: false }), writeSlip: async () => ({ ok: true }) })
  await solo.setDisplayName('Ace')
  await mem.update((state) => {
    state.self = { id: 'pk_ace', keySeed: 'aa', displayName: 'Ace' }
    state.peers.pk_lin = { id: 'pk_lin', displayName: '林督', keyHex: 'ab', unpaired: false }
    state.requests.req1 = {
      id: 'req1', kind: 'outgoing', status: 'sent', holder: 'pk_lin', to: ['pk_lin'], from: 'pk_ace',
    }
  })
  const left = await solo.applyLeftIds(['pk_lin'])
  assert.deepEqual(left.reclaimed, ['req1'])
  const after = (await solo.snapshot()).requests.find((row) => row.id === 'req1')
  assert.equal(after.holder, 'pk_ace')
  const peers = (await solo.snapshot()).peers
  assert.equal(peers.find((p) => p.id === 'pk_lin').unpaired, false)
})

test('suggestPrecedent is optional; compose still works without semantic', async () => {
  const { A, peer } = await paired()
  const miss = await A.suggestPrecedent('sess-gray', '先切 10%')
  assert.equal(miss.ok, false)
  assert.equal(miss.error, 'NO_SEMANTIC')
  const composed = await A.compose({ excerpt: '先切 10% 无图', to: [peer.id], sessionId: 'sess-gray' })
  assert.equal(composed.ok, true)
})

test('calendar and full cosign board only after the human click', async () => {
  const boards = []
  const { A, B, peer } = await paired({
    record: async (_sid, payload) => {
      boards.push(payload)
      return { ok: true, decisionId: 'dec-' + payload.outcome, causal: { supports: 1, leads_to: 1 } }
    },
  })
  const composed = await A.compose({ excerpt: '约复盘', to: [peer.id], sessionId: 'sess-gray', cosign: true })
  await A.confirmSend(composed.requestId)
  await A.proposeSlots(composed.requestId, ['周四 14:00'])
  await A.pickSlot(composed.requestId, 0)
  assert.equal(boards.length, 0)
  const cal = await A.writeCalendar(composed.requestId)
  assert.equal(cal.ok, true)
  assert.equal(cal.wrote, false)
  assert.match(cal.speak, /不能装成已写进日历/)
  assert.equal(boards.at(-1).outcome, 'calendar')
  assert.ok(boards.at(-1).because.length)
  assert.ok(boards.at(-1).leadsTo.length)

  const incoming = (await B.snapshot()).requests[0]
  await B.reply({ requestId: incoming.id, body: '周四可以。' })
  const beforeNod = boards.filter((row) => row.outcome === 'cosigned').length
  await A.nod(composed.requestId, peer.id)
  assert.ok(boards.filter((row) => row.outcome === 'cosigned').length > beforeNod)
})

test('readLeftIds only returns status=left stable ids', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dla-people-'))
  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(join(home, 'semantic-os'), { recursive: true })
  await writeFile(join(home, 'semantic-os', 'people.json'), JSON.stringify({
    version: 1,
    people: [
      { id: 'pk_left', status: 'left' },
      { id: 'pk_here', status: 'active' },
      { status: 'left' },
    ],
  }), 'utf8')
  assert.deepEqual(await readLeftIds(home), ['pk_left'])
  await rm(home, { recursive: true, force: true })
})

test('packAdvice still used by compose evidence path', () => {
  const advice = packAdvice({
    because: ['decision:gray', 'file:灰度'],
    evidence: [{ id: 'file:灰度', snippet: '上次先切 10% 回滚' }],
    precedents: [{ id: 'decision:gray', scenario: '先切 10%', supports: 1, leads_to: 1 }],
  }, '先切 10%')
  assert.equal(advice.ready, true)
  assert.ok(advice.because.includes('decision:gray'))
})
