import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  envelopePointer,
  parseBusinessRef,
  redactEnvelopeText,
  speakBusinessEvent,
  speakNamedRef,
} from '../ref.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'
import { withSpoken } from './ask-clue.js'

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

function connect() {
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
  const loadVocab = async () => KINDS
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip, loadVocab })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip, loadVocab })
  return box
}

async function paired() {
  const { A, B } = connect()
  await A.setDisplayName('Ace')
  await B.setDisplayName('林督')
  await A.mintPairCode()
  await B.mintPairCode()
  const bCode = (await B.snapshot()).pairCode.code
  const hs = await A.handshake({ peerCode: bCode, door: '10.0.0.2:9527' })
  const done = await afterHandshake(A, B, hs)
  return { A, B, peer: done.peers[0] }
}

const KINDS = withSpoken(['采购单', '销售订单', '销售数据', '客户', '工单', '合同', '报销单', '供应商', '项目任务'].map((kind) => ({ kind })))

test('parseBusinessRef keeps type and ticket only', () => {
  assert.deepEqual(parseBusinessRef('请林督过采购单 PO-12', KINDS), { kind: '采购单', no: 'PO-12' })
  assert.deepEqual(parseBusinessRef('先看 PO-12', KINDS), { kind: '单据', no: 'PO-12' })
  assert.deepEqual(parseBusinessRef('改一下客户 CUST-020', KINDS), { kind: '客户', no: 'CUST-020' })
  assert.deepEqual(parseBusinessRef('销售订单 SO-9', KINDS), { kind: '销售订单', no: 'SO-9' })
  assert.deepEqual(parseBusinessRef('查询SO20260623803这张单子的所有信息', KINDS), { kind: '单据', no: 'SO20260623803' })
  assert.equal(parseBusinessRef('先切 10%'), null)
  assert.deepEqual(parseBusinessRef('先看 PO-12', [{ kind: '客户' }]), { kind: '单据', no: 'PO-12' })
  assert.deepEqual(parseBusinessRef('过一下采购单 PO-12', [{ kind: '客户' }]), { kind: '单据', no: 'PO-12' })
})

test('parseBusinessRef keeps a name clue after the kind', () => {
  assert.deepEqual(parseBusinessRef('改一下客户 西安天工', KINDS), { kind: '客户', no: '西安天工' })
  assert.deepEqual(parseBusinessRef('过一下采购单 天工急件', KINDS), { kind: '采购单', no: '天工急件' })
  assert.deepEqual(parseBusinessRef('查一下工单 灰度告警', KINDS), { kind: '工单', no: '灰度告警' })
  assert.deepEqual(parseBusinessRef('删一下合同 HT-2026-020', KINDS), { kind: '合同', no: 'HT-2026-020' })
  assert.equal(parseBusinessRef('改一下客户', KINDS), null)
  assert.deepEqual(parseBusinessRef('查一下最新的销售数据', KINDS), { kind: '销售数据', no: '', list: true })
  assert.deepEqual(parseBusinessRef('查一下销售订单', KINDS), { kind: '销售订单', no: '', list: true })
  assert.deepEqual(parseBusinessRef('故障类工单发给我', KINDS), { kind: '工单', no: '', list: true })
  assert.deepEqual(parseBusinessRef('合同已到期的客户还有哪些订单', KINDS), { kind: '合同', no: '', list: true })
  assert.deepEqual(parseBusinessRef('工单发给我', KINDS), { kind: '工单', no: '', list: true })
  assert.equal(parseBusinessRef('帮我查某某客户的最新一条订单', KINDS).kind, '客户')
  assert.notEqual(parseBusinessRef('帮我查某某客户的最新一条订单', KINDS).no, '某某')
  assert.equal(parseBusinessRef('帮我把这个客户的电话号码改成1234567890'), null)
  assert.equal(parseBusinessRef('改一下客户 12000'), null)
  assert.equal(parseBusinessRef('改一下客户 20260824'), null)
})

