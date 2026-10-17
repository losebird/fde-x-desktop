import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { waitForLine } from './lib/drive.mjs'

test('a timed-out waitForLine lets the process exit', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const probe = fileURLToPath(new URL('./lib/wait-for-line-exit-probe.mjs', import.meta.url))
  const child = spawn(process.execPath, [probe], { cwd: root })
  let out = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { out += chunk })
  child.stderr.on('data', (chunk) => { out += chunk })
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('alive'), 1500)
    child.once('exit', (exitCode) => {
      clearTimeout(timer)
      resolve(exitCode)
    })
  })
  if (code === 'alive') {
    child.kill('SIGKILL')
    assert.fail(`process still alive after waitForLine timed out\n${out}`)
  }
  assert.equal(code, 0, out)
})

test('waitForLine resolves when the line is already buffered', async () => {
  const logs = {
    text: () => ({ stdout: 'settings: imported into profile fde-x\n', stderr: '' }),
    raw: () => ({ stdout: 'settings: imported into profile fde-x\n', stderr: '' }),
  }
  const match = await waitForLine(logs, /settings: imported/, 1000)
  assert.match(match[0], /settings: imported/)
})
