import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  readBundledRuntimeManifest,
  runtimeInstallerModulePath,
  shouldRunSemanticInstall,
} from '../dist/semantic-runtime.js'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const resources = join(repoRoot, 'resources')
const runtimeKey = `${process.platform}-${process.arch}`
const semanticSrc = join(resources, 'semantic-runtime', runtimeKey)
const vendorDir = join(resources, 'plugins')

test('bundled manifest exposes treeHash for install-state matching', async () => {
  const bundled = await readBundledRuntimeManifest(semanticSrc)
  assert.ok(bundled)
  assert.match(bundled.treeHash, /^[a-f0-9]{64}$/u)
  assert.equal(bundled.runtimeVersion, '0.1.1')
})

test('shouldRunSemanticInstall follows install-state + treeHash + installed probe', () => {
  const tree = 'a'.repeat(64)
  assert.equal(shouldRunSemanticInstall(null, tree, false, false), true)
  assert.equal(
    shouldRunSemanticInstall({ semanticRuntime: { treeHash: tree } }, tree, false, true),
    false,
  )
  assert.equal(
    shouldRunSemanticInstall({ semanticRuntime: { treeHash: 'stale' } }, tree, false, true),
    true,
  )
  assert.equal(
    shouldRunSemanticInstall({ semanticRuntime: { treeHash: tree } }, tree, false, false),
    true,
  )
  assert.equal(shouldRunSemanticInstall(null, tree, true, false), false)
})

test('official runtime-install.js is wired for packaged vendor tree', async () => {
  const installer = runtimeInstallerModulePath(vendorDir)
  const raw = await readFile(installer, 'utf8')
  assert.match(raw, /installRuntimeFromDirectory/u)
  assert.match(raw, /\.staging-/u)
  assert.match(raw, /verifyFiles: true/u)
  const bundlePath = join(vendorDir, 'dsh-semantic-os', 'runtime-bundle.js')
  const bundleRaw = await readFile(bundlePath, 'utf8')
  assert.match(bundleRaw, /treeHash/u)
})
