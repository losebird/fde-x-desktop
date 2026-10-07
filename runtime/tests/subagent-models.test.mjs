import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fillSubagentAllowedModelsInPatch,
  routesFromLlmPatchBlock,
  routesFromProviders,
  ensureSubagentAllowedModels,
} from '../subagent-models.mjs'

const SAMPLE = `
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      grok2api:
        displayName: grok2api
        models:
          - id: grok-4.5
          - id: grok-4.6
      sili:
        models:
          - id: Qwen/Qwen3.8-27B
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: grok2api
    model: grok-4.6
- id: subagent-model-selection-settings
  name: "@deepseek-ai/dsh-tool-subagent/model-selection-settings"
  config:
    enabled: true
`

test('routesFromProviders puts the default model first and keeps catalog ids', () => {
  const routes = routesFromProviders({
    grok2api: { models: [{ id: 'grok-4.5' }, { id: 'grok-4.6' }] },
  }, { provider: 'grok2api', model: 'grok-4.6' })
  assert.equal(routes[0].model, 'grok-4.6')
  assert.equal(routes[0].provider, 'grok2api')
  assert.ok(routes.some((row) => row.model === 'grok-4.5'))
})

test('fillSubagentAllowedModelsInPatch writes catalog routes when enabled list is empty', () => {
  const fromBlock = routesFromLlmPatchBlock(SAMPLE)
  assert.ok(fromBlock.some((row) => row.provider === 'grok2api' && row.model === 'grok-4.6'))
  assert.ok(fromBlock.some((row) => row.provider === 'sili'))
  const filled = fillSubagentAllowedModelsInPatch(SAMPLE)
  assert.equal(filled.changed, true)
  assert.match(filled.text, /allowedModels:/)
  assert.match(filled.text, /provider: grok2api/)
  assert.match(filled.text, /model: "grok-4.6"/)
  const again = fillSubagentAllowedModelsInPatch(filled.text)
  assert.equal(again.changed, false)
})

test('ensureSubagentAllowedModels mutates Host when enabled with an empty list', async () => {
  const calls = []
  const routes = await ensureSubagentAllowedModels({
    status: () => ({ connected: true }),
    rpc: async (endpoint, args) => {
      calls.push({ endpoint, args })
      if (endpoint === 'settings/describe') {
        return {
          namespaces: [
            { ns: 'subagent-model-selection-settings', revision: 3, value: { enabled: true, allowedModels: [] } },
            { ns: 'llm-pi-ai', value: { providers: { grok2api: { models: [{ id: 'grok-4.6' }] } } } },
            { ns: 'agent-default-model', value: { provider: 'grok2api', model: 'grok-4.6' } },
          ],
        }
      }
      return {}
    },
  })
  assert.equal(routes[0].model, 'grok-4.6')
  assert.equal(calls[1].endpoint, 'settings/mutate')
  assert.equal(calls[1].args.ns, 'subagent-model-selection-settings')
  assert.deepEqual(calls[1].args.ops[0].path, ['allowedModels'])
})
