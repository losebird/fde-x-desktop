import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createFirstTurnCache,
  firstHumanSpeech,
  formatHandoff,
  needsSearch,
  parseSearchHits,
  resolveFirstTurnSpeech,
  routeIntent,
  speechFromUserMessage,
} from '../first-turn.js'

test('routeIntent matches the python keyword table', () => {
  assert.deepEqual(routeIntent('PO-12 出自哪次会话'), { intent: '出处', tool: 'lineage' })
  assert.deepEqual(routeIntent('要不要过 PO-12'), { intent: '拍板', tool: 'brief_for_decision' })
  assert.deepEqual(routeIntent('帮我把 PO-12 过账'), { intent: '业务动作', tool: 'brief_for_decision' })
  assert.deepEqual(routeIntent('哈哈随便聊聊'), { intent: '闲聊', tool: '' })
  assert.deepEqual(routeIntent('这个项目里上次怎么定的'), { intent: '查询', tool: 'search_text' })
  assert.deepEqual(routeIntent('之前定了哪些事情'), { intent: '查询', tool: 'search_text' })
  assert.deepEqual(routeIntent('过账试探当时怎么记的'), { intent: '查询', tool: 'search_text' })
  assert.equal(needsSearch('查询'), true)
  assert.equal(needsSearch('拍板'), false)
  assert.equal(needsSearch('闲聊'), false)
})

test('firstHumanSpeech only when exactly one human line', () => {
  const user = (text) => ({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } })
  assert.equal(firstHumanSpeech([user('接着上次')]), '接着上次')
  assert.equal(firstHumanSpeech([user('一'), user('二')]), '')
  assert.equal(firstHumanSpeech([{ type: 'user/message', data: { source: { plugin: 'x' }, content: [{ type: 'text', text: '要不要' }] } }]), '')
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
