import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('connectors wait for core instead of leaving a stale 核心还没接通 banner', () => {
  const src = readFileSync(join(root, 'src/pages/MCP.tsx'), 'utf8')
  assert.match(src, /useCoreStatus\(\)/)
  assert.match(src, /useWhenCoreConnects\(load, phase === 'ready' && !connected\)/)
})

test('AI banner publishes into the shared core status', () => {
  const src = readFileSync(join(root, 'src/pages/AI.tsx'), 'utf8')
  assert.match(src, /useCoreStatus\(\)/)
  assert.match(src, /publishCoreStatus\(/)
})

test('files retry listing when the shared core comes up', () => {
  const src = readFileSync(join(root, 'src/pages/Files.tsx'), 'utf8')
  assert.match(src, /useWhenCoreConnects/)
  assert.match(src, /核心未接通/)
})

test('skills reload when the core-down note is still showing', () => {
  const src = readFileSync(join(root, 'src/pages/Skills.tsx'), 'utf8')
  assert.match(src, /useWhenCoreConnects\(load, phase === 'coreDown' \|\| note === SURFACE_CORE_DOWN\)/)
})

test('new core-status listeners get the last snapshot immediately', () => {
  const src = readFileSync(join(root, 'src/components/settings/core-connection.ts'), 'utf8')
  assert.match(src, /if \(lastDelivered\) \{/)
  assert.match(src, /coreBootGuidance\(lastDelivered\)/)
})

test('core-connect watch treats state=connected as live', () => {
  const src = readFileSync(join(root, 'src/components/settings/core-connection.ts'), 'utf8')
  assert.match(src, /function isCoreConnected/)
  assert.match(src, /export function useCoreStatus/)
  assert.match(src, /export function publishCoreStatus/)
  assert.match(src, /!isCoreConnected\(status\)/)
})

test('connected core wins before incomplete IUI contract checks', () => {
  const src = readFileSync(join(root, 'src/components/settings/core-connection.ts'), 'utf8')
  const fn = src.slice(src.indexOf('export function coreBootGuidance'))
  const connected = fn.indexOf("status?.connected || status?.state === 'connected'")
  const installing = fn.indexOf("iui?.state === 'installing'")
  assert.ok(connected >= 0 && installing >= 0 && connected < installing)
})
