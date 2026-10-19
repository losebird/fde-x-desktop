import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSecretary } from '../secretary.js'
import { emptyState } from '../store.js'
import { createSemanticBridge, extractUserSpeech, looksLikeChoice, packAdvice, recordArgs } from '../semantic.js'

function memStore() {
  let state = emptyState()
  return {
    async get() { return state },
    async update(fn) {
      await fn(state)
      return state
    },
  }
}

test('choice detector fires on board language only', () => {
  assert.equal(looksLikeChoice('要不要先切 10%'), true)
  assert.equal(looksLikeChoice('能不能发版'), true)
  assert.equal(looksLikeChoice('帮我看看这段日志'), false)
  assert.equal(looksLikeChoice('我们现在语义插件能不能做到记得住，交接得了给新会话？'), false)
  assert.equal(looksLikeChoice('这个是什么意思？我能不能理解成还有bug?'), false)
  assert.equal(looksLikeChoice('别的是另一类，没假装一起没了。这个是什么意思？'), false)
})

test('packAdvice drops graph hits that are not about this sentence', () => {
  const unrelated = packAdvice({
    because: ['session:mcp'],
    evidence: [{ id: 'session:mcp', snippet: '把本机 MCP 探活接到 lookupTodo，票号 PO2024112' }],
  }, '这个是什么意思？我能不能理解成还有bug?')
  assert.equal(unrelated.ready, false)
  assert.equal(unrelated.because.length, 0)
  const related = packAdvice({
    because: ['file:灰度方案'],
    evidence: [{ id: 'file:灰度方案', snippet: '上次先切 10% 用了脚本 X' }],
  }, '要不要先切 10%')
  assert.equal(related.ready, false)
  const chained = packAdvice({
    because: ['decision:gray', 'file:灰度方案'],
    evidence: [{ id: 'file:灰度方案', snippet: '上次先切 10% 用了脚本 X' }],
    precedents: [{ id: 'decision:gray', scenario: '先切 10%', supports: 1, leads_to: 1 }],
  }, '要不要先切 10%')
  assert.equal(chained.ready, true)
  assert.ok(chained.because.includes('decision:gray'))
  const pluginNoise = packAdvice({
    because: ['session:hygiene'],
    evidence: [{ id: 'session:hygiene', snippet: '不要硬编码。语义插件页面按钮按扫描口吐出的动作表渲染' }],
  }, '我们现在语义插件能不能做到记得住，交接得了给新会话？')
  assert.equal(pluginNoise.ready, false)
})

test('packAdvice stays closed without a decision causal chain', () => {
  const chatOnly = packAdvice({
    because: ['session:foo'],
    evidence: [{ id: 'session:foo', snippet: '之前定了哪些事情都进图了' }],
  }, '之前定了哪些事情只会从决策台账查出来是吧')
  assert.equal(chatOnly.ready, false)
  const noChain = packAdvice({
    because: ['decision:gray'],
    evidence: [{ id: 'file:灰度方案', snippet: '上次先切 10%' }],
    precedents: [{ id: 'decision:gray', scenario: '要不要先切 10%', supports: 0, leads_to: 0 }],
  }, '要不要先切 10%')
  assert.equal(noChain.ready, false)
})

test('extractUserSpeech keeps human lines and drops harness noise', () => {
  assert.equal(extractUserSpeech({
    type: 'user/message',
    data: { source: { kind: 'user' }, content: [{ type: 'text', text: '要不要先切 10%' }] },
  }), '要不要先切 10%')
  assert.equal(extractUserSpeech({
    type: 'user/message',
    data: { source: { kind: 'plugin', plugin: 'dsh-lan-assist' }, content: [{ type: 'text', text: '要不要' }] },
  }), '')
  assert.equal(extractUserSpeech({
    type: 'user/message',
    data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Current runtime context. This snapshot' }] },
  }), '')
  assert.equal(extractUserSpeech({ type: 'assistant/message', data: {} }), '')
})

