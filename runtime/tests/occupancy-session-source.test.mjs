import { test } from 'node:test'
import assert from 'node:assert/strict'
import { occupancyLiftSource, occupancyWriteSource } from '../vendor-overlays/dsh-lan-assist/session-source.js'

test('occupancyWriteSource is producer-owned and refuses plugin wrappers', () => {
  assert.deepEqual(occupancyWriteSource('dsh-lan-assist'), { kind: 'dsh-lan-assist' })
  assert.throws(() => occupancyWriteSource('plugin'))
  assert.throws(() => occupancyWriteSource(''))
})

test('occupancyLiftSource lifts own v3 wrapper and keeps native kinds', () => {
  assert.deepEqual(
    occupancyLiftSource({ kind: 'plugin', plugin: 'dsh-lan-assist' }, 'dsh-lan-assist'),
    { kind: 'dsh-lan-assist' },
  )
  assert.deepEqual(
    occupancyLiftSource({ kind: 'user' }, 'dsh-lan-assist'),
    { kind: 'user' },
  )
  assert.equal(
    occupancyLiftSource({ kind: 'plugin', plugin: 'other-plugin' }, 'dsh-lan-assist'),
    null,
  )
  assert.equal(occupancyLiftSource({ kind: '' }, 'dsh-lan-assist'), null)
})
