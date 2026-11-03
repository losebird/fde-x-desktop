import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deliverOsNotify,
  notifyHelperPaths,
  osNotifyFromEnvelope,
  osascriptNotifyArgs,
} from '../os-notify.mjs'

test('osNotify skips when the packaged BFF has FDE_STATIC_DIR', async () => {
  const { osNotify } = await import('../os-notify.mjs')
  const previous = process.env.FDE_STATIC_DIR
  process.env.FDE_STATIC_DIR = '/tmp/fde-static'
  try {
    assert.equal(osNotify({ title: 'FDE-X', body: '会话完成' }), undefined)
  } finally {
    if (previous == null) delete process.env.FDE_STATIC_DIR
    else process.env.FDE_STATIC_DIR = previous
  }
})

test('osNotifyFromEnvelope is silent under node:test', () => {
  osNotifyFromEnvelope('task.done', { source: 'session', title: '验收' })
  osNotifyFromEnvelope('task.changed', { status: 'done', title: '写周报' })
  assert.equal(true, true)
})

test('deliverOsNotify prefers the bundled helper and plays Glass', () => {
  const root = mkdtempSync(join(tmpdir(), 'fde-os-notify-'))
  const paths = notifyHelperPaths(root)
  mkdirSync(join(paths.appDir, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(paths.bin, 'fake')
  const calls = []
  const used = deliverOsNotify({ title: 'FDE-X', body: '会话完成：后台' }, {
    platform: 'darwin',
    paths,
    exists: (p) => p === paths.bin || p === paths.log,
    execFile: (cmd, args) => {
      calls.push({ cmd, args })
      return { unref() {} }
    },
  })
  assert.equal(used.used, 'helper')
  assert.equal(calls[0].cmd, 'open')
  assert.deepEqual(calls[0].args.slice(0, 4), ['-n', '-g', '-a', paths.appDir])
  assert.deepEqual(calls[0].args.slice(5, 7), ['FDE-X', '会话完成：后台'])
  assert.equal(calls[1].cmd, 'afplay')
})

test('deliverOsNotify skips a helper macOS has already refused', () => {
  const root = mkdtempSync(join(tmpdir(), 'fde-os-notify-'))
  const paths = notifyHelperPaths(root)
  mkdirSync(join(paths.appDir, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(paths.bin, 'fake')
  writeFileSync(paths.log, 'fde_notify_auth_error Notifications are not allowed for this application\n')
  const calls = []
  const used = deliverOsNotify({ title: 'FDE-X', body: '会话完成' }, {
    platform: 'darwin',
    paths,
    exists: (p) => p === paths.bin || p === '/System/Library/Sounds/Glass.aiff',
    execFile: (cmd, args) => {
      calls.push({ cmd, args })
      return { unref() {} }
    },
  })
  assert.equal(used.used, 'osascript')
  assert.equal(calls[0].cmd, 'osascript')
  assert.equal(calls[0].args[1], 'tell application id "com.fde-x.workstation"')
  assert.match(calls[0].args.join('\n'), /会话完成/)
  assert.equal(calls[1].cmd, 'afplay')
})

test('deliverOsNotify falls back to osascript when helper is missing', () => {
  const calls = []
  const used = deliverOsNotify({ title: 'FDE-X', body: '任务完成' }, {
    platform: 'darwin',
    helperBin: '/tmp/missing-fde-notify',
    exists: (p) => p === '/System/Library/Sounds/Glass.aiff',
    execFile: (cmd, args) => {
      calls.push({ cmd, args })
      return { unref() {} }
    },
  })
  assert.equal(used.used, 'osascript')
  assert.equal(calls[0].cmd, 'osascript')
  assert.equal(calls[0].args[1], 'tell application id "com.fde-x.workstation"')
  assert.match(calls[0].args.join('\n'), /任务完成/)
  assert.equal(calls[1].cmd, 'afplay')
})

test('osascriptNotifyArgs attributes the banner to FDE-X', () => {
  const args = osascriptNotifyArgs('FDE-X', '会话完成：后台')
  assert.equal(args[1], 'tell application id "com.fde-x.workstation"')
  assert.match(args[3], /会话完成：后台/)
  assert.equal(args[5], 'end tell')
})
