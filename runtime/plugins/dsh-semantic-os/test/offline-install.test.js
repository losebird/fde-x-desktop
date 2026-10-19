import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ensureDeps } from '../ensure-deps.js'

test('forced offline install fails explicitly when platform runtime is absent', async () => {
  const previous = process.env.DSH_SEMANTIC_OS_OFFLINE
  const previousHome = process.env.DSH_HOME
  const home = await mkdtemp(join(tmpdir(), 'dsos-offline-'))
  process.env.DSH_SEMANTIC_OS_OFFLINE = '1'
  process.env.DSH_HOME = home
  try {
    const status = await ensureDeps({ allowOnline: false })
    if (status.ok) {
      assert.equal(status.source, 'bundled')
      assert.equal(status.semantica.ok, true)
    } else {
      assert.equal(status.source, 'bundled-missing')
      assert.equal(status.semantica.ok, false)
      assert.match(String(status.semantica.detail || ''), /RUNTIME_/)
    }
  } finally {
    if (previous === undefined) delete process.env.DSH_SEMANTIC_OS_OFFLINE
    else process.env.DSH_SEMANTIC_OS_OFFLINE = previous
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await rm(home, { recursive: true, force: true })
  }
})
