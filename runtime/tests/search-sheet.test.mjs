import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KIND_CAP,
  collectFileHits,
  loadSearchSheet,
  searchSheet,
} from '../search/search-sheet.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function kindsOf(sheet) {
  return sheet.hits.map((hit) => hit.kind)
}

test('empty query is a jump sheet: pages contacts groups agents recent sessions, no files', () => {
  const sheet = searchSheet({
    cwd: '/ws/a',
    query: '',
    sessions: [
      { sessionId: 's1', title: '停用客户未关工单查询', cwd: '/ws/a', updatedAt: 30 },
      { sessionId: 's0', title: '更早', cwd: '/ws/a', updatedAt: 10 },
      { sessionId: 'other', title: '别的目录', cwd: '/ws/b', updatedAt: 99 },
    ],
    mailbox: {
      self: { id: 'me' },
      peers: [{ id: 'p1', displayName: '林督', door: '127.0.0.1:19021' }],
      groups: [{ id: 'g1', name: '话题群' }],
    },
    presets: [{ id: 'std', name: '标准模式', description: '编码 Agent' }],
    files: [{ kind: 'file', id: 'noise.png', title: 'noise.png', href: { panel: 'files', path: 'noise.png' }, score: 1 }],
  })
  assert.ok(kindsOf(sheet).includes('page'))
  assert.ok(sheet.hits.some((hit) => hit.kind === 'contact' && hit.id === 'p1' && hit.href.peerId === 'p1'))
  assert.ok(sheet.hits.some((hit) => hit.kind === 'group' && hit.href.groupId === 'g1'))
  assert.ok(sheet.hits.some((hit) => hit.kind === 'agent' && hit.href.agentId === 'std'))
  assert.ok(sheet.hits.some((hit) => hit.kind === 'session' && hit.id === 's1' && hit.href.sessionId === 's1'))
  assert.equal(sheet.hits.some((hit) => hit.kind === 'session' && hit.id === 'other'), false)
  assert.equal(sheet.hits.some((hit) => hit.kind === 'file'), false)
  assert.equal(sheet.hits.some((hit) => hit.kind === 'letter'), false)
})

test('query classifies session titles and session: find rows as session, not memory', () => {
  const sheet = searchSheet({
    cwd: '/ws/a',
    query: '停用',
    sessions: [
      { sessionId: 'sess-1', title: '停用客户未关工单查询', cwd: '/ws/a', updatedAt: 2 },
    ],
    find: {
      items: [
        { id: 'session:sess-1:3', snippet: '目录里有客户和工单。接着现查停用客户' },
        { id: 'mem-9', snippet: '词表停用字段', title: '记忆卡' },
      ],
    },
  })
  const sessions = sheet.hits.filter((hit) => hit.kind === 'session')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].id, 'sess-1')
  assert.equal(sessions[0].href.sessionId, 'sess-1')
  assert.match(sessions[0].hint || sessions[0].title, /停用/)
  const memory = sheet.hits.filter((hit) => hit.kind === 'memory')
  assert.equal(memory.length, 1)
  assert.equal(memory[0].id, 'mem-9')
  assert.equal(memory[0].href.panel, 'memory')
  assert.equal(memory[0].href.pane, 'explore')
})

test('memory hits land on archive; same-origin FAISS prefers the card', () => {
  const sheet = searchSheet({
    cwd: '/ws/a',
    query: '过账',
    find: {
      items: [
        { id: 'biz:trace_1', snippet: '过账摘录' },
        { id: 'memory:ab12cd34', snippet: '过账卡片' },
      ],
    },
    cards: [{ id: 'memory:ab12cd34', properties: { origin: 'biz:trace_1' } }],
  })
  const memory = sheet.hits.filter((hit) => hit.kind === 'memory')
  assert.equal(memory.length, 1)
  assert.equal(memory[0].id, 'memory:ab12cd34')
  assert.equal(memory[0].href.pane, 'cards')
  assert.equal(memory[0].href.cardId, 'memory:ab12cd34')
})

