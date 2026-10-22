import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTraceLog, projectionPath, traceDir } from '../traces.js'
import { createGate } from '../write.js'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'

test('trace log remembers an id on disk under the workspace', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-trace-'))
  const log = createTraceLog()
  assert.equal(await log.seen('once', cwd), false)
  await log.remember('once', cwd, { kind: '工单', no: 'TK-1', action: '改行', receiptId: 'r1' })
  assert.equal(await log.seen('once', cwd), true)
  const cold = createTraceLog()
  assert.equal(await cold.seen('once', cwd), true)
  assert.equal(existsSync(join(traceDir(cwd), 'traces.sqlite')), true)
  const projection = await readFile(projectionPath(cwd), 'utf8')
  assert.match(projection, /"id":"once"/)
  assert.match(projection, /"kind":"工单"/)
  assert.match(projection, /"receipt_id":"r1"/)
  assert.doesNotMatch(projection, /amount|phone|电话/)
  const diary = await readFile(join(traceDir(cwd), 'traces.projection.md'), 'utf8')
  assert.match(diary, /出自 once 工单 TK-1 改行 r1/)
  assert.doesNotMatch(diary, /amount|phone|电话/)
})

test('jsonl traces migrate into workspace sqlite', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-trace-jsonl-'))
  const dir = traceDir(cwd)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'traces.jsonl'), `${JSON.stringify({ id: 'old', kind: '工单', no: 'TK-9' })}\n`)
  const log = createTraceLog()
  assert.equal(await log.seen('old', cwd), true)
  const projection = await readFile(projectionPath(cwd), 'utf8')
  assert.match(projection, /"id":"old"/)
  assert.match(projection, /"no":"TK-9"/)
})

test('open reads the ledger row, not live ERP', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-trace-open-'))
  const log = createTraceLog()
  await log.remember('tr-1', cwd, {
    kind: '客户', no: 'CUST2152', action: '改行', receiptId: 'r-9', sessionId: 'sess-1',
  })
  const row = await log.open('tr-1', cwd)
  assert.equal(row.id, 'tr-1')
  assert.equal(row.kind, '客户')
  assert.equal(row.no, 'CUST2152')
  assert.equal(row.receipt_id, 'r-9')
  assert.equal(row.sessionId, 'sess-1')
  assert.equal(await log.open('missing', cwd), null)
  const recent = await log.recent(cwd)
  assert.equal(recent.length, 1)
  assert.equal(recent[0].id, 'tr-1')
})

test('gate dup trace still holds after a remember', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-trace-gate-'))
  const traces = createTraceLog()
  let title = '旧'
  const gate = createGate({
    traces,
    now: () => 1_700_000_000_000,
    loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
    lookupTodo: async () => ({
      ok: true, no: 'TK-1', status: 'processing', fields: { title },
      matches: [{ no: 'TK-1', status: 'processing', fields: { title } }], fingerprint: `TK-1:${title}`,
    }),
    postWrite: async (spec) => {
      if (spec.patch && spec.patch.title) title = spec.patch.title
      return { ok: true, receiptId: 'r1' }
    },
  })
  const preview = await gate.preview({ kind: '工单', no: 'TK-1', action: '改行', patch: { title: '新' }, workspace: cwd })
  const first = await gate.write({ preview_id: preview.preview_id, trace_id: 'same', workspace: cwd })
  assert.equal(first.ok, true)
  const again = await gate.preview({ kind: '工单', no: 'TK-1', action: '改行', patch: { title: '新' }, workspace: cwd })
  const second = await gate.write({ preview_id: again.preview_id, trace_id: 'same', workspace: cwd })
  assert.equal(second.ok, false)
  assert.equal(second.error, 'DUP_TRACE')
})

test('secretary opens the same workspace ledger the gate wrote', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-trace-sec-'))
  const traces = createTraceLog()
  let title = '旧'
  const gate = createGate({
    traces,
    now: () => 1,
    loadVocab: async () => [{ kind: '工单', fields: ['单号', '状态'], can: ['现查'], resource: 'biz_tickets', ticketField: 'ticketNo' }],
    lookupTodo: async () => ({
      ok: true, no: 'TK-1', status: 'processing', fields: { title },
      matches: [{ no: 'TK-1', status: 'processing', fields: { title } }], fingerprint: `TK-1:${title}`,
    }),
    postWrite: async (spec) => {
      if (spec.patch && spec.patch.title) title = spec.patch.title
      return { ok: true, receiptId: 'r-open' }
    },
  })
  let state = emptyState()
  const secretary = createSecretary({
    store: {
      async get() { return state },
      async update(fn) { await fn(state); return state },
    },
    traces,
    gate,
    now: () => 1,
    send: async () => ({ ok: false }),
    ingestPaths: async (_cwd, paths) => ({ ok: true, paths }),
  })
  const missing = await secretary.openTrace({})
  assert.equal(missing.ok, false)
  assert.equal(missing.error, 'NO_CWD')
  const preview = await secretary.previewBiz({ kind: '工单', no: 'TK-1', action: '改行', patch: { title: '新' }, workspace: cwd })
  const written = await secretary.commitWrite({ preview_id: preview.preview_id, trace_id: 'open-1', workspace: cwd })
  assert.equal(written.ok, true, written.hint || written.error)
  const listed = await secretary.openTrace({ workspace: cwd })
  assert.equal(listed.ok, true)
  assert.equal(listed.rows.length, 1)
  assert.match(listed.projection, /traces\.projection\.md/)
  assert.match(listed.mail, /mail\.projection\.md/)
  assert.match(listed.rows[0].id, /^open-1/)
  const opened = await secretary.openTrace({ workspace: cwd, id: listed.rows[0].id })
  assert.equal(opened.ok, true)
  assert.equal(opened.row.no, 'TK-1')
  assert.equal(opened.row.receipt_id, 'r-open')
  const refused = await secretary.ingestLedger({ workspace: cwd })
  assert.equal(refused.error, 'NOT_NODDED')
  const ingested = await secretary.ingestLedger({ workspace: cwd, nodded: true })
  assert.equal(ingested.ok, true)
  assert.ok(ingested.paths.some((row) => String(row).includes('traces.projection.md')))
  const byNo = await secretary.openTrace({ workspace: cwd, no: 'TK-1' })
  assert.equal(byNo.ok, true)
  assert.equal(byNo.live, false)
  assert.equal(byNo.rows[0].no, 'TK-1')
})
