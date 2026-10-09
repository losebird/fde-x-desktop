import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { cuaDriverDirs, desktopProcessPath } from '../desktop-process-path.mjs'

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
    assert.equal(path.startsWith(join(root, 'node', 'bin')), true)
    assert.equal(path.includes(join(root, 'dsh', 'bin')), true)
    assert.equal(path.includes('/usr/bin'), true)
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