test('letter hits current home and unassigned; skips other cwd', () => {
  const sheet = searchSheet({
    cwd: '/ws/a',
    query: '恒通',
    mailbox: {
      self: { id: 'me' },
      requests: [
        { id: 'r1', from: 'p1', fromName: '林督', to: ['me'], body: '恒通客户停用了', workspace: '/ws/a' },
        { id: 'r2', from: 'p1', fromName: '林督', to: ['me'], body: '恒通在别的区', workspace: '/ws/b' },
        { id: 'r3', from: 'p2', fromName: '测试甲', to: ['me'], excerpt: '看看恒通', workspace: '' },
      ],
    },
    localCwds: ['/ws/a', '/ws/b'],
  })
  const letters = sheet.hits.filter((hit) => hit.kind === 'letter')
  assert.deepEqual(letters.map((hit) => hit.id).sort(), ['r1', 'r3'])
  assert.equal(letters[0].href.panel, 'im')
  assert.ok(letters.find((hit) => hit.id === 'r1').href.peerId === 'p1')
})

test('file hits are ranked then capped; nested path matches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-search-'))
  await mkdir(join(root, 'docs', 'inner'), { recursive: true })
  await writeFile(join(root, 'noise.png'), 'x')
  await writeFile(join(root, 'FDE-X-PRODUCTION-SPEC.md'), 'spec')
  await writeFile(join(root, 'docs', 'inner', 'fde-notes.md'), 'notes')
  const files = await collectFileHits(root, 'fde', { budgetMs: 2000, ignoreNames: new Set(['.git', 'node_modules']) })
  const sheet = searchSheet({ cwd: root, query: 'fde', files })
  const paths = sheet.hits.filter((hit) => hit.kind === 'file').map((hit) => hit.href.path)
  assert.ok(paths.includes('FDE-X-PRODUCTION-SPEC.md'))
  assert.ok(paths.includes('docs/inner/fde-notes.md'))
  assert.equal(paths.includes('noise.png'), false)
})

test('per-kind cap applies after score, not directory order', () => {
  const files = Array.from({ length: KIND_CAP + 4 }, (_, i) => ({
    kind: 'file',
    id: `f${i}.txt`,
    title: i === 0 ? 'alpha-target.txt' : `zzzz-${i}.txt`,
    href: { panel: 'files', path: i === 0 ? 'deep/alpha-target.txt' : `zzzz-${i}.txt` },
    score: i === 0 ? 100 : 10,
  }))
  const sheet = searchSheet({ cwd: '/ws/a', query: 'txt', files })
  const hits = sheet.hits.filter((hit) => hit.kind === 'file')
  assert.equal(hits.length, KIND_CAP)
  assert.equal(hits[0].id, 'f0.txt')
})

test('loadSearchSheet swallows a dead host and still returns pages', async () => {
  const sheet = await loadSearchSheet({
    aiRuntime: {
      status: () => ({ connected: true }),
      call: async () => { throw new Error('down') },
      lanAssist: async () => { throw new Error('down') },
      semanticOs: async () => { throw new Error('down') },
      stream: async function* () { throw new Error('down') },
    },
    db: null,
    collectFileHits: async () => [],
  }, { cwd: '/ws/a', query: '' })
  assert.ok(sheet.hits.some((hit) => hit.kind === 'page' && hit.id === 'p_ai'))
})

test('GET /api/v1/search is the only palette mouth; compositor mouths are gone', async () => {
  const server = await readFile(join(repoRoot, 'runtime/server.mjs'), 'utf8')
  const palette = await readFile(join(repoRoot, 'src/components/CommandPalette.tsx'), 'utf8')
  const api = await readFile(join(repoRoot, 'src/lib/runtime-api.ts'), 'utf8')
  assert.match(server, /handleSearchRoute/)
  assert.match(api, /\/api\/v1\/search/)
  assert.match(palette, /runtimeApi\.search\(/)
  assert.doesNotMatch(palette, /listWorkspaceFiles/)
  assert.doesNotMatch(palette, /searchMemory/)
  assert.doesNotMatch(palette, /imState\(/)
  assert.doesNotMatch(palette, /listAiPresets/)
  assert.doesNotMatch(palette, /useCurrentTasks/)
  assert.doesNotMatch(palette, /useCurrentWorkflows/)
  assert.doesNotMatch(palette, /loadCurrentAiTarget/)
})
