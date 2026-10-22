import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bridge = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'index.js'))
const tools = require(join(root, 'runtime', 'fde-x-dsh-bridge', 'lib', 'tools.js'))
const policy = require(join(root, 'runtime', 'mode-policy.cjs'))

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

function createBus(assembleTools = fixtureTools) {
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
          if (name === 'system-prompt/assemble') return { sections: [], tools: assembleTools() }
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
  const sessionId = 'volatile-deny'
  const first = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.deepEqual(first.tools.map((row) => row.name), ['read'])
  assert.match(catalogText(first), /mail \//)
  assert.equal(catalogText(first).includes('cua-driver'), false)
  deny.current = ['chrome-devtools', 'playwright']
  const second = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.match(catalogText(second), /cua-driver \//)
  assert.equal(catalogText(second).includes('chrome-devtools'), false)
  assert.equal(second.tools.some((row) => row.name.startsWith('mcp__')), false)
  const registered = []
  tools.registerTools({
    get config() { throw new Error('cannot get property "config" without inject') },
    tools: { register(spec) { registered.push(spec) } },
  }, { defineTool: (spec) => spec, config: bus.config })
  const load = registered.find((spec) => spec.name === 'fde_mcp_load')
  const loaded = await load.execute({ server: 'cua-driver' }, { agent: agent('standard', sessionId) })
  assert.match(loaded, /mcp__cua-driver__click/)
  const third = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.equal(third.tools.some((row) => row.name === 'mcp__cua-driver__click'), true)
  assert.equal(third.tools.some((row) => row.name.startsWith('mcp__chrome-devtools')), false)
  briefing.current = false
  const kept = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', 'volatile-briefing') })
  assert.match(catalogText(kept), /mail \//)
  assert.equal(kept.tools.some((row) => row.name.startsWith('mcp__')), false)
})

test('standard request catalogs mail and drops the denied MCP servers', async () => {
  const bus = createBus()
  bridge.installIuiModeGate(bus, bus.config)
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

// Unstaged fde-briefing still drops every user MCP. That is the #18 rule.
// The staged test below is the exception, and only for the session that has an allow file.
test('fde-briefing request drops every user MCP tool and other presets catalog them', async () => {
  const briefingBus = createBus()
  bridge.installIuiModeGate(briefingBus, briefingBus.config)
  const briefing = await briefingBus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing') })
  assert.deepEqual(briefing.tools.map((row) => row.name), ['read'])
  assert.equal(catalogText(briefing), '')
  assert.equal(schemaTokens(briefing.tools), schemaTokens([fixtureTools()[4]]))

  const appBus = createBus()
  bridge.installIuiModeGate(appBus, appBus.config)
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

test('an empty standard deny list puts those servers back in the catalog', async () => {
  const bus = createBus()
  bus.config = { standardDenyServers: [], briefingDenyUserMcp: false }
  bridge.installIuiModeGate(bus, bus.config)
  const sessionId = 'mount-empty-deny'
  const assembled = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.deepEqual(assembled.tools.map((row) => row.name), ['read'])
  const text = catalogText(assembled)
  for (const server of ['cua-driver', 'chrome-devtools', 'playwright', 'mail']) {
    assert.match(text, new RegExp(`${server} /`))
  }
  const registered = []
  tools.registerTools({
    get config() { throw new Error('cannot get property "config" without inject') },
    tools: { register(spec) { registered.push(spec) } },
  }, { defineTool: (spec) => spec, config: bus.config })
  const load = registered.find((spec) => spec.name === 'fde_mcp_load')
  const loaded = await load.execute({ server: 'playwright' }, { agent: agent('standard', sessionId) })
  assert.match(loaded, /mcp__playwright__click/)
  const next = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', sessionId) })
  assert.equal(next.tools.some((row) => row.name === 'mcp__playwright__click'), true)
  const briefing = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', 'mount-empty-briefing') })
  assert.equal(briefing.tools.some((row) => row.name.startsWith('mcp__')), false)
  assert.match(catalogText(briefing), /mail \//)
})

function briefingFixture() {
  return [
    tool('mcp__cua-driver__click', 400),
    tool('mcp__chrome-devtools__navigate', 280),
    tool('mcp__playwright__click', 180),
    tool('mcp__mail__imap_search', 12),
    tool('mcp__rss__fetch', 12),
    tool('read', 8),
  ]
}

function writeBriefingAllow(home, sessionId, servers) {
  const dir = join(home, 'run', 'briefing-allow')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(join(dir, `${sessionId}.json`), `${JSON.stringify({ servers })}\n`, { mode: 0o600 })
}

function useAllowHome(t) {
  const previous = process.env.FDE_DSH_HOME
  const home = mkdtempSync(join(tmpdir(), 'briefing-allow-'))
  process.env.FDE_DSH_HOME = home
  t.after(() => {
    if (previous === undefined) delete process.env.FDE_DSH_HOME
    else process.env.FDE_DSH_HOME = previous
    rmSync(home, { recursive: true, force: true })
  })
  return home
}

test('a briefing allow file opens only that session and never a browser server', async (t) => {
  const home = useAllowHome(t)
  const sessionA = 'session-brief-allow'
  const sessionB = 'session-brief-other'
  writeBriefingAllow(home, sessionA, ['mail', 'rss', 'playwright', 'ghost'])
  const mount = {
    standardDenyServers: STANDARD_DENY.slice(),
    briefingDenyUserMcp: true,
  }
  assert.equal(policy.deniedServer('mail', 'fde-briefing', mount, sessionA), '')
  assert.equal(policy.deniedServer('rss', 'fde-briefing', mount, sessionA), '')
  assert.equal(policy.deniedServer('ghost', 'fde-briefing', mount, sessionA), '')
  assert.equal(policy.deniedServer('playwright', 'fde-briefing', mount, sessionA), 'playwright')
  assert.equal(policy.deniedServer('cua-driver', 'fde-briefing', mount, sessionA), 'cua-driver')
  assert.equal(policy.deniedServer('chrome-devtools', 'fde-briefing', mount, sessionA), 'chrome-devtools')
  assert.equal(policy.deniedServer('news', 'fde-briefing', mount, sessionA), 'news')
  assert.equal(policy.deniedServer('mail', 'fde-briefing', mount, sessionB), 'mail')
  assert.equal(policy.deniedServer('mail', 'fde-briefing', mount), 'mail')
  assert.equal(policy.deniedServer('playwright', 'standard', mount, sessionA), 'playwright')
  assert.equal(policy.deniedServer('mail', 'standard', mount, sessionA), '')
  assert.equal(policy.deniedServer('mail', 'fde-app-builder', mount, sessionA), '')
  rmSync(join(home, 'run', 'briefing-allow', `${sessionA}.json`))
  assert.equal(policy.deniedServer('mail', 'fde-briefing', mount, sessionA), 'mail')
})

test('a staged briefing prompt catalogs the allow list and keeps full MCP schemas out', async (t) => {
  const home = useAllowHome(t)
  const sessionA = 'session-brief-catalog'
  const sessionB = 'session-brief-catalog-other'
  writeBriefingAllow(home, sessionA, ['mail', 'rss', 'playwright'])
  const bus = createBus(briefingFixture)
  bridge.installIuiModeGate(bus, bus.config)
  const before = schemaTokens(briefingFixture())
  const briefing = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', sessionA) })
  assert.deepEqual(briefing.tools.map((row) => row.name), ['read'])
  const text = catalogText(briefing)
  assert.match(text, /mail \/ imap_search \//)
  assert.match(text, /rss \/ fetch \//)
  assert.equal(text.includes('playwright'), false)
  assert.equal(text.includes('cua-driver'), false)
  assert.equal(text.includes('chrome-devtools'), false)
  assert.equal(text.includes('ghost'), false)
  assert.equal(schemaTokens(briefing.tools), schemaTokens([briefingFixture()[5]]))
  assert.ok(before - schemaTokens(briefing.tools) > 1000, `${before} cataloged`)
  const other = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', sessionB) })
  assert.equal(catalogText(other), '')
  assert.deepEqual(other.tools.map((row) => row.name), ['read'])
  const standard = await bus.waterfall('system-prompt/assemble', null, { agent: agent('standard', 'session-std-beside') })
  const standardText = catalogText(standard)
  assert.match(standardText, /mail \//)
  assert.match(standardText, /rss \//)
  assert.equal(standardText.includes('playwright'), false)
  assert.equal(standardText.includes('cua-driver'), false)
  const builder = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-app-builder', 'session-app-beside') })
  assert.match(catalogText(builder), /playwright \//)
  assert.match(catalogText(builder), /mail \//)
})

test('pre-execute and fde_mcp_load use the same briefing allow file', async (t) => {
  const home = useAllowHome(t)
  const sessionA = 'session-brief-load'
  const sessionB = 'session-brief-load-other'
  writeBriefingAllow(home, sessionA, ['mail', 'rss', 'playwright', 'ghost'])
  const bus = createBus(briefingFixture)
  let later = 0
  bus.on('tools/pre-execute', async (_exec, next) => {
    later += 1
    return next()
  })
  bridge.installIuiModeGate(bus, bus.config)
  await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', sessionA) })
  const opened = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__mail__imap_search',
    arguments: {},
    agent: agent('fde-briefing', sessionA),
  })
  assert.deepEqual(opened, { kind: 'allow' })
  assert.equal(later, 1)
  const closed = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__mail__imap_search',
    arguments: {},
    agent: agent('fde-briefing', sessionB),
  })
  assert.equal(closed.kind, 'deny')
  assert.match(closed.reason, /mail/)
  assert.match(closed.reason, /fde-briefing/)
  const browser = await bus.waterfall('tools/pre-execute', {
    name: 'mcp__playwright__click',
    arguments: {},
    agent: agent('fde-briefing', sessionA),
  })
  assert.equal(browser.kind, 'deny')
  assert.match(browser.reason, /playwright/)
  assert.equal(later, 1)
  const registered = []
  tools.registerTools({
    get config() { throw new Error('cannot get property "config" without inject') },
    tools: { register(spec) { registered.push(spec) } },
  }, { defineTool: (spec) => spec, config: bus.config })
  const load = registered.find((spec) => spec.name === 'fde_mcp_load')
  const loaded = await load.execute({ server: 'mail' }, { agent: agent('fde-briefing', sessionA) })
  assert.match(loaded, /mcp__mail__imap_search/)
  await assert.rejects(
    () => load.execute({ server: 'playwright' }, { agent: agent('fde-briefing', sessionA) }),
    /playwright/,
  )
  await assert.rejects(
    () => load.execute({ server: 'mail' }, { agent: agent('fde-briefing', sessionB) }),
    /mail/,
  )
  await assert.rejects(
    () => load.execute({ server: 'ghost' }, { agent: agent('fde-briefing', sessionA) }),
    /不在目录里/,
  )
  const afterLoad = await bus.waterfall('system-prompt/assemble', null, { agent: agent('fde-briefing', sessionA) })
  assert.equal(afterLoad.tools.some((row) => row.name === 'mcp__mail__imap_search'), true)
  assert.equal(afterLoad.tools.some((row) => row.name === 'mcp__rss__fetch'), false)
  assert.equal(afterLoad.tools.some((row) => row.name.startsWith('mcp__playwright')), false)
})
