import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { hostChildEnv, isElectronRuntime, resolveHostSpawn } from '../host-spawn.mjs'

test('pnpm-dev spawn uses process.execPath', () => {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const versions = { ...process.versions, electron: undefined }
  const spawn = resolveHostSpawn('/opt/dsh/bin.js', env, versions)
  assert.equal(spawn.command, process.execPath)
  assert.equal(spawn.args[0], '--max-http-header-size=131072')
  assert.equal(spawn.args[1], '/opt/dsh/bin.js')
  assert.equal(isElectronRuntime(env, versions), false)
})

test('electron spawn uses FDE_HOST_NODE and strips ELECTRON_RUN_AS_NODE', () => {
  const node = process.execPath
  const spawn = resolveHostSpawn('/opt/dsh/bin.js', {
    ELECTRON_RUN_AS_NODE: '1',
    FDE_HOST_NODE: node,
  }, { electron: '44.7.0' })
  assert.equal(spawn.command, node)
  assert.equal(spawn.args[1], '/opt/dsh/bin.js')
  const childEnv = hostChildEnv({ DSH_HOME: '/tmp/x' }, {
    ELECTRON_RUN_AS_NODE: '1',
    ALL_PROXY: 'socks5://127.0.0.1:1',
  })
  assert.equal(childEnv.ELECTRON_RUN_AS_NODE, undefined)
  assert.equal(childEnv.ALL_PROXY, undefined)
  assert.equal(childEnv.DSH_HOME, '/tmp/x')
  assert.equal(typeof childEnv.PATH, 'string')
})

test('electron without host node throws', () => {
  const root = join(tmpdir(), `fde-host-${process.pid}`)
  mkdirSync(root, { recursive: true })
  try {
    assert.throws(
      () => resolveHostSpawn('/opt/dsh/bin.js', { ELECTRON_RUN_AS_NODE: '1', FDE_RESOURCES: root }, { electron: '44.7.0' }),
      /resources\/node/,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
