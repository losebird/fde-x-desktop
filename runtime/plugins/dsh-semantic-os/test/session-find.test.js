import assert from 'node:assert/strict'
import test from 'node:test'
import { composeFindResults, excerptsFromFind, groupOfficialSearch, groupSemanticHits, parseSessionNodeId } from '../session-find.js'

const list = {
  current: 'sess-a',
  ids: ['sess-a', 'sess-b', 'sess-blank', 'sess-child'],
  byId: {
    'sess-a': { id: 'sess-a', displayTitle: '改客户电话', cwd: '/ws/lan', blank: false, updatedAt: 30 },
    'sess-b': { id: 'sess-b', displayTitle: '安装依赖', cwd: '/ws/os', blank: false, updatedAt: 20 },
    'sess-blank': { id: 'sess-blank', displayTitle: 'New Session', cwd: '/ws/os', blank: true, updatedAt: 10 },
    'sess-child': { id: 'sess-child', displayTitle: '改客户电话子代理', cwd: '/ws/lan', origin: 'subagent', blank: false, updatedAt: 40 },
  },
}
const workspaces = [
  { workspaceId: 'w1', title: 'lan-assist', path: '/ws/lan', sessionIds: ['sess-a', 'sess-child'] },
  { workspaceId: 'w2', title: 'semantic-os', path: '/ws/os', sessionIds: ['sess-b'] },
]

test('titles and excerpts stay in separate groups', () => {
  const official = groupOfficialSearch({
    query: '客户',
    list,
    workspaces,
    content: {
      status: 'ready',
      items: [
        { sessionId: 'sess-b', snippet: '…改一下客户 CUST-020…' },
        { sessionId: 'sess-a', snippet: '客户电话改过了' },
      ],
    },
  })
  assert.deepEqual(official.titles.map((row) => row.id), ['sess-a'])
  assert.deepEqual(official.excerpts.map((row) => row.id), ['sess-b', 'sess-a'])
  assert.equal(official.excerptStatus, 'ready')
  assert.equal(official.titles[0].workspace, 'lan-assist')
  assert.match(official.excerpts[0].snippet, /CUST-020/)
})

test('body miss is honest, titles still show', () => {
  const official = groupOfficialSearch({
    query: '客户',
    list,
    workspaces,
    content: { status: 'ready', items: [] },
  })
  assert.equal(official.titles.length, 1)
  assert.equal(official.excerpts.length, 0)
  assert.equal(official.excerptStatus, 'empty')
  const composed = composeFindResults(official, { items: [], semanticStatus: 'empty' })
  assert.equal(composed.excerptEmptyReason, '正文没搜到')
})

test('body search failure does not pretend titles are excerpts', () => {
  const official = groupOfficialSearch({
    query: '客户',
    list,
    workspaces,
    content: { status: 'error', items: [] },
  })
  assert.equal(official.titles.length, 1)
  assert.equal(official.excerpts.length, 0)
  assert.equal(official.excerptStatus, 'unavailable')
})

test('semantic hits keep local files and bridged sessions, drop bridged files', () => {
  const packed = {
    query: '六位码',
    results: [
      { node: { id: 'session:sess-a:12', content: '配对用六位码', valid_from: '2026-08-22T14:43:18.853000+08:00' } },
      { node: { id: 'file:/ws/os/README.md', content: '六位码说明' } },
      { node: { id: 'session:there:1', content: '对面秘书配对用六位码', properties: { cwd: '/ws/eyes' } }, via: 'bridge', cwd: '/ws/eyes' },
      { node: { id: 'file:/ws/eyes/notes.md', content: '六位码' }, via: 'bridge', cwd: '/ws/eyes' },
      { node: { id: 'Person:Alice', content: '六位码' } },
    ],
  }
  const semantic = groupSemanticHits(packed, { query: '六位码', list, workspaces })
  assert.deepEqual(semantic.items.map((row) => row.id), [
    'session:sess-a:12',
    'session:there:1',
    'file:/ws/os/README.md',
  ])
  assert.equal(semantic.items[0].kind, 'session')
  assert.equal(semantic.items[0].sessionId, 'sess-a')
  assert.equal(semantic.items[0].title, '改客户电话')
  assert.match(semantic.items[0].then, /2026-08-22/)
  assert.equal(semantic.items[1].via, 'bridge')
  assert.equal(semantic.items[1].workspace, 'eyes')
  assert.equal(semantic.items[2].kind, 'file')
  assert.equal(semantic.items[2].via, 'local')
})

