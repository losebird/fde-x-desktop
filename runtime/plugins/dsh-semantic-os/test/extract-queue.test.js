import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createJobStore } from '../extract-jobs.js'
import { createExtractQueue, draftMemoryCards, isEnvelopeQuote, isReportNoise, writeDraftMemoryCards } from '../extract-queue.js'

function makeQueue(opts) {
  const dir = mkdtempSync(join(tmpdir(), 'dsos-jobs-'))
  return createExtractQueue({
    jobs: createJobStore({ path: join(dir, 'jobs.json') }),
    ...opts,
  })
}

function waitFor(check, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (check()) return resolve()
      if (Date.now() > deadline) return reject(new Error('condition timeout'))
      setTimeout(tick, 20)
    }
    tick()
  })
}

test('draftMemoryCards needs a source and stays 起草', () => {
  const none = draftMemoryCards('我们定了：只发 darwin-arm64。', '')
  assert.deepEqual(none, [])
  const chat = draftMemoryCards('今天天气怎么样？我们聊聊。', 'session:s1')
  assert.deepEqual(chat, [])
  const cards = draftMemoryCards('我们定了：发版收敛到 macOS arm64，其余平台延后。', 'session:s1')
  assert.equal(cards.length, 1)
  assert.equal(cards[0].type, '记忆卡片')
  assert.equal(cards[0].status, '起草')
  assert.equal(cards[0].source, 'session:s1')
  assert.match(cards[0].id, /^memory:/)
  assert.ok(cards[0].label.includes('macOS arm64'))
  assert.equal(cards[0].status === '已生效', false)
})

test('draftMemoryCards skips assistant report tables', () => {
  assert.equal(isReportNoise('--- ### 还未完成 | 项 | 说明 | |---|---| | 再重启 | 活窗口'), true)
  assert.equal(isReportNoise('** ### 当时要做的分期 1.'), true)
  assert.equal(isReportNoise('| 听见选择题就召回 | 仍靠提示；硬拦开口当时就定了不做 |'), true)
  assert.equal(isReportNoise('我们定了：发版收敛到 macOS arm64，其余平台延后。'), false)
  assert.equal(isReportNoise('最小闭环是 skill'), false)
  const noise = draftMemoryCards('### 还未完成\n| 项 | 说明 |\n|---|---|\n| 再重启 | 要做一次 |\n我们定了：只发 darwin-arm64。', 'session:s1')
  assert.equal(noise.some((row) => String(row.label || '').includes('还未完成')), false)
  assert.ok(noise.some((row) => String(row.label || '').includes('darwin-arm64')))
})

test('writeDraftMemoryCards skips assistant turns', async () => {
  const ops = []
  await writeDraftMemoryCards({
    cwd: '/ws',
    texts: [
      { path: 'session:s1', role: 'assistant', text: '我们定了：发版收敛到 macOS arm64，其余平台延后。' },
      { path: 'session:s1', role: 'user', text: '我们定了：只发 darwin-arm64。', timestamp: '2026-08-22T01:45:17.656000+08:00' },
    ],
    postPython: async (payload) => { ops.push(payload); return {} },
  })
  const cards = ops.filter((p) => p.op === 'add_entity' && p.args && p.args.type === '记忆卡片')
  assert.equal(cards.length, 1)
  assert.ok(String(cards[0].args.label || '').includes('darwin-arm64'))
  assert.equal(String(cards[0].args.label || '').includes('macOS'), false)
})

test('extractFromSession needs a nod and does not truncate the body', async () => {
  const ops = []
  const queue = makeQueue({
    getExtract: () => ({ extract: async () => ({ entities: [], relations: [] }) }),
    postPython: async (payload) => { ops.push(payload); return {} },
    concurrency: 1,
  })
  const long = '我们定了：发版收敛到 macOS arm64，其余平台延后。' + '甲'.repeat(2500)
  const denied = await queue.extractFromSession({ cwd: '/ws', id: 'session:s1', nodded: false, text: long })
  assert.equal(denied.error, 'NO_NOD')
  assert.equal(denied.truncated, false)
  const auto = await queue.extractFromSession({ cwd: '/ws', id: 'session:s1', auto: true, text: long })
  assert.equal(auto.error, undefined)
  assert.equal(auto.truncated, false)
  assert.equal(auto.auto, true)
  assert.equal(auto.body_length, long.length)
  const bad = await queue.extractFromSession({ cwd: '/ws', id: 'decision:1', nodded: true, text: long })
  assert.equal(bad.error, 'NOT_A_SESSION')
  const got = await queue.extractFromSession({
    cwd: '/ws',
    id: 'session:s1',
    nodded: true,
    text: long,
    timestamp: '2026-08-22T01:45:17.656000+08:00',
  })
  assert.equal(got.truncated, false)
  assert.equal(got.body_length, long.length)
  assert.ok(got.cards.length >= 1)
  assert.ok(ops.some((p) => p.op === 'add_entity' && p.args && p.args.type === '记忆卡片'))
  assert.equal(ops.some((p) => p.op === 'add_entity' && p.args && String(p.args.content || '').includes('甲'.repeat(100))), false)
  await queue.stop()
})

