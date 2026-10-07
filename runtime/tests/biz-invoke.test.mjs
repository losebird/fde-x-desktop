import { test } from 'node:test'
import assert from 'node:assert/strict'
import { invokeBizSlot } from '../biz/invoke.mjs'

test('invokeBizSlot refuses missing write slot', async () => {
  await assert.rejects(
    () => invokeBizSlot({ aiRuntime: {} }, {
      source: {
        type: 'mcp',
        serverName: 'a',
        describe: { via: 'mcp', serverName: 'a', tool: 'd' },
        list: { via: 'mcp', serverName: 'a', tool: 'l' },
      },
      slot: 'write',
      cwd: '/tmp/ws',
    }),
    (error) => error.code === 'no_write',
  )
})

test('invokeBizSlot refuses missing describe handle', async () => {
  await assert.rejects(
    () => invokeBizSlot({ aiRuntime: {} }, {
      source: { type: 'lookup' },
      slot: 'describe',
      cwd: '/tmp/ws',
    }),
    (error) => error.code === 'no_handle',
  )
})
