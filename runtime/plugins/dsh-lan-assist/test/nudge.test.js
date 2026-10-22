import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { looksLikeChoice } from '../semantic.js'
import { looksLikeNudge, nudgeDueAt, nudgeQuote } from '../probe.js'
import { dispatch } from '../http.js'

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

test('nudge parser keeps relative time and ignores missed-reminder talk', () => {
  const t = Date.parse('2026-08-24T11:17:29+08:00')
  assert.equal(looksLikeNudge('半小时之后提醒我和你确认打包的情况'), true)
  assert.equal(nudgeQuote('半小时之后提醒我和你确认打包的情况'), '和你确认打包的情况')
  assert.equal(nudgeDueAt('半小时之后提醒我和你确认打包的情况', t) - t, 30 * 60 * 1000)
  assert.equal(nudgeDueAt('10分钟后提醒我过 PO-12', t) - t, 10 * 60 * 1000)
  assert.equal(looksLikeNudge('秘书插件没有提醒我'), false)
})

function solo(clock) {
  return createSecretary({
    store: memStore(),
    now: clock || (() => 1_700_000_000_000),
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    looksLikeChoice,
  })
}

test('hearing a remind-me line asks first and does not keep a slip', async () => {
  const A = solo()
  await A.setDisplayName('Ace')
  const heard = await A.hearUserLine('sess-gray', '明天提醒我催林督')
  assert.equal(heard.ok, true)
  assert.equal(heard.heard, 'nudge')
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'nudge-ask')
  assert.match(dock.speak, /记下/)
  assert.match(dock.speak, /催林督/)
  assert.equal((await A.snapshot()).nudges.length, 0)
})

test('half-hour remind-me is due in 30 minutes, not tomorrow morning', async () => {
  let t = Date.parse('2026-08-24T11:17:29+08:00')
  const A = solo(() => t)
  await A.setDisplayName('Ace')
  await A.setBriefOff(true)
  await A.hearUserLine('sess-pack', '半小时之后提醒我和你确认打包的情况')
  const kept = await A.confirmNudge()
  assert.equal(kept.ok, true)
  assert.equal(kept.nudges.length, 1)
  assert.equal(kept.nudges[0].dueAt - t, 30 * 60 * 1000)
  assert.match(kept.nudges[0].quote, /确认打包/)

  t = Date.parse('2026-08-24T11:48:00+08:00')
  const due = await A.dock('sess-pack')
  assert.equal(due.mode, 'nudge')
  assert.match(due.speak, /到点了/)
  assert.match(due.speak, /确认打包/)
  assert.doesNotMatch(due.speak, /今早/)
  assert.doesNotMatch(due.speak, /昨天记下/)
})

test('complaining that a reminder did not fire is not a new slip', async () => {
  const A = solo()
  await A.setDisplayName('Ace')
  const heard = await A.hearUserLine('s', '我刚才发出了一个待办提醒，但是已经过时间了，秘书插件没有提醒我')
  assert.notEqual(heard.heard, 'nudge')
  assert.equal((await A.dock('s') || {}).mode, undefined)
  assert.equal((await A.snapshot()).nudges.length, 0)
})

test('confirming keeps a slip; due speak stays off the morning brief', async () => {
  let t = Date.parse('2026-08-24T10:00:00+08:00')
  const A = solo(() => t)
  await A.setDisplayName('Ace')
  await A.hearUserLine('sess-gray', '明天提醒我催林督')
  const kept = await A.confirmNudge()
  assert.equal(kept.ok, true)
  assert.equal(kept.nudges.length, 1)
  assert.match(kept.nudges[0].quote, /催林督/)
  const afterKeep = await A.dock('sess-gray')
  assert.notEqual(afterKeep && afterKeep.mode, 'nudge-ask')

  t = Date.parse('2026-08-25T09:05:00+08:00')
  await A.setBriefOff(true)
  const due = await A.dock('sess-gray')
  assert.equal(due.mode, 'nudge')
  assert.match(due.speak, /催林督/)
  assert.doesNotMatch(due.speak, /今早/)
  assert.equal(due.primary, '先记下')
  assert.equal(due.secondary, '忘掉')

  const brief = await A.snapshot()
  const morning = (brief.inbox || []).find((row) => row.kind === 'brief')
  if (morning) assert.doesNotMatch(morning.speak, /催林督/)
})

