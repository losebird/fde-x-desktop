import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  looksLikeBusiness,
  looksLikeChase,
  parseWriteAction,
  speakCostStop,
  speakDelegate,
  speakLookup,
  speakNods,
  speakSeeMissing,
  speakSla,
  WRITE_ACTIONS,
} from '../probe.js'
import { looksLikeChoice } from '../semantic.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { afterHandshake } from './pair-finish.js'
import { SPOKEN } from './spoken-pack.js'

const SPOKEN_EXTRA = { vocab: [SPOKEN] }

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
  box.A = createSecretary({ store: memStore(), now, send: sendA, writeSlip: async () => ({ ok: true }), looksLikeChoice, ...extraA })
  box.B = createSecretary({ store: memStore(), now, send: sendB, writeSlip: async () => ({ ok: true }), looksLikeChoice, ...extraB })
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

test('write actions are codes; synonyms are only a fast path', () => {
  assert.deepEqual(WRITE_ACTIONS, ['现查', '改行', '删除', '新建', '过审'])
  const hits = [
    ['查一下客户 CUST-020', '现查'],
    ['查询SO20260623803这张单子的所有信息', '现查'],
    ['帮我查某某客户的最新一条订单', '现查'],
    ['故障类工单发给我', '现查'],
    ['看一下工单 WO-3', '现查'],
    ['look up customer CUST-020', '现查'],
    ['check ticket WO-3', '现查'],
    ['改一下客户 CUST-020', '改行'],
    ['update customer CUST-020', '改行'],
    ['change the remark on CUST-020', '改行'],
    ['删一下合同 HT-1', '删除'],
    ['delete contract HT-1', '删除'],
    ['remove this customer', '删除'],
    ['新建客户 西安天工', '新建'],
    ['create a customer', '新建'],
    ['过一下采购单 PO-12', '过审'],
    ['approve purchase order PO-12', '过审'],
  ]
  for (const [text, action] of hits) {
    assert.equal(parseWriteAction(text, SPOKEN_EXTRA), action, text)
  }
  assert.equal(parseWriteAction('帮我看看这段日志', SPOKEN_EXTRA), null)
  assert.equal(parseWriteAction('把客户 CUST-020 的备注换成跟进', SPOKEN_EXTRA), null)
  assert.equal(parseWriteAction('帮我把这个客户的电话号码改成1234567890', SPOKEN_EXTRA), '改行')
  assert.equal(parseWriteAction('帮联系人胡文建个工单', SPOKEN_EXTRA), '新建')
})

test('unknown verb with a ticket is handed to the session, not skipped', async () => {
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    looksLikeChoice,
    catalog: () => [{ name: 'biz_preview' }, { name: 'search_text' }],
    loadVocab: async () => [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'] }],
    gate: {
      preview: async () => ({ ok: false, error: 'SHOULD_NOT_PREVIEW' }),
      tokens: new Map(),
    },
  })
  const missed = await A.hearUserLine('sess-gray', 'update customer CUST-020', '/mail/nocobase-test')
  assert.notEqual(missed.heard, 'preview')
  assert.equal(missed.followup, undefined)
  const loose = await A.hearUserLine('sess-gray', '帮我把这个客户的电话号码改成1234567890', '/mail/nocobase-test')
  assert.notEqual(loose.heard, 'preview')
  assert.equal(loose.followup, undefined)
  const named = await A.hearUserLine('sess-gray', '帮我把武汉光谷的电话改成13323277896', '/mail/nocobase-test')
  assert.notEqual(named.heard, 'preview')
  assert.equal(named.followup, undefined)
  const chatter = await A.hearUserLine('sess-gray', '帮我看看这段日志', '/mail/nocobase-test')
  assert.equal(chatter.skipped, 'not_choice')
  const typed = await A.hearUserLine('sess-gray', '查一下客户 CUST-020', '/mail/nocobase-test')
  assert.equal(typed.skipped, 'session')
  assert.notEqual(typed.speak, '像业务动作。点了才动，不自动开工。')
})

