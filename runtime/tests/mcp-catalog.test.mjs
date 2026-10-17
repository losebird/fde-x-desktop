import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { constants as zlibConstants, zstdCompress } from 'node:zlib'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bridge = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'index.js'))
const tools = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'tools.js'))
const compress = promisify(zstdCompress)
const ZSTD_CHECKSUM = { params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 } }

function tool(name, description, words = 0) {
  const pad = words > 0 ? ` ${'token '.repeat(words)}`.trim() : ''
  return {
    name,
    description,
    parameters: { type: 'object', properties: { q: { type: 'string', description: `${description}${pad ? ` ${pad}` : ''}` } } },
  }
}

function schemaTokens(rows) {
  const json = JSON.stringify(rows.map((row) => ({
    name: row.name,
    description: row.description,
    parameters: row.parameters,
  })))
  return Math.ceil(Buffer.byteLength(json, 'utf8') / 4)
}

function fixtureTools() {
  return [
    tool('fde_mcp_load', 'Load one MCP server by name.'),
    tool('mcp__mail__imap_search', 'Read the inbox.', 80),
    tool('mcp__ai-hot__aihot_get_latest', 'Latest industry notes.', 80),
    tool('mcp__playwright__click', 'Click a browser element.', 80),
    tool('read', 'Read a file.'),
  ]
}

function createBus(source = fixtureTools) {
  const rows = typeof source === 'function' ? source : () => source
  const hooks = new Map()
  return {
    config: {
      standardDenyServers: ['playwright'],
      briefingDenyUserMcp: true,
    },
    on(name, listener, prepend) {
      const list = hooks.get(name) || []
      if (prepend) list.unshift(listener)
      else list.push(listener)
      hooks.set(name, list)
    },
    waterfall(name, payload, context) {
      const cbs = (hooks.get(name) || []).slice()
      const call = () => {
        const listener = cbs.shift()
        if (!listener) {
          if (name === 'system-prompt/assemble') {
            return { sections: [{ name: 'persona', text: 'hi' }], tools: rows().map((row) => ({ ...row, parameters: row.parameters })) }
          }
          return { kind: 'allow' }
        }
        if (name === 'system-prompt/assemble') return listener(payload, context, call)
        return listener(payload, call)
      }
      return call()
    },
  }
}

function agent(sessionId) {
  return { session: { id: sessionId, header: { agentPreset: 'standard' } } }
}

async function writeLoadLog(sessionRoot, sessionId, servers) {
  const dir = join(sessionRoot, sessionId)
  await mkdir(dir, { recursive: true })
  const events = servers.map((server, index) => ({
    seq: index + 1,
    type: 'tool/call',
    data: {
      turn: 1,
      step: index + 1,
      callId: `call-${index + 1}`,
      name: 'fde_mcp_load',
      arguments: JSON.stringify({ server }),
    },
  }))
  const header = `${JSON.stringify({ type: 'session', version: 3, id: sessionId })}\n`
  const body = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
  const frames = [
    await compress(Buffer.from(header), ZSTD_CHECKSUM),
    await compress(Buffer.from(body), ZSTD_CHECKSUM),
  ]
  await writeFile(join(dir, 'session.v3.jsonl.zstd'), Buffer.concat(frames))
}

async function executeMounted(assembled, name, args) {
  const mounted = assembled.tools.find((row) => row.name === name)
  if (!mounted) throw new Error(`工具 ${name} 不在本步请求里`)
  if (name === 'mcp__mail__imap_search' && args && args.mailbox === 'INBOX') return { text: 'fake-mail-item' }
  throw new Error(`unexpected call ${name}`)
}

test('the first request keeps a catalog and drops mcp schemas', async () => {
  const bus = createBus()
  bridge.installIuiModeGate(bus)
  const before = schemaTokens(fixtureTools())
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent('sess-catalog') })
  const names = assembled.tools.map((row) => row.name)
  assert.deepEqual(names, ['fde_mcp_load', 'read'])
  const section = assembled.sections.find((row) => row && row.name === 'fde:mcp-catalog')
  assert.ok(section, JSON.stringify(assembled.sections))
  assert.match(section.text, /MCP 目录/)
  assert.match(section.text, /fde_mcp_load\(\{server\}\)/)
  assert.match(section.text, /mail \/ imap_search \/ Read the inbox\./)
  assert.match(section.text, /ai-hot \/ aihot_get_latest \/ Latest industry notes\./)
  assert.equal(section.text.includes('playwright'), false)
  const after = schemaTokens(assembled.tools)
  assert.equal(after, schemaTokens(fixtureTools().filter((row) => names.includes(row.name))))
  assert.ok(before - after > 100, `${before} -> ${after}`)
  assert.equal(tools.FDE_TOOL_NAMES.includes('fde_mcp_load'), true)
})

