import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeProfileManifest } from '../profile-manifest.mjs'

test('mergeProfileManifest keeps Host-selected bundles across FDE start', () => {
  const merged = mergeProfileManifest({
    name: 'dsh-profile-fde-x',
    private: true,
    dsh: {
      profile: {
        bundles: [
          '@deepseek-ai/dsh-base',
          '@deepseek-ai/dsh-web-app',
          'dsh-lan-assist',
          '@deepseek-ai/dsh-experimental-schedule-bundle',
        ],
      },
    },
  }, {
    profileName: 'fde-x',
    requiredBundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-lan-assist', 'dsh-semantic-os'],
  })
  assert.deepEqual(merged.dsh.profile.bundles, [
    '@deepseek-ai/dsh-base',
    '@deepseek-ai/dsh-web-app',
    'dsh-lan-assist',
    'dsh-semantic-os',
    '@deepseek-ai/dsh-experimental-schedule-bundle',
  ])
})

test('mergeProfileManifest bootstraps an empty profile with required bundles only', () => {
  const merged = mergeProfileManifest(null, {
    profileName: 'fde-x',
    requiredBundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
  })
  assert.equal(merged.private, true)
  assert.deepEqual(merged.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
})
