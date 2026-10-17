import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bridge = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'index.js'))
const tools = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'tools.js'))

const STANDARD_DENY = ['cua-driver', 'chrome-devtools', 'playwright']

function tool(name, words) {
  const description = `${name} ${'token '.repeat(words)}`.trim()
  return {
    name,
    description,
    parameters: { type: 'object', properties: { q: { type: 'string', description } } },
  }
}

function schemaTokens(tools) {
  const json = JSON.stringify(tools.map((row) => ({
    name: row.name,
    description: row.description,
    parameters: row.parameters,
  })))
  return Math.ceil(Buffer.byteLength(json, 'utf8') / 4)
}

function fixtureTools() {
  return [
    tool('mcp__cua-driver__click', 400),
    tool('mcp__chrome-devtools__navigate', 280),
    tool('mcp__playwright__click', 180),
    tool('mcp__mail__imap_search', 12),
    tool('read', 8),
  ]
}

function createBus() {
  const hooks = new Map()
  return {
    config: {
      standardDenyServers: STANDARD_DENY.slice(),
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
          if (name === 'system-prompt/assemble') return { sections: [], tools: fixtureTools() }
          return { kind: 'allow' }
        }
        if (name === 'system-prompt/assemble') return listener(payload, context, call)
        return listener(payload, call)
      }
      return call()
    },
  }
}

function agent(preset, sessionId = '') {
  return { session: { id: sessionId, header: { agentPreset: preset } } }
}

function catalogText(assembled) {
  const section = assembled.sections.find((row) => row && row.name === 'fde:mcp-catalog')
  return section ? section.text : ''
}

test('the bridge patch row is the standard and briefing MCP mount table', () => {
  const text = readFileSync(join(root, 'runtime', 'dsh-core.patch.yml'), 'utf8')
  const block = text.split('- id: fde-x-dsh-bridge')[1] || ''
  assert.match(block, /standardDenyServers:/)
  for (const server of STANDARD_DENY) assert.match(block, new RegExp(`- ${server}\\b`))
  assert.match(block, /briefingDenyUserMcp:\s*true/)
})

test('standard request catalogs mail and drops the denied MCP servers', async () => {
  const bus = createBus()
  bridge.installIuiModeGate(bus)
  const before = schemaTokens(fixtureTools())
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard') })
  const names = assembled.tools.map((row) => row.name)
  assert.deepEqual(names, ['read'])
  const text = catalogText(assembled)
  assert.match(text, /mail \/ imap_search \//)
  assert.equal(text.includes('cua-driver'), false)
  assert.equal(text.includes('chrome-devtools'), false)
  assert.equal(text.includes('playwright'), false)
  const after = schemaTokens(assembled.tools)
  const kept = schemaTokens(fixtureTools().filter((row) => names.includes(row.name)))
  assert.equal(after, kept)
  assert.ok(before - after > 1000, `${before} -> ${after}`)
})

test('fde-briefing request drops every user MCP tool and other presets catalog them', async () => {
  const briefingBus = createBus()
  bridge.installIuiModeGate(briefingBus)
  const briefing = await briefingBus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing') })
  assert.deepEqual(briefing.tools.map((row) => row.name), ['read'])
  assert.equal(catalogText(briefing), '')
  assert.equal(schemaTokens(briefing.tools), schemaTokens([fixtureTools()[4]]))

  const appBus = createBus()
  bridge.installIuiModeGate(appBus)
  const app = await appBus.waterfall('system-prompt/assemble', null, { agent: agent('fde-app-builder') })
  assert.deepEqual(app.tools.map((row) => row.name), ['read'])
  const text = catalogText(app)
  for (const server of ['cua-driver', 'chrome-devtools', 'playwright', 'mail']) {
    assert.match(text, new RegExp(`${server} /`))
  }
})

test('pre-execute denies the same servers and still allows a mounted one', async () => {
  const bus = createBus()
  let later = 0
  bus.on('tools/pre-execute', async (_exec, next) => {
    later += 1
    return next()
  })
  bridge.installIuiModeGate(bus)
  const denied = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__playwright__click',
    arguments: {},
    agent: agent('standard'),
  })
  assert.equal(denied.kind, 'deny')
  assert.match(denied.reason, /playwright/)
  assert.equal(later, 0)

  const briefing = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__mail__imap_search',
    arguments: {},
    agent: agent('fde-briefing'),
  })
  assert.equal(briefing.kind, 'deny')
  assert.match(briefing.reason, /mail/)

  const allowed = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__mail__imap_search',
    arguments: {},
    agent: agent('standard'),
  })
  assert.deepEqual(allowed, { kind: 'allow' })
  assert.equal(later, 1)

  const direct = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__mail__imap_search',
    arguments: {},
  })
  assert.deepEqual(direct, { kind: 'allow' })
})

test('an empty standard deny list puts those servers back in the catalog', async () => {
  const bus = createBus()
  bus.config = { standardDenyServers: [], briefingDenyUserMcp: false }
  bridge.installIuiModeGate(bus)
  const sessionId = 'mount-empty-deny'
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.deepEqual(assembled.tools.map((row) => row.name), ['read'])
  const text = catalogText(assembled)
  for (const server of ['cua-driver', 'chrome-devtools', 'playwright', 'mail']) {
    assert.match(text, new RegExp(`${server} /`))
  }
  const registered = []
  tools.registerTools({
    config: bus.config,
    tools: { register(spec) { registered.push(spec) } },
  }, { defineTool: (spec) => spec })
  const load = registered.find((spec) => spec.name === 'fde_mcp_load')
  const loaded = await load.execute({ server: 'playwright' }, { agent: agent('standard', sessionId) })
  assert.match(loaded, /mcp__playwright__click/)
  const next = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.equal(next.tools.some((row) => row.name === 'mcp__playwright__click'), true)
  const briefing = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', 'mount-empty-briefing') })
  assert.equal(briefing.tools.some((row) => row.name.startsWith('mcp__')), false)
  assert.match(catalogText(briefing), /mail \//)
})
