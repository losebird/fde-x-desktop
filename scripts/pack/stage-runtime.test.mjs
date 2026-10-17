import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { includeRuntimePath } from './stage.mjs'

const root = '/repo/runtime'

test('pack runtime excludes user sqlite and semantic-os cache', () => {
  assert.equal(includeRuntimePath(root, root), true)
  assert.equal(includeRuntimePath(join(root, 'server.mjs'), root), true)
  assert.equal(includeRuntimePath(join(root, 'migrations', '016_workspace_file_revisions.sql'), root), true)
  assert.equal(includeRuntimePath(join(root, 'data', 'fde-workstation.sqlite'), root), false)
  assert.equal(includeRuntimePath(join(root, 'data', 'fde-workstation.sqlite-wal'), root), false)
  assert.equal(includeRuntimePath(join(root, 'data', 'semantic-os', 'runtime', 'current.json'), root), false)
  assert.equal(includeRuntimePath(join(root, 'native-workspaces', 'ws_personal'), root), false)
  assert.equal(includeRuntimePath(join(root, 'vendor-overlays', 'dsh-semantic-os', 'python', '__pycache__', 'x.pyc'), root), false)
  assert.equal(
    includeRuntimePath(join(root, '.host-generation', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), root),
    false,
  )
})

test('copying runtime drops .host-generation from the staged tree', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fde-stage-runtime-'))
  const src = join(dir, 'runtime')
  const dest = join(dir, 'app', 'runtime')
  const planted = join(src, '.host-generation', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  await mkdir(join(planted, '..'), { recursive: true })
  await writeFile(planted, 'planted\n')
  await writeFile(join(src, 'server.mjs'), 'export {}\n')
  await cp(src, dest, {
    recursive: true,
    filter: (path) => includeRuntimePath(path, src),
  })
  assert.equal(existsSync(join(dest, 'server.mjs')), true)
  assert.equal(existsSync(join(dest, '.host-generation')), false)
})
