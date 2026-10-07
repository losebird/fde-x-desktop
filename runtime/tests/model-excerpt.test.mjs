import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clipSearchPayload, toModelExcerpt } from '../vendor-overlays/dsh-semantic-os/search-excerpt.js'

const FAT = {
  results: [{
    node: {
      id: 'session:abc:1',
      type: 'Document',
      content: '测试一下',
      properties: { content: '测试一下', cwd: '/ws/a' },
      valid_from: '2026-10-04T14:50:48.503Z',
    },
    score: 265,
    hop_distance: null,
    semantic_similarity: null,
    then: { now: false, label: '当时 · 2026-10-04 22:50' },
    cwd: '/ws/a',
    via: 'local',
  }],
  total: 1,
  query: '测试一下',
  sources: [{ name: 'BOM', source_type: 'assist', workspace: '/ws/a', retrievable: false, live: true }],
  missing: [],
  live_facts: [],
  bridged: [],
  expanded: [],
  ok: true,
}

test('toModelExcerpt keeps 摘录 fields and drops sidecar envelope', () => {
  const clipped = clipSearchPayload(FAT, { query: '测试一下', cwd: '/ws/a' })
  const view = toModelExcerpt(clipped, { query: '测试一下' })
  assert.equal(view.results.length, 1)
  assert.deepEqual(Object.keys(view.results[0]).sort(), ['id', 'knowledge_grade', 'snippet', 'then'].sort())
  assert.equal(view.results[0].id, 'session:abc:1')
  assert.match(view.results[0].then, /当时/)
  assert.equal(view.sources, undefined)
  assert.equal(view.missing, undefined)
  assert.equal(view.live_facts, undefined)
  assert.equal(view.ok, undefined)
  assert.equal(view.results[0].node, undefined)
})

test('toModelExcerpt pages to four hits by default', () => {
  const fat = {
    results: Array.from({ length: 12 }, (_, i) => ({
      node: { id: `n${i}`, content: `hit ${i}` },
      then: { label: '当时' },
    })),
    total: 40,
    query: 'x',
  }
  const view = toModelExcerpt(clipSearchPayload(fat, { query: 'x' }), { query: 'x' })
  assert.equal(view.results.length, 4)
  assert.equal(view.total, 40)
})

test('toModelExcerpt leaves non-search envelopes alone', () => {
  const lineage = { hops: [{ id: 'a' }], id: 'a' }
  assert.equal(toModelExcerpt(lineage), lineage)
})

test('clipSearchPayload plus excerpt applies to any results array', () => {
  const fat = {
    results: [{
      node: { id: 'n1', content: `${'x'.repeat(800)}` },
      then: { label: '当时' },
    }],
    total: 1,
    sources: [{ name: 'BOM' }],
  }
  const view = toModelExcerpt(clipSearchPayload(fat, { query: 'x' }), { query: 'x' })
  assert.equal(view.results.length, 1)
  assert.ok(view.results[0].snippet.length <= 360)
  assert.equal(view.sources, undefined)
})