test('semantic hits must contain the query in id or body', () => {
  const packed = {
    query: '0828a7c4',
    results: [
      { node: { id: 'session:other:1', content: '我们现在讨论关于搜索的问题' } },
      { node: { id: 'session:session-0828a7c4-b070:12', content: '本场会话' } },
    ],
  }
  const semantic = groupSemanticHits(packed, { query: '0828a7c4', list: { ids: [], byId: {} } })
  assert.deepEqual(semantic.items.map((row) => row.id), ['session:session-0828a7c4-b070:12'])
})

test('empty graph is 图里没有, not mixed into titles', () => {
  const official = groupOfficialSearch({ query: 'Univer', list, workspaces, content: { status: 'ready', items: [] } })
  const semantic = groupSemanticHits({ query: 'Univer', results: [] }, { query: 'Univer', list })
  const composed = composeFindResults(official, semantic)
  assert.equal(composed.titles.length, 0)
  assert.equal(composed.semantic.length, 0)
  assert.equal(composed.semanticEmptyReason, '图里没有')
  assert.equal(composed.excerptEmptyReason, '正文没搜到')
})

test('parseSessionNodeId keeps ids that contain colons', () => {
  assert.deepEqual(parseSessionNodeId('session:session-abc-1:9'), { sessionId: 'session-abc-1', seq: 9 })
})

test('titles match the last 8 of a session id', () => {
  const official = groupOfficialSearch({
    query: 'sess-a',
    list,
    workspaces,
    content: { status: 'ready', items: [] },
  })
  assert.equal(official.titles.some((row) => row.id === 'sess-a'), true)
})

test('G6 last 8 of a full session id opens that session not another', () => {
  const id = 'session-4033f687-0b20-4913-b00a-2fb590b52feb'
  const official = groupOfficialSearch({
    query: id.slice(-8),
    list: {
      current: id,
      ids: [id, 'session-2e88459a-f44b-4509-8b06-4796e6b6d2d8'],
      byId: {
        [id]: { id, displayTitle: '本场', cwd: '/ws/os', blank: false, updatedAt: 50 },
        'session-2e88459a-f44b-4509-8b06-4796e6b6d2d8': {
          id: 'session-2e88459a-f44b-4509-8b06-4796e6b6d2d8',
          displayTitle: '金场',
          cwd: '/ws/os',
          blank: false,
          updatedAt: 40,
        },
      },
    },
    workspaces: [{ workspaceId: 'w2', title: 'semantic-os', path: '/ws/os', sessionIds: [id] }],
    content: { status: 'ready', items: [] },
  })
  assert.equal(official.titles.length, 1)
  assert.equal(official.titles[0].id, id)
})