test('background extract does not auto-write 起草 cards', async () => {
  const ops = []
  const queue = makeQueue({
    getExtract: () => ({
      extract: async () => ({ entities: [], relations: [], via: 'dsh-llm' }),
    }),
    postPython: async (payload) => { ops.push(payload) },
  })
  queue.enqueue('/ws', [{ path: 'session:s1', text: '我们定了：发版收敛到 macOS arm64，其余平台延后。' }])
  await waitFor(() => ops.some((p) => p.op === 'apply_extracted_window'))
  assert.equal(ops.some((p) => p.op === 'add_entity' && p.args && p.args.type === '记忆卡片'), false)
  await queue.stop()
})

test('extractFromSession writes 记忆卡片 with 出自, not 已生效', async () => {
  const ops = []
  const queue = makeQueue({
    getExtract: () => ({
      extract: async () => ({ entities: [], relations: [], via: 'dsh-llm' }),
    }),
    postPython: async (payload) => { ops.push(payload) },
  })
  const got = await queue.extractFromSession({
    cwd: '/ws',
    id: 'session:s1',
    nodded: true,
    text: '我们定了：发版收敛到 macOS arm64，其余平台延后。',
    timestamp: '2026-08-22T01:45:17.656000+08:00',
  })
  assert.ok(got.cards.length >= 1)
  const card = ops.find((p) => p.op === 'add_entity' && p.args.type === '记忆卡片')
  assert.equal(card.args.metadata.status, '起草')
  assert.equal(card.args.metadata.source, 'session:s1')
  assert.equal(card.args.metadata.valid_from, '2026-08-22T01:45:17.656000+08:00')
  assert.ok(!ops.some((p) => p.op === 'add_entity' && p.args && p.args.metadata && p.args.metadata.status === '已生效'))
  const edge = ops.find((p) => p.op === 'add_relationship' && p.args && p.args.type === '出自')
  assert.equal(edge.args.source, 'session:s1')
  assert.equal(edge.args.target, card.args.id)
  await queue.stop()
})

test('extract queue skips quoted 信封 body', async () => {
  assert.equal(isEnvelopeQuote('【信封】请林督过采购单 PO-12，金额未传'), true)
  assert.equal(isEnvelopeQuote('我们定了只发 darwin-arm64'), false)
  const ops = []
  const queue = makeQueue({
    getExtract: () => ({ extract: async () => { throw new Error('should not extract envelope') } }),
    postPython: async (payload) => { ops.push(payload.op) },
    concurrency: 1,
  })
  queue.enqueue('/ws', [{ text: '【信封】请林督过采购单 PO-12，金额未传' }])
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.ok(!ops.includes('apply_extracted_window'))
  await queue.stop()
})

test('extract queue drains enqueued jobs through the worker', async () => {
  const processed = []
  const queue = makeQueue({
    getExtract: () => null,
    postPython: async (payload) => { processed.push(payload.op) },
    concurrency: 2,
  })
  queue.enqueue('/ws', [{ path: 'session:s1', text: 'hello world' }, { path: 'session:s2', text: 'hello' }])
  await waitFor(() => queue.snapshot().processed === 2)
  assert.ok(processed.includes('vocab_types'))
  assert.ok(processed.includes('apply_extracted_window'))
  assert.equal(queue.snapshot().processed, 2)
  await queue.stop()
})

test('extract queue retries failed jobs then marks them failed', async () => {
  let attempts = 0
  const queue = makeQueue({
    getExtract: () => null,
    postPython: async (payload) => {
      if (payload.op === 'vocab_types') return { types: [] }
      attempts += 1
      throw new Error('boom')
    },
    concurrency: 1,
    maxRetries: 2,
  })
  queue.enqueue('/ws', [{ path: 'session:s1', text: 'hello' }])
  await waitFor(() => queue.snapshot().failed === 1)
  assert.equal(attempts, 1)
  await queue.stop()
})

test('extract queue retries stored NOT_READY failures on start', async () => {
  const storeDir = mkdtempSync(join(tmpdir(), 'dsos-jobs-'))
  const jobs = createJobStore({ path: join(storeDir, 'jobs.json') })
  await jobs.enqueue({ cwd: '/ws', source: 'session:s1:1', window: 'hello leftover not ready', cause: 'hit' })
  const claimed = await jobs.claim()
  await jobs.finish(claimed.id, 'failed', 'NOT_READY')
  const queue = createExtractQueue({
    jobs,
    getExtract: () => null,
    postPython: async () => undefined,
    notReadyDelayMs: 0,
  })
  await waitFor(() => queue.snapshot().processed === 1, 3000)
  assert.equal(queue.snapshot().failed, 0)
  await queue.stop()
})

test('extract queue requeues NOT_READY instead of counting a failure', async () => {
  let n = 0
  const queue = makeQueue({
    getExtract: () => null,
    postPython: async (payload) => {
      if (payload.op === 'apply_extracted_window') {
        n += 1
        if (n < 3) return { error: 'NOT_READY' }
      }
    },
    notReadyDelayMs: 0,
    notReadyMax: 8,
  })
  queue.enqueue('/ws', [{ path: 'session:s1', text: 'hello ready later' }])
  await waitFor(() => queue.snapshot().processed === 1, 3000)
  assert.equal(queue.snapshot().failed, 0)
  assert.ok(n >= 3)
  await queue.stop()
})

