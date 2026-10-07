import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CANVAS_TOOL_NAMES } from '../vendor-overlays/dsh-semantic-os/search-excerpt.js'

test('registerTools keeps route_intent and omits canvas ingest/export tools', () => {
  const tools = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor-overlays', 'dsh-semantic-os', 'tools.js'), 'utf8')
  assert.match(tools, /name: 'route_intent'/)
  assert.match(tools, /CANVAS_TOOL_NAMES.has\(spec.name\)/)
  assert.ok(CANVAS_TOOL_NAMES.has('extract_entities'))
  assert.ok(CANVAS_TOOL_NAMES.has('backup_graph'))
  assert.ok(CANVAS_TOOL_NAMES.has('get_graph_analytics'))
  assert.equal(CANVAS_TOOL_NAMES.has('route_intent'), false)
  assert.equal(CANVAS_TOOL_NAMES.has('search_text'), false)
  assert.equal(CANVAS_TOOL_NAMES.has('record_decision'), false)
})
