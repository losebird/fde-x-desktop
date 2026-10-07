import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startSemanticReadyWatch } from '../semantic-ready-watch.mjs'
import { engineProbeKind } from '../engine-probe.mjs'
import { configureEventBus, subscribe } from '../events.mjs'
import { openDatabase } from '../db.mjs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

test('engine probe timeout is probe-failed, successful false is unready', () => {
  assert.equal(engineProbeKind({ ready: true }), 'ready')
  assert.equal(engineProbeKind({ ready: false, reason: 'boot' }), 'unready')
  assert.equal(engineProbeKind({ ready: false, reason: 'timeout' }, true), 'probe-failed')
  assert.equal(engineProbeKind(null, true), 'probe-failed')
  assert.equal(engineProbeKind({ probe: 'failed' }), 'probe-failed')
})

test('semantic ready watch emits only when occupancy flips; probe-failed does not emit', async () => {
  const root = join(fileURLToPath(new URL('..', import.meta.url)), '..')
  const dbPath = `/tmp/fde-semantic-ready-${Date.now()}.sqlite`
  await mkdir('/tmp', { recursive: true })
  const db = openDatabase(dbPath, join(root, 'runtime/migrations'))
  configureEventBus(db)
  const seen = []
  const off = subscribe((row) => {
    if (row.type === 'memory.engine.changed') seen.push(row.payload)
  })
  let mode = 'unready'
  const stop = startSemanticReadyWatch({
    probeMs: 40,
    watchMs: 80,
    semanticOs: async () => {
      if (mode === 'hang') await new Promise((resolve) => setTimeout(resolve, 200))
      if (mode === 'ready') return { ready: true }
      return { ready: false, reason: 'boot' }
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(seen.length, 1)
  assert.equal(seen[0].ready, false)
  mode = 'hang'
  await new Promise((resolve) => setTimeout(resolve, 200))
  assert.equal(seen.length, 1)
  mode = 'ready'
  await new Promise((resolve) => setTimeout(resolve, 200))
  stop()
  off()
  db.close()
  assert.ok(seen.some((row) => row.ready === true))
  assert.equal(seen.filter((row) => row.ready === true).length, 1)
})