test('extract queue requeues Chinese jobs until the LLM extract is available', async () => {
  let extract = null
  const ops = []
  const queue = makeQueue({
    getExtract: () => extract,
    postPython: async (payload) => { ops.push(payload.op) },
    concurrency: 1,
    maxRetries: 8,
  })
  queue.enqueue('/ws', [{ path: 'session:s1', text: '你好世界，sidecar 和 Oxigraph。' }])
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.ok(!ops.includes('apply_extracted_window'))
  extract = {
    extract: async () => ({ entities: [{ text: 'sidecar', type: '模块' }], relations: [], via: 'dsh-llm' }),
  }
  await waitFor(() => ops.includes('apply_extracted_window'), 3000)
  await queue.stop()
})

test('extract queue keeps one live job per session window', async () => {
  const sources = []
  const storeDir = mkdtempSync(join(tmpdir(), 'dsos-jobs-'))
  const jobs = createJobStore({ path: join(storeDir, 'jobs.json') })
  const queue = createExtractQueue({
    jobs,
    getExtract: () => null,
    postPython: async (payload) => {
      if (payload.op === 'apply_extracted_window') sources.push(payload.args.source)
    },
  })
  await queue.enqueue('/ws', [
    { path: 'session:s1:1', text: 'hello window one' },
    { path: 'session:s1:2', text: 'hello window one' },
  ])
  await queue.enqueue('/ws', [{ path: 'session:s1:3', text: 'hello window one' }])
  await waitFor(() => queue.snapshot().processed >= 1)
  assert.equal(sources.length, 1)
  await queue.stop()
})

test('extract queue counts parse failures separately from extract failures', () => {
  const queue = makeQueue({ getExtract: () => null, postPython: async () => undefined })
  queue.markParseFailed(2)
  assert.equal(queue.snapshot().parseFailed, 2)
  assert.equal(queue.snapshot().failed, 0)
})

test('extract queue skips empty enqueues and reports idle', () => {
  const queue = makeQueue({ getExtract: () => null, postPython: async () => undefined })
  queue.enqueue('/ws', [])
  assert.equal(queue.snapshot().processing, false)
})

test('extract queue applies a window and does not auto-record decisions', async () => {
  let detected = false
  const ops = []
  const queue = makeQueue({
    getExtract: () => ({
      extract: async () => ({ entities: [{ text: 'sidecar', type: '模块' }], relations: [], via: 'dsh-llm' }),
      detectDecisions: async () => { detected = true; return [{ outcome: 'should not record' }] },
    }),
    postPython: async (payload) => { ops.push(payload) },
  })
  queue.enqueue('/ws', [{ path: 'session:s1', text: '我们定了：只发 darwin-arm64。sidecar 是后台。' }])
  await waitFor(() => ops.some((p) => p.op === 'apply_extracted_window'))
  assert.equal(detected, false)
  assert.ok(!ops.some((p) => p.op === 'record_decision'))
  await queue.stop()
})

test('extract queue backfill only repairs, does not pre-extract', async () => {
  const ops = []
  const queue = makeQueue({
    getExtract: () => ({ extract: async () => ({ entities: [], relations: [], via: 'dsh-llm' }) }),
    postPython: async (payload) => { ops.push(payload.op); return { ok: true } },
  })
  const result = await queue.backfill('/ws')
  assert.equal(result.count, 0)
  assert.ok(ops.includes('repair_session_structure'))
  assert.ok(ops.includes('repair_workspace_vocab'))
  assert.equal(ops.includes('upsert_workspace_vocab'), false)
  assert.equal(ops.includes('record_decision'), false)
  await queue.stop()
})

test('idle warm enqueues the latest session only', async () => {
  const queued = []
  const storeDir = mkdtempSync(join(tmpdir(), 'dsos-jobs-'))
  const jobs = createJobStore({ path: join(storeDir, 'jobs.json') })
  const orig = jobs.enqueue.bind(jobs)
  jobs.enqueue = async (job) => {
    queued.push(job)
    return orig(job)
  }
  const queue = createExtractQueue({
    jobs,
    getExtract: () => ({ extract: async () => ({ entities: [], relations: [], via: 'dsh-llm' }) }),
    idleMs: 5,
    postPython: async (payload) => {
      if (payload.op === 'list_session_summaries') {
        return { texts: [{ path: 'session:new', text: 'recent chat' }, { path: 'session:old', text: 'older' }], count: 2 }
      }
      return { ok: true }
    },
  })
  queue.markIdle()
  await new Promise((resolve) => setTimeout(resolve, 25))
  const warmed = await queue.idleWarm('/ws')
  assert.equal(warmed.count, 1)
  assert.equal(queued[0].source, 'session:new')
  assert.equal(queued[0].cause, 'idle')
  await queue.stop()
})

