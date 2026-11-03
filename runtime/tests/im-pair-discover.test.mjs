import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createLanServer } from '../plugins/dsh-lan-assist/lan.js'
import { discoverPairDoors, pairDoorCandidates, probeLanWho } from '../im-pair-discover.mjs'

test('pair door candidates skip the local IM port', () => {
  const found = pairDoorCandidates({ env: { DSH_LAN_ASSIST_PORT: '19527' }, skipDoors: [] })
  assert.ok(!found.includes('127.0.0.1:19527'))
  assert.ok(found.includes('127.0.0.1:9527'))
})

test('who advertises live pairing without the code', async () => {
  const lan = createLanServer({
    port: 19041,
    host: '127.0.0.1',
    onFrame: async () => ({ ok: true }),
    who: async () => ({ pairing: true }),
  })
  await lan.start()
  try {
    const who = await probeLanWho('127.0.0.1:19041', 800)
    assert.equal(who.pairing, true)
    assert.equal(who.door, '127.0.0.1:19041')
  } finally {
    await lan.stop()
  }
})

test('discover prefers doors that are currently pairing', async () => {
  const quiet = createLanServer({
    port: 19042,
    host: '127.0.0.1',
    onFrame: async () => ({ ok: true }),
    who: async () => ({ pairing: false }),
  })
  const live = createLanServer({
    port: 19043,
    host: '127.0.0.1',
    onFrame: async () => ({ ok: true }),
    who: async () => ({ pairing: true }),
  })
  await quiet.start()
  await live.start()
  try {
    const doors = await discoverPairDoors({
      env: { DSH_LAN_ASSIST_PORT: '19527' },
      ports: [19042, 19043],
      timeoutMs: 800,
    })
    assert.ok(doors.includes('127.0.0.1:19043'))
    assert.equal(doors.some((door) => door.endsWith(':19042')), false)
  } finally {
    await quiet.stop()
    await live.stop()
  }
})

test('add-colleague form no longer requires a doorplate', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/components/IMWorkspace.tsx'), 'utf8')
  assert.match(src, /imPairHandshake\(\{ peerCode: peerCode.trim\(\) \}\)/)
  assert.doesNotMatch(src, /对方门牌/)
})
