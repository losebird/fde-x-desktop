import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewStillHolds, speakAlreadyWritten, speakPreview, speakReceipt } from '../write.js'
import { createLookup } from '../lookup.js'
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

function connect(extraA = {}, extraB = {}) {
  const box = { A: null, B: null }
  const sendA = async (_door, frame) => {
    if (frame.type === 'hello') return box.B.acceptHello(frame, '10.0.0.1:9527')
    if (frame.type === 'envelope') return box.B.receiveEnvelope(frame, await box.B.peerFor(frame.from))
    if (frame.type === 'reply') return box.B.receiveReply(frame, await box.B.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const sendB = async (_door, frame) => {
    if (frame.type === 'hello') return box.A.acceptHello(frame, '10.0.0.2:9527')
    if (frame.type === 'envelope') return box.A.receiveEnvelope(frame, await box.A.peerFor(frame.from))
    if (frame.type === 'reply') return box.A.receiveReply(frame, await box.A.peerFor(frame.from))
    return { ok: false, error: 'UNKNOWN' }
  }
  const now = () => 1_700_000_000_000
  const writeSlip = async () => ({ ok: true, path: ':mem:' })
  const loadVocab = extraA.loadVocab || extraB.loadVocab || (async () => [
    { kind: '采购单', resource: 'biz_purchase_orders', ticketField: 'orderNo' },
  ])
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip, loadVocab, ...extraA })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip, loadVocab, ...extraB })
  return box
}

async function paired(extraA = {}, extraB = {}) {
  const { A, B } = connect(extraA, extraB)
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  const done = await afterHandshake(A, B, hs)
  return { A, B, peer: done.peers[0] }
}

test('preview and receipt speak do not pretend a nod is a post', () => {
  const preview = speakPreview({ kind: '采购单', no: 'PO-12' }, { ok: true, status: '待审', fingerprint: 'pending' })
  assert.match(preview.speak, /将改采购单 PO-12/)
  assert.match(preview.speak, /不是过账/)
  const stale = previewStillHolds(preview, { ok: true, status: '已过', fingerprint: 'done' })
  assert.equal(stale.ok, false)
  assert.equal(stale.error, 'STALE')
  assert.match(speakReceipt({ kind: '采购单', no: 'PO-12' }, {}).speak, /没回执/)
  assert.match(speakReceipt({ kind: '采购单', no: 'PO-12' }, { receiptId: 'rcpt_1' }).speak, /库里已改上/)
  assert.doesNotMatch(speakReceipt({ kind: '采购单', no: 'PO-12' }, { receiptId: 'rcpt_1' }).speak, /修改成功|过账成功/)
  assert.match(speakReceipt({ kind: '采购单', no: 'PO-12' }, { failed: true }).speak, /要不要走冲正/)
  assert.match(speakAlreadyWritten({ no: 'PO-12' }), /不会二次过账/)
})

test('production lookup hook with empty url still schedules and does not claim posted', async () => {
  const lookup = createLookup({ baseUrl: '' })
  const { A, B, peer } = await paired({ lookupTodo: (spec) => lookup.lookupTodo(spec) })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  const preview = await A.previewWrite(composed.requestId)
  assert.equal(preview.ok, true)
  assert.match(preview.preview.speak, /没连业务/)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
  assert.equal(adopted.requests.find((row) => row.id === composed.requestId).receiptId, '')
})

test('another owner still schedules; staff id is not ACL', async () => {
  const { A, B, peer } = await paired({
    lookupTodo: async () => ({ ok: true, status: '待审', fingerprint: 'x', mine: false }),
  })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  const preview = await A.previewWrite(composed.requestId)
  assert.match(preview.preview.speak, /将改采购单 PO-12/)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
})

test('adopt without a connector still schedules and does not claim posted', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  const preview = await A.previewWrite(composed.requestId)
  assert.equal(preview.ok, true)
  assert.match(preview.preview.speak, /没连业务/)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  assert.ok(adopted.followup)
  assert.equal(adopted.requests.find((row) => row.id === composed.requestId).receiptId, '')
})

test('stale preview blocks adopt when a connector is present', async () => {
  let status = '待审'
  const { A, B, peer } = await paired({
    lookupTodo: async ({ no }) => ({ ok: true, status, fingerprint: `${no}:${status}` }),
  })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  const first = await A.previewWrite(composed.requestId)
  assert.match(first.preview.speak, /待审/)
  status = '已过'
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, false)
  assert.equal(adopted.error, 'STALE')
  assert.match(adopted.hint, /不是现在这版/)
})

test('receipt and compensate speak; same letter will not post twice', async () => {
  const { A, B, peer } = await paired({
    lookupTodo: async () => ({ ok: true, status: '待审', fingerprint: 'pending' }),
  })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  await A.previewWrite(composed.requestId)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, true)
  const receipt = await A.hearBusinessEvent({ kind: 'receipt', requestId: composed.requestId, receiptId: 'rcpt_9' })
  assert.equal(receipt.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'receipt')
  assert.match(dock.speak, /库里已改上|业务回了/)
  const again = await A.adopt(composed.requestId)
  assert.equal(again.ok, false)
  assert.equal(again.error, 'ALREADY_WRITTEN')
  await A.hold(dock.requestId)
  const failed = await A.hearBusinessEvent({ kind: 'compensate', no: 'PO-12', failed: true })
  const compensate = await A.dock('sess-other')
  assert.equal(compensate.mode, 'compensate')
  assert.match(compensate.speak, /要不要走冲正/)
  assert.match(compensate.sign, /不执行冲正/)
  assert.equal(failed.ok, true)
})
