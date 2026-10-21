import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBriefingAgent } from '../briefing/ask-ai.mjs'

function briefingDb() {
  return { prepare() { return { run() {} } } }
}

async function withBridgeHome(run) {
  const home = await mkdtemp(join(tmpdir(), 'fde-briefing-mcp-'))
  const previous = process.env.FDE_DSH_HOME
  process.env.FDE_DSH_HOME = home
  await mkdir(join(home, 'run'), { recursive: true })
  await writeFile(join(home, 'run', 'bridge.token'), 'bridge-token\n')
  try {
    await run(home)
  } finally {
    if (previous == null) delete process.env.FDE_DSH_HOME
    else process.env.FDE_DSH_HOME = previous
    await rm(home, { recursive: true, force: true })
  }
}

test('runBriefingAgent prompts the pointed session and does not create another', async () => {
  const calls = []
  const db = {
    prepare() {
      return { run() {} }
    },
  }
  const result = await runBriefingAgent({
    db,
    aiRuntime: {
      status: () => ({ connected: true }),
      call: async (endpoint, args) => {
        calls.push({ endpoint, args })
        if (endpoint === 'session/list') return { items: [{ sessionId: 'sess-current', running: false }] }
        if (endpoint === 'session/prompt') return {}
        throw new Error(`unexpected ${endpoint}`)
      },
    },
  }, {
    briefingId: 'brf',
    workspaceCwd: '/ws/a',
    sessionId: 'sess-current',
    sections: [{ id: 'ai', type: 'ai', enabled: true, title: '摘要', render: 'digest', params: {} }],
    internalSections: [],
    timeoutMs: 0,
    projectWaitMs: 0,
  })
  assert.equal(result.sessionId, 'sess-current')
  assert.equal(calls.some((row) => row.endpoint === 'session/create'), false)
  const prompt = calls.find((row) => row.endpoint === 'session/prompt')
  assert.ok(prompt)
  assert.equal(prompt.args.request.sessionId, 'sess-current')
  assert.equal(prompt.args.request.mode, 'queue')
  assert.equal(prompt.args.request.content[0].type, 'text')
  assert.equal(prompt.args.agentId, undefined)
})

test('runBriefingAgent waits for an idle session and does not queue a second prompt', async () => {
  const calls = []
  const result = await runBriefingAgent({
    db: { prepare() { return { run() {} } } },
    aiRuntime: {
      status: () => ({ connected: true }),
      call: async (endpoint, args) => {
        calls.push(endpoint)
        if (endpoint === 'session/list') return { items: [{ sessionId: 'sess-current', running: true }] }
        if (endpoint === 'session/prompt') return {}
        throw new Error(`unexpected ${endpoint}`)
      },
    },
  }, {
    briefingId: 'brf',
    workspaceCwd: '/ws/a',
    sessionId: 'sess-current',
    sections: [{ id: 'ai', type: 'ai', enabled: true, title: '摘要', render: 'digest', params: {} }],
    internalSections: [],
    timeoutMs: 50,
    projectWaitMs: 0,
  })
  assert.equal(result.ok, false)
  assert.match(result.error, /上一轮/)
  assert.equal(calls.includes('session/prompt'), false)
})

test('runBriefingAgent refuses to invent a session', async () => {
  const result = await runBriefingAgent({
    db: { prepare() { return { run() {} } } },
    aiRuntime: { status: () => ({ connected: true }), call: async () => ({}) },
  }, {
    briefingId: 'brf',
    workspaceCwd: '/ws/a',
    sessionId: '',
    sections: [],
    internalSections: [],
    timeoutMs: 10,
  })
  assert.equal(result.ok, false)
  assert.match(result.error, /没有可用的 AI 会话/)
})

test('runBriefingAgent fills an mcp block without a projected session header', async () => {
  await withBridgeHome(async (home) => {
    const calls = []
    const original = globalThis.fetch
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, text: 'fake-news-item' }),
    })
    try {
      const result = await runBriefingAgent({
        db: briefingDb(),
        aiRuntime: {
          dshHome: home,
          status: () => ({ connected: true, origin: 'http://127.0.0.1:9' }),
          call: async (endpoint) => {
            calls.push(endpoint)
            throw new Error(`unexpected ${endpoint}`)
          },
        },
      }, {
        briefingId: 'brf',
        workspaceCwd: '/ws/a',
        sessionId: 'sess-current',
        sections: [{
          id: 'news',
          type: 'mcp',
          enabled: true,
          title: '资讯',
          params: { server: 'ai-hot', tool: 'mcp__ai-hot__aihot_get_latest' },
        }],
        internalSections: [],
        timeoutMs: 0,
      })
      assert.equal(result.ok, true)
      assert.equal(calls.includes('session/prompt'), false)
      assert.deepEqual(result.blocked, [])
      assert.equal(result.toolResults['mcp__ai-hot__aihot_get_latest'].text, 'fake-news-item')
    } finally {
      globalThis.fetch = original
    }
  })
})

