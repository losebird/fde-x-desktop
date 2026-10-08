import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { insertBizWriteAudit, openDatabase } from '../db.mjs'
import { configureEventBus, emit } from '../events.mjs'
import { draftCard } from '../memory/draft.mjs'
import { draftMemoryFromBridge, startMemoryWriter } from '../memory/writer.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dbPath = '/tmp/fde-x-memory-writer-test.sqlite'

function makeRuntime(calls) {
  return {
    status: () => ({ connected: true }),
    lanAssist: async () => ({ ok: true }),
    semanticOs: async (_path, options) => {
      calls.push(options)
      if (options.op === 'add_node') return { id: options.args.id }
      return { ok: true }
    },
  }
}

async function withWriter(run) {
  await rm(dbPath, { force: true }).catch(() => undefined)
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  configureEventBus(db)
  const calls = []
  const aiRuntime = makeRuntime(calls)
  const stop = startMemoryWriter({ db, aiRuntime })
  try {
    await run({ db, aiRuntime, calls })
  } finally {
    stop()
    db.close()
    await rm(dbPath, { force: true }).catch(() => undefined)
  }
}

test('write events draft cards and do not archive', async () => {
  await withWriter(async ({ db, calls }) => {
    insertBizWriteAudit(db, {
      workspaceCwd: '/tmp/ws',
      traceId: 'trace_1',
      kind: 'order',
      action: 'post',
      recordNo: 'WO-9',
      lookupBind: { speech: '把客户张三改成成交这一句足够长' },
    })
    emit('biz.write.done', { kind: 'order', action: 'post', traceId: 'trace_1', recordNo: 'WO-9' }, { workspaceCwd: '/tmp/ws' })
    emit('app.record.changed', {
      slug: 'item-log',
      entity: 'item',
      rid: 'r_an',
      op: 'insert',
      memoryOnWrite: 'draft-card',
      title: '一条足够长的标题',
      summary: '正文足够长',
    }, { workspaceCwd: '/tmp/ws' })
    emit('task.changed', { id: 'task_1', op: 'update', status: 'done', title: '完成这项任务' }, { workspaceCwd: '/tmp/ws' })
    emit('briefing.ready', { briefingId: 'b1', status: 'ready' }, { workspaceCwd: '/tmp/ws' })
    emit('im.message.sent', { requestId: 'r1' }, { source: 'bff' })
    await new Promise((r) => setTimeout(r, 80))
    const drafts = calls.filter((c) => c.op === 'add_node')
    assert.equal(drafts.length, 1)
    assert.equal(drafts[0].args.label, '把客户张三改成成交这一句足够长')
    assert.equal(drafts[0].args.metadata.origin, 'biz:trace_1')
    assert.ok(drafts.every((c) => c.args.metadata.status === '起草'))
    assert.equal(calls.some((c) => c.op === 'draft_memory_card'), false)
    assert.equal(calls.some((c) => c.op === 'nod_memory_card'), false)
  })
})

test('unreadable biz origin does not draft identity dump', async () => {
  await withWriter(async ({ calls }) => {
    emit('biz.write.done', { kind: 'receipt', action: 'receipt', traceId: 'trace_dump', recordNo: '3717' }, { workspaceCwd: '/tmp/ws' })
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(calls.some((c) => c.op === 'add_node'), false)
  })
})

test('drafted instance origin is stored for list attach', async () => {
  await withWriter(async ({ db }) => {
    insertBizWriteAudit(db, {
      workspaceCwd: '/tmp/ws',
      traceId: 'trace_1',
      kind: 'order',
      lookupBind: { speech: '把客户张三改成成交这一句足够长' },
    })
    emit('biz.write.done', { kind: 'order', action: 'post', traceId: 'trace_1', recordNo: 'WO-9' }, { workspaceCwd: '/tmp/ws' })
    await new Promise((r) => setTimeout(r, 80))
    const row = db.prepare('SELECT ref, card_id FROM memory_write_log WHERE ref = ?').get('biz:trace_1')
    assert.equal(row.ref, 'biz:trace_1')
    assert.match(String(row.card_id), /^memory:[a-f0-9]{16}$/u)
  })
})