test('fde_mcp_load puts the real name on the next request and that name runs', async () => {
  const bus = createBus()
  bridge.installIuiModeGate(bus)
  const sessionId = 'sess-load'
  await bus.waterfall('system-prompt/assemble', null, { agent: agent(sessionId) })
  const registered = []
  tools.registerTools({
    config: bus.config,
    tools: { register(spec) { registered.push(spec) } },
  }, { defineTool: (spec) => spec })
  const load = registered.find((spec) => spec.name === 'fde_mcp_load')
  assert.ok(load)
  const text = await load.execute({ server: 'mail' }, { agent: agent(sessionId) })
  assert.match(text, /mcp__mail__imap_search/)
  const denied = await load.execute({ server: 'playwright' }, { agent: agent(sessionId) }).then(
    () => { throw new Error('playwright load should fail') },
    (error) => error,
  )
  assert.match(denied.message, /MCP 服务 playwright 未挂到预设 standard/)
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent(sessionId) })
  const names = assembled.tools.map((row) => row.name)
  assert.equal(names.includes('mcp__mail__imap_search'), true)
  assert.equal(names.includes('mcp__ai-hot__aihot_get_latest'), false)
  assert.equal(names.includes('mcp__playwright__click'), false)
  const catalog = assembled.sections.find((row) => row && row.name === 'fde:mcp-catalog')
  assert.match(catalog.text, /ai-hot \/ aihot_get_latest/)
  assert.equal(catalog.text.includes('mail /'), false)
  const ran = await executeMounted(assembled, 'mcp__mail__imap_search', { mailbox: 'INBOX' })
  assert.equal(ran.text, 'fake-mail-item')
  const missing = await executeMounted(assembled, 'mcp__ai-hot__aihot_get_latest', {}).then(
    () => { throw new Error('unloaded server should not run') },
    (error) => error,
  )
  assert.match(missing.message, /mcp__ai-hot__aihot_get_latest/)
})

test('a host restart restores every loaded server from the session log', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-mcp-log-'))
  const previous = process.env.FDE_DSH_SESSION_ROOT
  process.env.FDE_DSH_SESSION_ROOT = home
  const sessionId = 'sess-restart'
  try {
    await writeLoadLog(home, sessionId, ['mail', 'ai-hot', 'playwright'])
    const rows = [
      tool('fde_mcp_load', 'Load one MCP server by name.'),
      tool('read', 'Read a file.'),
      tool('mcp__news__latest', 'Fresh wire item.'),
    ]
    const bus = createBus(() => rows)
    bridge.installIuiModeGate(bus)
    await bus.waterfall('system-prompt/assemble', null, { agent: agent(sessionId) })
    rows.push(
      tool('mcp__mail__imap_search', 'Read the inbox.', 80),
      tool('mcp__ai-hot__aihot_get_latest', 'Latest industry notes.', 80),
      tool('mcp__playwright__click', 'Click a browser element.', 80),
    )
    const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent(sessionId) })
    const names = assembled.tools.map((row) => row.name)
    assert.equal(names.includes('mcp__mail__imap_search'), true)
    assert.equal(names.includes('mcp__ai-hot__aihot_get_latest'), true)
    assert.equal(names.includes('mcp__news__latest'), false)
    assert.equal(names.includes('mcp__playwright__click'), false)
    const catalog = assembled.sections.find((row) => row && row.name === 'fde:mcp-catalog')
    assert.match(catalog.text, /news \/ latest \/ Fresh wire item\./)
    assert.equal(catalog.text.includes('mail /'), false)
    assert.equal(catalog.text.includes('ai-hot /'), false)
  } finally {
    if (previous == null) delete process.env.FDE_DSH_SESSION_ROOT
    else process.env.FDE_DSH_SESSION_ROOT = previous
    await rm(home, { recursive: true, force: true })
  }
})

test('a server that was not in the table appears in the catalog', async () => {
  const rows = fixtureTools()
  const bus = createBus(() => rows)
  bridge.installIuiModeGate(bus)
  const first = await bus.waterfall('system-prompt/assemble', null, { agent: agent('sess-new') })
  const firstCatalog = first.sections.find((row) => row && row.name === 'fde:mcp-catalog')
  assert.ok(firstCatalog)
  assert.equal(firstCatalog.text.includes('news'), false)
  rows.push(tool('mcp__news__latest', 'Fresh wire item.'))
  const second = await bus.waterfall('system-prompt/assemble', null, { agent: agent('sess-new-2') })
  const catalog = second.sections.find((row) => row && row.name === 'fde:mcp-catalog')
  assert.match(catalog.text, /news \/ latest \/ Fresh wire item\./)
})
