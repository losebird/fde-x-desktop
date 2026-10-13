import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alignModelRowsWithDiscover,
  mergeModelRows,
  modelCapacityFromDiscoverRow,
  pickModelRowFields,
  sealCustomProviderModels,
} from '../models-settings-rows.mjs'
import { ensureSealedCustomReasoning } from '../models-settings.mjs'

test('pickModelRowFields omits empty reasoning', () => {
  const row = pickModelRowFields({ id: 'm1', name: 'M1' })
  assert.equal(row.reasoningEfforts, undefined)
})

test('pickModelRowFields keeps window effort and input', () => {
  const row = pickModelRowFields({
    id: 'm1',
    contextWindow: 500000,
    maxTokens: 32000,
    reasoningEfforts: { off: null, low: 'low' },
    input: ['text', 'image'],
  })
  assert.equal(row.contextWindow, 500000)
  assert.equal(row.maxTokens, 32000)
  assert.deepEqual(row.reasoningEfforts, { off: null, low: 'low' })
  assert.deepEqual(row.input, ['text', 'image'])
})

test('alignModelRowsWithDiscover keeps host effort when discover omits it', () => {
  const models = [{
    id: 'custom-a',
    name: 'a',
    reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high' },
    contextWindow: 500000,
  }]
  const discovered = [{ id: 'custom-a', name: 'a' }]
  const aligned = alignModelRowsWithDiscover(models, discovered)
  assert.deepEqual(aligned[0].reasoningEfforts, models[0].reasoningEfforts)
  assert.equal(aligned[0].contextWindow, 500000)
})

test('alignModelRowsWithDiscover fills empty window from discover', () => {
  const models = [{ id: 'custom-a', name: 'a' }]
  const discovered = [{ id: 'custom-a', name: 'a', contextWindow: 1000000, maxTokens: 8192 }]
  const aligned = alignModelRowsWithDiscover(models, discovered)
  assert.equal(aligned[0].contextWindow, 1000000)
  assert.equal(aligned[0].maxTokens, 8192)
})

test('alignModelRowsWithDiscover does not overwrite declared window', () => {
  const models = [{ id: 'custom-a', name: 'a', contextWindow: 500000 }]
  const discovered = [{ id: 'custom-a', name: 'a', contextWindow: 262144 }]
  const aligned = alignModelRowsWithDiscover(models, discovered)
  assert.equal(aligned[0].contextWindow, 500000)
})

test('alignModelRowsWithDiscover writes discover effort when present', () => {
  const discoveredWithReasoning = [{
    id: 'custom-b',
    name: 'b',
    reasoningEfforts: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
  }]
  const models = [{ id: 'custom-b', name: 'b' }]
  const aligned = alignModelRowsWithDiscover(models, discoveredWithReasoning)
  assert.deepEqual(aligned[0].reasoningEfforts, discoveredWithReasoning[0].reasoningEfforts)
})

test('mergeModelRows fills empty occupancy on existing ids', () => {
  const merged = mergeModelRows(
    [{ id: 'm1', name: 'one' }],
    [{ id: 'm1', name: 'one', contextWindow: 500000, reasoningEfforts: { off: null, high: 'high' } }],
  )
  assert.equal(merged[0].contextWindow, 500000)
  assert.deepEqual(merged[0].reasoningEfforts, { off: null, high: 'high' })
})

test('mergeModelRows does not overwrite declared window', () => {
  const merged = mergeModelRows(
    [{ id: 'm1', name: 'one', contextWindow: 500000 }],
    [{ id: 'm1', name: 'one', contextWindow: 262144 }],
  )
  assert.equal(merged[0].contextWindow, 500000)
})

test('sealCustomProviderModels writes false when efforts are omitted', () => {
  const sealed = sealCustomProviderModels([
    { id: 'grok-4.6', name: 'grok-4.6' },
    { id: 'other', name: 'other', reasoningEfforts: { off: null, low: 'low' } },
  ])
  assert.equal(sealed[0].reasoningEfforts, false)
  assert.deepEqual(sealed[1].reasoningEfforts, { off: null, low: 'low' })
})

test('ensureSealedCustomReasoning writes false on custom baseURL models', async () => {
  const { writeFile, readFile } = await import('node:fs/promises')
  const { mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const home = await mkdtemp(join(tmpdir(), 'fde-reason-seal-'))
  await writeFile(join(home, 'settings.yaml.imported'), `llm-pi-ai:
  providers:
    grok2api:
      api: openai-completions
      baseURL: "http://127.0.0.1:8000/v1"
      models:
        - { id: grok-4.6, name: grok-4.6 }
`)
  const result = ensureSealedCustomReasoning(home)
  assert.equal(result.changed, true)
  const live = await readFile(join(home, 'settings.yaml'), 'utf8')
  assert.match(live, /reasoningEfforts:\s*false/)
  assert.match(live, /id: grok-4.6/)
  const again = ensureSealedCustomReasoning(home)
  assert.equal(again.changed, false)
})

test('modelCapacityFromDiscoverRow maps openai-compat keys', () => {
  const packed = modelCapacityFromDiscoverRow({
    id: 'm',
    context_length: 500000,
    max_tokens: 32000,
  })
  assert.equal(packed.contextWindow, 500000)
  assert.equal(packed.maxTokens, 32000)
})

