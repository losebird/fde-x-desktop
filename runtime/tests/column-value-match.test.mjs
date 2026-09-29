import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { termFilterPart } from '../vendor-overlays/dsh-lan-assist/where-pass.js'
import { rowMatchesAll } from '../vendor-overlays/dsh-lan-assist/resolve.js'
import { FDE_DSH_HOME } from '../config.mjs'

const QUOTE = '客户胡文今天12点电脑故障紧急保修，现在已处理完成'

test('text column filter is exact first, then contains', () => {
  const term = { keys: ['description'], values: [QUOTE], text: true }
  assert.deepEqual(termFilterPart(term), { description: QUOTE })
  assert.deepEqual(termFilterPart({ ...term, textPass: 'contains' }), {
    description: { $includes: QUOTE },
  })
  const row = { description: `${QUOTE}。` }
  assert.equal(rowMatchesAll(row, [term], 'and', 'exact'), false)
  assert.equal(rowMatchesAll(row, [term], 'and', 'contains'), true)
  assert.equal(rowMatchesAll({ description: QUOTE }, [term], 'and', 'exact'), true)
})

const overlayDir = join(import.meta.dirname, '..', 'vendor-overlays', 'dsh-lan-assist')
const vendorDir = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist')
const staged = mkdtempSync(join(tmpdir(), 'lan-assist-column-'))
cpSync(vendorDir, staged, { recursive: true })
cpSync(overlayDir, staged, { recursive: true })
const { createGate, livePendingSheet } = await import(pathToFileURL(join(staged, 'gate.js')).href)

test('column miss replaces the previous sheet', async () => {
  const sessionId = 'sess-column-miss'
  const workspace = '/tmp/column-miss'
  let state = {
    pendingWrite: null,
    pendingSheet: null,
    sheetTrail: [],
    liveOpening: null,
    requests: {},
  }
  const store = {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
  const now = () => 1_700_000_000_000
  const snapshot = async (sid) => ({
    pendingSheet: livePendingSheet(await store.get(), null, now(), sid || sessionId),
  })
  const gate = createGate({
    store,
    now,
    snapshot,
    note() {},
    opts: {
      gate: {
        async preview(spec) {
          if (spec.columnMiss === true) {
            const sheet = {
              kind: '工单',
              action: '删除',
              rows: [],
              speech: spec.speech,
              speak: '工单的问题描述这一列对不上，0 条，不是没去查。',
              columnMiss: true,
              sessionId: spec.sessionId,
              workspace: spec.workspace,
            }
            return {
              ok: false,
              error: 'NOT_FOUND',
              action: '删除',
              kind: '工单',
              hint: sheet.speak,
              sheet,
              sessionId: spec.sessionId,
              workspace: spec.workspace,
            }
          }
          const sheet = {
            kind: '工单',
            action: '现查',
            rows: [{ no: 'OLD-1', fields: { title: '上一张' } }],
            speech: spec.speech,
            sessionId: spec.sessionId,
            workspace: spec.workspace,
          }
          return { ok: true, action: '现查', kind: '工单', sheet, sessionId: spec.sessionId, workspace: spec.workspace }
        },
      },
    },
    catalogOf() { return [] },
    async reopenReplyDraft() { return false },
    async hearBusinessEvent() {},
    async rememberFocus() {},
  })
  await gate.previewBiz({
    kind: '工单',
    action: '现查',
    speech: '打开工单 OLD-1',
    sessionId,
    workspace,
  })
  const filled = await snapshot(sessionId)
  assert.equal(filled.pendingSheet.rows[0].no, 'OLD-1')
  await gate.previewBiz({
    kind: '工单',
    action: '删除',
    columnMiss: true,
    speech: '按色号删工单',
    sessionId,
    workspace,
  })
  const next = await snapshot(sessionId)
  assert.equal(next.pendingSheet.columnMiss, true)
  assert.equal(next.pendingSheet.rows.length, 0)
  assert.match(next.pendingSheet.speak, /问题描述这一列对不上/)
  assert.notEqual(next.pendingSheet.rows[0] && next.pendingSheet.rows[0].no, 'OLD-1')
})
