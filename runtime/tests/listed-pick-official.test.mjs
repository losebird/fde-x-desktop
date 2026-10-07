import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'listed-pick-official-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate } = await import(pathToFileURL(join(staged, 'gate.js')).href)
const { extractUserSpeech } = await import(pathToFileURL(join(staged, 'semantic.js')).href)

const repoRoot = join(import.meta.dirname, '..', '..')

test('plugin secretary follow-up is not human speech', () => {
  assert.equal(extractUserSpeech({
    type: 'user/message',
    data: {
      source: { kind: 'plugin', plugin: 'dsh-lan-assist' },
      content: [{ type: 'text', text: '库里已改上。回信要用现在的值，不要沿用预览前的旧号。' }],
    },
  }), '')
  assert.equal(extractUserSpeech({
    type: 'user/message',
    data: {
      source: { kind: 'dsh-lan-assist' },
      content: [{ type: 'text', text: '库里已改上。回信要用现在的值，不要沿用预览前的旧号。' }],
    },
  }), '')
  assert.equal(extractUserSpeech({
    type: 'user/message',
    source: { kind: 'plugin', plugin: 'dsh-lan-assist' },
    data: {
      content: [{ type: 'text', text: '库里已改上。回信要用现在的值。' }],
    },
  }), '')
  assert.ok(extractUserSpeech({
    type: 'user/message',
    data: {
      source: { kind: 'user' },
      content: [{ type: 'text', text: '待审产假过一下' }],
    },
  }))
})

test('waiting listed pick executes official action patch to, not the button 过审', async () => {
  const listed = {
    kind: 'KindPay',
    action: '改行',
    listed: true,
    speech: '把备注改成催收',
    sessionId: 'sess-pick',
    patch: { remark: '催收' },
    to: '催收',
    rows: [
      { no: 'P-1', lookup: { field: 'code', value: 'P-1' } },
      { no: 'P-2', lookup: { field: 'code', value: 'P-2' } },
    ],
  }
  const state = { pendingSheet: listed, pendingWrite: null }
  let previewSpec = null
  const gating = createGate({
    store: {
      get: async () => state,
      update: async (fn) => { fn(state) },
    },
    now: () => 1,
    snapshot: async () => ({}),
    note() {},
    opts: {
      gate: {
        preview: async (spec) => {
          previewSpec = spec
          return {
            ok: true,
            action: spec.action,
            preview_id: 'pv_pick',
            picked: true,
            canWrite: true,
            sheet: {
              kind: spec.kind,
              action: spec.action,
              preview_id: 'pv_pick',
              picked: true,
              canWrite: true,
              rows: [{ no: spec.no }],
              changes: [{ field: 'remark', to: '催收' }],
            },
          }
        },
      },
      officialSheet: () => listed,
    },
    catalogOf: () => [],
    reopenReplyDraft: async () => false,
    hearBusinessEvent: async () => {},
    rememberFocus: async () => {},
  })
  const result = await gating.previewBiz({
    kind: 'KindPay',
    action: '过审',
    no: 'P-1',
    sessionId: 'sess-pick',
  })
  assert.equal(previewSpec.action, '改行')
  assert.equal(previewSpec.picked, true)
  assert.equal(previewSpec.patch.remark, '催收')
  assert.equal(previewSpec.to, '催收')
  assert.equal(result.action, '改行')
  assert.equal(result.preview_id, 'pv_pick')
})

test('workstation pick publishes official; listed waiting uses pending action', () => {
  const index = readFileSync(join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist/index.js'), 'utf8')
  assert.match(index, /spec\.workstation === true/)
  assert.match(index, /isConfirmableWritePreview/)
  assert.match(index, /QUERY_SETTLED/)
  assert.match(index, /officialSheet:/)
  const http = readFileSync(join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist/http.js'), 'utf8')
  assert.match(http, /workstation: true/)
  const write = readFileSync(join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist/write.js'), 'utf8')
  assert.match(write, /rereadWrittenIdentity/)
  assert.match(write, /withIdentityReread/)
  assert.doesNotMatch(write, /rereadListedAfterWrite/)
  assert.doesNotMatch(write, /withListedReread/)
  const gate = readFileSync(join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist/gate.js'), 'utf8')
  assert.match(gate, /isWaitingListedWrite/)
  assert.match(gate, /pendingAction/)
  assert.match(gate, /opts\.officialSheet/)
})
