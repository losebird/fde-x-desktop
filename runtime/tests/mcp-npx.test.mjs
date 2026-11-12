import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ensureNpxShim, findCachedNpxBin, parseNpxInvocation, planNpxLaunch, realNpxPath } from '../mcp-npx.mjs'

test('npx -y package is MCP-style; skills and clawhub pass through', () => {
  assert.deepEqual(parseNpxInvocation(['-y', '@playwright/mcp', '--headless']), {
    kind: 'mcp',
    pkg: '@playwright/mcp',
    rest: ['--headless'],
  })
  assert.equal(parseNpxInvocation(['--yes', 'skills', 'add', 'foo']).kind, 'passthrough')
  assert.equal(parseNpxInvocation(['--yes', 'clawhub@latest', 'search']).kind, 'passthrough')
})

test('findCachedNpxBin reads package.json bin from an npx cache tree', () => {
  const root = join(tmpdir(), `fde-npx-cache-${process.pid}`)
  const pkgDir = join(root, 'abc123', 'node_modules', '@playwright', 'mcp')
  const binDir = join(root, 'abc123', 'node_modules', '.bin')
  mkdirSync(pkgDir, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ bin: { 'playwright-mcp': 'cli.js' } }))
  const bin = join(binDir, 'playwright-mcp')
  writeFileSync(bin, '')
  try {
    assert.equal(findCachedNpxBin('@playwright/mcp', { cacheRoot: root, platform: 'darwin' }), bin)
    assert.equal(findCachedNpxBin('missing-pkg', { cacheRoot: root, platform: 'darwin' }), '')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('planNpxLaunch uses cache and skips real npx when the package is already installed', () => {
  const root = join(tmpdir(), `fde-npx-plan-${process.pid}`)
  const pkgDir = join(root, 'hash', 'node_modules', 'chrome-devtools-mcp')
  const binDir = join(root, 'hash', 'node_modules', '.bin')
  mkdirSync(pkgDir, { recursive: true })
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ bin: { 'chrome-devtools-mcp': 'bin.js' } }))
  const bin = join(binDir, 'chrome-devtools-mcp')
  writeFileSync(bin, '')
  try {
    const plan = planNpxLaunch(['-y', 'chrome-devtools-mcp'], {
      cacheRoot: root,
      realNpx: '/tmp/real-npx',
      platform: 'darwin',
    })
    assert.equal(plan.kind, 'cache')
    assert.equal(plan.command, bin)
    assert.deepEqual(plan.args, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ensureNpxShim keeps the original npx and points bin/npx at the cache launcher', () => {
  const root = join(tmpdir(), `fde-npx-shim-${process.pid}`)
  const binDir = join(root, 'node', 'bin')
  const npmBin = join(root, 'node', 'lib', 'node_modules', 'npm', 'bin')
  mkdirSync(binDir, { recursive: true })
  mkdirSync(npmBin, { recursive: true })
  writeFileSync(join(binDir, 'npx'), '#!/usr/bin/env node\nconsole.log("real")\n')
  writeFileSync(join(npmBin, 'npx-cli.js'), 'console.log("cli")\n')
  try {
    assert.equal(ensureNpxShim(root, 'darwin'), true)
    assert.match(readFileSync(join(binDir, 'npx'), 'utf8'), /mcp-npx-launch/)
    assert.match(readFileSync(join(binDir, 'npx.real'), 'utf8'), /real/)
    assert.equal(realNpxPath({ resources: root, platform: 'darwin', env: { PATH: '' } }), join(binDir, 'npx.real'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('planNpxLaunch falls through to real npx when cache is empty', () => {
  const root = join(tmpdir(), `fde-npx-empty-${process.pid}`)
  mkdirSync(root, { recursive: true })
  try {
    const plan = planNpxLaunch(['-y', 'brand-new-mcp'], {
      cacheRoot: root,
      realNpx: '/opt/npx',
      platform: 'darwin',
    })
    assert.equal(plan.kind, 'npx')
    assert.equal(plan.command, '/opt/npx')
    assert.deepEqual(plan.args, ['-y', 'brand-new-mcp'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
