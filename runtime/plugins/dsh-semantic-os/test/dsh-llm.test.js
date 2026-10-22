import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { readDshLlm } from '../dsh-llm.js'

async function withHome(files, fn) {
  const previous = process.env.DSH_HOME
  const home = await mkdtemp(join(tmpdir(), 'dsos-llm-'))
  process.env.DSH_HOME = home
  try {
    if (files.settings) await writeFile(join(home, 'settings.yaml'), files.settings, 'utf8')
    if (files.cred) await writeFile(join(home, '.credentials.yaml'), files.cred, 'utf8')
    await fn()
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
}

test('readDshLlm uses the selected provider key env, not a welded DeepSeek URL', async () => {
  await withHome({
    settings: [
      'agent-default-model:',
      '  provider: grok2api',
      '  model: grok-4.6',
      'llm-pi-ai:',
      '  providers:',
      '    {',
      '      grok2api:',
      '        {',
      '          apiKeyEnv: GROK2API_API_KEY,',
      '          api: openai-responses,',
      '          baseURL: http://127.0.0.1:8000/v1,',
      '        }',
      '    }',
      '',
    ].join('\n'),
    cred: 'GROK2API_API_KEY: test-grok-key\nDEEPSEEK_API_KEY: other\n',
  }, async () => {
    const llm = readDshLlm()
    assert.equal(llm.dshProvider, 'grok2api')
    assert.equal(llm.model, 'grok-4.6')
    assert.equal(llm.apiKeyEnv, 'GROK2API_API_KEY')
    assert.equal(llm.apiKey, 'test-grok-key')
    assert.equal(llm.api, 'openai-responses')
    assert.equal(llm.baseUrl, 'http://127.0.0.1:8000/v1')
    assert.equal(llm.chatCompletions, false)
  })
})

test('readDshLlm leaves provider empty when settings are missing', async () => {
  await withHome({}, async () => {
    const llm = readDshLlm()
    assert.equal(llm.dshProvider, '')
    assert.equal(llm.model, '')
    assert.equal(llm.configured, false)
  })
})
