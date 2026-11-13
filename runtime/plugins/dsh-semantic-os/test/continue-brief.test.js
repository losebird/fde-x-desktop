import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CORE_BRIEF_CAP,
  clipBrief,
  fetchFiledRules,
  fetchOpenTodos,
  fillSessionTitles,
  pickFiledRules,
  formatCoreBrief,
  isContinueQuery,
  mergeSessionLists,
  pickLastSession,
  rewriteContinueQuery,
  sessionTitleOf,
} from '../continue-brief.js'
import { installFirstTurn } from '../first-turn.js'

test('continue query matches 继续处理', () => {
  assert.equal(isContinueQuery('继续处理'), true)
  assert.equal(isContinueQuery('接着干'), true)
  assert.equal(isContinueQuery('昨天下午聊了啥'), false)
})

test('pickLastSession skips briefing and the current session', () => {
  const last = pickLastSession([
    { id: 'sess-now', cwd: '/ws', title: '现在', updatedAt: 9, lastPromptAt: 9 },
    { id: 'brief-old', cwd: '/ws', title: '早报', agentPreset: 'fde-briefing', updatedAt: 8, lastPromptAt: 8 },
    { id: 'sess-work', cwd: '/ws', title: '采购订单核验', updatedAt: 7, lastPromptAt: 7 },
    { id: 'empty', cwd: '/ws', updatedAt: 6 },
  ], { cwd: '/ws', currentId: 'sess-now' })
  assert.equal(last.id, 'sess-work')
  assert.equal(last.title, '采购订单核验')
})

test('pickLastSession skips probe titles even when they are newest', () => {
  const last = pickLastSession([
    { id: 'sess-now', cwd: '/ws', title: '现在', updatedAt: 20 },
    { id: 'probe', cwd: '/ws', title: 'Work on INGESTOBS-20261113 ticket', updatedAt: 19 },
    { id: 'work', cwd: '/ws', title: '继续处理未完成的任务', updatedAt: 18 },
  ], { cwd: '/ws', currentId: 'sess-now' })
  assert.equal(last.id, 'work')
})

test('pickLastSession prefers a session related to open todos', () => {
  const last = pickLastSession([
    { id: 'sess-now', cwd: '/ws', title: '现在', updatedAt: 20 },
    { id: 'chat', cwd: '/ws', title: '随便聊', updatedAt: 19 },
    { id: 'po', cwd: '/ws', title: '采购订单核验', updatedAt: 10 },
  ], {
    cwd: '/ws',
    currentId: 'sess-now',
    todos: [{ title: '采购订单核验：PO-20261112 到货数量对发票' }],
  })
  assert.equal(last.id, 'po')
})

test('pickLastSession keeps a persistence header that only has updatedAt', () => {
  const last = pickLastSession([
    { id: 'sess-now', cwd: '/ws', createdAt: 9, updatedAt: 9 },
    { id: 'sess-old', cwd: '/ws', createdAt: 7, updatedAt: 8 },
  ], { cwd: '/ws', currentId: 'sess-now' })
  assert.equal(last.id, 'sess-old')
})

test('mergeSessionLists prefers a live projection title', () => {
  const merged = mergeSessionLists(
    [{ id: 'sess-old', cwd: '/ws', createdAt: 7, updatedAt: 8 }],
    [{
      id: 'sess-old',
      header: { id: 'sess-old', cwd: '/ws', agentPreset: 'standard' },
      projections: { values: { title: { val: '昨天未完成的事' } } },
    }],
    '/ws',
  )
  const last = pickLastSession(merged, { cwd: '/ws', currentId: 'sess-now' })
  assert.equal(last.title, '昨天未完成的事')
})

test('sessionTitleOf unwraps projcache record.rows.title', () => {
  assert.equal(sessionTitleOf({
    record: { rows: { title: { ver: 1, seq: 172, val: '继续处理会话' } } },
  }), '继续处理会话')
})