test('recordArgs refuses a board with no because or no leads_to', () => {
  assert.equal(recordArgs({ scenario: '切灰度', because: [], leadsTo: ['sess-1'] }).ok, false)
  assert.equal(recordArgs({ scenario: '切灰度', because: ['n1'], leadsTo: [] }).ok, false)
  const packed = recordArgs({
    scenario: '切灰度',
    because: ['n1', 'n1'],
    leadsTo: ['req_1', 'sess-1'],
    actor: 'Ace',
  })
  assert.equal(packed.ok, true)
  assert.deepEqual(packed.args.because, ['n1'])
  assert.deepEqual(packed.args.leads_to, ['req_1', 'sess-1'])
})

test('secretary opens advice from a brief and records causal edges on confirm', async () => {
  const calls = []
  const A = createSecretary({
    store: memStore(),
    now: () => 1_700_000_000_000,
    send: async () => ({ ok: false }),
    looksLikeChoice,
    brief: async (sessionId, scenario) => {
      calls.push(['brief', sessionId, scenario])
      return {
        ok: true,
        cwd: '/tmp/ws',
        advice: packAdvice({
          because: ['file:灰度方案', 'decision:上次回滚'],
          evidence: [{ id: 'file:灰度方案', snippet: '上次先切 10% 回滚用了脚本 X' }],
          precedents: [{ id: 'decision:上次回滚', scenario: '先切 10%', supports: 1, leads_to: 1 }],
        }, scenario),
      }
    },
    record: async (sessionId, payload) => {
      calls.push(['record', payload])
      const packed = recordArgs(payload)
      assert.equal(packed.ok, true)
      assert.ok(packed.args.because.length)
      assert.ok(packed.args.leads_to.length)
      return { ok: true, decisionId: 'dec-1', causal: { supports: packed.args.because.length, leads_to: packed.args.leads_to.length } }
    },
  })
  await A.setDisplayName('Ace')
  const considered = await A.considerAdvice({
    sessionId: 'sess-gray',
    scenario: '要不要先切 10%',
    requestId: 'req_gray',
  })
  assert.equal(considered.ok, true)
  const dock = await A.dock('sess-gray')
  assert.equal(dock.mode, 'advice')
  assert.match(dock.speak, /图里/)
  const confirmed = await A.confirmAdvice()
  assert.equal(confirmed.ok, true)
  assert.equal(confirmed.decisionId, 'dec-1')
  assert.equal(confirmed.causal.supports, 2)
  assert.equal(confirmed.causal.leads_to, 2)
  const after = await A.dock('sess-gray')
  assert.equal(after, null)
  assert.equal(calls.filter((row) => row[0] === 'record').length, 1)
})

test('hearUserLine skips chatter, sleep, and duplicates without briefing', async () => {
  let briefs = 0
  const A = createSecretary({
    store: memStore(),
    now: () => 2,
    send: async () => ({ ok: false }),
    looksLikeChoice,
    brief: async () => {
      briefs += 1
      return {
        ok: true,
        cwd: '/tmp/ws',
        advice: packAdvice({
          because: ['decision:ship'],
          evidence: [{ id: 'n1', snippet: '上次要不要发版' }],
          precedents: [{ id: 'decision:ship', scenario: '要不要发版', supports: 1, leads_to: 1 }],
        }, '要不要发'),
      }
    },
  })
  assert.equal((await A.hearUserLine('s1', '帮我看看这段日志')).skipped, 'not_choice')
  assert.equal((await A.hearUserLine('s1', '这个是什么意思？我能不能理解成还有bug?')).skipped, 'not_choice')
  await A.setAsleep(true)
  assert.equal((await A.hearUserLine('s1', '要不要发版')).skipped, 'asleep')
  await A.setAsleep(false)
  const first = await A.hearUserLine('s1', '要不要发版')
  assert.equal(first.ok, true)
  assert.equal(briefs, 1)
  assert.equal((await A.hearUserLine('s1', '要不要发版')).skipped, 'dup')
  assert.equal(briefs, 1)
})

