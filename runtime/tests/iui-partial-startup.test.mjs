import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { BUILTIN_PLUGINS } from '../builtin-plugins.mjs'
import { createCoreConnector } from '../dsh-core.mjs'

const IUI = BUILTIN_PLUGINS.find((plugin) => plugin.module === '@losebird/iui')

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

test('startup removes a SIGKILL partial beside the vendor tar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-iui-startup-partial-'))
  const vendor = join(dir, 'iui')
  mkdirSync(vendor)
  const good = join(vendor, `iui-${IUI.source.commit}.tar.gz`)
  writeFileSync(good, 'good-archive')
  const goodSha = sha(good)
  const dead = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  const deadPartial = `iui-${IUI.source.commit}.tar.gz.${dead.pid}.ab12cd34.partial`
  writeFileSync(join(vendor, deadPartial), 'half-written')
  process.kill(dead.pid, 'SIGKILL')
  await new Promise((resolveWait, reject) => {
    dead.once('exit', resolveWait)
    dead.once('error', reject)
  })
  const savedVendor = process.env.FDE_VENDOR_DIR
  const savedArtifact = process.env.FDE_IUI_ARTIFACT
  process.env.FDE_VENDOR_DIR = dir
  delete process.env.FDE_IUI_ARTIFACT
  try {
    createCoreConnector({ dshHome: join(dir, 'home') })
    const names = await readdir(vendor)
    console.log(`names ${names.join(' ')}`)
    assert.equal(names.includes(deadPartial), false)
    assert.equal(sha(good), goodSha)
  } finally {
    if (savedVendor === undefined) delete process.env.FDE_VENDOR_DIR
    else process.env.FDE_VENDOR_DIR = savedVendor
    if (savedArtifact === undefined) delete process.env.FDE_IUI_ARTIFACT
    else process.env.FDE_IUI_ARTIFACT = savedArtifact
  }
})
