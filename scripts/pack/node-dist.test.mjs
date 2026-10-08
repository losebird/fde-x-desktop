import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { NODE_DIST_VERSION, nodeDistArchiveName, nodeDistPresent, nodeDistUrls } from './node-dist.mjs'

test('node dist archive names follow official dist layout', () => {
  assert.equal(nodeDistArchiveName('24.21.0', 'darwin', 'arm64'), 'node-v24.21.0-darwin-arm64.tar.gz')
  assert.equal(nodeDistArchiveName('24.21.0', 'linux', 'x64'), 'node-v24.21.0-linux-x64.tar.gz')
  assert.equal(nodeDistArchiveName('24.21.0', 'win32', 'x64'), 'node-v24.21.0-win-x64.zip')
  const urls = nodeDistUrls('24.21.0', 'node-v24.21.0-darwin-arm64.tar.gz')
  assert.equal(urls[0].includes('nodejs.org/dist/v24.21.0/'), true)
  assert.equal(urls[1].includes('npmmirror.com/mirrors/node/v24.21.0/'), true)
  assert.equal(NODE_DIST_VERSION, '24.21.0')
})

test('nodeDistPresent sees bin/node', () => {
  const root = join(tmpdir(), `fde-node-${process.pid}`)
  mkdirSync(join(root, 'bin'), { recursive: true })
  writeFileSync(join(root, 'bin', 'node'), '#!/bin/sh\n')
  chmodSync(join(root, 'bin', 'node'), 0o755)
  try {
    assert.equal(nodeDistPresent(root), true)
    assert.equal(nodeDistPresent(join(root, 'missing')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
