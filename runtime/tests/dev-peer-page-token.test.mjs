import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const node = process.execPath
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const stamp = `${process.pid}-${Date.now()}`
const root = `/tmp/fde-dev-peer-token-${stamp}`
const home = join(root, 'home')
const dshHome = join(root, 'dsh-home')
const peerHome = join(root, 'peer-home')
const dbPath = join(root, 'peer.sqlite')

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

function launch(args, options) {
  return spawn(node, args, { detached: true, ...options })
}

function watchOutput(child) {
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  let code = null
  child.on('exit', (exitCode) => { code = exitCode })
  return {
    output: () => output,
    code: () => code,
  }
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal)
  } catch (error) {
    if (!error || error.code !== 'ESRCH') throw error
  }
}

async function pidsInGroup(pgid) {
  const pids = []
  const names = await readdir('/proc')
  for (const name of names) {
    if (!/^\d+$/u.test(name)) continue
    let stat
    try {
      stat = await readFile(`/proc/${name}/stat`, 'utf8')
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'EACCES')) continue
      throw error
    }
    const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    if (Number(rest[2]) === pgid) pids.push(Number(name))
  }
  return pids
}

async function stop(child) {
  if (!child?.pid) return
  const group = await pidsInGroup(child.pid)
  for (const pid of [child.pid, ...group]) signalPid(pid, 'SIGKILL')
  for (let i = 0; i < 20; i += 1) {
    if (child.exitCode != null || child.signalCode != null) return
    await delay(50)
  }
  try {
    await readFile(`/proc/${child.pid}/stat`)
  } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw error
  }
  throw new Error(`process ${child.pid} did not exit`)
}

describe('dev peer page token', { concurrency: 1 }, () => {
  test('dev:peer gives the page a token and an AI write is not 401', async (t) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(home, { recursive: true })
    await mkdir(dshHome, { recursive: true })
    await mkdir(peerHome, { recursive: true })
    const appRoot = join(root, 'app')
    await mkdir(join(appRoot, 'node_modules/vite/bin'), { recursive: true })
    await symlink(join(repoRoot, 'runtime'), join(appRoot, 'runtime'))
    await writeFile(join(appRoot, 'node_modules/vite/bin/vite.js'), `
      process.on('message', (msg) => {
        if (msg && msg.type === 'fde-ui-token' && typeof msg.token === 'string') {
          process.stdout.write('STUB_UI_TOKEN ' + msg.token + '\\n')
        }
      })
      if (typeof process.send === 'function') process.send({ type: 'fde-vite-listening' })
      setInterval(() => {}, 1 << 30)
    `)
    const runtimePort = await freePort()
    const webPort = await freePort()
    const pageOrigin = `http://127.0.0.1:${webPort}`
    const dev = launch([join(repoRoot, 'scripts/dev-peer.mjs')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: home,
        FDE_APP_ROOT: appRoot,
        FDE_DSH_HOME: dshHome,
        FDE_PEER_DSH_HOME: peerHome,
        FDE_DATABASE_PATH: dbPath,
        FDE_PEER_RUNTIME_PORT: String(runtimePort),
        FDE_PEER_WEB_PORT: String(webPort),
        FDE_PEER_LAN_PORT: String(await freePort()),
        FDE_ALLOWED_ORIGINS: pageOrigin,
        FDE_LISTEN_HOST: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const watched = watchOutput(dev)
    t.after(async () => {
      await stop(dev)
      await rm(root, { recursive: true, force: true })
      await rm(join(repoRoot, 'runtime/data/fde-workstation-peer.sqlite'), { force: true })
      await rm(join(repoRoot, 'runtime/data/fde-workstation-peer.sqlite-wal'), { force: true })
      await rm(join(repoRoot, 'runtime/data/fde-workstation-peer.sqlite-shm'), { force: true })
    })

    let pageToken = ''
    let runtimeUp = false
    for (let i = 0; i < 100; i += 1) {
      const match = /^STUB_UI_TOKEN\s+([0-9a-f]{64})$/m.exec(watched.output())
      if (match) pageToken = match[1]
      if (!runtimeUp) {
        const health = await fetch(`http://127.0.0.1:${runtimePort}/health`).catch(() => null)
        runtimeUp = Boolean(health?.ok)
      }
      if (pageToken && runtimeUp) break
      if (watched.code() !== null && runtimeUp) break
      await delay(100)
    }

    const session = await fetch(`http://127.0.0.1:${runtimePort}/api/v1/ai/sessions`, {
      method: 'POST',
      headers: {
        Origin: pageOrigin,
        'Content-Type': 'application/json',
        ...(pageToken ? { 'x-fde-ui-token': pageToken } : {}),
      },
      body: JSON.stringify({ workspaceId: 'ws_personal' }),
    })
    const pageHasToken = /^[0-9a-f]{64}$/u.test(pageToken)
    assert.equal(
      pageHasToken && session.status !== 401,
      true,
      `pageHasToken=${pageHasToken} aiStatus=${session.status} runtimeUp=${runtimeUp}`,
    )
  })
})
