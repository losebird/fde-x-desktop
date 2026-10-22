import { awaitChildExit } from './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { lstat, mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PLUGIN_PIN_FILE, reconcilePinnedVendor } from '../plugin-vendor.mjs'

const PIN = {
  version: '0.13.0-iui.26',
  commit: 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37',
}

async function writeTree(dir, { version, commit, marker }) {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version })}\n`)
  if (commit) await writeFile(join(dir, PLUGIN_PIN_FILE), `${JSON.stringify({ commit })}\n`)
  await writeFile(join(dir, 'marker.txt'), marker)
}

test('reconcilePinnedVendor keeps a matching vendor and its marker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  const source = join(root, 'source')
  await writeTree(vendor, { ...PIN, marker: 'stay' })
  await writeTree(source, { ...PIN, marker: 'other' })
  const result = await reconcilePinnedVendor({
    vendorDir: vendor,
    pin: PIN,
    candidates: [source],
    pid: 11,
  })
  assert.deepEqual(result, { ok: true, action: 'keep' })
  assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'stay')
  assert.equal(await readFile(join(source, 'marker.txt'), 'utf8'), 'other')
  await rm(root, { recursive: true, force: true })
})

test('reconcilePinnedVendor replaces a mismatched vendor from an unchanged source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  const source = join(root, 'source')
  await writeTree(vendor, { version: 'old', commit: 'old', marker: 'vendor-marker' })
  await writeTree(source, { ...PIN, marker: 'source-marker' })
  const sourceBefore = await readFile(join(source, 'package.json'))
  const result = await reconcilePinnedVendor({
    vendorDir: vendor,
    pin: PIN,
    candidates: [source],
    pid: 12,
  })
  assert.deepEqual(result, { ok: true, action: 'replace' })
  assert.equal(JSON.parse(await readFile(join(vendor, 'package.json'), 'utf8')).version, PIN.version)
  assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'source-marker')
  assert.deepEqual(await readFile(join(source, 'package.json')), sourceBefore)
  assert.equal(existsSync(`${vendor}.staging-12`), false)
  assert.equal(existsSync(`${vendor}.bak-12`), false)
  await rm(root, { recursive: true, force: true })
})

test('reconcilePinnedVendor leaves the vendor when the source pin mismatches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  const source = join(root, 'source')
  await writeTree(vendor, { version: 'old', commit: 'old', marker: 'stay' })
  await writeTree(source, { version: 'nope', commit: 'nope', marker: 'bad' })
  const result = await reconcilePinnedVendor({
    vendorDir: vendor,
    pin: PIN,
    candidates: [source],
    pid: 13,
  })
  assert.deepEqual(result, { ok: false, action: 'source-mismatch' })
  assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'stay')
  assert.equal(existsSync(`${vendor}.staging-13`), false)
  await rm(root, { recursive: true, force: true })
})

test('reconcilePinnedVendor does not delete a vendor that is its own source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const real = join(root, 'real')
  const vendor = join(root, 'vendor', 'iui')
  await writeTree(real, { version: 'old', commit: 'old', marker: 'shared' })
  await mkdir(dirname(vendor), { recursive: true })
  await symlink(real, vendor)
  const result = await reconcilePinnedVendor({
    vendorDir: vendor,
    pin: PIN,
    candidates: [vendor],
    pid: 14,
  })
  assert.deepEqual(result, { ok: false, action: 'source-is-vendor' })
  assert.equal(await readFile(join(real, 'marker.txt'), 'utf8'), 'shared')
  assert.equal((await lstat(vendor)).isSymbolicLink(), true)
  assert.equal(existsSync(`${vendor}.staging-14`), false)
  await rm(root, { recursive: true, force: true })
})

test('reconcilePinnedVendor refuses a version match that has no commit file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  const source = join(root, 'source')
  await writeTree(vendor, { version: PIN.version, commit: '', marker: 'stay' })
  await rm(join(vendor, PLUGIN_PIN_FILE), { force: true })
  await writeTree(source, { version: PIN.version, commit: '', marker: 'bad' })
  await rm(join(source, PLUGIN_PIN_FILE), { force: true })
  const result = await reconcilePinnedVendor({
    vendorDir: vendor,
    pin: PIN,
    candidates: [source],
    pid: 15,
  })
  assert.equal(result.ok, false)
  assert.equal(result.action, 'source-mismatch')
  assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'stay')
  await rm(root, { recursive: true, force: true })
})

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

test('a crash bak from a dead pid is restored when the vendor is gone', async () => {
  const deadPid = 2147483646
  assert.equal(pidAlive(deadPid), false)
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  await writeTree(`${vendor}.bak-${deadPid}`, { ...PIN, marker: 'from-bak' })
  try {
    const result = await reconcilePinnedVendor({
      vendorDir: vendor,
      pin: PIN,
      candidates: [],
      pid: 21,
    })
    assert.equal(result.ok, true)
    assert.equal(result.action, 'restore')
    assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'from-bak')
    assert.equal(existsSync(`${vendor}.bak-${deadPid}`), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('pin cleanup keeps another live pid staging and a dead bak', async () => {
  const deadPid = 2147483646
  assert.equal(pidAlive(deadPid), false)
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  const liveStaging = `${vendor}.staging-${child.pid}`
  const deadStaging = `${vendor}.staging-${deadPid}`
  const deadBak = `${vendor}.bak-${deadPid}`
  try {
    await writeTree(vendor, { ...PIN, marker: 'stay' })
    await writeTree(liveStaging, { ...PIN, marker: 'live' })
    await writeTree(deadStaging, { ...PIN, marker: 'dead-staging' })
    await writeTree(deadBak, { ...PIN, marker: 'dead-bak' })
    const result = await reconcilePinnedVendor({
      vendorDir: vendor,
      pin: PIN,
      candidates: [],
      pid: 22,
    })
    assert.equal(result.action, 'keep')
    assert.equal(existsSync(liveStaging), true)
    assert.equal(await readFile(join(liveStaging, 'marker.txt'), 'utf8'), 'live')
    assert.equal(existsSync(deadStaging), false)
    assert.equal(existsSync(deadBak), true)
    assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'stay')
  } finally {
    await awaitChildExit(child)
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed staging rename restores the vendor and returns', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fde-vendor-'))
  const vendor = join(root, 'vendor', 'iui')
  const source = join(root, 'source')
  await writeTree(vendor, { version: 'old', commit: 'old', marker: 'old-marker' })
  await writeTree(source, { ...PIN, marker: 'new-marker' })
  try {
    const result = await reconcilePinnedVendor({
      vendorDir: vendor,
      pin: PIN,
      candidates: [source],
      pid: 16,
      async renameImpl(from, to) {
        if (String(from).includes('.staging-') && to === vendor) {
          throw Object.assign(new Error('EROFS'), { code: 'EROFS' })
        }
        return rename(from, to)
      },
    })
    assert.equal(result.ok, false)
    assert.equal(result.action, 'rename-failed')
    assert.match(result.error, /EROFS/)
    assert.equal(await readFile(join(vendor, 'marker.txt'), 'utf8'), 'old-marker')
    assert.equal(existsSync(`${vendor}.staging-16`), false)
    assert.equal(existsSync(`${vendor}.bak-16`), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
