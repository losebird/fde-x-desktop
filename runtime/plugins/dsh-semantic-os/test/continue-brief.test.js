import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CORE_BRIEF_CAP,
  clipBrief,
  fetchOpenTodos,
  formatCoreBrief,
  isContinueQuery,
  pickLastSession,
  rewriteContinueQuery,
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
  assert.equal(clipBrief('abcdefghij', 8).endsWith('…'), true)
})

test('continue rewrite uses last title instead of 继续处理', () => {
  assert.equal(rewriteContinueQuery('继续处理', {
    lastSession: { title: '采购订单核验' },
    todos: [{ title: '补开票' }],
  }), '采购订单核验 补开票')
  assert.equal(rewriteContinueQuery('昨天下午聊了啥', { lastSession: { title: 'x' } }), '昨天下午聊了啥')
  assert.equal(rewriteContinueQuery('接着干', {}), '未完成 待办')
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
  assert.deepEqual(searched, ['采购订单核验 补开票'])
  assert.match(card.text, /采购核验未完成/)
})