test('vocab reads skos kinds from the letter workspace', async () => {
  const calls = []
  const bridge = createSemanticBridge({
    resolveCwd: async () => '/open/dsh-lan-assist',
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/ready')) return { ok: true, json: async () => ({ ready: true }) }
      const body = JSON.parse(init.body)
      calls.push([url, body.op, body.cwd, init.headers['x-dsh-cwd'], body.args && body.args.type, init.headers.origin || init.headers.Origin])
      return {
        ok: true,
        json: async () => ({
          nodes: [{
            type: 'skos:Concept',
            properties: { content: '客户', fields: ['单号', '状态'], can: ['现查'] },
          }],
        }),
      }
    },
  })
  const found = await bridge.vocab('/mail/nocobase-test')
  assert.equal(found.ok, true)
  assert.equal(found.cwd, '/mail/nocobase-test')
  assert.deepEqual(found.kinds, [{ kind: '客户', fields: ['单号', '状态'], can: ['现查'] }])
  assert.deepEqual(calls, [['http://127.0.0.1:3080/semantic-os/python', 'list_graph_nodes', '/mail/nocobase-test', '/mail/nocobase-test', 'skos:Concept', 'http://127.0.0.1:3080']])
})

test('vocab does not treat a forbidden semantic POST as an empty kind list', async () => {
  const bridge = createSemanticBridge({
    fetchImpl: async (url) => {
      if (String(url).endsWith('/ready')) return { ok: true, json: async () => ({ ready: true }) }
      return { ok: false, status: 403, json: async () => ({ ok: false, error: 'forbidden' }) }
    },
  })
  const found = await bridge.vocab('/Users/zxz/Documents/ai-project/nocobase-test')
  assert.equal(found.ok, false)
  assert.equal(found.error, 'forbidden')
  assert.deepEqual(found.kinds, [])
})

test('brief prefers the letter workspace over the open session', async () => {
  const calls = []
  const bridge = createSemanticBridge({
    resolveCwd: async (sessionId) => {
      calls.push(['resolve', sessionId])
      return '/open/dsh-lan-assist'
    },
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/ready')) return { ok: true, json: async () => ({ ready: true }) }
      const body = JSON.parse(init.body)
      calls.push(['python', body.cwd, init.headers['x-dsh-cwd']])
      return {
        ok: true,
        json: async () => ({ because: ['n1'], evidence: [{ id: 'n1', snippet: '依据' }] }),
      }
    },
  })
  const found = await bridge.brief('sess-open', '要不要过 PO-12', '/mail/dsh-eyes')
  assert.equal(found.ok, true)
  assert.equal(found.cwd, '/mail/dsh-eyes')
  assert.deepEqual(calls, [['python', '/mail/dsh-eyes', '/mail/dsh-eyes']])
})

test('confirm without because never calls record', async () => {
  let recorded = 0
  const A = createSecretary({
    store: memStore(),
    now: () => 1,
    send: async () => ({ ok: false }),
    brief: async () => ({ ok: false, error: 'EMPTY', advice: packAdvice(null, 'x') }),
    record: async () => { recorded += 1; return { ok: true } },
  })
  const considered = await A.considerAdvice({ sessionId: 's', scenario: '要不要发' })
  assert.equal(considered.ok, false)
  const confirmed = await A.confirmAdvice()
  assert.equal(confirmed.ok, false)
  assert.equal(recorded, 0)
})

test('ingestPaths uses semantic ingest start, not python vocab', async () => {
  const hits = []
  const bridge = createSemanticBridge({
    origin: 'http://127.0.0.1:3080',
    fetchImpl: async (url, opts) => {
      hits.push(String(url))
      if (String(url).endsWith('/semantic-os/ready')) {
        return { ok: true, json: async () => ({ ready: true }) }
      }
      return { ok: true, json: async () => ({ ok: true, state: 'queued' }) }
    },
  })
  const miss = await bridge.ingestPaths('/ws', [])
  assert.equal(miss.error, 'NO_PATHS')
  const got = await bridge.ingestPaths('/ws', ['.dsh/lan-assist/mail.projection.md'])
  assert.equal(got.ok, true)
  assert.equal(hits.some((row) => row.includes('/semantic-os/ingest/start')), true)
  assert.equal(hits.some((row) => row.includes('/semantic-os/python')), false)
})
