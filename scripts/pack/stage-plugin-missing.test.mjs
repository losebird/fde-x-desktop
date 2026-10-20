import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const stage = fileURLToPath(new URL('./stage.mjs', import.meta.url))
const repo = fileURLToPath(new URL('../..', import.meta.url))
const rel = 'runtime/plugins/dsh-semantic-os/LICENSE'

test('stage exits 1 and names a missing plugin file', () => {
  const abs = join(repo, rel)
  const bak = `${abs}.pr5-missing`
  const out = join(tmpdir(), `pr5-stage-${process.pid}`)
  renameSync(abs, bak)
  try {
    const result = spawnSync(process.execPath, [stage], {
      cwd: repo,
      encoding: 'utf8',
      timeout: 120000,
      env: {
        ...process.env,
        FDE_PACK_OUT: out,
        FDE_DOWNLOAD_SEMANTIC_RUNTIME: '0',
        FDE_STAGE_DSH_FROM_NPM: '0',
        FDE_STAGE_NODE: '0',
      },
    })
    assert.equal(result.status, 1, result.stderr || result.stdout)
    assert.match(result.stderr, /missing runtime\/plugins\/dsh-semantic-os\/LICENSE/)
  } finally {
    renameSync(bak, abs)
  }
})