test('lookup / sla / delegate speak stay on this machine', () => {
  assert.match(speakLookup({ kind: '工单' }, { ok: false, error: 'NOT_FOUND', rest: '西安恒通' }), /西安恒通/)
  assert.doesNotMatch(speakLookup({ kind: '工单' }, { ok: false, error: 'NOT_FOUND', rest: '西安恒通' }), /丢掉/)
  assert.match(speakLookup({ kind: '工单' }, {
    ok: true,
    listed: true,
    ambiguous: true,
    matches: [{ no: 'TK-NEW', status: '处理中' }, { no: 'TK-OLD', status: '已关闭' }],
  }), /最近一页 2 条/)
  assert.doesNotMatch(speakLookup({ kind: '工单' }, {
    ok: true,
    listed: true,
    ambiguous: true,
    matches: [{ no: 'TK-NEW', status: '处理中' }, { no: 'TK-OLD', status: '已关闭' }],
  }), /回一张单号/)
  assert.match(speakLookup({ no: 'PO-12' }, { ok: true, status: '待审' }), /待审/)
  assert.match(speakLookup({ no: 'PO-12' }, { ok: true, status: '待审', system: 'NocoBase', env: '生产' }), /生产NocoBase/)
  assert.match(speakLookup({ no: 'PO-12' }, { ok: true, mine: false }), /不在你名下/)
  assert.match(speakSla({ no: 'PO-12' }, { who: '陈工' }), /超时转给陈工/)
  assert.match(speakSla({ no: 'PO-12' }, { who: '陈工' }), /不做超时转办引擎/)
  assert.match(speakSla({ no: 'PO-12' }, {}), /已超时转办/)
  assert.doesNotMatch(speakSla({ no: 'PO-12' }, {}), /陈工|林督/)
  assert.match(speakDelegate('emp_lin', 'emp_ace'), /不能把 emp_ace 的登录/)
  assert.doesNotMatch(speakDelegate('', ''), /林督|Ace/)
  assert.match(speakNods('secretary'), /同意开口/)
  assert.match(speakNods('schedule'), /领进会话/)
  assert.match(speakNods('post'), /才改业务/)
  assert.match(speakSeeMissing(), /不能装成合同已读/)
  assert.match(speakCostStop(), /超预算停写/)
  assert.equal(looksLikeBusiness('这单待审，催一下'), true)
  assert.equal(looksLikeBusiness('采购单'), false)
  assert.equal(looksLikeChase('催一下林督'), true)
  assert.equal(looksLikeChoice('帮我看看这段日志'), false)
})

test('incoming lookup uses this seat; see waits for a click', async () => {
  const { A, B, peer } = await paired({}, {
    lookupTodo: async ({ no }) => ({ ok: true, status: '待审', fingerprint: no, mine: true }),
  })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  const asked = await B.dock('sess-lin')
  assert.match(asked.speak, /待审/)
  assert.match(asked.nod, /同意开口/)
  const unseen = await B.seeAttachment((await B.snapshot()).requests[0].id)
  assert.equal(unseen.ok, false)
  assert.match(unseen.hint, /没眼睛/)
})

test('see after a click; cost gate blocks adopt write', async () => {
  const seen = []
  const { A, B, peer } = await paired({
    see: async (spec) => {
      seen.push(spec.requestId)
      return { ok: true, text: '发票抬头对得上 PO-12' }
    },
  })
  const composed = await A.compose({ excerpt: '请过采购单 PO-12', to: [peer.id], sessionId: 'sess-gray' })
  await A.confirmSend(composed.requestId)
  await B.reply({ requestId: (await B.snapshot()).requests[0].id, body: '可以过。' })
  const looked = await A.seeAttachment(composed.requestId)
  assert.equal(looked.ok, true)
  assert.equal(seen.length, 1)
  await A.stopWrites(true)
  const adopted = await A.adopt(composed.requestId)
  assert.equal(adopted.ok, false)
  assert.equal(adopted.error, 'COST')
})

test('hears business or chase without starting work; drafts stay a thin audit', async () => {
  const { A } = await paired()
  const heard = await A.hearUserLine('s1', '这单待审，催一下')
  assert.equal(heard.heard, 'chase')
  assert.match(heard.speak, /不自动开工/)
  const again = await A.hearUserLine('s1', '这单待审，催一下')
  assert.equal(again.heard, 'chase')
  const sla = await A.speakSlaHint({ who: '陈工', no: 'PO-12' })
  assert.ok((sla.inbox || []).some((row) => /超时转给陈工/.test(row.speak)))
  const delegate = await A.speakDelegateHint('emp_ace')
  assert.ok((delegate.inbox || []).some((row) => /不能把 emp_ace/.test(row.speak)))
})
