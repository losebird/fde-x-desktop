import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'

const require = createRequire(import.meta.url)
const policy = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'mode-policy.cjs'))

function probeHost() {
  const sections = []
  const tools = []
  const skills = []
  const listeners = []
  const reflect = {
    get(name) {
      if (name === 'webServer') return { register() { return () => {} } }
      return undefined
    },
  }
  const bag = {
    settings: { configure() {} },
    fiber: {},
    effect(fn) {
      if (typeof fn === 'function') fn()
    },
    logger: { warn() {} },
    tools: { register(tool) { tools.push(tool && tool.name) } },
    skills: { registerProvider(factory) { skills.push(factory()) } },
    reflect,
  }
  const ctx = {
    on(name, listener) {
      listeners.push({ name, listener })
      return () => {}
    },
    effect(fn) {
      if (typeof fn === 'function') fn()
    },
    fiber: {},
    logger: { warn() {}, error() {} },
    reflect,
    systemPrompt: {
      getSectionOrder() { return 50 },
      section(spec) { sections.push(spec.name) },
    },
    inject(_deps, fn) { fn(bag) },
  }
  return { ctx, sections, tools, skills, listeners }
}

test('pinned IUI registrations match the mode gate list', async () => {
  const dir = process.env.FDE_PLUGIN_IUI
  assert.equal(typeof dir, 'string', 'FDE_PLUGIN_IUI must point at the pinned @losebird/iui tree')
  assert.ok(dir.length > 0, 'FDE_PLUGIN_IUI must point at the pinned @losebird/iui tree')
  const builtin = BUILTIN_PLUGINS.find((plugin) => plugin.module === '@losebird/iui')
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
  const pinFile = JSON.parse(await readFile(join(dir, 'fde-plugin-pin.json'), 'utf8'))
  assert.equal(pkg.name, '@losebird/iui')
  assert.equal(pkg.version, builtin.source.version)
  assert.equal(pinFile.commit, builtin.source.commit)

  const plugin = await import(pathToFileURL(join(dir, 'lib', 'index.js')).href)
  const host = probeHost()
  plugin.apply(host.ctx, {})
  const listed = []
  for (const provider of host.skills) {
    const rows = await provider.list()
    listed.push({ provider: provider.name, skills: rows.map((row) => row.name) })
  }
  assert.deepEqual(host.sections, [policy.IUI_SECTION_NAME])
  assert.deepEqual([...host.tools].sort(), [...policy.IUI_TOOL_NAMES].sort())
  assert.deepEqual(listed, [{ provider: policy.IUI_SKILL_NAME, skills: [policy.IUI_SKILL_NAME] }])

  const htmlGate = host.listeners.find((row) => row.name === 'tools/pre-execute')
  assert.equal(typeof htmlGate.listener, 'function')
  let continued = false
  const denied = await htmlGate.listener(
    { arguments: { filePath: '/opt/fde-outside/page.html', content: '<html></html>' } },
    () => {
      continued = true
      return { kind: 'allow' }
    },
  )
  assert.equal(continued, false)
  assert.equal(denied.kind, 'deny')
  assert.equal(denied.reason.startsWith(policy.IUI_HTML_DENY_PREFIX), true)
  const passed = await htmlGate.listener(
    { arguments: { filePath: '/opt/fde-outside/page.js', content: 'var x' } },
    () => ({ kind: 'allow' }),
  )
  assert.deepEqual(passed, { kind: 'allow' })
})
