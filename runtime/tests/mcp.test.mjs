import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMcpPatchEntries,
  validateServerName,
  buildMcpServersV2,
  groupMcpToolsByServer,
  toolNamesFromFollowSnapshot,
  mapServerStatus,
  checkMcpHealth,
  mcpArchiveWriteNote,
  mcpFiberFromPlugins,
  resolveMcpProjectionSession,
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
  assert.match(validateServerName('alpha', existing, { unique: true }), /已存在/)
  assert.equal(validateServerName('alpha', existing), '')
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
  assert.equal(mcp[0].serverName, 'alpha')
  assert.equal(mcp[0].transport, 'stdio')
  assert.equal(mcp[0].command, 'npx')
  assert.deepEqual(mcp[0].args, ['-y', 'pkg'])
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
      if (endpoint === 'pluginManager/listPlugins') {
        return [
          { entryId: 'mcp-alpha', fiberPhase: 'active', enabled: true },
          { entryId: 'mcp-beta', fiberPhase: 'loading', enabled: true },
        ]
      }
      throw new Error(endpoint)
    },
    async *stream() {
      yield { type: 'snapshot', header: { tools: [] }, records: [] }
    },
    lanAssist: async () => ({}),
  }
  const mcp = await buildMcpServersV2(aiRuntime, SAMPLE_PATCH, ['mcp__alpha__ping'])
  assert.deepEqual(mcp[0].tools, ['mcp__alpha__ping'])
  assert.equal(mcp[0].status, 'loaded')
  assert.deepEqual(mcp[1].tools, [])
  assert.equal(mcp[1].status, 'loading')
})

test('buildMcpServersV2 reuses a projected tool snapshot when given one', async () => {
  let followed = 0
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint) => {
      if (endpoint === 'pluginManager/listPlugins') return []
      throw new Error('session/list should not run')
    },
    async *stream() {
      followed += 1
      yield { type: 'snapshot', header: { tools: [] }, records: [] }
    },
  }
  const mcp = await buildMcpServersV2(aiRuntime, SAMPLE_PATCH, ['mcp__alpha__search'])
  assert.equal(followed, 0)
  assert.deepEqual(mcp[0].tools, ['mcp__alpha__search'])
  assert.equal(mcp[0].status, 'loading')
})

test('MCP discover is a list mouth not a connect insert', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const archive = readFileSync(fileURLToPath(new URL('../mcp-archive.mjs', import.meta.url)), 'utf8')
  const routes = readFileSync(fileURLToPath(new URL('../routes/mcp.mjs', import.meta.url)), 'utf8')
  const core = readFileSync(fileURLToPath(new URL('../dsh-core.mjs', import.meta.url)), 'utf8')
  const ensure = archive.slice(archive.indexOf('export async function ensureLocalMcpInProfile'), archive.indexOf('export async function ensureLocalMcpInProfile') + 800)
  assert.equal(ensure.includes('discoverLocalMcpServers()'), false)
  assert.match(routes, /\/api\/v1\/mcp\/discover/)
  assert.match(core, /ensureLocalMcpInProfile\(this\)/)
})

test('connected MCP writes do not force a Host restart', async () => {
  assert.equal(mcpArchiveWriteNote(true), '已写入配置，核心将热更新')
  assert.equal(mcpArchiveWriteNote(false), '已写入配置，需重载核心生效')
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const routes = readFileSync(fileURLToPath(new URL('../routes/mcp.mjs', import.meta.url)), 'utf8')
  assert.match(routes, /needsRestart: !connected/)
  assert.match(routes, /mcpArchiveWriteNote\(connected\)/)
  assert.match(routes, /resolveStdioCwd/)
})

