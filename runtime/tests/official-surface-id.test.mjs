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
