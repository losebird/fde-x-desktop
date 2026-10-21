import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invokeBizSlot } from '../biz/invoke.mjs'
import { upsertMcpPatchEntry } from '../mcp-archive.mjs'

test('invokeBizSlot refuses missing write slot', async () => {
  await assert.rejects(
    () => invokeBizSlot({ aiRuntime: {} }, {
      source: {
        type: 'mcp',
        serverName: 'a',
        describe: { via: 'mcp', serverName: 'a', tool: 'd' },
        list: { via: 'mcp', serverName: 'a', tool: 'l' },
      },
      slot: 'write',
      cwd: '/tmp/ws',
    }),
    (error) => error.code === 'no_write',
  )
})

test('invokeBizSlot refuses missing describe handle', async () => {
  await assert.rejects(
    () => invokeBizSlot({ aiRuntime: {} }, {
      source: { type: 'lookup' },
      slot: 'describe',
      cwd: '/tmp/ws',
    }),
    (error) => error.code === 'no_handle',
  )
})

test('invokeBizSlot calls a stdio MCP tool on the host', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-invoke-mcp-'))
  const previous = process.env.FDE_DSH_HOME
  process.env.FDE_DSH_HOME = home
  const patchDir = join(home, 'profiles', 'fde-x')
  await mkdir(join(home, 'run'), { recursive: true })
  await mkdir(patchDir, { recursive: true })
  await writeFile(join(home, 'run', 'bridge.token'), 'bridge-token\n')
  await writeFile(join(patchDir, 'cordis.patch.yml'), upsertMcpPatchEntry('', {
    serverName: 'mail',
    transport: 'stdio',
    command: process.execPath,
    args: ['scripts/repro/fake-mcp-stdio.mjs'],
  }))
  const fetches = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    fetches.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) })
    return { ok: true, status: 200, json: async () => ({ ok: true, text: 'fake-mail-item' }) }
  }
  try {
    const text = await invokeBizSlot({
      aiRuntime: {
        dshHome: home,
        cookie: 'dsh=abc',
        status: () => ({ connected: true, origin: 'http://127.0.0.1:9' }),
        call: async (endpoint) => {
          if (endpoint === 'session/list') {
            return { items: [{ sessionId: 'sess', cwd: '/tmp/ws', updatedAt: 1 }] }
          }
          throw new Error(`unexpected ${endpoint}`)
        },
        async *stream() {
          yield { type: 'snapshot', header: { tools: [] } }
        },
      },
    }, {
      source: {
        type: 'mcp',
        describe: { via: 'mcp', serverName: 'mail', tool: 'imap_search' },
      },
      slot: 'describe',
      args: { mailbox: 'INBOX' },
      cwd: '/tmp/ws',
    })
    assert.equal(text, 'fake-mail-item')
    assert.equal(fetches.length, 1)
    assert.equal(fetches[0].url, 'http://127.0.0.1:9/fde-session/mcp/call')
    assert.equal(fetches[0].body.name, 'mcp__mail__imap_search')
    assert.deepEqual(fetches[0].body.args, { mailbox: 'INBOX' })
    assert.equal(fetches[0].headers['x-fde-bridge-token'], 'bridge-token')
    assert.equal(fetches[0].headers.cookie, 'dsh=abc')
  } finally {
    globalThis.fetch = original
    if (previous == null) delete process.env.FDE_DSH_HOME
    else process.env.FDE_DSH_HOME = previous
    await rm(home, { recursive: true, force: true })
  }
})
