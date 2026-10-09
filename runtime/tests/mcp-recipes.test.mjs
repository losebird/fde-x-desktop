import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
  assert.equal(mail.fields.some((field) => field.key === 'IMAP_HOST'), true)
})

test('cua recipe stays unavailable without envelope binary', () => {
  const recipes = listMcpRecipes({ runtimeDir: FDE_RUNTIME_DIR, resources: tmpdir() })
  const cua = recipes.find((row) => row.id === 'cua')
  assert.equal(cua.available, false)
})

test('cua recipe uses envelope binary when present', () => {
  const root = join(tmpdir(), `fde-recipe-cua-${process.pid}`)
  const dir = join(root, 'cua-driver', `${process.platform}-${process.arch}`)
  mkdirSync(dir, { recursive: true })
  const bin = join(dir, process.platform === 'win32' ? 'cua-driver.exe' : 'cua-driver')
  writeFileSync(bin, '')
  try {
    const recipes = listMcpRecipes({ runtimeDir: FDE_RUNTIME_DIR, resources: root })
    const cua = recipes.find((row) => row.id === 'cua')
    assert.equal(cua.available, true)
    assert.equal(cua.command, bin)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
