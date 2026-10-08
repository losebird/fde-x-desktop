import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { stagePluginTree } from './plugin-stage.mjs'

test('stagePluginTree copies package files and drops runtime-dist', async () => {
  const root = join(tmpdir(), `fde-plug-${process.pid}`)
  const from = join(root, 'src')
  const to = join(root, 'out')
  mkdirSync(join(from, 'dist', 'explore'), { recursive: true })
  mkdirSync(join(from, 'python'), { recursive: true })
  mkdirSync(join(from, 'runtime-dist', 'darwin-arm64'), { recursive: true })
  mkdirSync(join(from, 'release-dist'), { recursive: true })
  writeFileSync(join(from, 'package.json'), JSON.stringify({
    name: 'dsh-semantic-os',
    files: ['index.js', 'dist/explore', 'python/bootstrap.py'],
  }))
  writeFileSync(join(from, 'index.js'), 'export default 1\n')
  writeFileSync(join(from, 'cordis.patch.yml'), 'ok: 1\n')
  writeFileSync(join(from, 'dist', 'explore', 'app.js'), '1\n')
  writeFileSync(join(from, 'python', 'bootstrap.py'), '# py\n')
  writeFileSync(join(from, 'runtime-dist', 'darwin-arm64', 'big.bin'), 'x'.repeat(100))
  writeFileSync(join(from, 'release-dist', 'pack.tar.gz'), 'y'.repeat(100))
  try {
    assert.equal(await stagePluginTree(from, to), true)
    assert.equal(existsSync(join(to, 'index.js')), true)
    assert.equal(existsSync(join(to, 'cordis.patch.yml')), true)
    assert.equal(existsSync(join(to, 'dist', 'explore', 'app.js')), true)
    assert.equal(existsSync(join(to, 'python', 'bootstrap.py')), true)
    assert.equal(existsSync(join(to, 'runtime-dist')), false)
    assert.equal(existsSync(join(to, 'release-dist')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