test('im sent and incomplete tasks do not draft', async () => {
  await withWriter(async ({ calls }) => {
    emit('im.message.sent', { requestId: 'r1' }, { source: 'bff' })
    emit('task.changed', { id: 'task_1', op: 'update', status: 'todo', title: '还没做完' }, { workspaceCwd: '/tmp/ws' })
    emit('app.record.changed', { slug: 'item-log', entity: 'item', rid: 'r1', op: 'insert' }, { workspaceCwd: '/tmp/ws' })
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(calls.some((c) => c.op === 'add_node'), false)
  })
})

test('receipt origin auto skip; same cue reuses id', async () => {
  await withWriter(async ({ db, aiRuntime, calls }) => {
    const skipped = await draftMemoryFromBridge({ db, aiRuntime }, {
      workspaceCwd: '/tmp/ws',
      title: '一次',
      body: '12345678 正文足够长',
      origin: 'biz:dup',
    })
    assert.equal(skipped.skipped, true)
    assert.equal(skipped.reason, 'not_an_instance')
    assert.equal(calls.some((c) => c.op === 'add_node'), false)

    const first = await draftCard({ db, aiRuntime }, {
      cwd: '/tmp/ws',
      origin: 'session:s1',
      label: '12345678 同一句足够长的正文',
      auto: false,
    })
    const second = await draftCard({ db, aiRuntime }, {
      cwd: '/tmp/ws',
      origin: 'session:s1',
      label: '12345678 同一句足够长的正文',
      auto: false,
    })
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(first.cardId, second.cardId)
    assert.match(first.cardId, /^memory:[a-f0-9]{16}$/u)
    const drafts = calls.filter((c) => c.op === 'add_node')
    assert.equal(drafts.length, 2)
    assert.equal(drafts[0].args.id, drafts[1].args.id)
    assert.equal(drafts[0].args.metadata.status, '起草')
    assert.equal(drafts[0].args.metadata.origin, 'session:s1')
    assert.equal(calls.some((c) => c.op === 'draft_memory_card'), false)
  })
})

test('semantic failure does not throw', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = {
    status: () => ({ connected: true }),
    lanAssist: async () => ({ ok: true }),
    semanticOs: async () => {
      throw new Error('boom')
    },
  }
  const result = await draftMemoryFromBridge({ db, aiRuntime }, {
    workspaceCwd: '/tmp/ws',
    title: 't',
    body: '12345678 body text',
    origin: 'task:unique_ref',
    auto: false,
  })
  assert.equal(result.ok, false)
  db.close()
  await rm(dbPath, { force: true }).catch(() => undefined)
})

test('operation.executed records a decision and does not mint a card', async () => {
  await withWriter(async ({ db, calls }) => {
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO operations
        (id, workspace_id, connection_id, app_id, requested_by, target_ref, action, operation_kind,
         risk_level, execution_mode, state, idempotency_key, expected_version, input_json, plan_json,
         correlation_id, causation_id, created_at, updated_at)
      VALUES ('op_mem_1', 'ws_personal', NULL, NULL, 'actor_local_user', 'fde://external/x/table/y', 'record.update', 'write',
        'high', 'live', 'approved', 'idem_mem_1', NULL, '{}', '{}', 'corr', NULL, ?, ?)
    `).run(now, now)
    emit('operation.executed', { operationId: 'op_mem_1' }, { workspaceCwd: '/tmp/ws' })
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(calls.some((c) => c.op === 'add_node'), false)
    assert.equal(calls.some((c) => c.op === 'draft_memory_card'), false)
    const recorded = calls.find((c) => c.op === 'record_decision')
    assert.ok(recorded)
    assert.deepEqual(recorded.args.because, ['operation:op_mem_1'])
  })
})
