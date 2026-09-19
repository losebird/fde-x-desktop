import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_DSH_HOME } from '../config.mjs'

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-opening-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const {
  createGate,
  livePendingWrite,
  livePendingSheet,
  latestLiveLine,
} = await import(pathToFileURL(join(staged, 'gate.js')).href)
const { packSheet } = await import(pathToFileURL(join(staged, 'write.js')).href)

const WRITE_CAN = ['改行', '删除', '过审', '新建']
const sessionId = 'sess-opening'
const workspace = '/tmp/opening-ws'

function memStore(init = {}) {
  let state = {
    pendingWrite: null,
    pendingSheet: null,
    sheetTrail: [{ kind: 'KeepTrail', sessionId, rows: [{ no: 'KEEP-1' }] }],
    liveOpening: null,
    requests: {},
    ...init,
  }
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
    peek() { return state },
  }
}

function hopSheet(action, previewId, extra = {}) {
  return {
    kind: 'ChildB',
    action,
    preview_id: previewId,
    no: extra.no || 'CB-HIT',
    rows: extra.rows || [{ no: 'CB-HIT', fields: { id: 'c-hit', parentRefId: 'p3' } }],
    from: { kind: 'ParentA' },
    hopWhere: [{ keys: ['status'], values: ['pending'] }],
    steps: [{ kind: 'ParentA' }, { kind: 'ChildB' }],
    canWrite: true,
    sessionId,
    workspace,
    speech: extra.speech || 'pending ChildB ∩ expired ParentA',
  }
}

function makeSecretaryGate(store, opts = {}) {
  const now = opts.now || (() => 1_700_000_000_000)
  const snapshot = async (sid) => {
    const state = await store.get()
    return {
      pendingWrite: livePendingWrite(state, null, now()),
      pendingSheet: livePendingSheet(state, null, now(), sid || sessionId),
    }
  }
  return {
    store,
    gate: createGate({
      store,
      now,
      snapshot,
      note() {},
      opts: {
        gate: {
          async preview(spec) {
            const action = String(spec.action || '').trim()
            const previewId = `pv_${action}_${String(spec.patch && Object.keys(spec.patch)[0] || 'x')}`
            const sheet = hopSheet(action, previewId, {
              no: spec.no || 'CB-HIT',
              speech: spec.speech,
            })
            return {
              ok: true,
              action,
              kind: 'ChildB',
              no: sheet.no,
              preview_id: previewId,
              sheet,
              patch: spec.patch || {},
              sessionId: spec.sessionId,
              workspace: spec.workspace,
            }
          },
          async write() { return { ok: true } },
        },
      },
      catalogOf() { return [] },
      async reopenReplyDraft() { return false },
      async hearBusinessEvent() {},
      async rememberFocus() {},
    }),
    snapshot,
  }
}

test('latestLiveLine prefers the last live preview_id', () => {
  const latest = latestLiveLine([
    { action: '改行', preview_id: 'pv_old' },
    { action: '删除', preview_id: 'pv_new' },
  ])
  assert.equal(latest.action, '删除')
  assert.equal(latest.preview_id, 'pv_new')
})

test('same-session write previews follow the latest action instead of the first opening line', async () => {
  const store = memStore()
  const { gate, snapshot } = makeSecretaryGate(store)
  const seen = []
  for (const action of WRITE_CAN) {
    const packed = await gate.previewBiz({
      kind: 'ChildB',
      action,
      sessionId,
      workspace,
      speech: 'pending ChildB ∩ expired ParentA',
      ...(action === '改行' ? { patch: { remark: 'hop' } } : {}),
    })
    const hall = await snapshot(sessionId)
    const row = {
      action,
      packedAction: packed.action,
      pendingAction: hall.pendingWrite && hall.pendingWrite.action,
      sheetAction: hall.pendingSheet && hall.pendingSheet.action,
      previewId: hall.pendingWrite && hall.pendingWrite.preview_id,
      rows: Array.isArray(hall.pendingSheet && hall.pendingSheet.rows) ? hall.pendingSheet.rows.length : 0,
      fromKind: hall.pendingSheet && hall.pendingSheet.from && hall.pendingSheet.from.kind,
      hopWhere: Array.isArray(hall.pendingSheet && hall.pendingSheet.hopWhere)
        && hall.pendingSheet.hopWhere.length > 0,
      openingId: store.peek().pendingWrite && store.peek().pendingWrite.openingId,
    }
    seen.push(row)
    assert.equal(packed.action, action, action)
    assert.equal(row.pendingAction, action, action)
    assert.equal(row.sheetAction, action, action)
    assert.equal(row.rows, 1, action)
    assert.equal(row.fromKind, 'ParentA', action)
    assert.equal(row.hopWhere, true, action)
    assert.ok(row.previewId, action)
    assert.match(String(row.previewId), new RegExp(`pv_${action}_`))
  }
  assert.equal(new Set(seen.map((row) => row.openingId)).size, WRITE_CAN.length)
})

