import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { isRuntimeServerCommand } from '../reclaim-runtime.mjs'

const repoRoot = join(new URL('../..', import.meta.url).pathname)

test('the host boot command is recognized as the runtime server', () => {
  assert.equal(isRuntimeServerCommand('node runtime/boot.mjs'), true)
  assert.equal(isRuntimeServerCommand('node runtime/server.mjs'), true)
  assert.equal(isRuntimeServerCommand('node scripts/dev.mjs'), false)
})

test('boot listens when the host generation starts out missing', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-boot-'))
  const port = 4700 + (process.pid % 300)
  const child = spawn(process.execPath, ['runtime/boot.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: String(port),
      FDE_DATABASE_PATH: join(home, 'app.sqlite'),
      FDE_DSH_HOME: home,
      FDE_AI_WORKSPACE: home,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    const heard = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 90_000)
      const check = () => {
        if (!output.includes('FDE_LISTENING')) return
        clearTimeout(timer)
        resolve(true)
      }
      child.stdout.on('data', check)
      child.stderr.on('data', check)
      child.on('exit', () => {
        clearTimeout(timer)
        resolve(output.includes('FDE_LISTENING'))
      })
    })
    assert.equal(heard, true, output)
  } finally {
    child.kill('SIGKILL')
    await rm(home, { recursive: true, force: true })
  }
})
