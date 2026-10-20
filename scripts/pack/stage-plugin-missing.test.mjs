import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'
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

test('FDE_ALLOW_MISSING_PLUGINS=1 lets a local stage continue', { timeout: 180000 }, () => {
  const abs = join(repo, rel)
  const bak = `${abs}.pr5-allow`
  const out = join(tmpdir(), `pr5-stage-allow-${process.pid}`)
  const artifact = join(process.env.HOME || '', '.dsh', 'iui', 'iui-77c23c7c3e9cfc991e0bed9fb44b0a4ea66fd57c.tar.gz')
  assert.equal(existsSync(artifact), true, artifact)
  renameSync(abs, bak)
  try {
    const result = spawnSync(process.execPath, [stage], {
      cwd: repo,
      encoding: 'utf8',
      timeout: 180000,
      env: {
        ...process.env,
        CI: 'true',
        FDE_ALLOW_MISSING_PLUGINS: '1',
        FDE_PACK_OUT: out,
        FDE_IUI_ARTIFACT: artifact,
        FDE_DOWNLOAD_SEMANTIC_RUNTIME: '0',
        FDE_STAGE_DSH_FROM_NPM: '0',
        FDE_STAGE_NODE: '0',
      },
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(`${result.stderr}`, /FDE_ALLOW_MISSING_PLUGINS=1/)
    assert.match(`${result.stderr}`, /missing runtime\/plugins\/dsh-semantic-os\/LICENSE/)
  } finally {
    renameSync(bak, abs)
  }
})
