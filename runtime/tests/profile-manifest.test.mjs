import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeProfileManifest, writeMergedProfileManifest } from '../profile-manifest.mjs'

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

test('writeMergedProfileManifest leaves a corrupt package.json unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-profile-'))
  const packagePath = join(root, 'package.json')
  const corrupt = '{"dsh":'
  await writeFile(packagePath, corrupt)
  await assert.rejects(
    () => writeMergedProfileManifest(packagePath, {
      profileName: 'fde-x',
      requiredBundles: ['@deepseek-ai/dsh-base', '@losebird/iui'],
    }),
    (error) => error.code === 'FDE_PROFILE_MANIFEST_INVALID',
  )
  assert.equal(await readFile(packagePath, 'utf8'), corrupt)
  await rm(root, { recursive: true, force: true })
})

test('writeMergedProfileManifest creates a missing profile file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-profile-'))
  const packagePath = join(root, 'nested', 'package.json')
  const manifest = await writeMergedProfileManifest(packagePath, {
    profileName: 'fde-x',
    requiredBundles: ['@deepseek-ai/dsh-base', '@losebird/iui'],
  })
  assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@losebird/iui'])
  assert.equal(await readFile(packagePath, 'utf8'), `${JSON.stringify(manifest, null, 2)}\n`)
  await rm(root, { recursive: true, force: true })
})
