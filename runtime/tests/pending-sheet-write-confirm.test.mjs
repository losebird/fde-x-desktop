import './support/no-stray-processes.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { subscribe } from '../events.mjs'
import { startLanAssistStateWatch } from '../lan-assist-state-watch.mjs'
import { handleBizRoutes } from '../routes/biz.mjs'
import { shouldOpenWriteConfirm } from '../../src/lib/write-confirm.ts'

const PREVIEW = 'pv_0123456789abcdef'
const OPEN = 'pv_fedcba9876543210'

function picture(previewId, extra = {}) {
  return {
    kind: '客户',
    action: '改行',
    preview_id: previewId,
    canWrite: true,
    sessionId: 'sess-post',
    workspace: '/tmp/ws-confirm',
    rows: [{ no: 'ROW-1', fields: { title: '甲' } }],
    changes: [{ field: 'title', label: '名称', from: '甲', to: '乙' }],
    ...extra,
  }
}

function confirmOpts() {
  return { dismissed: false, hasChanges: true, alreadyAtTarget: false }
}

function entersConfirm(sheet, tokenIndex) {
  return shouldOpenWriteConfirm(sheet, { ...confirmOpts(), tokenIndex })
}

function depsFor(state) {
  const hook = {
    status: 0,
    body: null,
    db: null,
    aiRuntime: {
      cwd: '/tmp/ws-confirm',
      lanAssist: async (path) => {
        if (path === '/state') return state
        return { ok: true }
      },
    },
    readJson: async () => ({}),
    correlationId: 'corr-confirm',
    stripSecrets: (value) => value,
    normalizeBaseUrl: (value) => value,
    exchangeNocoBaseToken: async () => '',
  }
  hook.sendJson = (_response, code, body) => {
    hook.status = code
    hook.body = body
  }
  hook.sendError = (_response, code, error, message) => {
    hook.status = code
    hook.body = { error, message }
  }
  return hook
}

async function getPending(state) {
  const hook = depsFor(state)
  const url = new URL('http://127.0.0.1/api/v1/biz/pending-sheet?cwd=/tmp/ws-confirm&sessionId=sess-post')
  const handled = await handleBizRoutes({ method: 'GET' }, {}, url, hook)
  assert.equal(handled, true)
  assert.equal(hook.status, 200, JSON.stringify(hook.body))
  return hook.body.data.sheet
}

test('GET pending-sheet embeds a used token so hydrate does not open confirm', async () => {
  const sheet = await getPending({
    ok: true,
    officialRoundSheet: picture(PREVIEW),
    writePreview: { [PREVIEW]: 'used', [OPEN]: 'open' },
  })
  assert.equal(sheet.preview_id, PREVIEW)
  assert.equal(sheet.rows[0].no, 'ROW-1')
  assert.equal(entersConfirm(sheet), false)
  assert.equal(entersConfirm(sheet, { [PREVIEW]: 'open' }), false)
})

test('GET pending-sheet leaves an open token confirmable', async () => {
  const sheet = await getPending({
    ok: true,
    officialRoundSheet: picture(OPEN),
    writePreview: { [OPEN]: 'open' },
  })
  assert.equal(entersConfirm(sheet), true)
})

test('GET pending-sheet does not close a lookup', async () => {
  const sheet = await getPending({
    ok: true,
    officialRoundSheet: picture(PREVIEW, { action: '现查', canWrite: false, changes: [] }),
    writePreview: { [PREVIEW]: 'used' },
  })
  assert.equal(sheet.action, '现查')
  assert.equal(sheet.writeToken, undefined)
  assert.equal(entersConfirm(sheet), false)
})

test('state-watch emit embeds a used token so the business page does not open confirm', async () => {
  const events = []
  const stop = subscribe((envelope) => {
    if (envelope.type === 'biz.sheet.pending') events.push(envelope)
  })
  const handle = startLanAssistStateWatch({
    cwd: '/tmp/ws-confirm',
    lanAssist: async (path) => {
      if (path !== '/state') return { ok: true }
      return {
        ok: true,
        officialRoundSheet: picture(PREVIEW),
        writePreview: { [PREVIEW]: 'used' },
      }
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 50))
  handle.stop()
  stop()
  const pending = events.find((event) => event.payload?.sheet?.preview_id === PREVIEW)
  assert.ok(pending, 'state watch did not emit the official sheet')
  const sheet = pending.payload.sheet
  assert.equal(sheet.rows[0].no, 'ROW-1')
  assert.equal(entersConfirm(sheet), false)
  assert.equal(entersConfirm(sheet, { [PREVIEW]: 'open' }), false)
})
