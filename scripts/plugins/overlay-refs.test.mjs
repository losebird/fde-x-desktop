import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { includeRuntimePath } from '../pack/stage.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const script = fileURLToPath(new URL('./lan-assist-tree.mjs', import.meta.url))
const lockScript = fileURLToPath(new URL('./plugins-lock.mjs', import.meta.url))
const OVERLAY_COMMIT = '6a79f383b951c7e13f424c4577dc06b85f64304e'

test('sync without --overlay exits 0 and keeps the overlay lock label', () => {
  const source = process.env.LAN_ASSIST_SOURCE || join(homedir(), '.dsh', 'vendor', 'dsh-lan-assist')
  const root = mkdtempSync(join(tmpdir(), 'overlay-sync-'))
  try {
    const lock = readFileSync(join(repoRoot, 'runtime/plugins/plugins.lock.json'), 'utf8')
    mkdirSync(join(root, 'runtime/plugins'), { recursive: true })
    writeFileSync(join(root, 'runtime/plugins/plugins.lock.json'), lock)
    const ran = spawnSync(process.execPath, [script, 'sync', '--source', source, '--root', root], { encoding: 'utf8' })
    assert.equal(ran.status, 0, ran.stderr)
    const entry = JSON.parse(readFileSync(join(root, 'runtime/plugins/plugins.lock.json'), 'utf8')).plugins['dsh-lan-assist']
    assert.equal(entry.overlay.commit, OVERLAY_COMMIT)
    assert.equal(entry.overlay.path, 'runtime/vendor-overlays/dsh-lan-assist')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('plugins-lock without --root prints verify ok', () => {
  const ran = spawnSync(process.execPath, [lockScript], { cwd: repoRoot, encoding: 'utf8' })
  assert.equal(ran.status, 0, ran.stderr)
  assert.match(ran.stdout, /plugins\.lock verify ok/)
})

test('iui-tar-sha plants the semantic-os pyc on the packed plugin tree', () => {
  const yml = readFileSync(join(repoRoot, '.github/workflows/iui-tar-sha.yml'), 'utf8')
  const marker = 'runtime/plugins/dsh-semantic-os/python/__pycache__'
  assert.equal(yml.includes(marker), true)
  assert.equal(yml.includes('runtime/vendor-overlays'), false)
  const runtimeRoot = join(repoRoot, 'runtime')
  assert.equal(
    includeRuntimePath(join(runtimeRoot, 'plugins/dsh-semantic-os/python/__pycache__/x.pyc'), runtimeRoot),
    false,
  )
})
