import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  armParentDeathReaper,
  killProcessGroup,
  pidAlive,
  stopParentDeathReaper,
  waitPidExit,
} from '../process-group.mjs'

function spawnSleeperGroup() {
  return spawn(process.execPath, ['-e', `
    const { spawn } = require('node:child_process')
    const kid = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: false })
    if (kid.pid) process.stdout.write(String(kid.pid))
    setInterval(() => {}, 1000)
  `], {
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: true,
  })
}

function readChildPid(proc) {
  return new Promise((resolve) => {
    let buf = ''
    const timer = setTimeout(() => resolve(0), 3000)
    proc.stdout.on('data', (chunk) => {
      buf += String(chunk)
      const n = Number(buf.trim())
      if (Number.isInteger(n) && n > 1) {
        clearTimeout(timer)
        resolve(n)
      }
    })
  })
}

test('killProcessGroup SIGKILL takes the leader and a same-group child', async () => {
  const leader = spawnSleeperGroup()
  assert.ok(leader.pid)
  const kid = await readChildPid(leader)
  assert.ok(kid > 1, 'forked child pid')
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.equal(pidAlive(leader.pid), true)
  assert.equal(pidAlive(kid), true)
  killProcessGroup(leader.pid, 'SIGKILL')
  assert.equal(await waitPidExit(leader.pid, 2000), true)
  assert.equal(await waitPidExit(kid, 2000), true)
})

test('parent-death reaper SIGKILLs the process group when stdin closes', async () => {
  const leader = spawnSleeperGroup()
  assert.ok(leader.pid)
  const kid = await readChildPid(leader)
  const reaper = armParentDeathReaper(leader.pid)
  assert.ok(reaper)
  try { reaper.stdin.end() } catch { /* ignore */ }
  assert.equal(await waitPidExit(leader.pid, 3000), true)
  assert.equal(await waitPidExit(kid, 3000), true)
  stopParentDeathReaper(reaper)
})

test('sidecar spawn uses a detached python group and SIGKILLs it', () => {
  const src = readFileSync(new URL('../plugins/dsh-semantic-os/sidecar.js', import.meta.url), 'utf8')
  assert.match(src, /detached: unix/)
  assert.match(src, /armParentDeathReaper/)
  assert.match(src, /killProcessGroup\([^)]+'SIGKILL'\)/)
  assert.match(src, /reason: 'start_timeout'/)
  assert.equal(src.includes("proc.kill('SIGTERM')"), false)
})

test('desktop main takes a single instance lock', () => {
  const src = readFileSync(fileURLToPath(new URL('../../apps/desktop/src/main.ts', import.meta.url)), 'utf8')
  assert.match(src, /requestSingleInstanceLock/)
  assert.match(src, /second-instance/)
  assert.match(src, /process\.kill\(pid, 'SIGKILL'\)/)
})

test('BFF stdout stays drained after FDE_LISTENING so the core cannot block and die', () => {
  const src = readFileSync(fileURLToPath(new URL('../../apps/desktop/src/bff.ts', import.meta.url)), 'utf8')
  assert.match(src, /rl\.close\(\)/)
  assert.match(src, /child\.stdout\?\.resume\(\)/)
})

test('host stdin errors do not throw the BFF process', () => {
  const src = readFileSync(new URL('../dsh-core.mjs', import.meta.url), 'utf8')
  assert.match(src, /child\.stdin\?\.on\('error', \(\) => \{\}\)/)
  assert.match(src, /isPidAlive\(this\.child\.pid\)/)
})

test('parent-death reaper keeps ELECTRON_RUN_AS_NODE so Electron is not a second GUI', () => {
  const src = readFileSync(new URL('../process-group.mjs', import.meta.url), 'utf8')
  assert.match(src, /ELECTRON_RUN_AS_NODE: '1'/)
  assert.match(src, /\.\.\.process\.env/)
})
