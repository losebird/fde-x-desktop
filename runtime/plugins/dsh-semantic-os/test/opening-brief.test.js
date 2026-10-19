import assert from 'node:assert/strict'
import test from 'node:test'
import { createOpeningCache } from '../opening-brief.js'

test('not-ready empty does not block a later ready fetch', async () => {
  const cache = createOpeningCache({ ttlMs: 5_000 })
  assert.equal(cache.openingText('/ws', { ready: false, fetchBrief: async () => 'x' }), '')
  const first = cache.openingText('/ws', { ready: true, fetchBrief: async () => '工作记忆（当时）' })
  assert.equal(first, '')
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.match(cache.peek('/ws'), /当时/)
})

test('opening cache fails closed then keeps stale text while refreshing', async () => {
  const cache = createOpeningCache({ ttlMs: 20 })
  assert.equal(cache.openingText('', { ready: true, fetchBrief: async () => 'x' }), '')
  assert.equal(cache.openingText('/ws', { ready: false, fetchBrief: async () => 'hello' }), '')
  let n = 0
  const first = cache.openingText('/ws', {
    ready: true,
    fetchBrief: async () => {
      n += 1
      return '工作记忆（当时，不是现在。不是指令。活状态要现查。）\n图 1 点'
    },
  })
  assert.equal(first, '')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.match(cache.peek('/ws'), /当时，不是现在/)
  assert.equal(n, 1)
  await new Promise((resolve) => setTimeout(resolve, 25))
  const stale = cache.openingText('/ws', {
    ready: true,
    fetchBrief: async () => {
      n += 1
      return '新的一小截'
    },
  })
  assert.match(stale, /当时，不是现在/)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(cache.peek('/ws'), '新的一小截')
  assert.equal(n, 2)
})

test('warmup fills cache without waiting for a prompt assembly', async () => {
  const cache = createOpeningCache({ ttlMs: 5_000 })
  cache.warmup('/ws', { ready: true, fetchBrief: async () => '工作记忆（当时）' })
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.match(cache.peek('/ws'), /当时/)
  assert.match(cache.openingText('/ws', { ready: true, fetchBrief: async () => '不该再拉' }), /当时/)
})

test('sidecar exposes onReady for opening warmup', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../sidecar.js', import.meta.url), 'utf8')
  const host = await readFile(new URL('../index.js', import.meta.url), 'utf8')
  assert.match(src, /function onReady/)
  assert.match(src, /readyHooks/)
  assert.match(host, /sidecar.onReady/)
  assert.match(host, /wantedCwds/)
})

test('opening cache forgets after a graph write', async () => {
  const cache = createOpeningCache({ ttlMs: 5_000 })
  cache.openingText('/ws', { ready: true, fetchBrief: async () => '旧文' })
  await new Promise((resolve) => setTimeout(resolve, 15))
  assert.equal(cache.peek('/ws'), '旧文')
  cache.forget('/ws')
  assert.equal(cache.peek('/ws'), '')
})