test('cold start holds MCP then enables after connected', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const core = readFileSync(fileURLToPath(new URL('../dsh-core.mjs', import.meta.url)), 'utf8')
  const start = core.slice(core.indexOf('async startInternal()'), core.indexOf('pluginSourceCandidates('))
  assert.match(start, /applyMcpBootHold\(this\)/)
  const spawnAt = start.indexOf('const child = spawn(')
  const holdAt = start.indexOf('applyMcpBootHold(this)')
  const connectedAt = start.indexOf("this.state = 'connected'")
  const activateAt = start.indexOf('activateArchivedMcp()')
  const waitAt = start.indexOf('waitMcpOccupancy')
  assert.ok(holdAt > 0 && holdAt < spawnAt)
  assert.ok(connectedAt > spawnAt)
  assert.ok(activateAt > connectedAt)
  assert.ok(waitAt > activateAt)
  assert.match(start, /setPluginEnabled/)
  assert.match(start, /releaseMcpBootHoldSafe/)
  assert.equal(start.includes('--patch') && /mcp-boot-hold/.test(start), false)
})

test('mapServerStatus follows Host fiber and ignores session tool count', () => {
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'active', fiberEnabled: true }), 'loaded')
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'active' }), 'loaded')
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'loading' }), 'loading')
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'pending' }), 'loading')
  assert.equal(mapServerStatus({ connected: true }), 'loading')
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'failed' }), 'failed')
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'unloading' }), 'unloading')
  assert.equal(mapServerStatus({ connected: false }), 'configured')
  assert.equal(mapServerStatus({ connected: true, disabled: true }), 'disabled')
  assert.equal(mapServerStatus({ connected: true, disabled: true, fiberPhase: 'active', fiberEnabled: true }), 'unloading')
  assert.equal(mapServerStatus({ connected: true, fiberPhase: 'active', fiberEnabled: false }), 'loading')
  assert.equal(mapServerStatus({ connected: false, disabled: true }), 'disabled')
})

test('mcpFiberFromPlugins matches patch id and include: prefix', () => {
  const row = { entryId: 'include:mcp-alpha', patchId: 'mcp-alpha', fiberPhase: 'active', enabled: true }
  assert.equal(mcpFiberFromPlugins([row], 'alpha'), row)
})

test('checkMcpHealth stdio uses the archived cwd', async () => {
  const { chmod, mkdir, mkdtemp, realpath, writeFile, readFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'mcp-stdio-cwd-'))
  const cwd = join(dir, 'ws')
  await mkdir(cwd)
  const bin = join(dir, 'fake-mcp')
  const seen = join(dir, 'seen-cwd')
  await writeFile(bin, `#!/usr/bin/env node
const { writeFileSync } = require('node:fs')
writeFileSync(${JSON.stringify(seen)}, process.cwd())
let buf = ''
process.stdin.on('data', (chunk) => {
  buf += chunk
  if (!buf.includes('initialize')) return
  const result = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'x', version: '0' } },
  })
  process.stdout.write('Content-Length: ' + Buffer.byteLength(result) + '\\r\\n\\r\\n' + result)
})
`)
  await chmod(bin, 0o755)
  const health = await checkMcpHealth({ transport: 'stdio', command: bin, args: [], cwd })
  assert.equal(health.ok, true)
  assert.equal(await readFile(seen, 'utf8'), await realpath(cwd))
})

test('checkMcpHealth stdio initialize is reachable', async () => {
  const { chmod, mkdtemp, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'mcp-stdio-ok-'))
  const bin = join(dir, 'fake-mcp')
  await writeFile(bin, `#!/usr/bin/env node
let buf = ''
process.stdin.on('data', (chunk) => {
  buf += chunk
  if (!buf.includes('initialize')) return
  const result = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'x', version: '0' } },
  })
  process.stdout.write('Content-Length: ' + Buffer.byteLength(result) + '\\r\\n\\r\\n' + result)
})
`)
  await chmod(bin, 0o755)
  const health = await checkMcpHealth({ transport: 'stdio', command: bin, args: [] })
  assert.equal(health.ok, true)
  assert.match(health.message, /MCP 可达/)
})

