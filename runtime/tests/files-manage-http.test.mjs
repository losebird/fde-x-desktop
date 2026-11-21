import './support/no-stray-processes.mjs'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const stamp = `${process.pid}-${Date.now()}`
const workspaceCwd = `/tmp/fde-files-manage-${stamp}`
const dshHome = `/tmp/fde-files-manage-dsh-${stamp}`
const dbPath = `/tmp/fde-files-manage-${stamp}.sqlite`
const origin = 'http://127.0.0.1:5174'

let child
let base = ''
let uiToken = ''

async function startServer() {
  await mkdir(workspaceCwd, { recursive: true })
  await mkdir(join(dshHome, 'run'), { recursive: true })
  child = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FDE_RUNTIME_PORT: '0',
      FDE_LISTEN_HOST: '127.0.0.1',
      FDE_DATABASE_PATH: dbPath,
      FDE_DSH_HOME: dshHome,
      FDE_AI_WORKSPACE: workspaceCwd,
      FDE_RUNTIME_SUPERVISED: '1',
      FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
      FDE_ALLOWED_ORIGINS: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const port = (stdout.match(/^FDE_LISTENING\s+(\d+)/m) || [])[1]
    uiToken = (stdout.match(/^FDE_UI_TOKEN\s+(\S+)/m) || [])[1] || ''
    if (port && uiToken) {
      base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/health`).catch(() => null)
      if (health?.ok) return
    }
    if (child.exitCode != null) break
    await delay(50)
  }
  child.kill('SIGTERM')
  throw new Error(`runtime did not start: ${stderr.slice(0, 800)}\n${stdout.slice(0, 800)}`)
}

async function send(path, { method = 'POST', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: origin,
      'x-fde-ui-token': uiToken,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text.slice(0, 200) } }
  return { status: response.status, payload }
}

before(async () => {
  await startServer()
})

after(async () => {
  if (child?.pid) {
    try { execFileSync('pkill', ['-KILL', '-P', String(child.pid)], { stdio: 'ignore' }) } catch { /* already gone */ }
    try { child.kill('SIGKILL') } catch { /* already gone */ }
  }
  await delay(150)
  await rm(workspaceCwd, { recursive: true, force: true })
  await rm(dshHome, { recursive: true, force: true })
  await rm(dbPath, { force: true })
})

test('mkdir, nested move, copy, rename, and folder delete stay inside the workspace', async () => {
  const docs = await send('/api/v1/files/mkdir', { body: { name: 'docs' } })
  assert.equal(docs.status, 201, JSON.stringify(docs.payload))
  await writeFile(join(workspaceCwd, 'docs', 'a.md'), 'hello', 'utf8')
  const moved = await send('/api/v1/files/move', { body: { from: 'docs/a.md', to: 'a.md' } })
  assert.equal(moved.status, 200, JSON.stringify(moved.payload))
  assert.equal(existsSync(join(workspaceCwd, 'a.md')), true)
  assert.equal(existsSync(join(workspaceCwd, 'docs', 'a.md')), false)
  const copied = await send('/api/v1/files/copy', { body: { from: 'a.md', to: 'a 副本.md' } })
  assert.equal(copied.status, 201, JSON.stringify(copied.payload))
  assert.equal(await readFile(join(workspaceCwd, 'a 副本.md'), 'utf8'), 'hello')
  const renamed = await send('/api/v1/files/move', { body: { from: 'docs', to: 'keep' } })
  assert.equal(renamed.status, 200, JSON.stringify(renamed.payload))
  assert.equal(existsSync(join(workspaceCwd, 'keep')), true)
  const nested = await send('/api/v1/files/mkdir', { body: { name: 'keep/in' } })
  assert.equal(nested.status, 201, JSON.stringify(nested.payload))
  const intoSelf = await send('/api/v1/files/move', { body: { from: 'keep', to: 'keep/in/keep' } })
  assert.equal(intoSelf.status, 400)
  const escape = await send('/api/v1/files/move', { body: { from: 'a.md', to: '../out.md' } })
  assert.equal(escape.status, 400)
  const removed = await send('/api/v1/files?path=keep', { method: 'DELETE' })
  assert.equal(removed.status, 200, JSON.stringify(removed.payload))
  assert.equal(existsSync(join(workspaceCwd, 'keep')), false)
})
