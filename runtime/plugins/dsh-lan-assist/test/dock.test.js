import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAdopt, clip, dockFor, inboxOf, namedAsk, outboxSpeak, overdueUnread } from '../dock.js'
import { CHASE_AFTER_MS } from '../home.js'

function ctx() {
  return {
    gate: null,
    livePendingWrite() { return null },
    capabilitiesOf() { return { connector: false } },
    requestPublic(req) { return req && { id: req.id } },
  }
}

test('inboxOf speaks asked then reply without closed letters', () => {
  const t = Date.now()
  const items = inboxOf({
    self: { displayName: 'Ace' },
    peers: { pk_lin: { displayName: '林督' } },
    requests: {
      dead: { id: 'dead', status: 'closed', kind: 'incoming' },
      in: {
        id: 'in', kind: 'incoming', status: 'open', from: 'pk_lin', fromName: '林督',
        excerpt: '先切 10%', replies: [],
      },
      out: {
        id: 'out', kind: 'outgoing', status: 'replied', from: 'pk_ace', to: ['pk_lin'],
        replies: [{ fromName: '林督', body: '先看回滚窗口。' }],
      },
      topic: {
        id: 'topic', kind: 'outgoing', status: 'replied', from: 'pk_ace', to: ['pk_lin'], topic: true,
        replies: [{ fromName: '林督', body: '先看回滚窗口。' }],
      },
    },
    events: [],
    briefOff: true,
    nudges: [],
  }, t, ctx())
  assert.equal(items.some((row) => row.kind === 'asked' && row.requestId === 'in'), true)
  assert.equal(items.some((row) => row.kind === 'reply' && row.requestId === 'out'), false)
  assert.equal(items.some((row) => row.kind === 'reply' && row.requestId === 'topic'), true)
  assert.equal(items.some((row) => row.requestId === 'dead'), false)
  const afterRead = inboxOf({
    self: { id: 'pk_ace', displayName: 'Ace' },
    peers: { pk_lin: { displayName: '林督' } },
    requests: {
      in: {
        id: 'in', kind: 'incoming', status: 'open', from: 'pk_lin', fromName: '林督',
        excerpt: '先切 10%', replies: [], reads: { pk_ace: t },
      },
    },
    events: [],
    briefOff: true,
    nudges: [],
  }, t, ctx())
  assert.equal(afterRead.some((row) => row.kind === 'asked'), false)
})

test('dockFor prefers preview over asked', () => {
  const t = Date.now()
  const state = {
    self: { displayName: 'Ace' },
    peers: {},
    requests: {
      in: { id: 'in', kind: 'incoming', status: 'open', from: 'pk_lin', fromName: '林督', excerpt: '看单', replies: [] },
    },
    events: [],
    briefOff: true,
    nudges: [],
  }
  const previewCtx = Object.assign(ctx(), {
    livePendingWrite() {
      return { preview_id: 'tok_1', kind: '采购单', no: 'PO-1', ok: true, speak: '将改采购单 PO-1。这是预览，不是过账。' }
    },
  })
  const card = dockFor(state, 'sess', t, previewCtx)
  assert.equal(card.mode, 'preview')
  assert.equal(card.primary, '执行')
  assert.match(card.speak, /预览/)
})

test('canAdopt waits for cosign nods; overdueUnread is 24h', () => {
  assert.equal(canAdopt({ replies: [{}] }), true)
  assert.equal(canAdopt({ kind: 'incoming', excerpt: '先切 10%' }), true)
  assert.equal(canAdopt({ kind: 'outgoing', excerpt: '先切 10%' }, 1), true)
  assert.equal(canAdopt({ kind: 'outgoing', excerpt: '先切 10%' }), false)
  assert.equal(canAdopt({ cosign: { on: true, nods: [] }, visible: ['a', 'b'], from: 'a', replies: [{}] }), false)
  assert.equal(canAdopt({ cosign: { on: true, nods: ['b'] }, visible: ['a', 'b'], from: 'a', replies: [{}] }), true)
  const t = 1_000_000
  assert.equal(overdueUnread({ kind: 'outgoing', status: 'sent', to: ['pk_lin'], reads: {}, createdAt: t - CHASE_AFTER_MS }, t), true)
  assert.equal(overdueUnread({ kind: 'outgoing', status: 'queued', to: ['pk_lin'], reads: {}, createdAt: t - CHASE_AFTER_MS }, t), false)
  assert.equal(overdueUnread({ kind: 'outgoing', status: 'retry', to: ['pk_lin'], reads: {}, createdAt: t - CHASE_AFTER_MS }, t), false)
  assert.equal(overdueUnread({ kind: 'outgoing', status: 'sent', to: ['pk_lin'], withdrawn: ['pk_lin'], reads: {}, createdAt: t - CHASE_AFTER_MS }, t), false)
  assert.match(namedAsk({ fromName: '林督', excerpt: '先切 10%' }, 'Ace'), /林督请你看/)
  assert.equal(clip('abcdefghijklmnop', 8), 'abcdefgh…')
})

test('withdrawn retry is not chase or outbox', () => {
  const t = Date.now()
  const items = inboxOf({
    self: { id: 'pk_ace', displayName: 'Ace' },
    peers: { pk_lin: { displayName: '林督' } },
    requests: {
      gone: {
        id: 'gone', kind: 'outgoing', status: 'retry', from: 'pk_ace', to: ['pk_lin'],
        withdrawn: ['pk_lin'], reads: {}, createdAt: t - CHASE_AFTER_MS, lastError: 'UNREACHABLE',
      },
    },
    events: [],
    briefOff: true,
    nudges: [],
  }, t, ctx())
  assert.equal(items.some((row) => row.kind === 'chase'), false)
  assert.equal(items.some((row) => row.kind === 'outbox'), false)
})

test('relayed outbox does not speak 已收到', () => {
  const state = { peers: { pk_lin: { displayName: '林督' } } }
  const speak = outboxSpeak(state, {
    kind: 'outgoing',
    to: ['pk_lin'],
    relayed: { pk_lin: 1 },
    delivered: {},
  })
  assert.match(speak, /已进中继/)
  assert.match(speak, /不是已收到/)
  const waiting = outboxSpeak(state, { kind: 'outgoing', to: ['pk_lin'], status: 'queued' })
  assert.match(waiting, /还没送到林督/)
})
