import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acceptListenFrame,
  daemonSource,
  LISTEN_MAX_BYTES,
  installUserAutostart,
  removeUserAutostart,
  launchdHint,
  linuxUnitPath,
  windowsStartupPath,
  windowsStartupSource,
} from '../listen.js'
import { keyFromHex, signFrame } from '../crypto.js'

test('windows startup script is user-level and names the listen mouth', () => {
  const text = windowsStartupSource({
    node: 'C:\\\\Program Files\\\\node.exe',
    script: 'C:\\\\Users\\\\Ace\\\\.dsh\\\\lan-assist\\\\listen-daemon.mjs',
    home: 'C:\\\\Users\\\\Ace\\\\.dsh',
    port: 9527,
  })
  assert.match(text, /WScript.Shell/)
  assert.match(text, /DSH_LAN_ASSIST_PORT=9527/)
  assert.match(text, /listen-daemon/)
  assert.doesNotMatch(text, /require admin|RunAs|schtasks/i)
})

test('listen mouth refuses path traversal and unsigned frames', () => {
  const key = keyFromHex('ab'.repeat(32))
  const state = { peers: { pk_lin: { id: 'pk_lin', keyHex: key.toString('hex'), unpaired: false } } }
  assert.equal(acceptListenFrame(state, { type: 'envelope', from: 'pk_evil', requestId: 'req_1' }).ok, false)
  assert.equal(acceptListenFrame(state, { type: 'envelope', from: 'pk_lin', requestId: '../state' }).ok, false)
  assert.equal(acceptListenFrame(state, { type: 'envelope', from: 'pk_lin', requestId: '' }).ok, false)
  assert.equal(acceptListenFrame(state, { type: 'hello', from: 'pk_new' }, 10).store, false)
  const signed = signFrame(key, { type: 'envelope', from: 'pk_lin', requestId: 'req_ok', nonce: 'n1' })
  const accepted = acceptListenFrame(state, signed)
  assert.equal(accepted.ok, true)
  assert.equal(accepted.id, 'req_ok')
  const sneaky = signFrame(key, { type: 'envelope', from: 'pk_lin', requestId: '../state', nonce: 'n2' })
  assert.equal(acceptListenFrame(state, sneaky).ok, true)
  assert.doesNotMatch(acceptListenFrame(state, sneaky).id, /[\\/]/)
  assert.equal(acceptListenFrame(state, signed, LISTEN_MAX_BYTES + 1).error, 'TOO_BIG')
  const pair = acceptListenFrame({}, { type: 'pair.offer', from: 'pk_new', session: 'ab'.repeat(8), nonce: 'n3' })
  assert.equal(pair.ok, true)
  assert.equal(pair.store, true)
  assert.match(pair.id, /^pair-/)
})

test('listen daemon source subscribes NATS when the env is set', () => {
  const src = daemonSource()
  assert.match(src, /DSH_LAN_ASSIST_NATS/)
  assert.match(src, /pair\./)
  assert.match(src, /dsh\.v1\.inbox\./)
})

test('user autostart writes a unit without admin', async () => {
  const home = await mkdtemp(join(tmpdir(), 'dla-home-'))
  const prevHome = process.env.HOME
  const prevDsh = process.env.DSH_HOME
  process.env.HOME = home
  process.env.DSH_HOME = join(home, '.dsh')
  try {
    const result = await installUserAutostart(9527)
    if (process.platform === 'darwin') {
      assert.equal(result.ok, true)
      const text = await readFile(launchdHint(), 'utf8')
      assert.match(text, /ai.dsh.lan-assist.listen/)
      assert.match(text, /9527/)
      const withRelay = await installUserAutostart(9527, {
        DSH_LAN_ASSIST_NATS: 'nats://127.0.0.1:4222',
        DSH_LAN_ASSIST_NATS_CREDS: '/tmp/device.creds',
      })
      assert.equal(withRelay.ok, true)
      const relayed = await readFile(launchdHint(), 'utf8')
      assert.match(relayed, /DSH_LAN_ASSIST_NATS/)
      assert.match(relayed, /device\.creds/)
    } else if (process.platform === 'linux') {
      assert.equal(result.ok, true)
      const text = await readFile(linuxUnitPath(), 'utf8')
      assert.match(text, /dsh-lan-assist/)
    } else if (process.platform === 'win32') {
      assert.equal(result.ok, true)
      const text = await readFile(windowsStartupPath(), 'utf8')
      assert.match(text, /dsh-lan-assist/)
      assert.match(text, /9527/)
      assert.match(text, /WScript.Shell/)
    } else {
      assert.equal(result.ok, false)
    }
    await removeUserAutostart()
  } finally {
    process.env.HOME = prevHome
    if (prevDsh === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevDsh
    await rm(home, { recursive: true, force: true })
  }
})
