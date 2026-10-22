import assert from 'node:assert/strict'
import test from 'node:test'
import { coversQueryWindow, openCorpus, searchCorpus, thenFromIso } from '../session-corpus.js'

function event(seq, text, time) {
  const row = { seq, type: 'user/message', data: { content: text, source: { kind: 'user' } } }
  if (time != null) row.time = time
  return row
}

test('coversQueryWindow matches local calendar day and clock', () => {
  const iso = '2026-08-23T06:33:35.489Z'
  assert.equal(coversQueryWindow(iso, { date: '2026-08-23' }), true)
  assert.equal(coversQueryWindow(iso, { date: '2026-08-22' }), false)
  assert.equal(coversQueryWindow('', { date: '2026-08-23' }), false)
  assert.equal(coversQueryWindow(iso, {}), true)
})

test('searchCorpus stops after maxSessions even if more cwd sessions exist', async () => {
  let reads = 0
  const persistence = {
    async list() {
      return [
        { id: 'old', cwd: '/ws/a', updatedAt: 1 },
        { id: 'new', cwd: '/ws/a', updatedAt: 9 },
      ]
    },
    async readFrom(id) {
      reads += 1
      return { events: [event(1, `hit in ${id} darwin-arm64`, Date.parse('2026-08-23T06:33:00Z'))] }
    },
  }
  const got = await searchCorpus({
    getPersistence: () => persistence,
    cwd: '/ws/a',
    args: { query: 'darwin-arm64', across_bridges: false, maxSessions: 1, limit: 8 },
  })
  assert.equal(got.ok, true)
  assert.equal(reads, 1)
  assert.equal(got.results[0].node.id, 'session:new:1')
})

test('searchCorpus stops when maxMs budget is spent', async () => {
  let reads = 0
  const persistence = {
    async list() {
      return [
        { id: 'a', cwd: '/ws/a', updatedAt: 3 },
        { id: 'b', cwd: '/ws/a', updatedAt: 2 },
        { id: 'c', cwd: '/ws/a', updatedAt: 1 },
      ]
    },
    async readFrom() {
      reads += 1
      await new Promise((resolve) => setTimeout(resolve, 250))
      return { events: [] }
    },
  }
  const got = await searchCorpus({
    getPersistence: () => persistence,
    cwd: '/ws/a',
    args: { query: 'nope', across_bridges: false, maxMs: 200, limit: 8 },
  })
  assert.equal(got.ok, true)
  assert.equal(reads, 1)
})

test('searchCorpus only reads sessions for this cwd and returns 摘录', async () => {
  const persistence = {
    async list() {
      return [
        { id: 's1', cwd: '/ws/a' },
        { id: 's2', cwd: '/ws/other' },
      ]
    },
    async readFrom(id) {
      if (id === 's1') return { events: [event(3, '要不要只发 darwin-arm64', Date.parse('2026-08-23T06:33:00Z'))] }
      return { events: [event(1, 'darwin-arm64 在别人仓', Date.parse('2026-08-23T06:33:00Z'))] }
    },
  }
  const got = await searchCorpus({
    getPersistence: () => persistence,
    cwd: '/ws/a',
    args: { query: 'darwin-arm64', across_bridges: false },
  })
  assert.equal(got.ok, true)
  assert.equal(got.total, 1)
  assert.equal(got.results[0].node.id, 'session:s1:3')
  assert.match(String(got.results[0].node.content), /darwin-arm64/)
  assert.equal(got.results[0].then.now, false)
})

test('searchCorpus reads DSH sessionPersistence snapshots via open/read', async () => {
  const persistence = {
    async list() {
      return [
        { header: { id: 's1', cwd: '/ws/a' }, revision: 'r1' },
        { header: { id: 's2', cwd: '/ws/other' }, revision: 'r2' },
      ]
    },
    async open(id, access) {
      assert.equal(access, 'read')
      return {
        async read() {
          if (id === 's1') return { events: [event(3, '要不要只发 darwin-arm64', Date.parse('2026-08-23T06:33:00Z'))] }
          return { events: [event(1, 'darwin-arm64 在别人仓', Date.parse('2026-08-23T06:33:00Z'))] }
        },
        async close() {},
      }
    },
  }
  const got = await searchCorpus({
    getPersistence: () => persistence,
    cwd: '/ws/a',
    args: { query: 'darwin-arm64', across_bridges: false },
  })
  assert.equal(got.ok, true)
  assert.equal(got.error, '')
  assert.equal(got.results.length, 1)
  assert.equal(got.results[0].node.id, 'session:s1:3')
})

test('searchCorpus refuses a missing persistence', async () => {
  const got = await searchCorpus({ getPersistence: () => null, cwd: '/ws/a', args: { query: 'x' } })
  assert.equal(got.ok, false)
  assert.equal(got.error, 'NO_PERSISTENCE')
})

test('openCorpus returns the log body for session:id:seq', async () => {
  const persistence = {
    async list() { return [{ id: 's1', cwd: '/ws/a' }] },
    async readFrom() {
      return { events: [event(3, `${'x'.repeat(500)}原话在这里`, Date.parse('2026-08-23T06:33:00Z'))] }
    },
  }
  const got = await openCorpus({ getPersistence: () => persistence, id: 'session:s1:3', limit: 220 })
  assert.equal(got.ok, true)
  assert.equal(got.truncated, true)
  assert.ok(got.length > 220)
  assert.match(got.id, /session:s1:3/)
})

test('mergeSearchHits drops hits outside the clock window', async () => {
  const { mergeSearchHits } = await import('../session-corpus.js')
  const iso = '2026-08-23T06:33:35.489Z'
  const instant = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  const clock = `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())} ${pad(instant.getHours())}:${pad(instant.getMinutes())}`
  const hit = {
    node: { id: 'session:s1:3', type: 'Document', content: '聊', valid_from: iso },
    then: { valid_from: iso },
  }
  const late = {
    node: { id: 'session:s1:9', type: 'Document', content: '聊', valid_from: '2026-08-23T09:57:00.000Z' },
    then: { valid_from: '2026-08-23T09:57:00.000Z' },
  }
  const got = mergeSearchHits({ results: [late] }, { results: [hit] }, '聊', { date: clock })
  assert.equal(got.results.length, 1)
  assert.equal(got.results[0].node.id, 'session:s1:3')
})

test('thenFromIso is 当时, never 现在', () => {
  const got = thenFromIso('2026-08-23T06:33:35.489Z')
  assert.equal(got.now, false)
  assert.match(got.label, /当时/)
})
