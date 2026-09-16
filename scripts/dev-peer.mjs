import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = '127.0.0.1'
const runtimePort = Number(process.env.FDE_PEER_RUNTIME_PORT ?? 4319)
const webPort = Number(process.env.FDE_PEER_WEB_PORT ?? 5175)
const lanPort = Number(process.env.FDE_PEER_LAN_PORT ?? 18528)
const peerHome = process.env.FDE_PEER_DSH_HOME || join(homedir(), '.dsh-fde-peer')
const officialHome = join(homedir(), '.dsh')
const mainHome = process.env.FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')

function portOpen(port, timeoutMs = 400) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ port, host })
    const timer = setTimeout(() => {
      socket.destroy()
      resolveOpen(false)
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolveOpen(true)
    })
    socket.once('error', () => {
      clearTimeout(timer)
      socket.destroy()
      resolveOpen(false)
    })
  })
}

async function waitFor(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portOpen(port, 300)) return true
    await new Promise((resolveWait) => setTimeout(resolveWait, 200))
  }
  return false
}

function preparePeerHome() {
  mkdirSync(peerHome, { recursive: true })
  const cred = existsSync(join(mainHome, '.credentials.yaml')) ? join(mainHome, '.credentials.yaml') : join(officialHome, '.credentials.yaml')
  const dest = join(peerHome, '.credentials.yaml')
  if (existsSync(cred) && !existsSync(dest)) copyFileSync(cred, dest)
  const vendor = join(peerHome, 'vendor')
  const shared = existsSync(join(officialHome, 'vendor')) ? join(officialHome, 'vendor') : join(mainHome, 'vendor')
  if (existsSync(shared) && !existsSync(vendor)) symlinkSync(shared, vendor)
  const storages = join(peerHome, 'storages')
  mkdirSync(storages, { recursive: true })
  const wsSrc = join(mainHome, 'storages', 'workspace.json')
  const wsDst = join(storages, 'workspace.json')
  if (existsSync(wsSrc)) copyFileSync(wsSrc, wsDst)
}

let shuttingDown = false
process.on('SIGINT', () => { shuttingDown = true })
process.on('SIGTERM', () => { shuttingDown = true })

function run(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    if (signal) process.exit(1)
    if (code && code !== 0) process.exit(code)
  })
  return child
}

function runRuntime(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv, FDE_RUNTIME_SUPERVISED: '1' }
  const boot = () => {
    const child = spawn(process.execPath, ['runtime/server.mjs'], {
      cwd: root,
      env,
      stdio: 'inherit',
    })
    child.on('exit', (code, signal) => {
      if (shuttingDown) return
      console.log(`[fde-x] 对端核心退出 (${signal || code || 0})，正在重新拉起`)
      setTimeout(boot, 400)
    })
    return child
  }
  return boot()
}

preparePeerHome()

if (await portOpen(runtimePort)) {
  console.error(`[fde-x] 对端核心端口 ${runtimePort} 已被占用`)
  process.exit(1)
}

console.log(`[fde-x] 对端核心 http://${host}:${runtimePort}  门牌 127.0.0.1:${lanPort}`)
runRuntime({
  FDE_RUNTIME_PORT: String(runtimePort),
  FDE_RUNTIME_HOST: host,
  FDE_DSH_HOME: peerHome,
  FDE_DSH_PROFILE: 'fde-x-peer',
  DSH_LAN_ASSIST_PORT: String(lanPort),
  FDE_DATABASE_PATH: join(root, 'runtime', 'data', 'fde-workstation-peer.sqlite'),
})
if (!await waitFor(runtimePort, 20_000)) {
  console.error('[fde-x] 对端核心没有起来')
  process.exit(1)
}

console.log(`[fde-x] 对端界面 http://127.0.0.1:${webPort}`)
console.log('[fde-x] 配对：填对面 IM 显示的本机门牌（主环境 127.0.0.1:19527，对端 127.0.0.1:18528）')
run(process.execPath, [
  resolve(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1',
  '--port', String(webPort),
], {
  FDE_RUNTIME_URL: `http://${host}:${runtimePort}`,
  FDE_SKIP_RUNTIME_SPAWN: '1',
})
