import { test } from 'node:test'
import assert from 'node:assert/strict'
import { basename, resolve } from 'node:path'
import { packMacSteps } from './mac-pack.mjs'

test('pack:mac stages resources before electron-builder', () => {
  const steps = packMacSteps()
  assert.equal(basename(steps.stage.args[0]), 'stage.mjs')
  assert.equal(steps.builder.args.includes('electron-builder'), true)
  assert.equal(basename(steps.builder.cwd), 'desktop')
  assert.equal(steps.builder.cwd.startsWith(steps.stage.cwd), true)
  assert.equal(resolve(steps.stage.cwd, 'apps/desktop'), steps.builder.cwd)
})
