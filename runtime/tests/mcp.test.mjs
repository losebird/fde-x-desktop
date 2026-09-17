import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMcpPatchEntries,
  validateServerName,
  buildMcpServersV2,
  groupMcpToolsByServer,
  toolNamesFromFollowSnapshot,
} from '../routes/mcp.mjs'

const SAMPLE_PATCH = `
- id: mcp-alpha
  package: @deepseek-ai/dsh-mcp-client
  config:
    transport: stdio
    serverName: alpha
    command: "npx"
    args: ["-y", "pkg"]
- id: mcp-beta
  package: @deepseek-ai/dsh-mcp-client
  config:
    transport: streamable-http
    serverName: beta
    url: "http://127.0.0.1:9999/mcp"
`

test('parseMcpPatchEntries reads stdio and http transports', () => {
  const rows = parseMcpPatchEntries(SAMPLE_PATCH)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].serverName, 'alpha')
  assert.equal(rows[0].transport, 'stdio')
  assert.equal(rows[1].transport, 'streamable-http')
  assert.equal(rows[1].url, 'http://127.0.0.1:9999/mcp')
})

test('validateServerName enforces pattern and uniqueness', () => {
  const existing = new Set(['alpha'])
  assert.match(validateServerName('bad name', existing), /serverName/)
  assert.match(validateServerName('alpha', existing), /已存在/)
  assert.equal(validateServerName('gamma', existing), '')
})

test('buildMcpServersV2 returns v2 shape', async () => {
  const aiRuntime = {
    status: () => ({ connected: false }),
    call: async () => ({}),
    lanAssist: async () => ({}),
  }
  const mcp = await buildMcpServersV2(aiRuntime, SAMPLE_PATCH)
  assert.equal(mcp.length, 2)
  assert.deepEqual(Object.keys(mcp[0]).sort(), ['command', 'serverName', 'status', 'tools', 'transport'].sort())
  assert.equal(mcp[0].status, 'configured')
  assert.deepEqual(mcp[0].tools, [])
})

test('toolNamesFromFollowSnapshot reads request/header tools', () => {
  const names = toolNamesFromFollowSnapshot({
    type: 'snapshot',
    header: {},
    records: [{
      type: 'event',
      event: {
        type: 'request/header',
        data: {
          header: {
            tools: [
              { name: 'mcp__alpha__search', description: '', parameters: {} },
              { name: 'bash', description: '', parameters: {} },
            ],
          },
        },
      },
    }],
  })
  assert.deepEqual(names, ['mcp__alpha__search', 'bash'])
})

test('groupMcpToolsByServer assigns mcp__ prefixes', () => {
  const grouped = groupMcpToolsByServer(
    ['mcp__beta__fetch', 'mcp__alpha__search', 'bash'],
    ['alpha', 'beta'],
  )
  assert.deepEqual(grouped.get('alpha'), ['mcp__alpha__search'])
  assert.deepEqual(grouped.get('beta'), ['mcp__beta__fetch'])
})

test('buildMcpServersV2 projects live tools from session follow', async () => {
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint) => {
      if (endpoint === 'session/list') {
        return { sessions: [{ id: 'sess-1' }] }
      }
      return {}
    },
    async *stream(endpoint) {
      if (endpoint !== 'session/follow') return
      yield {
        type: 'snapshot',
        header: {},
        records: [{
          type: 'event',
          event: {
            type: 'request/header',
            data: {
              header: {
                tools: [{ name: 'mcp__alpha__ping', description: '', parameters: {} }],
              },
            },
          },
        }],
      }
    },
    lanAssist: async () => ({}),
  }
  const mcp = await buildMcpServersV2(aiRuntime, SAMPLE_PATCH)
  assert.deepEqual(mcp[0].tools, ['mcp__alpha__ping'])
  assert.equal(mcp[0].status, 'live')
  assert.deepEqual(mcp[1].tools, [])
  assert.equal(mcp[1].status, 'needs-reload')
})