test('envelope keeps this-seat fields; attachment bytes ride the encrypted box', () => {
  const raw = '采购单 PO-12，客户全称：上海某某贸易，金额 12000 元，电话 13800138000'
  const cleaned = redactEnvelopeText(raw)
  assert.match(cleaned, /PO-12/)
  assert.match(cleaned, /12000/)
  assert.match(cleaned, /13800138000/)
  assert.match(cleaned, /上海某某/)
  const pointer = envelopePointer({
    id: 'req_1',
    excerpt: raw,
    body: raw,
    workspace: '/ws/buy',
    ref: { kind: '采购单', no: 'PO-12' },
    attachments: [{ name: '发票.pdf', bytes: 'secret' }],
    evidence: [{ amount: 12000 }],
  })
  assert.equal(pointer.ref.no, 'PO-12')
  assert.equal((pointer.attachments || []).length, 1)
  assert.equal(pointer.attachments[0].name, '发票.pdf')
  assert.equal(pointer.attachments[0].data, 'secret')
  assert.equal(pointer.evidence, undefined)
  assert.match(JSON.stringify(pointer), /12000/)
  assert.match(JSON.stringify(pointer), /上海某某/)
  assert.match(JSON.stringify(pointer), /发票\.pdf/)
})

test('compose ships a pointer; dock names the ticket', async () => {
  const { A, B, peer } = await paired()
  const composed = await A.compose({
    excerpt: '请过采购单 PO-12，客户全称：上海某某，金额 8800 元',
    to: [peer.id],
    sessionId: 'sess-gray',
  })
  const presend = await A.dock('sess-gray')
  assert.equal(presend.mode, 'presend')
  assert.match(presend.speak, /PO-12/)
  const outgoing = (await A.snapshot()).requests.find((row) => row.id === composed.requestId)
  assert.match(String(outgoing && outgoing.excerpt || ''), /8800|上海某某/)
  await A.confirmSend(composed.requestId)
  const incoming = (await B.snapshot()).requests[0]
  assert.equal(incoming.ref.no, 'PO-12')
  assert.equal(incoming.ref.kind, '采购单')
  assert.match(incoming.excerpt, /8800|上海某某/)
  assert.equal((incoming.attachments || []).length, 0)
  const asked = await B.dock('sess-lin')
  assert.equal(asked.mode, 'asked')
  assert.match(asked.speak, /这封像请林督过采购单 PO-12/)
})

test('business event speaks once and never sends or followups', async () => {
  const { A, B, peer } = await paired()
  const heard = await A.hearBusinessEvent({ kind: 'mine', no: 'PO-12' })
  assert.equal(heard.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'biz')
  assert.match(dock.speak, /到我审了/)
  assert.match(dock.speak, /PO-12/)
  assert.match(dock.sign, /不自动寄信/)
  assert.equal((await B.snapshot()).requests.length, 0)
  await A.hold(dock.requestId)
  assert.equal(await A.dock('sess-gray'), null)
  assert.equal((await B.snapshot()).requests.length, 0)
  const composed = await A.compose({ excerpt: '先切 10%', to: [peer.id], sessionId: 'sess-gray' })
  await A.hearBusinessEvent({ kind: 'sla', no: 'PO-99' })
  const presend = await A.dock('sess-gray')
  assert.equal(presend.mode, 'presend')
  assert.equal(presend.requestId, composed.requestId)
})

test('event line stays a pointer, not a ledger', () => {
  assert.match(speakNamedRef({ kind: '采购单', no: 'PO-12' }, '林督'), /请林督过采购单 PO-12/)
  assert.match(speakBusinessEvent('rejected', { kind: '采购单', no: 'PO-12' }), /被驳回了/)
  assert.match(speakBusinessEvent('rejected', { kind: '采购单', no: 'PO-12' }), /不自动再寄/)
})
