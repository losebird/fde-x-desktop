import './support/no-stray-processes.mjs'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { listBizWriteAudits, openDatabase } from '../db.mjs'
import { auditChangesFromWrite, auditWorkstationWrite, capturePendingSheet } from '../routes/biz.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const migrations = join(repoRoot, 'runtime/migrations')

test('BFF overlay write proxy audits through the workstation write path', () => {
  const src = readFileSync(join(repoRoot, 'runtime/server.mjs'), 'utf8')
  assert.match(src, /function isLanAssistWriteProxy/)
  assert.match(src, /function proxyLanAssistWrite/)
  assert.match(src, /auditWorkstationWrite/)
  assert.match(src, /capturePendingSheet/)
  assert.match(src, /body.sessionId \|\| body.session_id/)
})

test('overlay write envelope lands a 操作记录 row', async () => {
  const db = openDatabase(`/tmp/fde-overlay-audit-${Date.now()}.sqlite`, migrations)
  const written = {
    ok: true,
    kind: 'receipt',
    receiptId: '371713470234641',
    preview_id: 'pv_overlay',
    lines: [{ no: 'EXP20250503296', kind: '费用报销', action: '改行' }],
  }
  const pendingSheet = {
    kind: '费用报销',
    action: '改行',
    no: 'EXP20250503296',
    sessionId: 'session-overlay',
    workspace: '/tmp/overlay-ws',
    changes: [{ field: 'remarks', label: '事由', from: '项目出差', to: '写口验' }],
    columns: [{ key: 'remarks', label: '事由' }],
  }
  const { traceId } = await auditWorkstationWrite(
    { db, aiRuntime: { lanAssist: async () => ({ ok: true }) } },
    {
      body: {
        preview_id: 'pv_overlay',
        source: 'workstation',
        workspace: '/tmp/overlay-ws',
        sessionId: 'session-overlay',
      },
      written,
      pendingSheet,
    },
  )
  assert.ok(traceId)
  const rows = listBizWriteAudits(db, '/tmp/overlay-ws', 8)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, '费用报销')
  assert.equal(rows[0].action, '改行')
  assert.equal(rows[0].recordNo, 'EXP20250503296')
  assert.equal(rows[0].sessionId, 'session-overlay')
  assert.equal(rows[0].source, 'workstation')
  assert.equal(rows[0].receiptId, '371713470234641')
  assert.equal(rows[0].changes.length, 1)
  assert.equal(rows[0].changes[0].field, 'remarks')
  assert.equal(rows[0].changes[0].to, '写口验')
  db.close()
})

test('capturePendingSheet prefers the session pendingSheet for the preview token', async () => {
  const official = { preview_id: 'pv_old', action: '现查', changes: [] }
  const pending = {
    preview_id: 'pv_overlay',
    action: '改行',
    no: 'EXP20250503296',
    changes: [{ field: 'remarks', from: '项目出差', to: '审计验' }],
  }
  const sheet = await capturePendingSheet({
    lanAssist: async (_path, options) => {
      assert.equal(options.search.sessionId, 'session-overlay')
      return { pendingSheet: pending, officialRoundSheet: official }
    },
  }, 'pv_overlay', 'session-overlay')
  assert.equal(sheet.preview_id, 'pv_overlay')
  assert.equal(sheet.changes[0].to, '审计验')
})

test('auditChangesFromWrite keeps sheet changes ahead of the receipt envelope', () => {
  const changes = auditChangesFromWrite(
    { source: 'workstation' },
    { changes: [{ field: 'remarks', from: 'a', to: 'b' }] },
    { kind: 'receipt', lines: [{ no: 'EXP1' }] },
  )
  assert.equal(changes[0].to, 'b')
})
