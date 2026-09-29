import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subscribe } from '../events.mjs'
import { startLanAssistStateWatch } from '../lan-assist-state-watch.mjs'

test('a new official sheet is emitted with the surface id prepared for it', async () => {
  const events = []
  const stop = subscribe((envelope) => {
    if (envelope.type === 'biz.sheet.pending') events.push(envelope)
  })
  const sheet = {
    kind: 'KindTicket',
    action: '现查',
    sessionId: 'sess-surf',
    speech: 'which related rows',
    from: { kind: 'KindCustomer', no: 'ROW-1' },
    hopWhere: [{ keys: ['owner'], values: ['ROW-1'] }],
    rows: [{ no: 'T-1' }, { no: 'T-2' }, { no: 'T-3' }, { no: 'T-4' }],
    workspace: '/tmp/ws-surf',
  }
  let prepared = 0
  const handle = startLanAssistStateWatch({
    cwd: '/tmp/ws-surf',
    lanAssist: async () => ({ ok: true, officialRoundSheet: sheet }),
    prepareSurface: () => {
      prepared += 1
      return 'bsurf_new'
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 40))
  handle.stop()
  stop()
  assert.equal(prepared, 1)
  assert.equal(events.length, 1)
  assert.equal(events[0].payload.surfaceId, 'bsurf_new')
  assert.equal(events[0].payload.sheet.rows.length, 4)
})

test('official-sheet mailbox flushes the served sheet without polling', async () => {
  const events = []
  const stop = subscribe((envelope) => {
    if (envelope.type === 'biz.sheet.pending') events.push(envelope)
  })
  let calls = 0
  let onMailbox
  const handle = startLanAssistStateWatch({
    cwd: '/tmp/ws-push',
    lanAssist: async (_path, options) => {
      calls += 1
      const sid = String(options && options.search && options.search.sessionId || '')
      return {
        ok: true,
        officialRoundSheet: {
          kind: 'KindA',
          action: '现查',
          speech: `turn-${calls}`,
          sessionId: sid || 'sess-push',
          roundId: `rnd-${calls}`,
          rows: [{ no: String(calls) }],
        },
      }
    },
    subscribeLanMailbox: (onEvent) => {
      onMailbox = onEvent
      return () => {}
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const afterStart = events.length
  assert.ok(afterStart >= 1)
  onMailbox({ type: 'official-sheet', sessionId: 'sess-push' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  handle.stop()
  stop()
  assert.ok(events.length > afterStart)
})

test('official-sheet flush passes sessionId; poll keeps running as backup', async () => {
  const searches = []
  let onMailbox
  const handle = startLanAssistStateWatch({
    cwd: '/tmp/ws-flush',
    lanAssist: async (_path, options) => {
      const sid = String(options && options.search && options.search.sessionId || '')
      searches.push(sid)
      if (sid === 'sess-fail') return { ok: false }
      return {
        ok: true,
        officialRoundSheet: {
          kind: 'KindA',
          action: '现查',
          speech: `n-${searches.length}`,
          sessionId: sid || 'sess-ok',
          roundId: `rnd-${searches.length}`,
          rows: [{ no: String(searches.length) }],
        },
      }
    },
    subscribeLanMailbox: (onEvent) => {
      onMailbox = onEvent
      return () => {}
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const afterStart = searches.length
  assert.ok(afterStart >= 1)
  onMailbox({ type: 'official-sheet', sessionId: 'sess-ok' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(searches.includes('sess-ok'))
  await new Promise((resolve) => setTimeout(resolve, 1100))
  assert.ok(searches.length > afterStart)
  onMailbox({ type: 'official-sheet', sessionId: 'sess-fail' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(searches.includes('sess-fail'))
  const afterFail = searches.length
  await new Promise((resolve) => setTimeout(resolve, 1100))
  handle.stop()
  assert.ok(searches.length > afterFail)
})

test('poll paints a newer official sheet even if the mailbox event was missed', async () => {
  const events = []
  const stop = subscribe((envelope) => {
    if (envelope.type === 'biz.sheet.pending') events.push(envelope)
  })
  let version = 1
  const handle = startLanAssistStateWatch({
    cwd: '/tmp/ws-miss',
    lanAssist: async () => ({
      ok: true,
      officialRoundSheet: {
        kind: '工单',
        action: '现查',
        speech: version === 1 ? '停用客户还有哪些没关的工单？' : '故障类而且紧急、还没关的工单是哪家客户的？',
        sessionId: 'sess-miss',
        roundId: `rnd-${version}`,
        rows: version === 1
          ? Array.from({ length: 20 }, (_, i) => ({ no: `OLD-${i}` }))
          : [{ no: 'NEW-1' }],
      },
    }),
    subscribeLanMailbox: () => () => {},
  })
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.ok(events.some((row) => row.payload?.sheet?.rows?.[0]?.no === 'OLD-0'))
  version = 2
  await new Promise((resolve) => setTimeout(resolve, 1100))
  handle.stop()
  stop()
  assert.ok(events.some((row) => row.payload?.sheet?.rows?.[0]?.no === 'NEW-1'))
})

test('mailbox onDown keeps poll running after a successful flush', async () => {
  const searches = []
  let onMailbox
  let onDown
  const handle = startLanAssistStateWatch({
    cwd: '/tmp/ws-down',
    lanAssist: async (_path, options) => {
      const sid = String(options && options.search && options.search.sessionId || '')
      searches.push(sid)
      return {
        ok: true,
        officialRoundSheet: {
          kind: 'KindA',
          action: '现查',
          speech: `n-${searches.length}`,
          sessionId: sid || 'sess-ok',
          roundId: `rnd-${searches.length}`,
          rows: [{ no: String(searches.length) }],
        },
      }
    },
    subscribeLanMailbox: (onEvent, hooks) => {
      onMailbox = onEvent
      onDown = hooks && hooks.onDown
      return () => {}
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  onMailbox({ type: 'official-sheet', sessionId: 'sess-ok' })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const afterOk = searches.length
  onDown()
  await new Promise((resolve) => setTimeout(resolve, 1100))
  handle.stop()
  assert.ok(searches.length > afterOk)
})




