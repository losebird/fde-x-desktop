import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  EMPTY_CREDENTIALS_DOCUMENT,
  credentialSourceHomes,
  ensureCredentialsDocument,
  seedDshCredentials,
  seedDshCredentialsSync,
} from '../dsh-credentials.mjs'

test('credentialSourceHomes skips dest and de-dupes', () => {
  const dest = '/tmp/fde-x-user/dsh-home'
  const homes = credentialSourceHomes(dest, {
    officialHome: '/Users/z/.dsh',
    fdeHome: dest,
  })
  assert.deepEqual(homes, ['/Users/z/.dsh'])
})

test('seedDshCredentials copies official yaml once with 0600', async () => {
  const root = join(tmpdir(), `fde-cred-${process.pid}-${Date.now()}`)
  const official = join(root, 'official')
  const destHome = join(root, 'desktop-home')
  mkdirSync(official, { recursive: true })
  writeFileSync(join(official, '.credentials.yaml'), 'models: {}\n', { mode: 0o600 })
  try {
    const first = await seedDshCredentials(destHome, { officialHome: official, fdeHome: join(root, 'other') })
    assert.equal(first.copied, true)
    assert.equal(readFileSync(first.dest, 'utf8'), 'models: {}\n')
    const again = seedDshCredentialsSync(destHome, { officialHome: official })
    assert.equal(again.copied, false)
    assert.equal(again.reason, 'already')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('seedDshCredentials falls back to fde home when official is missing', async () => {
  const root = join(tmpdir(), `fde-cred-fb-${process.pid}-${Date.now()}`)
  const fde = join(root, 'fde')
  const destHome = join(root, 'desktop-home')
  mkdirSync(fde, { recursive: true })
  writeFileSync(join(fde, '.credentials.yaml'), 'from: fde\n', { mode: 0o600 })
  try {
    const seeded = await seedDshCredentials(destHome, {
      officialHome: join(root, 'missing-official'),
      fdeHome: fde,
    })
    assert.equal(seeded.copied, true)
    assert.equal(readFileSync(seeded.dest, 'utf8'), 'from: fde\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ensureCredentialsDocument writes an empty store and does not replace one', async () => {
  const root = join(tmpdir(), `fde-cred-empty-${process.pid}-${Date.now()}`)
  const destHome = join(root, 'desktop-home')
  try {
    const created = await ensureCredentialsDocument(destHome)
    assert.equal(created.created, true)
    assert.equal(readFileSync(created.dest, 'utf8'), EMPTY_CREDENTIALS_DOCUMENT)
    assert.equal(statSync(created.dest).mode & 0o777, 0o600)
    writeFileSync(created.dest, 'keep: yes\n', { mode: 0o600 })
    const again = await ensureCredentialsDocument(destHome)
    assert.equal(again.created, false)
    assert.equal(readFileSync(again.dest, 'utf8'), 'keep: yes\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