test('forgetting a slip stops due speak; hold silences it for the day', async () => {
  let t = Date.parse('2026-08-24T10:00:00+08:00')
  const A = solo(() => t)
  await A.setDisplayName('Ace')
  await A.setBriefOff(true)
  await A.hearUserLine('s', '明天提醒我催林督')
  const kept = await A.confirmNudge()
  t = Date.parse('2026-08-25T09:05:00+08:00')
  assert.equal((await A.dock('s')).mode, 'nudge')
  await A.holdNudge(kept.nudgeId)
  assert.equal(await A.dock('s'), null)
  t = Date.parse('2026-08-26T09:05:00+08:00')
  assert.equal((await A.dock('s')).mode, 'nudge')
  await A.forgetNudge(kept.nudgeId)
  assert.equal(await A.dock('s'), null)
  assert.equal((await A.snapshot()).nudges.length, 0)
})

test('reply dock still beats a due nudge', async () => {
  let t = Date.parse('2026-08-24T10:00:00+08:00')
  const store = memStore()
  const A = createSecretary({
    store,
    now: () => t,
    send: async () => ({ ok: false }),
    writeSlip: async () => ({ ok: true }),
    looksLikeChoice,
  })
  await A.setDisplayName('Ace')
  await A.setBriefOff(true)
  await A.hearUserLine('sess-gray', '明天提醒我催林督')
  await A.confirmNudge()
  await store.update((state) => {
    state.requests.req1 = {
      id: 'req1',
      kind: 'outgoing',
      status: 'replied',
      sessionId: 'sess-gray',
      excerpt: '先切 10%',
      from: 'pk_ace',
      fromName: 'Ace',
      to: ['pk_lin'],
      topic: true,
      replies: [{ from: 'pk_lin', fromName: '林督', body: '可以。', at: t }],
      adopted: false,
      held: false,
    }
  })
  t = Date.parse('2026-08-25T09:05:00+08:00')
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'reply')
})

test('asleep does not take a remind-me line', async () => {
  const A = solo()
  await A.setDisplayName('Ace')
  await A.setAsleep(true)
  const heard = await A.hearUserLine('s', '明天提醒我催林督')
  assert.equal(heard.skipped, 'asleep')
  const dock = await A.dock('s')
  assert.notEqual(dock && dock.mode, 'nudge-ask')
  assert.equal((await A.snapshot()).nudges.length, 0)
})

test('plain chase talk is not a slip; http confirm then forget', async () => {
  const A = solo()
  await A.setDisplayName('Ace')
  const chase = await A.hearUserLine('s', '催一下林督')
  assert.equal(chase.heard, 'chase')
  assert.equal((await A.snapshot()).nudges.length, 0)
  await A.hearUserLine('s', '明天提醒我过 PO-12')
  const kept = await dispatch(A, '/nudge/confirm', {})
  assert.equal(kept.ok, true)
  assert.equal(kept.nudges.length, 1)
  const gone = await dispatch(A, '/nudge/forget', { requestId: kept.nudgeId })
  assert.equal(gone.nudges.length, 0)
})

test('addNudge from a chat quote keeps a slip without pretending asked', async () => {
  const A = solo()
  await A.setDisplayName('Ace')
  const added = await A.addNudge({ quote: '先切 10%', sessionId: 's' })
  assert.equal(added.ok, true)
  assert.equal(added.nudges.length, 1)
  assert.equal(added.nudges[0].quote, '先切 10%')
  const empty = await A.addNudge({ quote: '  ' })
  assert.equal(empty.ok, false)
})

test('addNudge keeps a picked dueAt instead of guessing from the quote', async () => {
  const A = solo()
  await A.setDisplayName('Ace')
  const dueAt = 1_800_000_000_000
  const added = await A.addNudge({ quote: '明天再说', sessionId: 's', dueAt })
  assert.equal(added.ok, true)
  assert.equal(added.nudges[0].dueAt, dueAt)
})
