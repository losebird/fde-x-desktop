import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseMcpPatchEntries,
  validateServerName,
  buildMcpServersV2,
  groupMcpToolsByServer,
  toolNamesFromFollowSnapshot,
  mapServerStatus,
  checkMcpHealth,
  entryFromProbeDraft,
  probeAddressBlocked,
  probeHttpTargetError,
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

test('cold start holds MCP then lets Host HMR apply after connected', async () => {
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
  assert.equal(start.includes('setPluginEnabled'), false)
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
  process.stdout.write(result + '\\n')
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
  process.stdout.write(result + '\\n')
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
  process.stdout.write(result + '\\n')
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

test('entryFromProbeDraft drops cookies and does not name a saved server', () => {
  const http = entryFromProbeDraft({
    transport: 'streamable-http',
    url: 'http://127.0.0.1:9/mcp',
    serverName: 'should-not-matter',
    headers: { Cookie: 'session=secret', Authorization: 'Bearer t' },
  })
  assert.equal(http.error, undefined)
  assert.equal(http.entry.transport, 'streamable-http')
  assert.equal(http.entry.url, 'http://127.0.0.1:9/mcp')
  assert.equal(http.entry.serverName, undefined)
  assert.equal(http.entry.headers.Authorization, 'Bearer t')
  assert.equal(http.entry.headers.Cookie, undefined)
  assert.match(entryFromProbeDraft({ transport: 'stdio' }).error, /command/)
  assert.match(entryFromProbeDraft({ transport: 'streamable-http', url: 'file:///etc/passwd' }).error, /http/)
  assert.match(entryFromProbeDraft({ transport: 'nope' }).error, /transport/)
  assert.match(entryFromProbeDraft({ transport: 'stdio', command: 'npx', args: Array(65).fill('a') }).error, /64/)
  const stdio = entryFromProbeDraft({
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'pkg'],
    cwd: '/tmp/ws',
    env: { IMAP_PASS: 'secret', PATH: '/tmp/evil' },
  })
  assert.deepEqual(stdio.entry.args, ['-y', 'pkg'])
  assert.equal(stdio.entry.cwd, '/tmp/ws')
  assert.equal(stdio.entry.env.IMAP_PASS, 'secret')
  assert.equal(stdio.entry.env.PATH, undefined)
})

test('probeAddressBlocked allows loopback and rejects private, link-local, and metadata addresses', () => {
  for (const ip of ['127.0.0.1', '127.0.0.2', '::1', '::ffff:127.0.0.1', '8.8.8.8', '172.32.0.1', '100.128.0.1', '11.0.0.1', '64:ff9b::808:808', '2002:808:808::']) {
    assert.equal(probeAddressBlocked(ip), false, ip)
  }
  for (const ip of [
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.1',
    '192.168.1.1',
    '169.254.169.254',
    '169.254.1.1',
    '100.100.100.200',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '192.0.0.8',
    '198.18.0.1',
    '::',
    'fc00::1',
    'fd00:ec2::254',
    'fe80::1',
    'ff02::1',
    '::ffff:169.254.169.254',
    '::ffff:10.1.2.3',
    '::ffff:a9fe:a9fe',
    '64:ff9b::a9fe:a9fe',
    '2002:a9fe:a9fe::',
    'not-an-ip',
    '',
  ]) {
    assert.equal(probeAddressBlocked(ip), true, ip)
  }
})

test('probeHttpTargetError judges the resolved address and fails closed', async () => {
  const lookup = async (host) => {
    const table = {
      'metadata.google.internal': [{ address: '169.254.169.254' }],
      localhost: [{ address: '127.0.0.1' }, { address: '::1' }],
      'mixed.example': [{ address: '1.1.1.1' }, { address: '10.0.0.8' }],
      'public.example': [{ address: '8.8.8.8' }],
    }
    if (!table[host]) {
      const error = new Error('ENOTFOUND')
      error.code = 'ENOTFOUND'
      throw error
    }
    return table[host]
  }
  assert.equal(await probeHttpTargetError('http://169.254.169.254/latest/meta-data', lookup), '该地址不在探测允许范围内')
  assert.equal(await probeHttpTargetError('http://2852039166/latest/meta-data', lookup), '该地址不在探测允许范围内')
  assert.equal(await probeHttpTargetError('http://metadata.google.internal/computeMetadata/v1/', lookup), '该地址不在探测允许范围内')
  assert.equal(await probeHttpTargetError('http://[fd00:ec2::254]/', lookup), '该地址不在探测允许范围内')
  assert.equal(await probeHttpTargetError('http://10.1.2.3/mcp', lookup), '该地址不在探测允许范围内')
  assert.equal(await probeHttpTargetError('https://mixed.example/mcp', lookup), '该地址不在探测允许范围内')
  assert.equal(await probeHttpTargetError('http://127.0.0.1:9/mcp', lookup), '')
  assert.equal(await probeHttpTargetError('http://localhost:9/mcp', lookup), '')
  assert.equal(await probeHttpTargetError('http://[::1]:9/mcp', lookup), '')
  assert.equal(await probeHttpTargetError('https://public.example/mcp', lookup), '')
  assert.equal(await probeHttpTargetError('http://missing.example/mcp', lookup), '无法解析该地址')
  let lookedUp = false
  await probeHttpTargetError('http://192.168.0.8/mcp', async () => {
    lookedUp = true
    return [{ address: '192.168.0.8' }]
  })
  assert.equal(lookedUp, false)
})

test('checkMcpHealth stdio applies draft env without replacing PATH', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-probe-env-'))
  const marker = join(dir, 'seen.json')
  const script = join(dir, 'echo-env.mjs')
  await writeFile(script, `import { writeFileSync } from 'node:fs'
writeFileSync(process.argv[2], JSON.stringify({ mark: process.env.MCP_PROBE_MARK || '', path: process.env.PATH || '' }))
process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }) + '\\n')
`)
  try {
    const health = await checkMcpHealth({
      transport: 'stdio',
      command: process.execPath,
      args: [script, marker],
      env: { MCP_PROBE_MARK: 'from-draft', PATH: '/tmp/not-a-real-path' },
    })
    assert.equal(health.ok, true)
    const seen = JSON.parse(await readFile(marker, 'utf8'))
    assert.equal(seen.mark, 'from-draft')
    assert.notEqual(seen.path, '/tmp/not-a-real-path')
    assert.match(seen.path, /\S/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
