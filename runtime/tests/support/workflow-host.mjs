import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as zlib from 'node:zlib'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createCoreConnector, parseHostRpcValue } from '../../dsh-core.mjs'
import { PRODUCT_BUNDLE_IDS } from '../../product-bundles.mjs'

const execFileAsync = promisify(execFile)
const PIN = '0.2.0-rc.2'

export function hostPinDir() {
  return join(import.meta.dirname, '..', '..', 'host-pin')
}

export async function ensureHostPin() {
  const pinDir = hostPinDir()
  const bin = join(pinDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const stamp = join(pinDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  if (existsSync(stamp)) {
    const pkg = JSON.parse(readFileSync(stamp, 'utf8'))
    if (pkg.version === PIN && existsSync(bin)) return bin
  }
  const cache = join(tmpdir(), 'fde-x-host-pin-npm-cache')
  await mkdir(cache, { recursive: true })
  await execFileAsync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], {
    cwd: pinDir,
    env: {
      ...process.env,
      npm_config_cache: cache,
      npm_config_prefix: pinDir,
      npm_config_update_notifier: 'false',
    },
    maxBuffer: 128 * 1024 * 1024,
  })
  return bin
}

export async function bootWorkflowHost(options = {}) {
  if (options.withPlugins || process.env.FDE_WORKFLOW_HOST_CHILD === '1') {
    return bootWorkflowHostHere(options)
  }
  return bootWorkflowHostChild(options)
}