test('fillSessionTitles reads projcache when list() has no title', async () => {
  const reads = []
  const rows = await fillSessionTitles(
    [{ id: 'session-ee2a141c-25fd-4caf-92f9-6016e957b3ee', cwd: '/ws', updatedAt: 8 }],
    {
      env: { DSH_HOME: '/dsh-home' },
      readFile: async (path) => {
        reads.push(path)
        return JSON.stringify({
          version: 1,
          record: { rows: { title: { ver: 1, seq: 172, val: '继续处理会话' } } },
        })
      },
    },
  )
  assert.equal(reads[0], '/dsh-home/storages/session_projcache/sessions/session-ee2a141c-25fd-4caf-92f9-6016e957b3ee.json')
  assert.equal(rows[0].title, '继续处理会话')
  const last = pickLastSession(rows, { cwd: '/ws', currentId: 'sess-now' })
  assert.equal(last.title, '继续处理会话')
})

test('core brief stays under the cap', () => {
  const text = formatCoreBrief({
    cwd: '/Users/zxz/Documents/ai-project/fdex测试',
    lastSession: { id: 's1', title: '采购订单核验' },
    todos: [{ title: '补开票' }, { title: '对账' }, { title: '发货' }, { title: '多余' }],
  })
  assert.ok(text.length <= CORE_BRIEF_CAP)
  assert.match(text, /工作区 fdex测试/)
  assert.match(text, /最近一场 采购订单核验/)
  assert.match(text, /未完成 补开票；对账；发货/)
  assert.doesNotMatch(text, /多余/)
  assert.match(text, /桥接 无（只续本工作区）/)
  const bridged = formatCoreBrief({
    cwd: '/ws/a',
    lastSession: { title: '核验' },
    todos: [],
    peers: ['/other/proj-b', '/other/proj-c', '/other/proj-d'],
  })
  assert.match(bridged, /桥接 3（proj-b；proj-c…）/)
  assert.ok(bridged.length <= CORE_BRIEF_CAP)
  assert.equal(clipBrief('abcdefghij', 8).endsWith('…'), true)
})

test('continue rewrite uses last title instead of 继续处理', () => {
  assert.equal(rewriteContinueQuery('继续处理', {
    lastSession: { title: '采购订单核验' },
    todos: [{ title: '补开票' }],
  }), '采购订单核验 补开票')
  assert.equal(rewriteContinueQuery('昨天下午聊了啥', { lastSession: { title: 'x' } }), '昨天下午聊了啥')
  assert.equal(rewriteContinueQuery('接着干', {}), '未完成 待办')
  assert.equal(rewriteContinueQuery('继续处理', { lastSession: { id: 'session-abc' } }), 'session-abc')
})

test('fetchOpenTodos reads todo and doing titles from the plan API', async () => {
  const calls = []
  const rows = await fetchOpenTodos('/ws/a', {
    env: { FDE_RUNTIME_PORT: '54765', FDE_DSH_HOME: '/tmp/mem-home' },
    readFile: async (path) => {
      assert.match(path, /\.ui-token$/)
      return 'tok\n'
    },
    fetch: async (href, init) => {
      calls.push({ href, init })
      return {
        ok: true,
        json: async () => ({ data: [
          { title: '补开票', status: 'todo' },
          { title: '对账', status: 'doing' },
          { title: '已完成', status: 'done' },
        ] }),
      }
    },
  })
  assert.equal(calls[0].href.includes('workspace=%2Fws%2Fa'), true)
  assert.equal(calls[0].init.headers['x-fde-ui-token'], 'tok')
  assert.deepEqual(rows.map((row) => row.title), ['补开票', '对账'])
})

test('pickFiledRules keeps 已入档 cues and drops drafts', () => {
  const rows = pickFiledRules([
    { id: 'memory:draft', status: '起草', label: '规则：还没点头' },
    { id: 'memory:dead', status: '已入档', current: false, label: '规则：已过期' },
    { id: 'memory:a', status: '已入档', label: '规则：单号无连字符\n怎么知道：session:x' },
    { id: 'memory:b', status: '已入档', label: '发票型无数量列' },
    { id: 'memory:c', status: '已停用', label: '规则：停用' },
  ])
  assert.deepEqual(rows.map((row) => row.id), ['memory:a', 'memory:b'])
  assert.equal(rows[0].label, '单号无连字符')
})

