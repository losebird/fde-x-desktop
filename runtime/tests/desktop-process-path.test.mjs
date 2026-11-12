import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { cuaDriverDirs, desktopProcessPath, osDefaultPathDirs } from '../desktop-process-path.mjs'
import { mcpNpxBinDir } from '../mcp-npx.mjs'

test('desktopProcessPath prepends bundled node and dsh when they exist', () => {
  const root = join(tmpdir(), `fde-path-${process.pid}-${Date.now()}`)
  mkdirSync(join(root, 'node', 'bin'), { recursive: true })
  mkdirSync(join(root, 'dsh', 'bin'), { recursive: true })
  writeFileSync(join(root, 'node', 'bin', 'npx'), '')
  try {
    const path = desktopProcessPath({
      resources: root,
      platform: 'darwin',
      inheritedPath: '/usr/bin:/bin',
    })
    const dirs = path.split(':')
    assert.equal(dirs[0], mcpNpxBinDir())
    assert.equal(dirs.includes(join(root, 'node', 'bin')), true)
    assert.equal(path.includes(join(root, 'dsh', 'bin')), true)
    assert.equal(path.includes('/usr/bin'), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('desktopProcessPath keeps unix system bins even when inherited PATH is empty', () => {
  const root = join(tmpdir(), `fde-path-empty-${process.pid}-${Date.now()}`)
  mkdirSync(join(root, 'node', 'bin'), { recursive: true })
  mkdirSync(join(root, 'dsh', 'bin'), { recursive: true })
  try {
    const path = desktopProcessPath({
      resources: root,
      platform: 'darwin',
      inheritedPath: '',
    })
    assert.equal(path.includes('/bin'), true)
    assert.equal(path.includes('/usr/bin'), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('osDefaultPathDirs is per-OS: posix bins stay off win32', () => {
  const win = osDefaultPathDirs('win32', { SystemRoot: 'C:\\Windows' })
  const posix = osDefaultPathDirs('darwin', {})
  assert.equal(win.some((dir) => dir === '/bin' || dir === '/usr/bin'), false)
  assert.equal(win[0], 'C:\\Windows\\System32')
  assert.equal(posix.includes('/bin'), true)
  assert.equal(posix.includes('/usr/bin'), true)
})

test('win32 desktopProcessPath does not inject posix /bin entries', () => {
  const root = join(tmpdir(), `fde-path-win-${process.pid}-${Date.now()}`)
  mkdirSync(join(root, 'node'), { recursive: true })
  mkdirSync(join(root, 'dsh', 'bin'), { recursive: true })
  try {
    const path = desktopProcessPath({
      resources: root,
      platform: 'win32',
      inheritedPath: '',
    })
    const dirs = path.split(';')
    assert.equal(dirs.includes('/bin'), false)
    assert.equal(dirs.includes('/usr/bin'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('cuaDriverDirs only returns existing envelope dirs', () => {
  const root = join(tmpdir(), `fde-cua-${process.pid}-${Date.now()}`)
  mkdirSync(join(root, 'cua-driver', 'darwin-arm64'), { recursive: true })
  try {
    const dirs = cuaDriverDirs(root, 'darwin', 'arm64')
    assert.equal(dirs.includes(join(root, 'cua-driver', 'darwin-arm64')), true)
    assert.equal(cuaDriverDirs(root, 'win32', 'x64').length, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
