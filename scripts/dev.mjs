import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, symlinkSync } from 'node:fs'
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
import { isPidAlive, reclaimStrayRuntime } from '../runtime/reclaim-runtime.mjs'
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
  const cred = join(officialHome, '.credentials.yaml')
  const dest = join(fdeHome, '.credentials.yaml')
  if (existsSync(cred) && !existsSync(dest)) copyFileSync(cred, dest)
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
process.on('SIGINT', () => { shuttingDown = true })
process.on('SIGTERM', () => { shuttingDown = true })

/** Dev 监督：口不通就杀掉再拉（设置里重载核心在 BFF 已死时经 Vite IPC 触发）。 */
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

function superviseRuntime(extraEnv = {}, { adoptExisting = false } = {}) {
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
      })
      if (shuttingDown) return
      if (await portOpen(runtimePort, 300)) return
      child = spawn(process.execPath, ['runtime/server.mjs'], {
        cwd: root,
        env,
        stdio: 'inherit',
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
  if (!adoptExisting) {
    void boot()
    return
  }
  const watch = async () => {
    while (!shuttingDown) {
      if (!child && !(await portOpen(runtimePort, 300))) await boot()
      await new Promise((resolveWait) => setTimeout(resolveWait, 400))
    }
  }
  void watch()
}

prepareFdeHome()

if (!await portOpen(runtimePort)) {
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
} else {
  console.log(`[fde-x] 复用已有本地核心 http://${host}:${runtimePort}`)
  console.log('[fde-x] 已挂监督：设置里「重载核心」退出后会自动再拉起')
  const dshBin = FDE_DSH_BIN || resolveDshBin()
  superviseRuntime(dshBin ? { FDE_DSH_BIN: dshBin } : {}, { adoptExisting: true })
}

console.log(`[fde-x] 打开界面 http://127.0.0.1:${webPort}`)
const viteChild = spawn(process.execPath, [
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
