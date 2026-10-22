import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createJobStore, jobId, sessionKey, windowOf } from '../extract-jobs.js'

function store() {
  const dir = mkdtempSync(join(tmpdir(), 'dsos-jobstore-'))
  return createJobStore({ path: join(dir, 'jobs.json') })
}

test('sessionKey collapses message seq onto the session', () => {
  assert.equal(sessionKey('session:abc:12'), 'session:abc')
  assert.equal(sessionKey('session:abc'), 'session:abc')
  assert.equal(sessionKey('file:/tmp/a.md'), 'file:/tmp/a.md')
})

test('job store keeps one live job per session window', async () => {
  const jobs = store()
  const first = await jobs.enqueue({ cwd: '/ws', source: 'session:s1:1', window: 'hello there', cause: 'hit' })
  const again = await jobs.enqueue({ cwd: '/ws', source: 'session:s1:9', window: 'hello there', cause: 'hit' })
  assert.equal(first.duplicate, false)
  assert.equal(again.duplicate, true)
  assert.equal(again.id, first.id)
  const claimed = await jobs.claim()
  assert.equal(claimed.id, first.id)
  assert.equal(await jobs.claim(), null)
  await jobs.finish(claimed.id, 'done')
  const snap = await jobs.snapshot()
  assert.equal(snap.done, 1)
  assert.equal(snap.queued, 0)
})

test('windowOf clips around the query', () => {
  const blob = `${'甲'.repeat(80)} darwin-arm64 ${'乙'.repeat(80)}`
  const clip = windowOf(blob, 'darwin-arm64', 40)
  assert.match(clip, /darwin-arm64/)
  assert.ok(clip.length <= 50)
})

test('jobId is stable for the same window', () => {
  assert.equal(jobId('/ws', 'session:s1:1', 'abc'), jobId('/ws', 'session:s1:2', 'abc'))
})

test('reclaimRunning turns leftover running jobs back into queued', async () => {
  const jobs = store()
  await jobs.enqueue({ cwd: '/ws', source: 'session:s1:1', window: 'hello leftover', cause: 'hit' })
  const claimed = await jobs.claim()
  assert.equal(claimed.status, 'running')
  const reclaimed = await jobs.reclaimRunning()
  assert.equal(reclaimed.count, 1)
  const snap = await jobs.snapshot()
  assert.equal(snap.running, 0)
  assert.equal(snap.queued, 1)
})

test('requeueFailed puts NOT_READY jobs back and drops live duplicates', async () => {
  const jobs = store()
  await jobs.enqueue({ cwd: '/ws', source: 'session:s1:1', window: 'hello not ready', cause: 'hit' })
  const claimed = await jobs.claim()
  await jobs.finish(claimed.id, 'failed', 'NOT_READY')
  let snap = await jobs.snapshot()
  assert.equal(snap.failed, 1)
  const again = await jobs.requeueFailed('NOT_READY')
  assert.equal(again.queued, 1)
  snap = await jobs.snapshot()
  assert.equal(snap.failed, 0)
  assert.equal(snap.queued, 1)
  await jobs.claim()
  await jobs.finish(claimed.id, 'failed', 'NOT_READY')
  await jobs.enqueue({ cwd: '/ws', source: 'session:s1:9', window: 'hello not ready', cause: 'hit' })
  await jobs.claim()
  const dropped = await jobs.requeueFailed('NOT_READY')
  assert.equal(dropped.dropped, 1)
  snap = await jobs.snapshot()
  assert.equal(snap.failed, 0)
  assert.equal(snap.running, 1)
})

test('claim will not start a second running job', async () => {
  const jobs = store()
  await jobs.enqueue({ cwd: '/ws', source: 'session:s1:1', window: 'one window', cause: 'hit' })
  await jobs.enqueue({ cwd: '/ws', source: 'session:s2:1', window: 'two window', cause: 'hit' })
  const first = await jobs.claim()
  assert.ok(first)
  assert.equal(await jobs.claim(), null)
  await jobs.finish(first.id, 'done')
  const second = await jobs.claim()
  assert.ok(second)
  assert.notEqual(second.id, first.id)
})
