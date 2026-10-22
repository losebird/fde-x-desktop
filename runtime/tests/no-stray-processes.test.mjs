import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import {
  assertNoStrays,
  formatStray,
  listStrays,
  recordedIdentity,
  registerStrayRoot,
  stopStrays,
} from './support/no-stray-processes.mjs'

const supportUrl = pathToFileURL(join(import.meta.dirname, 'support', 'no-stray-processes.mjs')).href

function settingsPath(home) {
  return join(home, 'semantic-os', 'falkordb', 'graph.db.settings')
}

function writePidRecord(home, pid) {
  const dir = join(home, 'semantic-os', 'falkordb')
  mkdirSync(dir, { recursive: true })
  const pidfile = join(dir, 'redis.pid')
  writeFileSync(pidfile, `${pid}\n`)
  writeFileSync(settingsPath(home), JSON.stringify({
    pidfile,
    unixsocket: join(dir, 'redis.socket'),
    dbdir: dir,
    dbfilename: 'graph.db',
  }))
}

function leaveSetsidOrphan(marker) {
  const script = [
    "const { spawn } = require('child_process')",
    `const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', ${JSON.stringify(marker)}], { detached: true, stdio: 'ignore' })`,
    'if (!child.pid) process.exit(1)',
    'process.stdout.write(String(child.pid))',
    'child.unref()',
  ].join('\n')
  const ran = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' })
  assert.equal(ran.status, 0, ran.stderr || ran.stdout)
  const pid = Number(ran.stdout.trim())
  assert.equal(Number.isInteger(pid) && pid > 1, true, ran.stdout)
  return pid
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error && error.code === 'ESRCH') return false
    throw error
  }
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGKILL')
  } catch (error) {
    if (error && error.code !== 'ESRCH') throw error
  }
}

test('a live setsid orphan fails the census and a dead one passes', () => {
  const home = mkdtempSync(join(tmpdir(), 'fde-stray-setsid-'))
  registerStrayRoot(home)
  const pid = leaveSetsidOrphan('fde-stray-live')
  writePidRecord(home, pid)
  try {
    const found = listStrays().filter((row) => row.pid === pid)
    assert.equal(found.length, 1, 'census missed the setsid orphan')
    assert.notEqual(found[0].ppid, process.pid, formatStray(found[0]))
    assert.throws(() => assertNoStrays(), (error) => {
      assert.match(String(error.message), new RegExp(`pid=${pid} ppid=${found[0].ppid}`))
      return true
    })
    killPid(pid)
    assert.equal(listStrays().some((row) => row.pid === pid), false)
    assertNoStrays()
  } finally {
    killPid(pid)
    rmSync(home, { recursive: true, force: true })
  }
})

test('stopStrays kills a pidfile orphan only when args and lstart still match', () => {
  const home = mkdtempSync(join(tmpdir(), 'fde-stray-identity-'))
  registerStrayRoot(home)
  const pid = leaveSetsidOrphan('fde-stray-identity')
  writePidRecord(home, pid)
  try {
    const found = listStrays().filter((row) => row.pid === pid)
    assert.equal(found.length, 1, 'census missed the orphan')
    const recorded = recordedIdentity.get(pid)
    assert.equal(typeof recorded?.args, 'string')
    assert.match(recorded.args, /fde-stray-identity/)
    assert.match(recorded.lstart, /^[A-Za-z]{3} [A-Za-z]{3} /)
    recordedIdentity.set(pid, { args: `${recorded.args} reused`, lstart: recorded.lstart })
    stopStrays([home])
    assert.equal(alive(pid), true, 'stopStrays killed a pid whose command line no longer matched')
    recordedIdentity.set(pid, recorded)
    stopStrays([home])
    assert.equal(alive(pid), false)
    assertNoStrays()
  } finally {
    killPid(pid)
    rmSync(home, { recursive: true, force: true })
  }
})

test('a census error survives a later successful read', () => {
  const home = mkdtempSync(join(tmpdir(), 'fde-stray-sticky-'))
  const file = join(home, 'sticky.test.mjs')
  writeFileSync(file, `
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { listStrays, registerStrayRoot } from ${JSON.stringify(supportUrl)}
const home = mkdtempSync(join(tmpdir(), 'fde-stray-bad-'))
const dir = join(home, 'semantic-os', 'falkordb')
mkdirSync(dir, { recursive: true })
const settings = join(dir, 'graph.db.settings')
writeFileSync(settings, '{}')
registerStrayRoot(home)
test('body recovers', () => {
  try { listStrays() } catch (error) {
    if (!String(error.message).includes('no pidfile')) throw error
  }
  rmSync(settings)
  listStrays()
})
`)
  try {
    const env = { ...process.env }
    delete env.NODE_TEST_CONTEXT
    const ran = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8', env })
    assert.notEqual(ran.status, 0, ran.stdout || ran.stderr)
    assert.match(`${ran.stdout}\n${ran.stderr}`, /no pidfile/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
