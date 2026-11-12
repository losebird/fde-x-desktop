import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createFirstTurnCache,
  firstHumanSpeech,
  flipFirstTurn,
  formatHandoff,
  installFirstTurn,
  isInjectedUserSpeech,
  needsSearch,
  normalizeFirstTurnSpeech,
  parseSearchHits,
  resolveFirstTurnSpeech,
  routeIntent,
  speechFromUserMessage,
} from '../first-turn.js'

test('routeIntent matches the python keyword table', () => {
  assert.deepEqual(routeIntent('PO-12 出自哪次会话'), { intent: '出处', tool: 'lineage' })
  assert.deepEqual(routeIntent('要不要过 PO-12'), { intent: '拍板', tool: 'find_precedents' })
  assert.deepEqual(routeIntent('帮我把 PO-12 过账'), { intent: '业务动作', tool: 'brief_for_decision' })
  assert.deepEqual(routeIntent('哈哈随便聊聊'), { intent: '闲聊', tool: '' })
  assert.deepEqual(routeIntent('这个项目里上次怎么定的'), { intent: '查询', tool: 'search_text' })
  assert.deepEqual(routeIntent('之前定了哪些事情'), { intent: '查询', tool: 'search_text' })
  assert.deepEqual(routeIntent('过账试探当时怎么记的'), { intent: '查询', tool: 'search_text' })
  assert.equal(needsSearch('查询'), true)
  assert.equal(needsSearch('拍板'), false)
  assert.equal(needsSearch('闲聊'), false)
})

test('拍板 first-turn names find_precedents and does not search_text', async () => {
  let n = 0
  const flipped = await flipFirstTurn({
    text: '要不要过 PO-12',
    search: async () => {
      n += 1
      return { results: [{ node: { id: 'session:x:1', content: 'should not run' } }] }
    },
  })
  assert.equal(flipped.intent, '拍板')
  assert.equal(flipped.tool, 'find_precedents')
  assert.equal(n, 0)
  assert.deepEqual(flipped.hits, [])
})

test('firstHumanSpeech only when exactly one human line', () => {
  const user = (text) => ({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } })
  assert.equal(firstHumanSpeech([user('接着上次')]), '接着上次')
  assert.equal(firstHumanSpeech([user('一'), user('二')]), '')
  assert.equal(firstHumanSpeech([{ type: 'user/message', data: { source: { plugin: 'x' }, content: [{ type: 'text', text: '要不要' }] } }]), '')
})

test('firstHumanSpeech ignores Host runtime injects and strips /iui', () => {
  const user = (text) => ({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } })
  assert.equal(isInjectedUserSpeech('Current runtime context. This snapshot supersedes'), true)
  assert.equal(isInjectedUserSpeech('<system-reminder> A skill is'), true)
  assert.equal(normalizeFirstTurnSpeech('/iui 昨天下午聊了啥'), '昨天下午聊了啥')
  assert.equal(firstHumanSpeech([
    user('/iui 昨天下午聊了啥'),
    user('Current runtime context. This snapshot supersedes earlier runtime-context snapshots.'),
    user('<system-reminder> A skill is a reusable set of task-specific instructions.'),
  ]), '昨天下午聊了啥')
  assert.deepEqual(routeIntent('昨天下午聊了啥'), { intent: '查询', tool: 'search_text' })
})

test('assemble reads Host session.eventAt instead of a missing events array', async () => {
  const listeners = {}
  const ctx = { on(name, fn) { listeners[name] = fn } }
  let searched = 0
  installFirstTurn(ctx, {
    search: async (text) => {
      searched += 1
      assert.equal(text, '昨天上午我们聊了哪些事情？')
      return { results: [{ node: { id: 'session:old:4', content: '上午那句' } }] }
    },
  })
  const events = [
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '昨天上午我们聊了哪些事情？' }] } },
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.' }] } },
  ]
  const session = {
    id: 'sess-host',
    header: { id: 'sess-host', cwd: '/ws' },
    seq: events.length,
    eventAt(index) { return events[index] },
  }
  const assembled = await listeners['system-prompt/assemble'](
    { sections: [] },
    { agent: { session } },
    async () => ({ sections: [] }),
  )
  assert.equal(searched, 1)
  const card = assembled.sections.find((row) => row.name === 'tool:dsh-semantic-os-first-turn')
  assert.match(card.text, /上午那句/)
})

