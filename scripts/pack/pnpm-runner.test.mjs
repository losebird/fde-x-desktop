import assert from 'node:assert/strict'
import test from 'node:test'
import { selectPnpmRunner } from './pnpm-runner.mjs'

const pinnedVersion = '11.7.0'

test('corepack present runs the pinned pnpm through corepack', () => {
  const runner = selectPnpmRunner({
    corepackAvailable: true,
    pnpmVersion: '11.20.0',
    pinnedVersion,
  })
  assert.deepEqual(runner, {
    command: 'corepack',
    argsPrefix: ['pnpm@11.7.0'],
  })
})

test('missing corepack uses PATH pnpm when the major matches', () => {
  const runner = selectPnpmRunner({
    corepackAvailable: false,
    pnpmVersion: '11.20.0',
    pinnedVersion,
  })
  assert.deepEqual(runner, {
    command: 'pnpm',
    argsPrefix: [],
  })
  assert.throws(
    () => selectPnpmRunner({
      corepackAvailable: false,
      pnpmVersion: '10.15.0',
      pinnedVersion,
    }),
    /pnpm 11\.x/,
  )
  assert.throws(
    () => selectPnpmRunner({
      corepackAvailable: false,
      pnpmVersion: '12.0.0',
      pinnedVersion,
    }),
    /pnpm 11\.x/,
  )
})

test('missing corepack and pnpm names how to install either', () => {
  assert.throws(
    () => selectPnpmRunner({
      corepackAvailable: false,
      pnpmVersion: '',
      pinnedVersion,
    }),
    (error) => {
      assert.match(error.message, /Node 25\+ no longer ships corepack/)
      assert.match(error.message, /npm install -g pnpm@11\.7\.0/)
      assert.match(error.message, /npm install -g corepack/)
      return true
    },
  )
})
