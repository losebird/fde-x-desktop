import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { listMcpRecipes } from '../mcp-recipes.mjs'
import { FDE_RUNTIME_DIR } from '../config.mjs'

test('mail recipe points at the bundled launcher', () => {
  const recipes = listMcpRecipes({ runtimeDir: FDE_RUNTIME_DIR, resources: '', env: { FDE_HOST_NODE: process.execPath } })
  const mail = recipes.find((row) => row.id === 'mail')
  assert.equal(mail.available, true)
  assert.equal(mail.transport, 'stdio')
  assert.equal(mail.args[0].endsWith('mail-mcp-launch.mjs'), true)
  assert.equal(mail.fields.some((field) => field.key === 'MAIL_PROVIDER'), true)
  assert.equal(mail.fields.some((field) => field.key === 'IMAP_USER'), true)
  assert.equal(mail.fields.some((field) => field.key === 'IMAP_HOST'), true)
})

test('playwright recipe uses the cache-first npx shim', () => {
  const recipes = listMcpRecipes({
    runtimeDir: FDE_RUNTIME_DIR,
    resources: tmpdir(),
    env: { PATH: '/no-npx' },
  })
  const playwright = recipes.find((row) => row.id === 'playwright')
  assert.equal(playwright.available, true)
  assert.equal(playwright.command.endsWith('mcp-npx-bin/npx'), true)
  assert.deepEqual(playwright.args, ['-y', '@playwright/mcp', '--headless'])
  assert.match(playwright.hint, /@playwright\/mcp/)
})

test('cua recipe stays unavailable without envelope or host binary', () => {
  const recipes = listMcpRecipes({
    runtimeDir: FDE_RUNTIME_DIR,
    resources: tmpdir(),
    env: { PATH: '/no-such-cua-path', HOME: tmpdir() },
    hostCuaBins: [],
  })
  const cua = recipes.find((row) => row.id === 'cua')
  assert.equal(cua.available, false)
  assert.match(cua.hint, /本机也没有/)
})

test('cua recipe uses envelope binary when present', () => {
  const root = join(tmpdir(), `fde-recipe-cua-${process.pid}`)
  const dir = join(root, 'cua-driver', `${process.platform}-${process.arch}`)
  mkdirSync(dir, { recursive: true })
  const bin = join(dir, process.platform === 'win32' ? 'cua-driver.exe' : 'cua-driver')
  writeFileSync(bin, '')
  try {
    const recipes = listMcpRecipes({
      runtimeDir: FDE_RUNTIME_DIR,
      resources: root,
      hostCuaBins: ['/Applications/CuaDriver.app/Contents/MacOS/cua-driver'],
    })
    const cua = recipes.find((row) => row.id === 'cua')
    assert.equal(cua.available, true)
    assert.equal(cua.command, bin)
    assert.match(cua.hint, /安装包内/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('cua recipe uses host CuaDriver when the envelope has none', () => {
  const root = join(tmpdir(), `fde-recipe-cua-host-${process.pid}`)
  mkdirSync(root, { recursive: true })
  const bin = join(root, 'cua-driver')
  writeFileSync(bin, '')
  try {
    const recipes = listMcpRecipes({
      runtimeDir: FDE_RUNTIME_DIR,
      resources: tmpdir(),
      env: { PATH: '/no-such-cua-path', HOME: tmpdir() },
      hostCuaBins: [bin],
    })
    const cua = recipes.find((row) => row.id === 'cua')
    assert.equal(cua.available, true)
    assert.equal(cua.command, bin)
    assert.match(cua.hint, /本机已装/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