async function bootWorkflowHostHere(options = {}) {
  if (typeof zlib.zstdDecompress !== 'function') {
    throw new Error(`真 Host 测试需要 node:zlib 的 zstdDecompress，当前是 ${process.version}`)
  }
  const bin = await ensureHostPin()
  const home = await mkdtemp(join(tmpdir(), 'fde-workflow-host-'))
  const cwd = join(home, 'workspace')
  const probeDir = join(home, 'probe')
  const profileName = 'fde-workflow-host'
  await mkdir(cwd, { recursive: true })
  await mkdir(probeDir, { recursive: true })
  if (options.staleAllow) {
    const allowDir = join(home, 'run', 'workflow-allow')
    await mkdir(allowDir, { recursive: true, mode: 0o755 })
    await chmod(allowDir, 0o755)
    const stale = join(allowDir, 'session-stale-allow.json')
    await writeFile(stale, '{}\n', { mode: 0o644 })
    await chmod(stale, 0o644)
  }
  const credentials = join(home, '.credentials.yaml')
  await writeFile(credentials, '', { mode: 0o600 })
  await chmod(credentials, 0o600)

  const profileModules = join(home, 'profiles', profileName, 'node_modules')
  await mkdir(profileModules, { recursive: true })
  await writeFile(join(home, 'profiles', profileName, 'package.json'), `${JSON.stringify({
    name: `dsh-profile-${profileName}`,
    private: true,
    dsh: {
      profile: {
        bundles: [
          '@deepseek-ai/dsh-base',
          '@deepseek-ai/dsh-web-app',
          ...PRODUCT_BUNDLE_IDS,
        ],
      },
    },
  }, null, 2)}\n`)

  const probeSource = join(import.meta.dirname, '..', 'fixtures', 'workflow-host-probe')
  await rm(join(profileModules, 'fde-workflow-host-probe'), { recursive: true, force: true })
  await mkdir(profileModules, { recursive: true })
  const { symlink } = await import('node:fs/promises')
  await symlink(probeSource, join(profileModules, 'fde-workflow-host-probe'))

  const productPatch = await readFile(join(import.meta.dirname, '..', '..', 'dsh-core.patch.yml'), 'utf8')
  const patchFile = join(home, 'probe.patch.yml')
  await writeFile(patchFile, `${productPatch}\n- insert:\n    - id: fde-workflow-host-probe\n      name: fde-workflow-host-probe\n`)

  const previous = {
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
    DSH_HOME: process.env.DSH_HOME,
    FDE_DSH_BIN: process.env.FDE_DSH_BIN,
    FDE_DSH_SESSION_ROOT: process.env.FDE_DSH_SESSION_ROOT,
    FDE_DSH_STORAGE_ROOT: process.env.FDE_DSH_STORAGE_ROOT,
    FDE_SEMANTIC_RUNTIME_MODE: process.env.FDE_SEMANTIC_RUNTIME_MODE,
    FDE_PROBE_DIR: process.env.FDE_PROBE_DIR,
    FDE_AI_WORKSPACE: process.env.FDE_AI_WORKSPACE,
    FDE_WORKFLOW_PROBE_LEAK: process.env.FDE_WORKFLOW_PROBE_LEAK,
    FDE_WORKFLOW_PROBE_EXTRA: process.env.FDE_WORKFLOW_PROBE_EXTRA,
    FDE_WORKFLOW_PROBE_CALL: process.env.FDE_WORKFLOW_PROBE_CALL,
    FDE_WORKFLOW_PROBE_PRESET_ONLY: process.env.FDE_WORKFLOW_PROBE_PRESET_ONLY,
  }
  process.env.FDE_DSH_HOME = home
  process.env.DSH_HOME = home
  process.env.FDE_DSH_BIN = bin
  process.env.FDE_DSH_SESSION_ROOT = join(home, 'sessions')
  process.env.FDE_DSH_STORAGE_ROOT = join(home, 'storages')
  process.env.FDE_SEMANTIC_RUNTIME_MODE = 'readonly'
  process.env.FDE_PROBE_DIR = probeDir
  process.env.FDE_AI_WORKSPACE = cwd
  if (options.leak) process.env.FDE_WORKFLOW_PROBE_LEAK = '1'
  else delete process.env.FDE_WORKFLOW_PROBE_LEAK
  if (options.extra) process.env.FDE_WORKFLOW_PROBE_EXTRA = '1'
  else delete process.env.FDE_WORKFLOW_PROBE_EXTRA
  if (options.callTool) process.env.FDE_WORKFLOW_PROBE_CALL = options.callTool
  else delete process.env.FDE_WORKFLOW_PROBE_CALL
  if (options.presetOnly) process.env.FDE_WORKFLOW_PROBE_PRESET_ONLY = '1'
  else delete process.env.FDE_WORKFLOW_PROBE_PRESET_ONLY

  const core = createCoreConnector({
    bin,
    dshHome: home,
    cwd,
    patchFile,
    profileName,
    startTimeoutMs: 90_000,
  })
  const status = await core.start()
  if (!status.connected || status.version !== PIN) {
    const detail = status.lastError || (status.recentLogs || []).slice(-12).join('\n')
    await core.stop().catch(() => {})
    restoreEnv(previous)
    throw new Error(`真 Host 没有连上 ${PIN}：${detail}`)
  }

  async function stop() {
    await core.stop().catch(() => {})
    restoreEnv(previous)
    // semantic-os can still write bytecode into this home while rm walks it
    await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 })
  }

  return { core, cwd, probeDir, home, version: status.version, stop }
}

