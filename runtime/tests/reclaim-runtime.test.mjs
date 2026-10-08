import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  collectStrayPids,
  isPidAlive,
  isRuntimeServerCommand,
  reclaimStrayRuntime,
} from '../reclaim-runtime.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function request(port, path) {
  return fetch(`http://127.0.0.1:${port}${path}`)
}

describe('reclaim-runtime', () => {
  test('isRuntimeServerCommand recognizes runtime/server.mjs only', () => {
    assert.equal(isRuntimeServerCommand('node runtime/server.mjs'), true)
    assert.equal(
      isRuntimeServerCommand('/opt/homebrew/bin/node runtime/server.mjs --profile x'),
      true,
    )
    assert.equal(isRuntimeServerCommand('node runtime/tests/foo.mjs'), false)
    assert.equal(isRuntimeServerCommand('node scripts/dev.mjs'), false)
    assert.equal(isRuntimeServerCommand(''), false)
  })

  test('isPidAlive reflects current process and absent pids', () => {
    assert.equal(isPidAlive(process.pid), true)
    assert.equal(isPidAlive(2_147_483_647), false)
  })

  test('reclaimStrayRuntime terminates recorded stray pids', async () => {
    const dummy = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      detached: false,
    })
    assert.ok(dummy.pid)
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(isPidAlive(dummy.pid), true)

    try {
      const killed = await reclaimStrayRuntime({
        keep: [process.pid],
        recordedPids: [dummy.pid],
        profileName: '',
        lanPort: 0,
        runtimePort: 0,
      })
      assert.ok(killed.includes(dummy.pid))
      assert.equal(isPidAlive(dummy.pid), false)
    } finally {
      if (isPidAlive(dummy.pid)) {
        try {
          dummy.kill('SIGKILL')
        } catch {
          // gone
        }
      }
    }
  })

  test('collectStrayPids finds ephemeral BFF; reclaimStrayRuntime kills it', async () => {
    const port = 4397 + Math.floor(Math.random() * 50)
    const home = `/tmp/fde-reclaim-bff-${Date.now()}`
    const dbPath = join(home, 'data.sqlite')
    await mkdir(home, { recursive: true })

    const child = spawn(process.execPath, ['runtime/server.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        FDE_RUNTIME_PORT: String(port),
        FDE_DSH_HOME: home,
        FDE_DATABASE_PATH: dbPath,
        FDE_RUNTIME_SUPERVISED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const reclaimOpts = {
      keep: [process.pid],
      runtimePort: port,
      lanPort: 0,
      profileName: '',
    }

    try {
      let ready = false
      for (let i = 0; i < 40; i++) {
        try {
          const res = await request(port, '/health')
          if (res.ok) {
            ready = true
            break
          }
        } catch {
          // retry
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      assert.ok(ready, 'BFF did not become ready within ~4s')
      assert.ok(child.pid)
      assert.equal(isPidAlive(child.pid), true)

      const stray = await collectStrayPids(reclaimOpts)
      assert.ok(stray.includes(child.pid), `expected BFF pid ${child.pid} in ${stray.join(',')}`)

      const killed = await reclaimStrayRuntime(reclaimOpts)
      assert.ok(killed.includes(child.pid))
      let gone = !isPidAlive(child.pid)
      for (let i = 0; !gone && i < 20; i++) {
        await new Promise((r) => setTimeout(r, 50))
        gone = !isPidAlive(child.pid)
      }
      assert.equal(gone, true)
    } finally {
      if (child.pid && isPidAlive(child.pid)) {
        try {
          child.kill('SIGKILL')
        } catch {
          // gone
        }
      }
    }
  })

  test('collectStrayPids does not take another stack on the same lan port', async () => {
    const port = 45000 + Math.floor(Math.random() * 1000)
    const other = spawn(process.execPath, ['-e', `require('net').createServer().listen(${port}, '127.0.0.1', () => {}); setInterval(() => {}, 1000)`], {
      env: { ...process.env, DSH_HOME: '/tmp/fde-other-home', FDE_DSH_HOME: '/tmp/fde-other-home' },
      stdio: 'ignore',
    })
    assert.ok(other.pid)
    await new Promise((r) => setTimeout(r, 120))
    try {
      const stray = await collectStrayPids({
        keep: [process.pid],
        profileName: 'fde-x',
        lanPort: port,
        runtimePort: 64999,
        dshHome: '/tmp/fde-mine-home',
        recordedPids: [],
      })
      assert.equal(stray.includes(other.pid), false)
    } finally {
      if (isPidAlive(other.pid)) {
        try { other.kill('SIGKILL') } catch { /* gone */ }
      }
    }
  })
})
