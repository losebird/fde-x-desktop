import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SESSION_BIND_BOTH,
  SESSION_BIND_MISSING,
  SESSION_RESTORE_BOTH,
  SESSION_RESTORE_MISSING,
  parseSessionBind,
  restoreWriteRoot,
} from '../session-bind.mjs'

test('session bind keeps one hand', () => {
  assert.deepEqual(parseSessionBind({ workspaceId: ' ws-1 ' }), {
    ok: true,
    code: 'workspace',
    workspaceId: 'ws-1',
    cwd: '',
  })
  assert.deepEqual(parseSessionBind({ cwd: '/tmp/ws-a' }), {
    ok: true,
    code: 'path',
    workspaceId: '',
    cwd: '/tmp/ws-a',
  })
})

test('session bind rejects both hands and missing bind', () => {
  const both = parseSessionBind({ workspaceId: 'ws-1', cwd: '/tmp/ws-a' })
  assert.equal(both.ok, false)
  assert.equal(both.code, 'both')
  const missing = parseSessionBind({})
  assert.equal(missing.ok, false)
  assert.equal(missing.code, 'missing')
  assert.equal(SESSION_BIND_BOTH, '创建会话只能带 workspaceId 或 cwd，不能两个都带')
  assert.equal(SESSION_BIND_MISSING, '创建会话需要 workspaceId 或绝对路径 cwd')
  assert.equal(SESSION_RESTORE_BOTH, '复原会话只能带 workspaceId 或 cwd，不能两个都带')
  assert.equal(SESSION_RESTORE_MISSING, '复原会话需要 workspaceId 或绝对路径 cwd')
})

test('restore write root is writeCwd, then created cwd, then path bind', () => {
  assert.equal(
    restoreWriteRoot({ writeCwd: '/tmp/write' }, { cwd: '/tmp/created' }, '/tmp/bind'),
    '/tmp/write',
  )
  assert.equal(
    restoreWriteRoot({}, { header: { cwd: '/tmp/created' } }, '/tmp/bind'),
    '/tmp/created',
  )
  assert.equal(restoreWriteRoot({}, {}, '/tmp/bind'), '/tmp/bind')
  assert.equal(restoreWriteRoot({ cwd: '/tmp/bind' }, {}, ''), '')
})

test('restore writeCwd does not count as bind cwd', () => {
  const bound = parseSessionBind({ workspaceId: 'ws-1', writeCwd: '/tmp/write' })
  assert.equal(bound.ok, true)
  assert.equal(bound.code, 'workspace')
  assert.equal(bound.cwd, '')
  assert.equal(restoreWriteRoot({ workspaceId: 'ws-1', writeCwd: '/tmp/write' }, {}, ''), '/tmp/write')
})