async function bootWorkflowHostChild(options) {
  const emptyVendor = await mkdtemp(join(tmpdir(), 'fde-empty-vendor-'))
  const tempHome = await mkdtemp(join(tmpdir(), 'fde-child-home-'))
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key.startsWith('FDE_PLUGIN_')) delete env[key]
  }
  delete env.FDE_IUI_ARTIFACT
  env.FDE_VENDOR_DIR = emptyVendor
  env.FDE_REPO_PLUGINS = '0'
  env.HOME = tempHome
  env.USERPROFILE = tempHome
  env.FDE_DSH_HOME = tempHome
  env.DSH_HOME = tempHome
  env.FDE_WORKFLOW_HOST_CHILD = '1'
  env.FDE_WORKFLOW_HOST_OPTIONS = JSON.stringify({
    leak: Boolean(options.leak),
    extra: Boolean(options.extra),
    callTool: options.callTool || '',
    presetOnly: Boolean(options.presetOnly),
    staleAllow: Boolean(options.staleAllow),
  })
  const childPath = fileURLToPath(new URL('./workflow-host-child.mjs', import.meta.url))
  const child = spawn(process.execPath, [childPath], {
    env,
    stdio: ['pipe', 'inherit', 'inherit', 'pipe'],
  })
  const pending = new Map()
  let readySettled = false
  let readyResolve
  let readyReject
  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve
    readyReject = reject
  })
  let buffer = ''
  const channel = child.stdio[3]
  channel.setEncoding('utf8')
  channel.on('data', (chunk) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch (error) {
        if (!readySettled) {
          readySettled = true
          readyReject(error)
        }
        continue
      }
      if (msg.type === 'ready') {
        readySettled = true
        readyResolve(msg)
      } else if (msg.type === 'fatal' && !readySettled) {
        readySettled = true
        readyReject(new Error(msg.message))
      } else {
        const waiter = pending.get(msg.id)
        if (!waiter) continue
        pending.delete(msg.id)
        if (msg.error) waiter.reject(new Error(msg.error))
        else waiter.resolve(msg.value)
      }
    }
  })
  const closed = new Promise((resolve) => {
    child.on('close', (code) => resolve(code))
  })
  closed.then((code) => {
    const error = new Error(`workflow host child exited ${code}`)
    if (!readySettled) {
      readySettled = true
      readyReject(error)
    }
    for (const waiter of pending.values()) waiter.reject(error)
    pending.clear()
  })
  const timer = setTimeout(() => {
    if (!readySettled) {
      readySettled = true
      readyReject(new Error('workflow host child did not become ready'))
    }
  }, 90_000)
  let started
  try {
    started = await readyPromise
  } catch (error) {
    child.kill()
    await closed
    await rm(emptyVendor, { recursive: true, force: true })
    await rm(tempHome, { recursive: true, force: true })
    throw error
  } finally {
    clearTimeout(timer)
  }
  const previousHome = {
    FDE_DSH_HOME: process.env.FDE_DSH_HOME,
    DSH_HOME: process.env.DSH_HOME,
  }
  process.env.FDE_DSH_HOME = started.home
  process.env.DSH_HOME = started.home
  let seq = 0
  function request(message) {
    const id = ++seq
    const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    child.stdin.write(`${JSON.stringify({ ...message, id })}\n`)
    return result
  }
  const core = {
    origin: started.origin,
    cookie: started.cookie,
    dshHome: started.home,
    cwd: started.cwd,
    logs: [],
    status() {
      return {
        state: 'connected',
        connected: Boolean(core.origin && core.cookie),
        version: started.version,
        origin: core.origin,
        workspace: started.cwd,
        dshHome: started.home,
      }
    },
    async call(endpoint, args = {}, signal) {
      if (!core.origin || !core.cookie) throw new Error('核心 AI 运行时尚未连接')
      const rpcId = randomUUID()
      const response = await fetch(new URL(`/api/${endpoint}`, core.origin), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: core.cookie,
          origin: core.origin,
        },
        body: JSON.stringify({
          type: 'client-request',
          rpcId,
          method: endpoint,
          payload: { args },
        }),
        signal,
      })
      if (!response.ok) throw new Error(`AI 远程调用失败：HTTP ${response.status}`)
      return parseHostRpcValue(response, rpcId, endpoint)
    },
    async *stream(endpoint, args = {}) {
      const frames = await request({ type: 'stream', endpoint, args })
      for (const frame of frames) yield frame
    },
  }
  async function stop() {
    try {
      await request({ type: 'stop' })
    } finally {
      restoreEnv(previousHome)
      if (child.exitCode === null) child.kill()
      await closed
      await rm(emptyVendor, { recursive: true, force: true })
      await rm(tempHome, { recursive: true, force: true })
    }
  }
  return { core, cwd: started.cwd, probeDir: started.probeDir, home: started.home, version: started.version, stop }
}

function restoreEnv(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

export async function waitForProbe(probeDir, preset) {
  const file = join(probeDir, `${preset}.json`)
  const started = Date.now()
  while (Date.now() - started < 5000) {
    if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'))
    await new Promise((resolve) => setImmediate(resolve))
  }
  throw new Error(`真 Host 没有写出 ${preset} 会话的工具列表`)
}