test('checkMcpHealth stdio keeps stdin open until initialize result', async () => {
  const { chmod, mkdtemp, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'mcp-stdio-keep-'))
  const bin = join(dir, 'fake-mcp')
  await writeFile(bin, `#!/usr/bin/env node
let buf = ''
process.stdin.on('end', () => process.exit(0))
process.stdin.on('data', (chunk) => {
  buf += chunk
  if (!buf.includes('initialize')) return
  const result = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'x', version: '0' } },
  })
  process.stdout.write('Content-Length: ' + Buffer.byteLength(result) + '\\r\\n\\r\\n' + result)
})
`)
  await chmod(bin, 0o755)
  const health = await checkMcpHealth({ transport: 'stdio', command: bin, args: [] })
  assert.equal(health.ok, true)
  assert.match(health.message, /MCP 可达/)
})

test('checkMcpHealth stdio surfaces spawn stderr', async () => {
  const { chmod, mkdtemp, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'mcp-stdio-bad-'))
  const bin = join(dir, 'broken-npx')
  await writeFile(bin, `#!/usr/bin/env node
require('../lib/cli.js')
`)
  await chmod(bin, 0o755)
  const health = await checkMcpHealth({ transport: 'stdio', command: bin, args: ['-y', 'pkg'] })
  assert.equal(health.ok, false)
  assert.match(health.message, /Cannot find module|cli\.js/)
})

test('resolvePrimarySessionForRuntime stays on the cwd primary session', async () => {
  const { resolvePrimarySessionForRuntime } = await import('../session-primary.mjs')
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      return {
        sessions: [
          { id: 's-other', cwd: '/tmp/other', updatedAt: 9 },
          { id: 's-here', cwd: '/tmp/ws', updatedAt: 3 },
          { id: 's-sub', cwd: '/tmp/ws', parentSessionId: 's-here', origin: 'subagent', updatedAt: 8 },
        ],
      }
    },
  }
  assert.equal(await resolvePrimarySessionForRuntime(aiRuntime, { cwd: '/tmp/ws' }), 's-here')
  assert.equal(await resolvePrimarySessionForRuntime(aiRuntime, { sessionId: 's-sub', cwd: '/tmp/ws' }), 's-here')
  assert.equal(await resolvePrimarySessionForRuntime(aiRuntime, { cwd: '/tmp/missing' }), '')
})

test('resolveMcpProjectionSession stays on the cwd primary session', async () => {
  const calls = []
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      return {
        sessions: [
          { id: 's-other', cwd: '/tmp/other', updatedAt: 9 },
          { id: 's-here', cwd: '/tmp/ws', updatedAt: 3 },
          { id: 's-sub', cwd: '/tmp/ws', parentSessionId: 's-here', origin: 'subagent', updatedAt: 8 },
        ],
      }
    },
  }
  assert.equal(await resolveMcpProjectionSession(aiRuntime, { cwd: '/tmp/ws' }), 's-here')
  assert.equal(await resolveMcpProjectionSession(aiRuntime, { sessionId: 's-sub', cwd: '/tmp/ws' }), 's-here')
  assert.equal(await resolveMcpProjectionSession(aiRuntime, { cwd: '/tmp/missing' }), '')
})

test('checkMcpHealth names a missing absolute path as a missing file', async () => {
  const health = await checkMcpHealth({ transport: 'stdio', command: '/tmp/fde-x-no-such-mcp-bin' })
  assert.equal(health.ok, false)
  assert.match(health.message, /找不到文件/)
})

test('checkMcpHealth streamable-http POSTs initialize and does not HEAD', async () => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, headers: init?.headers, body: init?.body })
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const health = await checkMcpHealth({
      transport: 'streamable-http',
      url: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer z' },
    })
    assert.equal(health.ok, true)
    assert.match(health.message, /MCP 可达/)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.equal(JSON.parse(calls[0].body).method, 'initialize')
    assert.equal(calls[0].headers.Authorization, 'Bearer z')
  } finally {
    globalThis.fetch = original
  }
})

test('checkMcpHealth streamable-http reports HTTP status when initialize is refused', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('', { status: 405 })
  try {
    const health = await checkMcpHealth({ transport: 'streamable-http', url: 'https://example.test/mcp' })
    assert.equal(health.ok, false)
    assert.equal(health.message, 'HTTP 405')
  } finally {
    globalThis.fetch = original
  }
})
