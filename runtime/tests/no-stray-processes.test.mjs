import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertNoStrays,
  formatStray,
  listStrays,
  registerStrayRoot,
  stopStrays,
} from './support/no-stray-processes.mjs'

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

function leaveSetsidOrphan() {
  const script = [
    "const { spawn } = require('child_process')",
    "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' })",
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

function hardExitRedislite(home) {
  const script = [
    'import os, sys',
    'from pathlib import Path',
    'import redislite',
    'home = sys.argv[1]',
    'db = str(Path(home) / "semantic-os" / "falkordb" / "graph.db")',
    'Path(db).parent.mkdir(parents=True, exist_ok=True)',
    'redislite.Redis(db, serverconfig={"port": "0"})',
    'os._exit(0)',
  ].join('\n')
  const ran = spawnSync('python3', ['-c', script, home], { encoding: 'utf8' })
  assert.equal(ran.status, 0, ran.stderr || ran.stdout)
  assert.equal(readFileSync(settingsPath(home), 'utf8').includes('pidfile'), true)
}

test('a live setsid orphan fails the census and a dead one passes', () => {
  const home = mkdtempSync(join(tmpdir(), 'fde-stray-setsid-'))
  registerStrayRoot(home)
  const pid = leaveSetsidOrphan()
  writePidRecord(home, pid)
  try {
    const found = listStrays().filter((row) => row.pid === pid)
    assert.equal(found.length, 1, 'census missed the setsid orphan')
    assert.equal(found[0].ppid, 1, formatStray(found[0]))
    assert.throws(() => assertNoStrays(), (error) => {
      assert.match(String(error.message), new RegExp(`pid=${pid} ppid=1`))
      return true
    })
    process.kill(pid, 'SIGKILL')
    assert.equal(listStrays().some((row) => row.pid === pid), false)
    assertNoStrays()
  } finally {
    try {
      process.kill(pid, 'SIGKILL')
    } catch (error) {
      if (error && error.code !== 'ESRCH') throw error
    }
    rmSync(home, { recursive: true, force: true })
  }
})

test('hard-exited redislite leaves no redis-server', () => {
  const home = mkdtempSync(join(tmpdir(), 'fde-stray-redis-'))
  registerStrayRoot(home)
  try {
    hardExitRedislite(home)
    const before = listStrays().filter((row) => row.args.includes('redis-server'))
    assert.equal(before.length, 1, 'redislite did not leave a redis-server')
    assert.equal(before[0].ppid, 1, formatStray(before[0]))
    stopStrays([home])
    assertNoStrays()
  } finally {
    stopStrays([home])
    rmSync(home, { recursive: true, force: true })
  }
})
