import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { llmFingerprint, llmFromDescribe, llmPublicView, writeLlmOccupancy } from '../dsh-default-llm.mjs'
import { readDshLlm, llmFromDescribe as overlayFromDescribe } from '../vendor-overlays/dsh-semantic-os/dsh-llm.js'

test('llmFromDescribe uses Host namespaces and credential configured flag', () => {
  const llm = llmFromDescribe(
    [
      { ns: 'agent-default-model', value: { provider: 'grok2api', model: 'grok-4.6' } },
      {
        ns: 'llm-pi-ai',
        value: {
          providers: {
            grok2api: { apiKeyEnv: 'GROK2API_API_KEY', api: 'openai-responses', baseURL: 'http://127.0.0.1:8000/v1' },
          },
        },
      },
    ],
    { GROK2API_API_KEY: { configured: true } },
  )
  assert.equal(llm.dshProvider, 'grok2api')
  assert.equal(llm.model, 'grok-4.6')
  assert.equal(llm.apiKeyEnv, 'GROK2API_API_KEY')
  assert.equal(llm.configured, true)
  const view = llmPublicView(llm)
  assert.equal(view.llmProvider, 'grok2api')
  assert.equal(view.llmModel, 'grok-4.6')
  assert.equal(view.llmReady, true)
})

test('llmFromDescribe without Host default model is empty', () => {
  const llm = llmFromDescribe([], {})
  assert.equal(llm.dshProvider, '')
  assert.equal(llm.configured, false)
  assert.equal(llmPublicView(llm).llmReady, false)
})

test('overlay readDshLlm uses occupancy file when settings.yaml is missing', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-llm-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const empty = readDshLlm()
    assert.equal(empty.dshProvider, '')
    assert.equal(empty.configured, false)
    await writeLlmOccupancy(home, {
      dshProvider: 'grok2api',
      model: 'grok-4.6',
      apiKeyEnv: 'GROK2API_API_KEY',
      api: 'openai-responses',
      baseUrl: 'http://127.0.0.1:8000/v1',
      configured: true,
    })
    await writeFile(join(home, '.credentials.yaml'), 'GROK2API_API_KEY: test-grok-key\n', 'utf8')
    const llm = readDshLlm()
    assert.equal(llm.dshProvider, 'grok2api')
    assert.equal(llm.model, 'grok-4.6')
    assert.equal(llm.apiKey, 'test-grok-key')
    assert.equal(llm.configured, true)
    assert.equal(overlayFromDescribe(
      [{ ns: 'agent-default-model', value: { provider: 'grok2api', model: 'grok-4.6' } }],
      { GROK2API_API_KEY: { configured: true } },
    ).dshProvider, 'grok2api')
    assert.ok(llmFingerprint(llm).includes('grok2api'))
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
})
