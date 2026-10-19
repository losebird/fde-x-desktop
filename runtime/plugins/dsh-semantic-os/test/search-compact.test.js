import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { clipSearchPayload } from '../tools.js'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const py = join(root, 'python')

function writeGraph(cwd, nodes) {
  const dir = join(cwd, '.dsh', 'semantic-os')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'graph.json'), JSON.stringify({
    nodes: nodes.map((row) => ({
      id: row.id,
      type: row.type || 'Document',
      content: row.content,
      properties: {
        content: row.content,
        valid_from: row.valid_from || '',
      },
      valid_from: row.valid_from || null,
    })),
    edges: [],
  }))
}

function search(cwd, args) {
  const script = [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(py)})`,
    'from bootstrap import run_search_text',
    `print(json.dumps(run_search_text(${JSON.stringify(cwd)}, ${JSON.stringify(args)}), ensure_ascii=False))`,
  ].join('\n')
  return JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
}

test('search_text gives the model a 摘录, not the whole session', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-search-compact-'))
  try {
    const body = `开头垫话。${'甲'.repeat(80)}要不要只发 darwin-arm64${'乙'.repeat(800)}`
    writeGraph(cwd, [{
      id: 'session:s1:1',
      content: body,
      valid_from: '2026-08-22T01:45:17.656000+08:00',
    }])
    const got = search(cwd, { q: 'darwin-arm64' })
    assert.equal(got.total, 1)
    const hit = got.results[0]
    const node = hit.node
    assert.ok(String(node.content).includes('darwin-arm64'))
    assert.ok(String(node.content).length <= 420)
    assert.ok(body.length > 800)
    assert.ok(String(node.content).length < body.length / 2)
    assert.equal(String(node.properties.content), String(node.content))
    assert.ok(!String(node.content).includes('乙'.repeat(400)))
    assert.equal(hit.then && hit.then.now, false)
    assert.match(String(hit.then && hit.then.label || ''), /当时/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('search_text still returns a retired 记忆卡片 and the session', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-search-retire-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        {
          id: 'memory:dead',
          type: '记忆卡片',
          content: '只发 darwin-arm64',
          properties: {
            content: '只发 darwin-arm64',
            kind: '记忆卡片',
            valid_from: '2026-08-22T01:45:17.656000+08:00',
            valid_until: '2020-01-01T00:00:00+00:00',
          },
        },
        {
          id: 'session:s1:1',
          type: 'Document',
          content: '会话里也写了只发 darwin-arm64',
          properties: {
            content: '会话里也写了只发 darwin-arm64',
            valid_from: '2026-08-22T01:45:17.656000+08:00',
          },
        },
      ],
      edges: [],
    }))
    const got = search(cwd, { q: 'darwin-arm64' })
    const ids = (got.results || []).map((row) => row.node && row.node.id)
    assert.ok(ids.includes('memory:dead'))
    assert.ok(ids.includes('session:s1:1'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('search_text default page is 12 and total stays honest', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-search-limit-'))
  try {
    writeGraph(cwd, Array.from({ length: 20 }, (_, i) => ({
      id: `session:s1:${i + 1}`,
      content: `本区只谈 falkordb 修复 ${i + 1}`,
    })))
    const got = search(cwd, { q: 'falkordb' })
    assert.equal(got.results.length, 12)
    assert.equal(got.total, 20)
    const more = search(cwd, { q: 'falkordb', limit: 20 })
    assert.equal(more.results.length, 20)
    assert.equal(more.total, 20)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('search_text ranks by intent without a second search engine', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dsos-search-intent-'))
  try {
    const dir = join(cwd, '.dsh', 'semantic-os')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'graph.json'), JSON.stringify({
      nodes: [
        {
          id: 'session:s1:1',
          type: 'Document',
          content: '聊天里说要不要只发 darwin-arm64',
          properties: { content: '聊天里说要不要只发 darwin-arm64', valid_from: '2026-08-22T01:45:17.656000+08:00' },
        },
        {
          id: 'file:notes.md',
          type: 'Document',
          content: 'darwin-arm64 出自这份发版说明',
          properties: { content: 'darwin-arm64 出自这份发版说明', valid_from: '2026-08-22T01:45:17.656000+08:00' },
        },
        {
          id: 'dec-gray',
          type: 'decision',
          content: '要不要只发 darwin-arm64',
          properties: {
            content: '要不要只发 darwin-arm64',
            status: '已生效',
            outcome: '只发 darwin-arm64',
            valid_from: '2026-08-22T01:45:17.656000+08:00',
          },
        },
      ],
      edges: [],
    }))
    const board = search(cwd, { q: 'darwin-arm64', intent: '拍板' })
    assert.equal(board.intent, '拍板')
    assert.equal(board.results[0].node.id, 'dec-gray')
    const source = search(cwd, { q: 'darwin-arm64', intent: '出处' })
    assert.equal(source.intent, '出处')
    assert.notEqual(source.results[0].node.id, 'dec-gray')
    const chat = search(cwd, { q: '哈哈随便聊聊 darwin-arm64', intent: '闲聊' })
    assert.equal(chat.intent, '闲聊')
    assert.equal((chat.results || []).length, 0)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('Host clips sidecar 全文 before the model sees search_text', () => {
  const body = `开头垫话。${'甲'.repeat(80)}要不要只发 darwin-arm64${'乙'.repeat(800)}`
  const leaked = {
    results: Array.from({ length: 20 }, (_, i) => ({
      node: {
        id: `session:s1:${i + 1}`,
        type: 'Document',
        content: body,
        properties: { content: body },
      },
      score: 120,
    })),
    total: 40,
    query: 'darwin-arm64',
  }
  const got = clipSearchPayload(leaked)
  assert.equal(got.results.length, 12)
  assert.equal(got.total, 40)
  const node = got.results[0].node
  assert.ok(String(node.content).includes('darwin-arm64'))
  assert.ok(String(node.content).length <= 420)
  assert.equal(String(node.properties.content), String(node.content))
  assert.ok(!String(node.content).includes('乙'.repeat(400)))
})
