import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { computeRuntimeTreeSync, resolveBundledRuntime, runtimePackageName } from '../runtime-bundle.js'
import { RUNTIME_VERSION } from '../version.js'

test('runtime tree hashes ignore Windows path case and keep a stable file count', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-runtime-tree-'))
  try {
    await mkdir(join(root, 'python'), { recursive: true })
    await writeFile(join(root, 'python', 'python'), 'runtime\n')
    await writeFile(join(root, 'runtime-manifest.json'), '{}\n')
    await writeFile(join(root, 'package.json'), '{}\n')
    const first = computeRuntimeTreeSync(root)
    const second = computeRuntimeTreeSync(root)
    assert.equal(first.fileCount, 1)
    assert.equal(first.treeHash, second.treeHash)
    assert.match(first.treeHash, /^[a-f0-9]{64}$/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('runtime package names cover the release matrix', () => {
  assert.equal(runtimePackageName('darwin', 'arm64'), 'dsh-semantic-os-runtime-darwin-arm64')
  assert.equal(runtimePackageName('linux', 'x64'), 'dsh-semantic-os-runtime-linux-x64')
  assert.equal(runtimePackageName('win32', 'x64'), 'dsh-semantic-os-runtime-win32-x64')
})

test('runtime resolver rejects paths outside the package root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-runtime-path-'))
  try {
    await writeFile(join(root, 'runtime-manifest.json'), JSON.stringify({
      schemaVersion: 1,
      runtimeVersion: RUNTIME_VERSION,
      platform: 'darwin',
      arch: 'arm64',
      python: '../python',
      files: [{ path: '../outside', sha256: 'a'.repeat(64) }],
    }))
    const result = await resolveBundledRuntime({ platform: 'darwin', arch: 'arm64', runtimeRoot: root })
    assert.equal(result.error, 'RUNTIME_MANIFEST_INVALID')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('runtime resolver verifies manifest file hashes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsos-runtime-'))
  try {
    await mkdir(join(root, 'python'), { recursive: true })
    await mkdir(join(root, 'wheelhouse'), { recursive: true })
    const executable = join(root, 'python', 'python')
    await writeFile(executable, '#!/bin/sh\n', 'utf8')
    await chmod(executable, 0o755)
    await writeFile(join(root, 'constraints.txt'), 'semantica==0.7.0\n', 'utf8')
    const data = await import('node:fs/promises').then((fs) => fs.readFile(executable))
    const sha256 = createHash('sha256').update(data).digest('hex')
    await writeFile(join(root, 'runtime-manifest.json'), JSON.stringify({
      schemaVersion: 1,
      runtimeVersion: RUNTIME_VERSION,
      platform: 'darwin',
      arch: 'arm64',
      python: 'python/python',
      wheelhouse: 'wheelhouse',
      constraints: 'constraints.txt',
      files: [{ path: 'python/python', sha256 }],
    }))
    const ok = await resolveBundledRuntime({ platform: 'darwin', arch: 'arm64', runtimeRoot: root })
    assert.equal(ok.ok, true)
    await writeFile(executable, 'tampered', 'utf8')
    const bad = await resolveBundledRuntime({ platform: 'darwin', arch: 'arm64', runtimeRoot: root })
    assert.equal(bad.error, 'RUNTIME_CHECKSUM_MISMATCH')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
