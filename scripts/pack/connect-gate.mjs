#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { readUiTokenLine } from '../page-token-handoff.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const resources = process.env.FDE_PACK_OUT
  ? resolve(process.env.FDE_PACK_OUT)
  : join(repoRoot, 'resources')

function bundledNode() {
  const candidates = [
    join(resources, 'node', 'bin', 'node'),
    join(resources, 'node', 'bin', 'node.exe'),
    join(resources, 'node', 'node.exe'),
  ]
  return candidates.find((path) => existsSync(path)) || ''
}

function fail(result, code = 1) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(code)
}

export function tokenFromSupervisedLog(log) {
  let token = ''
  for (const line of String(log || '').split(/\r?\n/u)) {
    const next = readUiTokenLine(line)
    if (next) token = next
  }
  return token
}

export function connectHeaders(origin, token) {
  if (!token) {
    const error = new Error('ui_token_not_printed')
    error.reason = 'ui_token_not_printed'
    throw error
  }
  return {
    origin,
    'content-type': 'application/json',
    'x-fde-ui-token': token,
  }
}

export function planConnect(log, origin) {
  const token = tokenFromSupervisedLog(log)
  if (!token) return { reason: 'ui_token_not_printed', token: '', post: null }
  return {
    reason: '',
    token,
    post: {
      url: `${origin}/api/v1/ai/connect`,
      method: 'POST',
      headers: connectHeaders(origin, token),
      body: '{}',
    },
  }
}

export async function postConnect(fetchImpl, { origin, token, signal }) {
  const headers = connectHeaders(origin, token)
  return fetchImpl(`${origin}/api/v1/ai/connect`, {
    method: 'POST',
    headers,
    body: '{}',
    signal,
  })
}

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

async function main() {
  const hostNode = bundledNode()
  const dshBin = join(resources, 'dsh', 'bin', process.platform === 'win32' ? 'dsh.cmd' : 'dsh')
  const server = join(resources, 'app', 'runtime', 'server.mjs')
  const generation = join(resources, 'app', 'runtime', '.host-generation')
  const launcher = process.env.FDE_GATE_NODE || hostNode
  const useElectron = process.env.FDE_GATE_ELECTRON === '1'

  if (!hostNode || !existsSync(dshBin) || !existsSync(server) || !launcher || !existsSync(launcher)) {
    fail({
      ok: false,
      reason: 'staged tree is incomplete',
      resources,
      hostNode,
      dshBin,
      server,
      launcher,
    })
  }
  if (existsSync(generation)) {
    fail({
      ok: false,
      reason: 'staged runtime contains .host-generation, so resolveDshBin ignores FDE_DSH_BIN',
      generation,
    })
  }

  const home = await mkdtemp(join(tmpdir(), 'fde-connect-gate-'))
  const dshHome = join(home, 'dsh-home')
  const workspace = join(home, 'ws')
  await mkdir(dshHome, { recursive: true })
  await mkdir(workspace, { recursive: true })
  await writeFile(join(dshHome, '.credentials.yaml'), '{}\n', { mode: 0o600 })

  const childEnv = {
    ...process.env,
    HOME: home,
    FDE_RESOURCES: resources,
    FDE_APP_ROOT: join(resources, 'app'),
    FDE_DSH_BIN: dshBin,
    FDE_HOST_NODE: hostNode,
    FDE_DSH_HOME: dshHome,
    FDE_DATABASE_PATH: join(home, 'fde.sqlite'),
    FDE_RUNTIME_PORT: '0',
    FDE_RUNTIME_HOST: '127.0.0.1',
    FDE_LISTEN_HOST: '127.0.0.1',
    FDE_AI_WORKSPACE: workspace,
    FDE_DSH_PROFILE: 'fde-connect-gate',
    FDE_ALLOWED_ORIGINS: 'http://127.0.0.1',
    FDE_RUNTIME_SUPERVISED: '1',
  }
  if (useElectron) childEnv.ELECTRON_RUN_AS_NODE = '1'
  else delete childEnv.ELECTRON_RUN_AS_NODE

  const child = spawn(launcher, [server], {
    detached: true,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  function stop() {
    try { process.kill(-child.pid, 'SIGTERM') } catch {}
  }

  let log = ''
  child.stdout.on('data', (chunk) => { log += chunk })
  child.stderr.on('data', (chunk) => { log += chunk })

  let port = 0
  const started = Date.now()
  while (Date.now() - started < 20000) {
    const match = log.match(/FDE_LISTENING (\d+)/)
    if (match) {
      port = Number(match[1])
      break
    }
    if (child.exitCode != null) break
    await delay(50)
  }

  const result = {
    ok: false,
    resources,
    launcher,
    dshBin,
    electron: useElectron,
    port,
    listenMs: Date.now() - started,
    supervised: childEnv.FDE_RUNTIME_SUPERVISED,
  }

  if (!port) {
    result.reason = 'server did not listen'
    result.log = log.slice(-4000)
    stop()
    await rm(home, { recursive: true, force: true })
    fail(result)
  }

  const origin = `http://127.0.0.1:${port}`
  const health = await fetch(`${origin}/health`)
  result.health = health.status
  result.healthBody = (await health.text()).slice(0, 500)
  const planned = planConnect(log, origin)
  if (!planned.post) {
    result.reason = 'ui_token_not_printed'
    result.logTail = log.slice(-4000)
    stop()
    await rm(home, { recursive: true, force: true })
    fail(result)
  }
  try {
    const connect = await postConnect(fetch, {
      origin,
      token: planned.token,
      signal: AbortSignal.timeout(60000),
    })
    result.connect = connect.status
    result.connectBody = await connect.text()
  } catch (error) {
    result.connect = 0
    result.connectBody = error instanceof Error ? error.name : String(error)
  }
  result.logTail = log.slice(-4000)
  result.hasRequireAsync = `${result.connectBody}\n${log}`.includes('ERR_REQUIRE_ASYNC_MODULE')
  result.connected = /"connected"\s*:\s*true/.test(result.connectBody || '')
  result.ok = result.health === 200 && result.connected && !result.hasRequireAsync
  stop()
  await delay(200)
  await rm(home, { recursive: true, force: true })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

if (invokedDirectly()) await main()