test('pickFiledRules ranks PO work over SCANFILE/AUTOFILE probes', () => {
  const rows = pickFiledRules([
    { id: 'memory:scan', status: '已入档', body: '规则：回扫升格探针 SCANFILE-20261113 按现况重核。' },
    { id: 'memory:auto', status: '已入档', body: '规则：目录已对齐。AUTOFILE-LOW-20261113 按现况重核。' },
    { id: 'memory:ix', status: '已入档', body: '规则：PO-20261112 案卷\n怎么知道：memory:po' },
    { id: 'memory:po', status: '已入档', body: '规则：PO-20261112 到货对发票：现况未读到该采购单，未放行\n怎么知道：session:s1' },
  ], { lastTitle: '继续处理先前任务', todos: [{ title: '采购订单核验：PO-20261112 到货数量对发票' }] })
  assert.deepEqual(rows.map((row) => row.id), ['memory:ix', 'memory:po', 'memory:scan'])
  assert.match(rows[0].label, /PO-20261112 案卷/)
  assert.match(rows[1].label, /未放行/)
})

test('pickFiledRules prefers 规则： from body over origin-polluted label', () => {
  const rows = pickFiledRules([{
    id: 'memory:ok',
    status: '已入档',
    label: '继续处理 先记下缺口，单号补齐后再对数量',
    body: '规则：PO-20261112 到货对发票：现况未读到该采购单\n怎么知道：session:s1',
  }])
  assert.equal(rows[0].label, 'PO-20261112 到货对发票：现况未读到该采购单')
})

test('fetchFiledRules reads 已入档 from the memory API', async () => {
  const calls = []
  const rows = await fetchFiledRules('/ws/a', {
    env: { FDE_RUNTIME_PORT: '54765', FDE_DSH_HOME: '/tmp/mem-home' },
    readFile: async () => 'tok\n',
    fetch: async (href, init) => {
      calls.push({ href, init })
      return {
        ok: true,
        json: async () => ({
          data: {
            cards: [
              { id: 'memory:draft', status: '起草', label: '规则：待审' },
              { id: 'memory:ok', status: '已入档', label: '规则：发票无数量列' },
            ],
          },
        }),
      }
    },
  })
  assert.equal(calls[0].href.includes('cwd=%2Fws%2Fa'), true)
  assert.equal(calls[0].href.includes('include_filed=true'), true)
  assert.equal(calls[0].init.headers['x-fde-ui-token'], 'tok')
  assert.deepEqual(rows, [{ id: 'memory:ok', label: '发票无数量列' }])
})

test('installFirstTurn injects a capped continue brief and rewrites continue search', async () => {
  const listeners = {}
  const ctx = { on(name, fn) { listeners[name] = fn } }
  const searched = []
  installFirstTurn(ctx, {
    search: async (text) => {
      searched.push(text)
      return { results: [{ node: { id: 'session:old:1', content: '采购核验未完成' } }] }
    },
    listSessions: async () => [
      { id: 'sess-now', cwd: '/ws', title: '新窗口', updatedAt: 2, lastPromptAt: 2 },
      { id: 'sess-old', cwd: '/ws', title: '采购订单核验', updatedAt: 1, lastPromptAt: 1 },
    ],
    listTodos: async () => [{ title: '补开票' }],
    listBridgePeers: async () => ['/other/ledger'],
    listFiledRules: async () => [{ id: 'memory:ok', label: '发票型无数量列' }],
  })
  const session = { id: 'sess-now', header: { cwd: '/ws', id: 'sess-now' } }
  listeners['session/event'](session, {
    type: 'user/message',
    data: { source: { kind: 'user' }, content: [{ type: 'text', text: '继续处理' }] },
  })
  const assembled = await listeners['system-prompt/assemble'](
    { sections: [] },
    { agent: { session } },
    async () => ({ sections: [] }),
  )
  const core = assembled.sections.find((row) => row.name === 'tool:dsh-semantic-os-continue')
  const card = assembled.sections.find((row) => row.name === 'tool:dsh-semantic-os-first-turn')
  assert.ok(core)
  assert.ok(core.text.length <= CORE_BRIEF_CAP)
  assert.match(core.text, /最近一场 采购订单核验/)
  assert.match(core.text, /桥接 1（ledger）/)
  assert.deepEqual(searched, ['采购订单核验 补开票'])
  assert.match(card.text, /采购核验未完成/)
  assert.match(card.text, /已入档规则（待审不是依据）/)
  assert.match(card.text, /memory:ok 发票型无数量列/)
  assert.equal(core.text.includes('已入档规则'), false)
})
