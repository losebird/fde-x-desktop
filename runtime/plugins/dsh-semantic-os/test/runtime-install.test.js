import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { installRuntimeFromDirectory, removeInstalledRuntime, resolveInstalledRuntime, runtimeCurrentPath } from '../runtime-install.js'
import { RUNTIME_VERSION } from '../version.js'

async function makeRuntime(root, content = 'runtime') {
  await mkdir(join(root, 'python'), { recursive: true })
  await writeFile(join(root, 'python', 'python'), content)
  const sha256 = createHash('sha256').update(content).digest('hex')
  await writeFile(join(root, 'runtime-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    runtimeVersion: RUNTIME_VERSION,
    platform: 'darwin',
    arch: 'arm64',
    python: 'python/python',
    files: [{ path: 'python/python', sha256 }],
  }))
  return root
}

async function withHome(fn) {
  const previous = process.env.DSH_HOME
  const home = await mkdtemp(join(tmpdir(), 'dsos-runtime-install-'))
  process.env.DSH_HOME = home
  try { await fn(home) } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(home, { recursive: true, force: true })
  }
}

test('runtime installer verifies, atomically activates, and resolves a runtime', async () => {
  await withHome(async () => {
    const source = await makeRuntime(await mkdtemp(join(tmpdir(), 'dsos-runtime-source-')))
    try {
      const installed = await installRuntimeFromDirectory(source, { platform: 'darwin', arch: 'arm64' })
      assert.equal(installed.ok, true)
      const current = JSON.parse(await readFile(runtimeCurrentPath(), 'utf8'))
      assert.equal(current.key, 'darwin-arm64')
      const resolved = await resolveInstalledRuntime({ platform: 'darwin', arch: 'arm64', verifyFiles: true })
      assert.equal(resolved.ok, true)
    } finally { await rm(source, { recursive: true, force: true }) }
  })
})

test('activation failure restores the previous runtime', async () => {
  await withHome(async () => {
    const first = await makeRuntime(await mkdtemp(join(tmpdir(), 'dsos-runtime-first-')), 'first')
    const second = await makeRuntime(await mkdtemp(join(tmpdir(), 'dsos-runtime-second-')), 'second')
    try {
      await installRuntimeFromDirectory(first, { platform: 'darwin', arch: 'arm64' })
      await assert.rejects(() => installRuntimeFromDirectory(second, {
        platform: 'darwin', arch: 'arm64',
        activate() { throw new Error('plugin registration failed') },
      }), /plugin registration failed/)
      const active = await resolveInstalledRuntime({ platform: 'darwin', arch: 'arm64', verifyFiles: true })
      assert.equal(active.ok, true)
      assert.equal(await readFile(active.python, 'utf8'), 'first')
    } finally {
      await Promise.all([first, second].map((path) => rm(path, { recursive: true, force: true })))
    }
  })
})

test('invalid upgrade source leaves the active runtime intact', async () => {
  await withHome(async () => {
    const good = await makeRuntime(await mkdtemp(join(tmpdir(), 'dsos-runtime-good-')), 'good')
    const bad = await makeRuntime(await mkdtemp(join(tmpdir(), 'dsos-runtime-bad-')), 'bad')
    try {
      assert.equal((await installRuntimeFromDirectory(good, { platform: 'darwin', arch: 'arm64' })).ok, true)
      await writeFile(join(bad, 'python', 'python'), 'tampered')
      assert.equal((await installRuntimeFromDirectory(bad, { platform: 'darwin', arch: 'arm64' })).ok, false)
      const active = await resolveInstalledRuntime({ platform: 'darwin', arch: 'arm64', verifyFiles: true })
      assert.equal(active.ok, true)
      assert.equal(await readFile(active.python, 'utf8'), 'good')
    } finally {
      await Promise.all([good, bad].map((path) => rm(path, { recursive: true, force: true })))
    }
  })
})

test('runtime removal clears runtime but does not remove other Semantic OS data', async () => {
  await withHome(async (home) => {
    const source = await makeRuntime(await mkdtemp(join(tmpdir(), 'dsos-runtime-remove-')))
    const graph = join(home, 'semantic-os', 'keep-me.json')
    try {
      await mkdir(join(home, 'semantic-os'), { recursive: true })
      await writeFile(graph, 'keep')
      await installRuntimeFromDirectory(source, { platform: 'darwin', arch: 'arm64' })
      await removeInstalledRuntime({ platform: 'darwin', arch: 'arm64' })
      assert.equal((await resolveInstalledRuntime({ platform: 'darwin', arch: 'arm64' })).ok, false)
      assert.equal(await readFile(graph, 'utf8'), 'keep')
    } finally { await rm(source, { recursive: true, force: true }) }
  })
})
