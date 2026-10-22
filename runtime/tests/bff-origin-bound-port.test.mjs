import { awaitChildExit } from './support/no-stray-processes.mjs'
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('status bffOrigin uses the port from server.address() when FDE_RUNTIME_PORT is 0', async (t) => {
  const root = `/tmp/fde-d2-origin-${process.pid}-${Date.now()}`
  const dbPath = join(root, 'fde.sqlite')
  const dshHome = join(root, 'dsh-home')
  const workspaceCwd = join(root, 'workspace')
  await rm(root, { recursive: true, force: true })
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(dshHome, { recursive: true })
  const child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_AI_WORKSPACE: workspaceCwd,
      FDE_RUNTIME_SUPERVISED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  t.after(async () => {
    await awaitChildExit(child, 'SIGKILL')
    await rm(root, { recursive: true, force: true })
  })
  let boundPort = 0
  for (let i = 0; i < 100; i += 1) {
    const match = /^FDE_LISTENING\s+(\d+)/m.exec(output)
    if (match) {
      boundPort = Number(match[1])
      const health = await fetch(`http://127.0.0.1:${boundPort}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(100)
  }
  assert.ok(boundPort > 0, output)
  const res = await fetch(`http://127.0.0.1:${boundPort}/api/v1/ai/status`)
  const body = await res.json()
  const origin = body?.data?.bffOrigin
  const originPort = Number(new URL(String(origin)).port)
  assert.equal(res.status, 200, JSON.stringify(body))
  assert.equal(originPort, boundPort, `bffOrigin=${origin} FDE_LISTENING=${boundPort}`)
  assert.notEqual(originPort, 0, `bffOrigin=${origin}`)
})
