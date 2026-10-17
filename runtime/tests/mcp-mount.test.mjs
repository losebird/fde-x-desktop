import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bridge = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'index.js'))

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

function agent(preset) {
  return { session: { header: { agentPreset: preset } } }
}

test('the bridge bundle patch is the standard and briefing MCP mount table', () => {
  const text = readFileSync(join(root, 'runtime', 'fde-x-dsh-bridge', 'cordis.patch.yml'), 'utf8')
  const block = text.split('- id: fde-x-dsh-bridge')[1] || ''
  assert.match(block, /standardDenyServers:/)
  for (const server of STANDARD_DENY) assert.match(block, new RegExp(`- ${server}\\b`))
  assert.match(block, /briefingDenyUserMcp:\s*true/)
  const cli = readFileSync(join(root, 'runtime', 'dsh-core.patch.yml'), 'utf8')
  assert.equal(cli.includes('fde-x-dsh-bridge'), false)
})

test('a profile config replaces the bundle mount table', async () => {
  const hostRequire = createRequire(join(root, 'runtime/.host-generation/node_modules/js-yaml/package.json'))
  const yaml = hostRequire('js-yaml')
  const bundle = yaml.load(readFileSync(join(root, 'runtime', 'fde-x-dsh-bridge', 'cordis.patch.yml'), 'utf8'))
  const includeUrl = pathToFileURL(join(root, 'runtime/.host-generation/node_modules/@deepseek-ai/cordis-plugin-include/lib/index.js'))
  const { applyEntryPatches } = await import(includeUrl.href)
  const profile = [{
    id: 'fde-x-dsh-bridge',
    config: {
      standardDenyServers: ['chrome-devtools', 'playwright'],
      briefingDenyUserMcp: true,
    },
  }]
  const composed = applyEntryPatches([], [...bundle, ...profile], () => {})
  const row = composed.find((entry) => entry.id === 'fde-x-dsh-bridge')
  assert.deepEqual(row.config.standardDenyServers, ['chrome-devtools', 'playwright'])
  assert.equal(row.config.briefingDenyUserMcp, true)
})

test('a later read sees a volatile deny list change', async () => {
  const bus = createBus()
  const deny = { current: STANDARD_DENY.slice() }
  const briefing = { current: true }
  const volatileWrite = Symbol.for('cosmokit.volatile.write')
  const ref = (read) => ({ get: read, [volatileWrite]() {} })
  bus.config = {
    standardDenyServers: ref(() => deny.current),
    briefingDenyUserMcp: ref(() => briefing.current),
  }
  bridge.installIuiModeGate(bus, bus.config)
  const first = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard') })
  assert.deepEqual(first.tools.map((row) => row.name), ['mcp__mail__imap_search', 'read'])
  deny.current = ['chrome-devtools', 'playwright']
  const second = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard') })
  assert.deepEqual(second.tools.map((row) => row.name), ['mcp__cua-driver__click', 'mcp__mail__imap_search', 'read'])
  briefing.current = false
  const kept = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing') })
  assert.equal(kept.tools.some((row) => row.name.startsWith('mcp__')), true)
})

test('standard request keeps mail and drops the denied MCP servers', async () => {
  const bus = createBus()
  bridge.installIuiModeGate(bus, bus.config)
  const before = schemaTokens(fixtureTools())
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard') })
  const names = assembled.tools.map((row) => row.name)
  assert.deepEqual(names, ['mcp__mail__imap_search', 'read'])
  const after = schemaTokens(assembled.tools)
  const kept = schemaTokens(fixtureTools().filter((row) => names.includes(row.name)))
  assert.equal(after, kept)
  assert.ok(before - after > 1000, `${before} -> ${after}`)
})

test('fde-briefing request drops every user MCP tool and other presets keep them', async () => {
  const briefingBus = createBus()
  bridge.installIuiModeGate(briefingBus, briefingBus.config)
  const briefing = await briefingBus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing') })
  assert.deepEqual(briefing.tools.map((row) => row.name), ['read'])
  assert.equal(schemaTokens(briefing.tools), schemaTokens([fixtureTools()[4]]))

  const appBus = createBus()
  bridge.installIuiModeGate(appBus, appBus.config)
  const app = await appBus.waterfall('system-prompt/assemble', null, { agent: agent('fde-app-builder') })
  assert.deepEqual(app.tools.map((row) => row.name), fixtureTools().map((row) => row.name))
})

test('pre-execute denies the same servers and still allows a mounted one', async () => {
  const bus = createBus()
  let later = 0
  bus.on('tools/pre-execute', async (_exec, next) => {
    later += 1
    return next()
  })
  bridge.installIuiModeGate(bus, bus.config)
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

test('an empty standard deny list mounts those servers again', async () => {
  const bus = createBus()
  bus.config = { standardDenyServers: [], briefingDenyUserMcp: false }
  bridge.installIuiModeGate(bus, bus.config)
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard') })
  assert.deepEqual(assembled.tools.map((row) => row.name), fixtureTools().map((row) => row.name))
  const briefing = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing') })
  assert.equal(briefing.tools.some((row) => row.name.startsWith('mcp__')), true)
})
