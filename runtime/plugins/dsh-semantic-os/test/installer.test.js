import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createInstaller, installStatePath } from '../installer.js'

async function withHome(fn) {
  const previous = process.env.DSH_HOME
  const root = await mkdtemp(join(tmpdir(), 'dsos-installer-test-'))
  process.env.DSH_HOME = root
  try {
    await fn(root)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    await rm(root, { recursive: true, force: true })
  }
}

const ready = {
  semantica: { ok: true, version: '0.6.7' },
  graph: { ok: true, via: 'test' },
  vector: { ok: true, via: 'test' },
}

test('fast path verifies and records an already-ready environment', async () => {
  await withHome(async () => {
    let installed = 0
    const installer = createInstaller({
      probe: async () => ready,
      install: async () => { installed += 1; return ready },
    })
    const result = await installer.ensure()
    assert.equal(result.ok, true)
    assert.equal(installed, 0)
    assert.equal(installer.snapshot().phase, 'ready')
    const manifest = JSON.parse(await readFile(installStatePath(), 'utf8'))
    assert.equal(manifest.status.semantica.version, '0.6.7')
  })
})

test('subsequent checks pass the trusted runtime manifest digest', async () => {
  await withHome(async () => {
    const seen = []
    const status = { ...ready, runtime: { manifestDigest: 'a'.repeat(64) } }
    const installer = createInstaller({
      probe: async (options) => { seen.push(options.trustedRuntimeDigest || ''); return status },
      install: async () => status,
    })
    await installer.ensure()
    await installer.ensure()
    assert.deepEqual(seen, ['', 'a'.repeat(64)])
  })
})

test('missing required dependency runs install and publishes progress', async () => {
  await withHome(async () => {
    let installed = 0
    const installer = createInstaller({
      probe: async () => ({ semantica: { ok: false }, graph: { ok: false } }),
      install: async ({ onProgress }) => {
        installed += 1
        onProgress({ step: 'installing_semantica', current: 2, total: 6, detail: 'installing' })
        return ready
      },
    })
    const result = await installer.ensure()
    assert.equal(result.ok, true)
    assert.equal(installed, 1)
    assert.equal(installer.snapshot().phase, 'ready')
  })
})

test('installation timeout aborts the active installer', async () => {
  await withHome(async () => {
    const installer = createInstaller({
      getConfig: () => ({ installTimeoutMs: 20 }),
      probe: async () => ({ semantica: { ok: false }, graph: { ok: false } }),
      install: ({ signal }) => new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({ semantica: { ok: false, detail: 'aborted' }, graph: { ok: false } }), { once: true })
      }),
    })
    const result = await installer.ensure()
    assert.equal(result.ok, false)
    assert.equal(result.error, 'INSTALL_TIMEOUT')
  })
})

test('required installation failure is explicit and retryable', async () => {
  await withHome(async () => {
    let attempts = 0
    const installer = createInstaller({
      probe: async () => ({ semantica: { ok: false }, graph: { ok: false } }),
      install: async () => {
        attempts += 1
        return attempts === 1 ? { semantica: { ok: false, detail: 'offline' }, graph: { ok: false } } : ready
      },
    })
    const failed = await installer.ensure()
    assert.equal(failed.ok, false)
    assert.equal(installer.snapshot().phase, 'install_failed')
    assert.equal(installer.snapshot().error, 'REQUIRED_DEPENDENCY_MISSING')
    const retried = await installer.ensure(true)
    assert.equal(retried.ok, true)
    assert.equal(attempts, 2)
  })
})
