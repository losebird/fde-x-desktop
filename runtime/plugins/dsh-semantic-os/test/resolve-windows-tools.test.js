import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { firstExisting, resolveWindowsTool, windowsToolDirs } from '../scripts/resolve-windows-tools.js'

test('windowsToolDirs keeps npm and pnpm shim folders', () => {
  const dirs = windowsToolDirs({
    APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    ProgramFiles: 'C:\\Program Files',
  })
  assert.ok(dirs.some((dir) => dir.endsWith(join('Roaming', 'npm'))))
  assert.ok(dirs.some((dir) => dir.endsWith(join('Local', 'pnpm'))))
})

test('resolveWindowsTool finds dsh.cmd next to npm when PATH is empty', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-win-tools-'))
  const npm = join(root, 'Roaming', 'npm')
  await mkdir(npm, { recursive: true })
  const dsh = join(npm, 'dsh.cmd')
  await writeFile(dsh, '@echo off\r\n')
  try {
    const found = resolveWindowsTool(['dsh.cmd', 'dsh.exe'], {
      platform: 'win32',
      env: { APPDATA: join(root, 'Roaming'), LOCALAPPDATA: join(root, 'Local') },
    })
    assert.equal(found, dsh)
    assert.equal(found, dsh)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('firstExisting skips missing candidates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-win-first-'))
  const hit = join(root, 'pnpm.cmd')
  await writeFile(hit, '@echo off\r\n')
  try {
    assert.equal(firstExisting([join(root, 'missing.cmd'), hit]), hit)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
