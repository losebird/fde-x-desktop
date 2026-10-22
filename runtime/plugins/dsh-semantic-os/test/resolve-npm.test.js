import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { resolveNpmInvocation } from '../scripts/resolve-npm.js'

test('Windows prefers npm-cli.js next to node, then npm.cmd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-npm-'))
  const bindir = join(root, 'bin')
  const cli = join(bindir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
  await mkdir(join(bindir, 'node_modules', 'npm', 'bin'), { recursive: true })
  await writeFile(cli, 'console.log("npm")\n')
  await writeFile(join(bindir, 'node.exe'), '')
  try {
    const resolved = resolveNpmInvocation(join(bindir, 'node.exe'), 'win32', {})
    assert.equal(resolved.command, join(bindir, 'node.exe'))
    assert.deepEqual(resolved.prefix, [cli])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('Windows falls back to npm.cmd with a shell when cli.js is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-npm-cmd-'))
  const bindir = join(root, 'bin')
  await mkdir(bindir, { recursive: true })
  await writeFile(join(bindir, 'node.exe'), '')
  await writeFile(join(bindir, 'npm.cmd'), '@echo off\r\n')
  try {
    const resolved = resolveNpmInvocation(join(bindir, 'node.exe'), 'win32', {})
    assert.equal(resolved.command, join(bindir, 'npm.cmd'))
    assert.equal(resolved.shell, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