test('installFirstTurn injects a Host search receipt on assemble', async () => {
  const listeners = {}
  const ctx = {
    on(name, fn) {
      listeners[name] = fn
    },
  }
  let searched = 0
  installFirstTurn(ctx, {
    search: async (text) => {
      searched += 1
      assert.equal(text, '昨天下午聊了啥')
      return { results: [{ node: { id: 'session:old:3', content: '采购订单核验' } }] }
    },
  })
  const session = { id: 'sess-new', header: { cwd: '/ws' } }
  listeners['session/event'](session, {
    type: 'user/message',
    data: { source: { kind: 'user' }, content: [{ type: 'text', text: '昨天下午聊了啥' }] },
  })
  const assembled = await listeners['system-prompt/assemble'](
    { sections: [] },
    { agent: { session }, session },
    async () => ({ sections: [{ name: 'base', text: 'x' }] }),
  )
  assert.equal(searched, 1)
  const card = assembled.sections.find((row) => row.name === 'tool:dsh-semantic-os-first-turn')
  assert.ok(card)
  assert.match(card.text, /Host 已代调/)
  assert.match(card.text, /search_text/)
  assert.match(card.text, /采购订单核验/)
})

test('formatHandoff stays a small tool receipt', () => {
  const card = formatHandoff({
    intent: '查询',
    tool: 'search_text',
    sessionId: 's1',
    hits: [{ node: { id: 'session:s1:1', content: '人类记忆那句' }, then: { label: '当时 · 2026-08-28' } }],
  })
  assert.match(card, /Host 已代调/)
  assert.match(card, /intent: 查询/)
  assert.match(card, /session:s1:1/)
  assert.ok(card.length < 1600)
})

test('cache flips once and skips search on 闲聊', async () => {
  let n = 0
  const cache = createFirstTurnCache()
  const search = async () => {
    n += 1
    return { results: [{ node: { id: 'session:x:1', content: 'hit' } }] }
  }
  const chat = await cache.ensure('s1', '哈哈随便聊聊', search)
  assert.match(chat, /闲聊/)
  assert.equal(n, 0)
  const query = await cache.ensure('s2', '这个项目里上次怎么定的', search)
  assert.match(query, /查询/)
  assert.match(query, /session:x:1/)
  assert.equal(n, 1)
  await cache.ensure('s2', '这个项目里上次怎么定的', search)
  assert.equal(n, 1)
})

test('parseSearchHits ignores sidecar errors', () => {
  assert.deepEqual(parseSearchHits({ error: 'SIDECAR_TIMEOUT', results: [{ node: { id: 'x' } }] }), [])
  assert.equal(parseSearchHits('{"results":[{"node":{"id":"a","content":"b"}}]}').length, 1)
})

test('ensure waits for in-flight search instead of returning empty', async () => {
  const cache = createFirstTurnCache()
  let release
  const search = () => new Promise((resolve) => {
    release = () => resolve({ results: [{ node: { id: 'session:x:1', content: 'hit' } }] })
  })
  const first = cache.ensure('s1', '这个项目里上次怎么定的', search)
  const second = cache.ensure('s1', '这个项目里上次怎么定的', search)
  release()
  const [a, b] = await Promise.all([first, second])
  assert.match(a, /Host 已代调/)
  assert.match(b, /Host 已代调/)
  assert.match(b, /session:x:1/)
})

test('BFF Host path installs first-turn and keeps session persistence for search', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const bridge = readFileSync(join(here, '../../../fde-x-dsh-bridge/lib/index.js'), 'utf8')
  assert.match(bridge, /installFirstTurn/)
  assert.match(bridge, /runHostSearch/)
  assert.match(bridge, /adaptSessionPersistence/)
  const index = readFileSync(join(here, '../index.js'), 'utf8')
  assert.match(index, /installFirstTurn/)
})

test('inbox UserMessage speech is used when session log is still empty', async () => {
  const cache = createFirstTurnCache()
  const search = async () => ({ results: [{ node: { id: 'session:s:1', content: '第2刀 Host 代调' } }] })
  const message = {
    source: { kind: 'user' },
    content: [{ type: 'text', text: '这个项目里上次是怎么定的？' }],
  }
  assert.equal(speechFromUserMessage(message), '这个项目里上次是怎么定的？')
  assert.equal(speechFromUserMessage({ source: { kind: 'plugin', plugin: 'x' }, content: [{ type: 'text', text: 'runtime' }] }), '')
  assert.equal(firstHumanSpeech([]), '')
  cache.noteSpeech('s1', speechFromUserMessage(message))
  const speech = resolveFirstTurnSpeech({ events: [], remembered: cache.speechOf('s1') })
  const card = await cache.ensure('s1', speech, search)
  assert.match(card, /第2刀 Host 代调/)
})