test('G6 last 8 does not keep FAISS hits from other sessions', () => {
  const id = 'session-4033f687-0b20-4913-b00a-2fb590b52feb'
  const q = id.slice(-8)
  const semantic = groupSemanticHits({
    query: q,
    results: [
      { node: { id: `session:${id}:12`, content: '本场正文' }, via: 'faiss' },
      { node: { id: 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440', content: '金场' }, via: 'faiss' },
      { node: { id: 'session:session-other:1', content: q }, via: 'corpus' },
    ],
  }, { query: q })
  assert.deepEqual(semantic.items.map((row) => row.sessionId), [id])
})

test('G6 last 8 does not copy unfiltered FAISS rows into excerpts', () => {
  const id = 'session-4033f687-0b20-4913-b00a-2fb590b52feb'
  const q = id.slice(-8)
  assert.equal(q.length, 8)
  const grouped = groupSemanticHits({
    query: q,
    results: [
      { node: { id: 'session:session-other:1', content: 'dsh-lan-assist 串仓正文 ' + q }, via: 'faiss' },
      { node: { id: 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440', content: '金场' }, via: 'faiss' },
    ],
  }, { query: q })
  const excerpts = excerptsFromFind(grouped, {
    results: [
      { node: { id: 'session:session-other:1', content: 'dsh-lan-assist 串仓正文' } },
    ],
  }, q)
  assert.equal(excerpts.length, 0)
  assert.equal(grouped.items.length, 0)
})

test('long recall query keeps the original FAISS hit and drops 稀疏索引', () => {
  const q = '还记得我们讨论过把语义插件做成和人类记忆一样吗'
  const packed = {
    query: q,
    results: [
      {
        node: { id: 'session:later:1', content: `金例 G1 原话：${q} 帮不上忙 验收`, valid_from: '2026-08-30T00:00:00Z' },
        score: 160,
        via: 'corpus',
      },
      {
        node: {
          id: 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440',
          content: '记忆生成、记忆检索、记忆召回以及人类对记忆能力。语义助手还差哪些？',
          valid_from: '2026-08-28T02:59:59Z',
        },
        score: 80,
        via: 'faiss',
      },
      {
        node: { id: 'session:sparse:1', content: '接着给本仓建一份稀疏索引，不再写稠密 FAISS。', valid_from: '2026-08-25T00:00:00Z' },
        score: 160,
        via: 'faiss',
      },
    ],
  }
  const semantic = groupSemanticHits(packed, { query: q, list: { ids: [], byId: {} } })
  assert.equal(semantic.items[0].id.includes('34440'), true)
  assert.equal(semantic.items.some((row) => row.id.includes('sparse')), false)
})

test('人类记忆 keeps 人类对记忆 and drops 稀疏索引', () => {
  const packed = {
    query: '人类记忆',
    results: [
      { node: { id: 'session:sparse:1', content: '接着给本仓建一份稀疏索引' }, via: 'faiss', score: 160 },
      { node: { id: 'session:gold:34440', content: '人类对记忆能力是如何实现和使用的', valid_from: '2026-08-28T02:59:59Z' }, via: 'faiss', score: 80 },
    ],
  }
  const semantic = groupSemanticHits(packed, { query: '人类记忆', list: { ids: [], byId: {} } })
  assert.deepEqual(semantic.items.map((row) => row.id), ['session:gold:34440'])
})

test('工作记忆 keeps scheme session over source file', () => {
  const packed = {
    query: '工作记忆',
    results: [
      { node: { id: 'file:/ws/session-find.js', content: 'TOPIC_RE = /编码|召回|工作记忆/' }, via: 'corpus', score: 200 },
      { node: { id: 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235', content: '工作记忆 | 眼前这几张', valid_from: '2026-08-28T03:00:00Z' }, via: 'faiss', score: 80 },
    ],
  }
  const semantic = groupSemanticHits(packed, { query: '工作记忆', list: { ids: [], byId: {} } })
  assert.equal(semantic.items[0].id, 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235')
})

test('工作记忆 drops 审查仓库 audit prompts', () => {
  const packed = {
    query: '工作记忆',
    results: [
      { node: { id: 'session:audit:1', content: '审查仓库 /Users/zxz/Documents 重点检查 index.js。必须给文件和行号。工作记忆' }, score: 200 },
      { node: { id: 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235', content: '工作记忆 | 眼前这几张', valid_from: '2026-08-28T03:00:00Z' }, score: 80 },
    ],
  }
  const semantic = groupSemanticHits(packed, { query: '工作记忆', list: { ids: [], byId: {} } })
  assert.equal(semantic.items[0].id, 'session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235')
  assert.equal(semantic.items.some((row) => /audit/.test(row.id)), false)
})

test('clock miss is 这一分钟没有', () => {
  const official = groupOfficialSearch({ query: '聊', list, workspaces, content: { status: 'ready', items: [] } })
  const semantic = groupSemanticHits({ query: '聊', results: [] }, { query: '聊', list })
  const composed = composeFindResults(official, semantic, { date: '14:33' })
  assert.equal(composed.semanticEmptyReason, '这一分钟没有')
  assert.equal(composed.excerptEmptyReason, '这一分钟没有')
})
