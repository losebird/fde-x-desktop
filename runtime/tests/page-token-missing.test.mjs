import { awaitChildExit } from './support/no-stray-processes.mjs'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5173'

test('a write without the page token is rejected', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'fde-page-token-missing-'))
  const child = spawn(node, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_SUPERVISED: '1',
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: join(home, 'core.sqlite'),
      FDE_DSH_HOME: join(home, 'dsh'),
      FDE_AI_WORKSPACE: home,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  t.after(async () => {
    await awaitChildExit(child)
    await rm(home, { recursive: true, force: true })
  })

  let base = ''
  let pageToken = ''
  for (let i = 0; i < 80; i += 1) {
    const tokenMatch = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(stdout)
    if (tokenMatch) pageToken = tokenMatch[1]
    const listen = /^FDE_LISTENING\s+(\d+)/m.exec(stdout)
    if (listen && pageToken) {
      base = `http://127.0.0.1:${listen[1]}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) break
    }
    if (child.exitCode != null) break
    await delay(50)
  }
  assert.equal(child.exitCode, null, `core exited\n${stderr.slice(-800)}\n${stdout.slice(-800)}`)
  assert.match(pageToken, /^[0-9a-f]{64}$/u)

  const response = await fetch(`${base}/api/v1/ai/workspaces`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: home, title: 'probe' }),
  })
  const payload = await response.json()
  assert.equal(response.status, 401)
  assert.equal(payload.error.code, 'ui_token_invalid')
})
