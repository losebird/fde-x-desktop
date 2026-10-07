import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mcpOccupancyFrozen, waitMcpOccupancy } from '../tool-occupancy.mjs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('mcp occupancy is frozen when no servers are configured', () => {
  assert.equal(mcpOccupancyFrozen([], []), true)
  assert.equal(mcpOccupancyFrozen([], [{ serverName: 'alpha', disabled: true }]), true)
})

test('mcp occupancy waits until fibers are active or failed', () => {
  const configured = [{ serverName: 'alpha' }, { serverName: 'beta' }]
  assert.equal(mcpOccupancyFrozen([], configured), false)
  assert.equal(mcpOccupancyFrozen([{ id: 'mcp-alpha', fiberPhase: 'active' }], configured), false)
  assert.equal(mcpOccupancyFrozen([
    { id: 'mcp-alpha', fiberPhase: 'active' },
    { id: 'mcp-beta', fiberPhase: 'failed' },
  ], configured), true)
})

test('waitMcpOccupancy freezes after fibers settle', async () => {
  let n = 0
  const listed = await waitMcpOccupancy({
    timeoutMs: 1000,
    pollMs: 10,
    configured: [{ serverName: 'alpha' }],
    listPlugins: async () => {
      n += 1
      if (n < 3) return [{ id: 'mcp-alpha', fiberPhase: 'starting' }]
      return [{ id: 'mcp-alpha', fiberPhase: 'active' }]
    },
  })
  assert.equal(listed.frozen, true)
  assert.equal(listed.timedOut, false)
  assert.ok(n >= 3)
})

test('semantic-os system prompt does not advertise project-memory or greeting search', () => {
  const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor-overlays', 'dsh-semantic-os', 'index.js'), 'utf8')
  assert.match(text, /route_intent names which graph tool/)
  assert.doesNotMatch(text, /project-memory/)
  assert.doesNotMatch(text, /Ask about prior project facts with search_text/)
})
