import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import {
  DSH_LAN_ASSIST_PORT,
  FDE_APP_ROOT,
  FDE_DSH_BIN,
  FDE_DSH_HOME,
  FDE_OFFICIAL_DSH_HOME,
  FDE_RUNTIME_HOST,
  FDE_RUNTIME_PORT,
  FDE_VENDOR_DIR,
  FDE_WEB_PORT,
  resolveDshBin,
} from '../runtime/config.mjs'
import { seedDshCredentialsSync } from '../runtime/dsh-credentials.mjs'
import { isPidAlive, pidsListeningOnPort, reclaimStrayRuntime } from '../runtime/reclaim-runtime.mjs'
import { bindPageToken, readUiTokenLine } from './page-token-handoff.mjs'
import { runtimePortOpen } from './runtime-port.mjs'

const root = FDE_APP_ROOT
const host = FDE_RUNTIME_HOST
const runtimePort = FDE_RUNTIME_PORT
const webPort = FDE_WEB_PORT
const fdeHome = FDE_DSH_HOME
const officialHome = FDE_OFFICIAL_DSH_HOME

function linkVendorTarget(target, linkPath) {
  if (process.platform === 'win32') {
    try {
      symlinkSync(target, linkPath, 'junction')
      return
    } catch {
      // dev 启动阶段不拷贝整棵 vendor；失败时留给 runtime 插件逻辑处理
      return
    }
  }
  symlinkSync(target, linkPath)
}

function prepareFdeHome() {
  mkdirSync(fdeHome, { recursive: true })
  seedDshCredentialsSync(fdeHome, { officialHome, fdeHome })
  const vendor = join(fdeHome, 'vendor')
  const shared = existsSync(FDE_VENDOR_DIR) ? FDE_VENDOR_DIR : join(officialHome, 'vendor')
  if (existsSync(shared) && !existsSync(vendor)) linkVendorTarget(shared, vendor)
}

function portOpen(port, timeoutMs = 400) {
  return runtimePortOpen(port, host, timeoutMs)
}

async function waitFor(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portOpen(port, 300)) return true
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }
  return false
}

let shuttingDown = false
let pageToken = ''
let viteChild = null
let sendPageToken = () => {}
process.on('SIGINT', () => { shuttingDown = true })
process.on('SIGTERM', () => { shuttingDown = true })

let runtimeSupervisorNudge = null

function attachRuntimePortWatch(getChild, port) {
  let portWatch = null
  const clear = () => {
    if (portWatch) clearInterval(portWatch)
    portWatch = null
  }
  const start = () => {
    clear()
    portWatch = setInterval(async () => {
      const child = getChild()
      if (shuttingDown || !child) return
      if (!isPidAlive(child.pid)) return
      if (!(await portOpen(port, 250))) {
        console.warn(`[fde-x] 本地核心进程还在但运行口不可用，强制重启`)
        child.kill('SIGKILL')
      }
    }, 2000)
  }
  return { start, clear }
}

function bindRuntimeSupervisorNudge(getChild, port, boot) {
  runtimeSupervisorNudge = async () => {
    const child = getChild()
    if (child && isPidAlive(child.pid)) {
      child.kill('SIGKILL')
      return
    }
    if (!(await portOpen(port, 300))) await boot()
  }
}

function superviseRuntime(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv, FDE_RUNTIME_SUPERVISED: '1' }
  let child = null
  let booting = false
  const portWatchCtl = attachRuntimePortWatch(() => child, runtimePort)
  const boot = async () => {
    if (shuttingDown || booting) return
    if (child && isPidAlive(child.pid)) return
    booting = true
    child = null
    try {
      if (await portOpen(runtimePort, 300)) return
      await reclaimStrayRuntime({
        keep: [process.pid],
        profileName: process.env.FDE_DSH_PROFILE || 'fde-x',
        lanPort: process.env.DSH_LAN_ASSIST_PORT || DSH_LAN_ASSIST_PORT,
        runtimePort,
        dshHome: fdeHome,
      })
      if (shuttingDown) return
      if (await portOpen(runtimePort, 300)) return
      child = spawn(process.execPath, ['runtime/server.mjs'], {
        cwd: root,
        env,
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      const lines = createInterface({ input: child.stdout })
      lines.on('line', (line) => {
        const token = readUiTokenLine(line)
        if (token) {
          pageToken = token
          sendPageToken()
          return
        }
        process.stdout.write(`${line}\n`)
      })
      portWatchCtl.start()
      child.on('exit', (code, signal) => {
        portWatchCtl.clear()
        child = null
        if (shuttingDown) return
        console.log(`[fde-x] 本地核心退出 (${signal || code || 0})，正在重新拉起`)
        setTimeout(() => { void boot() }, 400)
      })
    } finally {
      booting = false
    }
  }
  bindRuntimeSupervisorNudge(() => child, runtimePort, boot)
  void boot()
}

prepareFdeHome()

if (await portOpen(runtimePort)) {
  const occupants = await pidsListeningOnPort(runtimePort)
  console.error(`[fde-x] ${runtimePort} 已有核心在听，但这个 dev 拿不到它的页面令牌。不复用，也不另起。`)
  console.error(`[fde-x] 占用进程 pid：${occupants.length ? occupants.join('、') : '没有查到'}`)
  if (occupants.length === 0) {
    console.error(`[fde-x] 停掉占用 ${runtimePort} 的进程后再运行 pnpm dev。`)
  } else {
    for (const pid of occupants) {
      console.error(`[fde-x] 停掉后再运行 pnpm dev：kill ${pid}`)
    }
  }
  process.exit(1)
}

console.log(`[fde-x] 正在启动本地核心 http://${host}:${runtimePort}`)
const dshBin = FDE_DSH_BIN || resolveDshBin()
superviseRuntime({
  FDE_RUNTIME_PORT: String(runtimePort),
  FDE_RUNTIME_HOST: host,
  ...(dshBin ? { FDE_DSH_BIN: dshBin } : {}),
  FDE_DSH_HOME: fdeHome,
  DSH_LAN_ASSIST_PORT: process.env.DSH_LAN_ASSIST_PORT || DSH_LAN_ASSIST_PORT,
})
const ready = await waitFor(runtimePort, 12_000)
if (!ready) {
  console.error('[fde-x] 本地核心没有在 12 秒内起来。请看上方 runtime 报错。')
  process.exit(1)
}

console.log(`[fde-x] 打开界面 http://127.0.0.1:${webPort}`)
viteChild = spawn(process.execPath, [
  join(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1',
  '--port', String(webPort),
], {
  cwd: root,
  env: {
    ...process.env,
    FDE_DEV_SUPERVISOR_IPC: '1',
    FDE_SKIP_RUNTIME_SPAWN: '1',
  },
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
})
sendPageToken = bindPageToken(viteChild, () => pageToken)
viteChild.on('message', (msg) => {
  if (msg && msg.type === 'fde-runtime-restart' && runtimeSupervisorNudge) {
    void runtimeSupervisorNudge()
  }
})
viteChild.on('exit', (code, signal) => {
  if (shuttingDown) return
  if (signal) process.exit(1)
  if (code && code !== 0) process.exit(code)
})
