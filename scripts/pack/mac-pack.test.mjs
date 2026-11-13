import { test } from 'node:test'
import assert from 'node:assert/strict'
import { basename, resolve } from 'node:path'
import { packMacSteps } from './mac-pack.mjs'

test('unsigned pack adhoc-signs com.fde-x.workstation afterPack', async () => {
  const { readFile } = await import('node:fs/promises')
  const yml = await readFile(new URL('../../apps/desktop/electron-builder.yml', import.meta.url), 'utf8')
  const hook = await readFile(new URL('../../apps/desktop/scripts/after-pack-adhoc-sign.mjs', import.meta.url), 'utf8')
  assert.match(yml, /afterPack: \.\/scripts\/after-pack-adhoc-sign\.mjs/)
  assert.match(hook, /com\.fde-x\.workstation/)
  assert.match(hook, /CSC_IDENTITY_AUTO_DISCOVERY/)
  assert.match(hook, /--sign', '-'/)
})

test('pack:mac stages resources before electron-builder', () => {
  const steps = packMacSteps()
  assert.equal(basename(steps.stage.args[0]), 'stage.mjs')
  assert.equal(steps.builder.args.includes('electron-builder'), true)
  assert.equal(basename(steps.builder.cwd), 'desktop')
  assert.equal(steps.builder.cwd.startsWith(steps.stage.cwd), true)
  assert.equal(resolve(steps.stage.cwd, 'apps/desktop'), steps.builder.cwd)
})
