import './support/no-stray-processes.mjs'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { listBizWriteAudits, openDatabase } from '../db.mjs'
import { auditWorkstationWrite } from '../routes/biz.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const migrations = join(repoRoot, 'runtime/migrations')

test('BFF overlay write proxy audits through the workstation write path', () => {
  const src = readFileSync(join(repoRoot, 'runtime/server.mjs'), 'utf8')
  assert.match(src, /function isLanAssistWriteProxy/)
  assert.match(src, /function proxyLanAssistWrite/)
  assert.match(src, /auditWorkstationWrite/)
  assert.match(src, /capturePendingSheet/)
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
  db.close()
})
