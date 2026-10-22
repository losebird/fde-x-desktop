import assert from 'node:assert/strict'
import test from 'node:test'
import { createRouteGate } from '../tools.js'

function execFor(id, turn) {
  return {
    agent: {
      id,
      session: {
        id,
        events: [{ type: 'turn/start', data: { turn } }],
      },
    },
  }
}

test('graph lookup is blocked until route_intent this turn', async () => {
  const gate = createRouteGate({ graceMs: 0 })
  const exec = execFor('s1', 1)
  const blocked = await gate.allow('search_text', exec)
  assert.equal(blocked.ok, false)
  assert.match(blocked.error, /ROUTE_FIRST/)
  gate.mark(exec)
  assert.equal((await gate.allow('search_text', exec)).ok, true)
  assert.equal((await gate.allow('lineage', exec)).ok, true)
  const next = execFor('s1', 2)
  assert.equal((await gate.allow('search_text', next)).ok, false)
})

test('闲聊 tools and missing session are not gated', async () => {
  const gate = createRouteGate({ graceMs: 0 })
  assert.equal((await gate.allow('route_intent', execFor('s1', 1))).ok, true)
  assert.equal((await gate.allow('get_graph_summary', execFor('s1', 1))).ok, true)
  assert.equal((await gate.allow('search_text', {})).ok, true)
})

test('parallel route_intent unblocks search in the same batch', async () => {
  const gate = createRouteGate({ graceMs: 80 })
  const exec = execFor('s1', 1)
  const pending = gate.allow('search_text', exec)
  gate.begin(exec)
  gate.mark(exec)
  gate.end(exec)
  const got = await pending
  assert.equal(got.ok, true)
})

test('search alone still fails fast without a sibling route_intent', async () => {
  const gate = createRouteGate({ graceMs: 20 })
  const started = Date.now()
  const got = await gate.allow('search_text', execFor('s1', 1))
  assert.equal(got.ok, false)
  assert.ok(Date.now() - started < 200)
})
