import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alignModelRowsWithDiscover,
  pickModelRowFields,
} from '../models-settings.mjs'

test('pickModelRowFields omits empty reasoning', () => {
  const row = pickModelRowFields({ id: 'm1', name: 'M1' })
  assert.equal(row.reasoningEfforts, undefined)
})

test('alignModelRowsWithDiscover keeps reasoning only from discover', () => {
  const models = [{
    id: 'Qwen/Qwen3.8-27B',
    name: 'qwen',
    reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
  }]
  const discovered = [{ id: 'Qwen/Qwen3.8-27B', name: 'qwen' }]
  const aligned = alignModelRowsWithDiscover(models, discovered)
  assert.equal(aligned[0].reasoningEfforts, undefined)

  const discoveredWithReasoning = [{
    id: 'grok-4.5',
    name: 'grok',
    reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
  }]
  const grokModels = [{ id: 'grok-4.5', name: 'grok' }]
  const grokAligned = alignModelRowsWithDiscover(grokModels, discoveredWithReasoning)
  assert.deepEqual(grokAligned[0].reasoningEfforts, discoveredWithReasoning[0].reasoningEfforts)
})
