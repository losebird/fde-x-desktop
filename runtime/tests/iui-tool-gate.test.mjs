import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const bridge = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'fde-x-dsh-bridge', 'lib', 'index.js'))

function contained(filePath, root) {
  const rel = relative(resolve(root), resolve(filePath))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function createBus() {
  const hooks = new Map()
  return {
    on(name, listener, prepend) {
      const list = hooks.get(name) || []
      if (prepend) list.unshift(listener)
      else list.push(listener)
      hooks.set(name, list)
    },
    waterfall(name, exec) {
      const cbs = (hooks.get(name) || []).slice()
      const inner = () => ({ kind: 'allow' })
      const next = () => {
        const listener = cbs.shift()
        return listener ? listener(exec, next) : inner()
      }
      return next()
    },
  }
}

function htmlExec(preset, filePath, cwd) {
  return {
    arguments: { filePath, content: '<html></html>' },
    agent: { session: { header: { agentPreset: preset, cwd } } },
  }
}

function installChain() {
  const bus = createBus()
  let checks = 0
  bridge.installIuiModeGate(bus)
  bus.on('tools/pre-execute', async (exec, next) => {
    const filePath = exec && exec.arguments && exec.arguments.filePath
    if (typeof filePath === 'string' && /\.(?:html?|xhtml)$/iu.test(filePath.trim())) {
      return { kind: 'deny', reason: 'IUI: do NOT write HTML/web pages to files' }
    }
    return next()
  })
  bus.on('tools/pre-execute', async (exec, next) => {
    checks += 1
    const decision = await next()
    if (!decision || decision.kind !== 'allow') return decision
    const filePath = exec.arguments.filePath
    const cwd = exec.agent.session.header.cwd
    const allowed = contained(filePath, cwd) || contained(filePath, '/tmp') || contained(filePath, tmpdir())
    if (!allowed) {
      return {
        kind: 'deny',
        reason: `cannot write "${filePath}": file access denied under workspace-write mode`,
      }
    }
    return decision
  })
  return {
    bus,
    checks: () => checks,
  }
}

test('app-build html write outside the workspace stays denied', async () => {
  const chain = installChain()
  const decision = await chain.bus.waterfall(
    'tools/pre-execute',
    htmlExec('fde-app-builder', '/opt/fde-outside/page.html', '/workspace/app'),
  )
  assert.equal(chain.checks(), 1)
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /file access denied under workspace-write mode/)
  assert.doesNotMatch(decision.reason, /^IUI:/)
})

test('app-build html inside the workspace or temp is not an IUI deny', async () => {
  const inside = installChain()
  const insideDecision = await inside.bus.waterfall(
    'tools/pre-execute',
    htmlExec('fde-app-builder', '/workspace/app/page.html', '/workspace/app'),
  )
  assert.equal(inside.checks(), 1)
  assert.deepEqual(insideDecision, { kind: 'allow' })

  const temp = installChain()
  const tempDecision = await temp.bus.waterfall(
    'tools/pre-execute',
    htmlExec('fde-briefing', '/tmp/page.html', '/workspace/app'),
  )
  assert.equal(temp.checks(), 1)
  assert.deepEqual(tempDecision, { kind: 'allow' })
})

test('standard mode still keeps the IUI html deny', async () => {
  const chain = installChain()
  const decision = await chain.bus.waterfall(
    'tools/pre-execute',
    htmlExec('standard', '/opt/fde-outside/page.html', '/workspace/app'),
  )
  assert.equal(chain.checks(), 0)
  assert.equal(decision.kind, 'deny')
  assert.match(decision.reason, /^IUI:/)
})
