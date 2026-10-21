import { awaitChildExit } from './support/no-stray-processes.mjs'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const origin = 'http://127.0.0.1:5174'
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-tool-token-${stamp}`
const dbPath = join(root, 'fde.sqlite')
const dshHome = join(root, 'dsh-home')
const workspaceCwd = join(root, 'workspace')

test('保存工具清单时没有页面令牌返回 401，并且不写库', async () => {
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
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  let base = ''
  try {
    for (let i = 0; i < 100; i += 1) {
      const match = /^FDE_LISTENING\s+(\d+)/m.exec(stdout)
      if (match) {
        base = `http://127.0.0.1:${match[1]}`
        const res = await fetch(`${base}/health`).catch(() => null)
        if (res?.ok) break
      }
      if (child.exitCode != null) throw new Error(stdout)
      await delay(100)
    }
    assert.ok(base)
    const response = await fetch(`${base}/api/v1/plan/workflows`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: 'ws_personal',
        name: '无令牌',
        steps: [{ id: 's1', kind: 'ai', label: 'AI', config: { prompt: '跑', tools: ['bash'] } }],
      }),
    })
    const payload = await response.json()
    assert.equal(response.status, 401, JSON.stringify(payload))
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workflows').get().n, 0)
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM audit_entries WHERE action = 'plan.workflow.tools'`).get().n, 0)
    } finally {
      db.close()
    }
  } finally {
    await awaitChildExit(child)
    await rm(root, { recursive: true, force: true })
  }
})
