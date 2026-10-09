import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { PRODUCT_BUNDLE_IDS, availableProductBundles } from '../product-bundles.mjs'
import { generationInstallRoot } from '../generation.mjs'

test('availableProductBundles keeps ids that exist in the generation tree', () => {
  const live = availableProductBundles()
  for (const name of live) {
    assert.equal(PRODUCT_BUNDLE_IDS.includes(name), true)
  }
  const root = generationInstallRoot()
  if (live.length) {
    assert.equal(live.length > 0, true)
    assert.equal(root.includes('.host-generation'), true)
  }
})

test('availableProductBundles skips missing packages', () => {
  const root = join(tmpdir(), `fde-bundles-${process.pid}`)
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  try {
    assert.deepEqual(availableProductBundles(root), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
