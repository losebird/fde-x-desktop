import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'

import { buildBffEnv, pageOrigin, reserveLoopbackPort } from '../dist/bff-env.js'

const roots = {
  base: '/tmp/fde-x-user',
  dshHome: '/tmp/fde-x-user/dsh-home',
  databasePath: '/tmp/fde-x-user/data/fde-workstation.sqlite',
  installState: '/tmp/fde-x-user/dsh-home/install-state.json',
}

test('buildBffEnv binds page origin, user cwd, and supervised reload', () => {
  const env = buildBffEnv({
    resources: '/pack/resources',
    appRoot: '/pack/resources/app',
    port: 43210,
    roots,
  })
  assert.equal(env.FDE_AI_WORKSPACE, roots.base)
  assert.notEqual(env.FDE_AI_WORKSPACE, '/pack/resources/app')
  assert.equal(env.FDE_RUNTIME_PORT, '43210')
  assert.equal(env.FDE_ALLOWED_ORIGINS, 'app://fde-x,http://127.0.0.1:43210')
  assert.equal(env.FDE_RUNTIME_SUPERVISED, '1')
  assert.equal(env.FDE_STATIC_DIR, join('/pack/resources', 'app', 'dist'))
  assert.equal(pageOrigin(43210), 'http://127.0.0.1:43210')
})

test('desktopDev static dir is appRoot/dist', () => {
  const env = buildBffEnv({
    resources: '/pack/resources',
    appRoot: '/repo',
    port: 9,
    roots,
    desktopDev: true,
  })
  assert.equal(env.FDE_STATIC_DIR, join('/repo', 'dist'))
  assert.equal(env.FDE_AI_WORKSPACE, roots.base)
})

test('reserveLoopbackPort returns a listen-able port', async () => {
  const port = await reserveLoopbackPort()
  assert.equal(Number.isInteger(port), true)
  assert.equal(port > 0, true)
})
