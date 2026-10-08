import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pluginMetaForNs, settingsNsHome } from '../settings-ns-home.mjs'

test('one ns lands on one writer', () => {
  assert.equal(settingsNsHome('llm-pi-ai', ['llm-pi-ai']), 'elsewhere')
  assert.equal(settingsNsHome('agent-preset-registry'), 'elsewhere')
  assert.equal(settingsNsHome('ui-theme'), 'appearance')
  assert.equal(settingsNsHome('locale'), 'appearance')
  assert.equal(settingsNsHome('ui-settings-account'), 'account')
  assert.equal(settingsNsHome('llm-deepseek-account'), 'account')
  assert.equal(settingsNsHome('ui-chat'), 'chrome')
  assert.equal(settingsNsHome('subagent'), 'core')
  assert.equal(settingsNsHome('speech-to-text'), 'core')
  assert.equal(settingsNsHome('bash-sandbox'), 'core')
})

test('plugin meta for ns uses include id', () => {
  const meta = pluginMetaForNs([
    { id: 'include:subagent', fields: { meta: { title: { zh: '子代理', en: 'Subagent' } } } },
  ], 'subagent')
  assert.equal(meta.title.zh, '子代理')
})

test('plugin record walks bundle rows and package heading', async () => {
  const { flattenModelRoutes, hostPackageHeading, pluginRecordForNs } = await import('../settings-ns-home.mjs')
  const rec = pluginRecordForNs([
    {
      id: '@deepseek-ai/dsh-experimental-voice-input-bundle',
      fields: {
        bundle: true,
        rows: [
          { entryId: 'include:speech-to-text', meta: { title: { zh: '语音', en: 'Speech' } } },
        ],
      },
    },
  ], 'speech-to-text')
  assert.equal(rec.meta.title.zh, '语音')
  assert.equal(hostPackageHeading('@deepseek-ai/dsh-bash-sandbox'), 'dsh-bash-sandbox')
  assert.equal(hostPackageHeading('外观'), '外观')
  const catalogs = flattenModelRoutes(
    { rows: [{ provider: 'grok2api', displayName: 'Grok', profile: { models: [{ id: 'grok-4.6', name: 'Grok 4.6' }] } }] },
    { groups: [{ id: 'grok2api', name: 'Grok', models: [{ id: 'grok-4.5', name: 'Grok 4.5' }] }] },
  )
  assert.equal(catalogs.length, 1)
  assert.ok(catalogs[0].keys.includes('provider'))
  assert.ok(catalogs[0].keys.includes('model'))
  assert.equal(catalogs[0].rows.length, 2)
})
