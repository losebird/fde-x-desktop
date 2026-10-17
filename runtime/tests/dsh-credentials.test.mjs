import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CREDENTIALS_TMP_MAX_AGE_MS,
  EMPTY_CREDENTIALS_DOCUMENT,
  credentialSourceHomes,
  ensureCredentialsDocument,
  seedDshCredentials,
  seedDshCredentialsSync,
  sweepStaleCredentialTemps,
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
    assert.deepEqual(readdirSync(destHome).filter((name) => name.endsWith('.tmp')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ensureCredentialsDocument does not replace an existing file', async () => {
  const root = join(tmpdir(), `fde-cred-keep-${process.pid}-${Date.now()}`)
  const destHome = join(root, 'desktop-home')
  const dest = join(destHome, '.credentials.yaml')
  mkdirSync(destHome, { recursive: true })
  writeFileSync(dest, '', { mode: 0o640 })
  try {
    const empty = await ensureCredentialsDocument(destHome)
    assert.equal(empty.created, false)
    assert.equal(readFileSync(dest, 'utf8'), '')
    assert.equal(statSync(dest).mode & 0o777, 0o640)
    writeFileSync(dest, 'keep: yes\n', { mode: 0o640 })
    const again = await ensureCredentialsDocument(destHome)
    assert.equal(again.created, false)
    assert.equal(readFileSync(again.dest, 'utf8'), 'keep: yes\n')
    assert.equal(statSync(again.dest).mode & 0o777, 0o640)
    assert.deepEqual(readdirSync(destHome).filter((name) => name.endsWith('.tmp')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function publishInChild(destHome) {
  const modulePath = fileURLToPath(new URL('../dsh-credentials.mjs', import.meta.url))
  const code = `
    import { ensureCredentialsDocument } from ${JSON.stringify(modulePath)}
    process.umask(0o077)
    const result = await ensureCredentialsDocument(${JSON.stringify(destHome)})
    process.stdout.write(JSON.stringify({ created: result.created === true }))
  `
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    child.on('close', (status) => {
      if (status !== 0) {
        reject(new Error(err || out || `exit ${status}`))
        return
      }
      resolve(JSON.parse(out))
    })
  })
}

test('ensureCredentialsDocument mode stays 0600 when umask clears owner bits', async () => {
  const root = join(tmpdir(), `fde-cred-mode-${process.pid}-${Date.now()}`)
  const destHome = join(root, 'desktop-home')
  mkdirSync(destHome, { recursive: true })
  try {
    const result = await publishInChild(destHome)
    assert.equal(result.created, true)
    const dest = join(destHome, '.credentials.yaml')
    assert.equal(readFileSync(dest, 'utf8'), EMPTY_CREDENTIALS_DOCUMENT)
    assert.equal(statSync(dest).mode & 0o777, 0o600)
    assert.deepEqual(readdirSync(destHome).filter((name) => name.endsWith('.tmp')), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('two processes publishing the first credentials file leave one document', async () => {
  const root = join(tmpdir(), `fde-cred-race-${process.pid}-${Date.now()}`)
  const destHome = join(root, 'desktop-home')
  mkdirSync(destHome, { recursive: true })
  try {
    const results = await Promise.all([publishInChild(destHome), publishInChild(destHome)])
    const created = results.filter((result) => result.created)
    assert.equal(created.length, 1)
    const dest = join(destHome, '.credentials.yaml')
    assert.equal(readFileSync(dest, 'utf8'), EMPTY_CREDENTIALS_DOCUMENT)
    assert.equal(statSync(dest).mode & 0o777, 0o600)
    assert.deepEqual(readdirSync(destHome), ['.credentials.yaml'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('startup sweep removes an old credentials temp and keeps a fresh one', async () => {
  const root = join(tmpdir(), `fde-cred-tmp-${process.pid}-${Date.now()}`)
  const destHome = join(root, 'desktop-home')
  mkdirSync(destHome, { recursive: true })
  const official = join(destHome, '.credentials.yaml')
  const oldTemp = join(destHome, '.credentials.yaml.11.old.tmp')
  const freshTemp = join(destHome, '.credentials.yaml.22.fresh.tmp')
  const decoy = join(destHome, '.credentials.yaml.bak')
  writeFileSync(official, 'keep: yes\n', { mode: 0o600 })
  writeFileSync(oldTemp, 'stale\n', { mode: 0o600 })
  writeFileSync(freshTemp, 'live\n', { mode: 0o600 })
  writeFileSync(decoy, 'bak\n', { mode: 0o600 })
  const staleAt = new Date(Date.now() - CREDENTIALS_TMP_MAX_AGE_MS - 60_000)
  const freshAt = new Date(Date.now() - 30_000)
  utimesSync(official, staleAt, staleAt)
  utimesSync(oldTemp, staleAt, staleAt)
  utimesSync(freshTemp, freshAt, freshAt)
  utimesSync(decoy, staleAt, staleAt)
  try {
    const swept = sweepStaleCredentialTemps(destHome)
    assert.deepEqual(swept.removed, ['.credentials.yaml.11.old.tmp'])
    assert.equal(existsSync(oldTemp), false)
    assert.equal(readFileSync(freshTemp, 'utf8'), 'live\n')
    assert.equal(readFileSync(official, 'utf8'), 'keep: yes\n')
    assert.equal(statSync(official).mode & 0o777, 0o600)
    assert.equal(readFileSync(decoy, 'utf8'), 'bak\n')
    const { createCoreConnector } = await import('../dsh-core.mjs')
    writeFileSync(oldTemp, 'stale-again\n', { mode: 0o600 })
    utimesSync(oldTemp, staleAt, staleAt)
    createCoreConnector({ dshHome: destHome })
    assert.equal(existsSync(oldTemp), false)
    assert.equal(readFileSync(freshTemp, 'utf8'), 'live\n')
    assert.equal(readFileSync(official, 'utf8'), 'keep: yes\n')
    assert.equal(statSync(official).mode & 0o777, 0o600)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