test('packSheet 过审 diffs use schema field, not hop from object', () => {
  const fieldKey = 'phase'
  const fieldLabel = '阶段'
  const sheet = packSheet({
    kind: 'KindA',
    action: '过审',
    status: 'open',
    to: 'closed',
    from: { kind: 'KindB' },
    patch: { [fieldKey]: 'closed' },
    mapped: { fields: [fieldKey] },
    schemaFields: [{ name: fieldKey, title: fieldLabel }],
    matches: [{ no: 'R-1', status: 'open', fields: { [fieldKey]: 'open' } }],
    preview_id: 'pv_phase',
  })
  assert.equal(sheet.changes.length, 1)
  assert.equal(sheet.changes[0].field, fieldKey)
  assert.equal(sheet.changes[0].label, fieldLabel)
  assert.equal(sheet.changes[0].from, 'open')
  assert.equal(sheet.changes[0].to, 'closed')
  assert.equal(sheet.from && sheet.from.kind, 'KindB')
})

test('cancel drops only that preview_id and keeps the later hop', async () => {
  const store = memStore()
  const { gate, snapshot } = makeSecretaryGate(store)
  const first = await gate.previewBiz({
    kind: 'ChildB',
    action: '改行',
    patch: { remark: 'one' },
    sessionId,
    workspace,
  })
  const second = await gate.previewBiz({
    kind: 'ChildB',
    action: '删除',
    sessionId,
    workspace,
  })
  assert.equal(first.action, '改行')
  assert.equal(second.action, '删除')
  const trailBefore = store.peek().sheetTrail.slice()
  await gate.dismissWrite({ preview_id: first.preview_id })
  const afterOld = await snapshot(sessionId)
  assert.equal(afterOld.pendingWrite && afterOld.pendingWrite.action, '删除')
  assert.equal(afterOld.pendingSheet && afterOld.pendingSheet.action, '删除')
  assert.equal(afterOld.pendingWrite && afterOld.pendingWrite.preview_id, second.preview_id)
  assert.deepEqual(store.peek().sheetTrail, trailBefore)

  await gate.dismissWrite({ preview_id: second.preview_id })
  const afterNew = await snapshot(sessionId)
  assert.equal(afterNew.pendingWrite, null)
  assert.equal(afterNew.pendingSheet, null)
  assert.deepEqual(store.peek().sheetTrail, trailBefore)
})

test('same-action patches in one opening still merge', async () => {
  const store = memStore()
  const { gate, snapshot } = makeSecretaryGate(store)
  await gate.previewBiz({
    kind: 'ChildB',
    action: '改行',
    patch: { phone: '1' },
    sessionId,
    workspace,
    openingId: 'open-bundle',
  })
  const second = await gate.previewBiz({
    kind: 'ChildB',
    action: '改行',
    patch: { address: '2' },
    sessionId,
    workspace,
    openingId: 'open-bundle',
  })
  const hall = await snapshot(sessionId)
  assert.equal(hall.pendingWrite.action, '改行')
  assert.equal(hall.pendingWrite.preview_id, second.preview_id)
  assert.equal((hall.pendingWrite.lines || []).length, 2)
})

test('empty 现查 does not wipe a populated list sheet', async () => {
  const store = memStore()
  const now = () => 1_700_000_000_000
  const snapshot = async (sid) => {
    const state = await store.get()
    return {
      pendingWrite: livePendingWrite(state, null, now()),
      pendingSheet: livePendingSheet(state, null, now(), sid || sessionId),
    }
  }
  const gate = createGate({
    store,
    now,
    snapshot,
    note() {},
    opts: {
      gate: {
        async preview(spec) {
          const kind = String(spec.kind || 'KindShown')
          const rows = Array.isArray(spec.rows) ? spec.rows : []
          const sheet = {
            kind,
            action: '现查',
            rows,
            speech: spec.speech,
            sessionId: spec.sessionId,
            workspace: spec.workspace,
          }
          return { ok: rows.length > 0, action: '现查', kind, sheet, sessionId: spec.sessionId, workspace: spec.workspace }
        },
        async write() { return { ok: true } },
      },
    },
    catalogOf() { return [] },
    async reopenReplyDraft() { return false },
    async hearBusinessEvent() {},
    async rememberFocus() {},
  })
  await gate.previewBiz({
    kind: 'KindShown',
    action: '现查',
    rows: [{ no: 'HIT-1' }],
    sessionId,
    workspace,
    speech: 'first populated list',
  })
  const filled = await snapshot(sessionId)
  assert.equal(filled.pendingSheet.kind, 'KindShown')
  assert.equal(filled.pendingSheet.rows.length, 1)
  await gate.previewBiz({
    kind: 'KindEmpty',
    action: '现查',
    rows: [],
    sessionId,
    workspace,
    speech: 'empty follow-up',
  })
  const kept = await snapshot(sessionId)
  assert.equal(kept.pendingSheet.kind, 'KindShown')
  assert.equal(kept.pendingSheet.rows.length, 1)
  assert.equal(kept.pendingSheet.rows[0].no, 'HIT-1')
})
