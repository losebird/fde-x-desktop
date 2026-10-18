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
import { isPidAlive, pidsChildrenOf, pidsListeningOnPort, reclaimStrayRuntime } from '../runtime/reclaim-runtime.mjs'
import { ensureOwnedRuntime } from './dev-runtime.mjs'
import { runtimePortOpen } from './runtime-port.mjs'

const root = FDE_APP_ROOT
const host = FDE_RUNTIME_HOST
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

let shuttingDown = false
let pageToken = ''
let viteChild = null
let runtimePort = FDE_RUNTIME_PORT
let child = null
let preservedPids = []
let booting = false
process.on('SIGINT', () => { shuttingDown = true })
process.on('SIGTERM', () => { shuttingDown = true })

/** Dev 监督：口不通就杀掉再拉（设置里重载核心在 BFF 已死时经 Vite IPC 触发）。 */
let runtimeSupervisorNudge = null
let dshBin = ''

function attachRuntimePortWatch(getChild, getPort) {
  let portWatch = null
  const clear = () => {
    if (portWatch) clearInterval(portWatch)
    portWatch = null
  }
  const start = () => {
    clear()
    portWatch = setInterval(async () => {
      const current = getChild()
      if (shuttingDown || !current) return
      if (!isPidAlive(current.pid)) return
      if (!(await portOpen(getPort(), 250))) {
        console.warn(`[fde-x] 本地核心进程还在但运行口不可用，强制重启`)
        current.kill('SIGKILL')
      }
    }, 2000)
  }
  return { start, clear }
}

const portWatchCtl = attachRuntimePortWatch(() => child, () => runtimePort)

function publishPageToken() {
  if (!pageToken || !viteChild || !viteChild.connected) return
  viteChild.send({ type: 'fde-ui-token', token: pageToken })
}

function bootOwned(port, keepPids) {
  if (shuttingDown) return Promise.reject(new Error('dev 正在退出'))
  if (booting) return Promise.reject(new Error('核心正在启动'))
  if (child && isPidAlive(child.pid)) return Promise.resolve({ port: runtimePort, token: pageToken })
  booting = true
  return (async () => {
    try {
      await reclaimStrayRuntime({
        keep: [process.pid, ...keepPids],
        profileName: process.env.FDE_DSH_PROFILE || 'fde-x',
        lanPort: process.env.DSH_LAN_ASSIST_PORT || DSH_LAN_ASSIST_PORT,
        runtimePort: port > 0 ? port : 0,
        dshHome: fdeHome,
      })
      if (shuttingDown) throw new Error('dev 正在退出')
      if (port > 0 && await portOpen(port, 300)) {
        throw new Error(`${port} 仍被占用。原来的进程没有动。停掉占用 ${port} 的进程后再运行 pnpm dev。`)
      }
      const spawned = spawn(process.execPath, ['runtime/server.mjs'], {
        cwd: root,
        env: {
          ...process.env,
          FDE_RUNTIME_PORT: String(port),
          FDE_RUNTIME_HOST: host,
          FDE_RUNTIME_SUPERVISED: '1',
          FDE_DSH_HOME: fdeHome,
          DSH_LAN_ASSIST_PORT: process.env.DSH_LAN_ASSIST_PORT || DSH_LAN_ASSIST_PORT,
          FDE_RECLAIM_KEEP_PIDS: keepPids.join(','),
          ...(dshBin ? { FDE_DSH_BIN: dshBin } : {}),
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      })
      child = spawned
      let token = ''
      let announced = 0
      let settled = false
      const lines = createInterface({ input: spawned.stdout })
      const announcedReady = new Promise((resolve, reject) => {
        lines.on('line', (line) => {
          const tokenMatch = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/u.exec(line.trim())
          if (tokenMatch) {
            token = tokenMatch[1]
            pageToken = token
            publishPageToken()
            if (announced && !settled) {
              settled = true
              resolve({ port: announced, token })
            }
            return
          }
          const portMatch = /^FDE_LISTENING\s+(\d+)/u.exec(line.trim())
          if (portMatch) announced = Number(portMatch[1])
          process.stdout.write(`${line}\n`)
          if (token && announced && !settled) {
            settled = true
            resolve({ port: announced, token })
          }
        })
        spawned.once('exit', (code, signal) => {
          portWatchCtl.clear()
          child = null
          if (!settled) {
            settled = true
            reject(new Error(`本地核心退出 (${signal || code || 0})，没有拿到页面令牌`))
            return
          }
          if (shuttingDown) return
          console.log(`[fde-x] 本地核心退出 (${signal || code || 0})，正在重新拉起`)
          setTimeout(() => { void bootOwned(runtimePort, preservedPids) }, 400)
        })
      })
      const ready = await announcedReady
      runtimePort = ready.port
      portWatchCtl.start()
      return ready
    } finally {
      booting = false
    }
  })()
}

runtimeSupervisorNudge = async () => {
  if (child && isPidAlive(child.pid)) {
    child.kill('SIGKILL')
    return
  }
  if (!(await portOpen(runtimePort, 300))) await bootOwned(runtimePort, preservedPids)
}

prepareFdeHome()
dshBin = FDE_DSH_BIN || resolveDshBin()

const preferredPort = runtimePort
if (await portOpen(preferredPort)) {
  console.log(`[fde-x] ${preferredPort} 已有核心在听。页面令牌只在那个进程启动时出现，复用它之后页面无法保存。`)
}
const owned = await ensureOwnedRuntime({
  preferredPort,
  portOpen: (port) => portOpen(port),
  listenersOn: (port) => pidsListeningOnPort(port),
  childrenOf: (pid) => pidsChildrenOf(pid),
  spawnOwned: ({ port, keepPids }) => bootOwned(port, keepPids),
})
runtimePort = owned.port
pageToken = owned.token
preservedPids = owned.keptPids
if (owned.port !== preferredPort) {
  console.log(`[fde-x] 另起核心 http://${host}:${owned.port}。原来的进程保持运行。若必须用 ${preferredPort}，先停掉占用它的进程，再运行 pnpm dev。`)
} else {
  console.log(`[fde-x] 本地核心 http://${host}:${owned.port}`)
}

const runtimeUrl = `http://${host}:${runtimePort}`
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
    FDE_RUNTIME_URL: runtimeUrl,
    VITE_FDE_RUNTIME_URL: runtimeUrl,
  },
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
})
viteChild.on('message', (msg) => {
  if (msg && msg.type === 'fde-runtime-restart' && runtimeSupervisorNudge) {
    void runtimeSupervisorNudge()
  }
  if (msg && msg.type === 'fde-vite-listening' && pageToken) {
    viteChild.send({ type: 'fde-ui-token', token: pageToken })
  }
})
viteChild.on('exit', (code, signal) => {
  if (shuttingDown) return
  if (signal) process.exit(1)
  if (code && code !== 0) process.exit(code)
})
