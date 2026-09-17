import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { configureEventBus, emit } from '../events.mjs'
import { draftMemoryFromBridge, startMemoryWriter } from '../memory/writer.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dbPath = '/tmp/fde-x-memory-writer-test.sqlite'

function makeRuntime(calls) {
  return {
    status: () => ({ connected: true }),
    semanticOs: async (_path, options) => {
      calls.push(options)
      if (options.op === 'draft_memory_card') return { card_id: 'card_test' }
      return { ok: true }
    },
  }
}

test('biz.write.done drafts with expected refs', async () => {
  await rm(dbPath, { force: true }).catch(() => undefined)
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  configureEventBus(db)
  const calls = []
  const aiRuntime = makeRuntime(calls)
  startMemoryWriter({ db, aiRuntime })
  emit('biz.write.done', {
    kind: 'order',
    action: 'post',
    traceId: 'trace_1',
    receiptId: 'rcpt_1',
  }, { workspaceCwd: '/tmp/ws' })
  await new Promise((r) => setTimeout(r, 80))
  const draft = calls.find((c) => c.op === 'draft_memory_card')
  assert.ok(draft)
  assert.equal(draft.args.refs[0], 'biz:trace_1')
})

test('24h dedup skips second draft', async () => {
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  configureEventBus(db)
  const calls = []
  const aiRuntime = makeRuntime(calls)
  const deps = { db, aiRuntime }
  await draftMemoryFromBridge(deps, {
    workspaceCwd: '/tmp/ws',
    title: '一次',
    body: '正文',
    layer: 'project',
    refs: ['biz:dup'],
  })
  calls.length = 0
  await draftMemoryFromBridge(deps, {
    workspaceCwd: '/tmp/ws',
    title: '二次',
    body: '正文',
    layer: 'project',
    refs: ['biz:dup'],
  })
  assert.equal(calls.filter((c) => c.op === 'draft_memory_card').length, 0)
})

test('semantic failure does not throw', async () => {
  const db = openDatabase(dbPath, join(repoRoot, 'runtime/migrations'))
  const aiRuntime = {
    status: () => ({ connected: true }),
    semanticOs: async () => {
      throw new Error('boom')
    },
  }
  const result = await draftMemoryFromBridge({ db, aiRuntime }, {
    workspaceCwd: '/tmp/ws',
    title: 't',
    body: 'b',
    layer: 'daily',
    refs: ['task:unique_ref'],
  })
  assert.equal(result.ok, false)
})