test('runBriefingAgent calls the host with block params and puts the text in the prompt', async () => {
  await withBridgeHome(async (home) => {
    const calls = []
    const fetches = []
    const original = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body)
      fetches.push({ url: String(url), headers: init.headers, body })
      const text = String(body.name).includes('imap_search') ? 'fake-mail-item' : 'fake-news-item'
      return { ok: true, status: 200, json: async () => ({ ok: true, text }) }
    }
    try {
      const result = await runBriefingAgent({
        db: briefingDb(),
        aiRuntime: {
          dshHome: home,
          cookie: 'dsh=abc',
          status: () => ({ connected: true, origin: 'http://127.0.0.1:9' }),
          call: async (endpoint, args) => {
            calls.push({ endpoint, args })
            if (endpoint === 'session/list') return { items: [{ sessionId: 'sess-current', running: false }] }
            if (endpoint === 'session/prompt') return {}
            throw new Error(`unexpected ${endpoint}`)
          },
          async *stream(endpoint) {
            calls.push({ endpoint })
            if (endpoint === 'session/follow') {
              yield { type: 'event', event: { type: 'turn/end' } }
            }
          },
        },
      }, {
        briefingId: 'brf',
        workspaceCwd: '/ws/a',
        sessionId: 'sess-current',
        sections: [
          {
            id: 'news',
            type: 'mcp',
            enabled: true,
            title: '资讯',
            params: { server: 'ai-hot', tool: 'mcp__ai-hot__aihot_get_latest', args: { limit: 3 } },
          },
          {
            id: 'mail',
            type: 'mcp',
            enabled: true,
            title: '邮件',
            params: { server: 'mail', tool: 'imap_search', args: { mailbox: 'INBOX' } },
          },
          { id: 'ai', type: 'ai', enabled: true, title: '摘要', render: 'digest', params: {} },
        ],
        internalSections: [],
        timeoutMs: 5000,
        projectWaitMs: 0,
      })
      assert.deepEqual(result.blocked, [])
      assert.equal(result.toolResults['mcp__ai-hot__aihot_get_latest'].text, 'fake-news-item')
      assert.equal(result.toolResults.imap_search.text, 'fake-mail-item')
      assert.equal(fetches.length, 2)
      const news = fetches.find((row) => row.body.name === 'mcp__ai-hot__aihot_get_latest')
      const mail = fetches.find((row) => row.body.name === 'mcp__mail__imap_search')
      assert.ok(news)
      assert.ok(mail)
      assert.deepEqual(news.body.args, { limit: 3 })
      assert.deepEqual(mail.body.args, { mailbox: 'INBOX' })
      assert.equal(news.headers['x-fde-bridge-token'], 'bridge-token')
      assert.equal(news.headers.cookie, 'dsh=abc')
      assert.equal(news.url, 'http://127.0.0.1:9/fde-session/mcp/call')
      const prompt = calls.find((row) => row.endpoint === 'session/prompt')
      assert.ok(prompt)
      const text = prompt.args.request.content[0].text
      assert.match(text, /fake-news-item/)
      assert.match(text, /fake-mail-item/)
      assert.doesNotMatch(text, /必须在本轮调用/)
      assert.doesNotMatch(text, /会话未投影/)
      assert.equal(calls.filter((row) => row.endpoint === 'session/follow').length, 1)
    } finally {
      globalThis.fetch = original
    }
  })
})

test('runBriefingAgent records the host error on the block and does not prompt', async () => {
  await withBridgeHome(async (home) => {
    const calls = []
    const original = globalThis.fetch
    globalThis.fetch = async () => ({
      ok: false,
      status: 200,
      json: async () => ({ ok: false, error: 'connection reset by peer' }),
    })
    try {
      const result = await runBriefingAgent({
        db: briefingDb(),
        aiRuntime: {
          dshHome: home,
          cookie: 'dsh=abc',
          status: () => ({ connected: true, origin: 'http://127.0.0.1:9' }),
          call: async (endpoint) => {
            calls.push(endpoint)
            throw new Error(`unexpected ${endpoint}`)
          },
        },
      }, {
        briefingId: 'brf',
        workspaceCwd: '/ws/a',
        sessionId: 'sess-current',
        sections: [{
          id: 'news',
          type: 'mcp',
          enabled: true,
          title: '资讯',
          params: { server: 'ai-hot', tool: 'mcp__ai-hot__aihot_get_latest', args: { limit: 3 } },
        }],
        internalSections: [],
        timeoutMs: 0,
        projectWaitMs: 0,
      })
      assert.equal(result.ok, true)
      assert.equal(calls.includes('session/prompt'), false)
      assert.equal(result.blocked[0].id, 'news')
      assert.equal(result.blocked[0].error, 'connection reset by peer')
    } finally {
      globalThis.fetch = original
    }
  })
})

test('runBriefingAgent refuses a tool name that does not belong to the block server', async () => {
  await withBridgeHome(async (home) => {
    const original = globalThis.fetch
    let fetched = 0
    globalThis.fetch = async () => {
      fetched += 1
      return { ok: true, status: 200, json: async () => ({ ok: true, text: 'nope' }) }
    }
    try {
      const result = await runBriefingAgent({
        db: briefingDb(),
        aiRuntime: {
          dshHome: home,
          status: () => ({ connected: true, origin: 'http://127.0.0.1:9' }),
          call: async () => { throw new Error('unexpected call') },
        },
      }, {
        briefingId: 'brf',
        workspaceCwd: '/ws/a',
        sessionId: 'sess-current',
        sections: [{
          id: 'news',
          type: 'mcp',
          enabled: true,
          title: '资讯',
          params: { server: 'other', tool: 'mcp__ai-hot__aihot_get_latest' },
        }],
        internalSections: [],
        timeoutMs: 0,
        projectWaitMs: 0,
      })
      assert.equal(fetched, 0)
      assert.equal(result.blocked[0].error, '工具 mcp__ai-hot__aihot_get_latest 不属于 server other')
    } finally {
      globalThis.fetch = original
    }
  })
})
