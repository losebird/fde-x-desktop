import { test } from 'node:test'
import assert from 'node:assert/strict'
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
})
