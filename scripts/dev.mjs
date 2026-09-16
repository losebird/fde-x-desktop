import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

function resolveDshBin() {
  const fromPath = String(process.env.PATH || '').split(':').map((dir) => join(dir, 'dsh'))
  const candidates = [process.env.FDE_DSH_BIN, '/opt/homebrew/bin/dsh', '/usr/local/bin/dsh', ...fromPath].filter(Boolean)
  return candidates.find((item) => existsSync(item)) || ''
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = process.env.FDE_RUNTIME_HOST ?? '127.0.0.1'
const runtimePort = Number(process.env.FDE_RUNTIME_PORT ?? 4318)
const webPort = Number(process.env.FDE_WEB_PORT ?? 5174)
const officialHome = join(homedir(), '.dsh')
const fdeHome = process.env.FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')

function prepareFdeHome() {
  mkdirSync(fdeHome, { recursive: true })
  const cred = join(officialHome, '.credentials.yaml')
  const dest = join(fdeHome, '.credentials.yaml')
  if (existsSync(cred) && !existsSync(dest)) copyFileSync(cred, dest)
  const vendor = join(fdeHome, 'vendor')
  const shared = join(officialHome, 'vendor')
  if (existsSync(shared) && !existsSync(vendor)) symlinkSync(shared, vendor)
}

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
      console.log(`[fde-x] 本地核心退出 (${signal || code || 0})，正在重新拉起`)
      setTimeout(boot, 400)
    })
    return child
  }
  return boot()
}

prepareFdeHome()

if (!await portOpen(runtimePort)) {
  console.log(`[fde-x] 正在启动本地核心 http://${host}:${runtimePort}`)
  const dshBin = resolveDshBin()
  runRuntime({
    FDE_RUNTIME_PORT: String(runtimePort),
    FDE_RUNTIME_HOST: host,
    ...(dshBin ? { FDE_DSH_BIN: dshBin } : {}),
    FDE_DSH_HOME: fdeHome,
    DSH_LAN_ASSIST_PORT: process.env.DSH_LAN_ASSIST_PORT || '19527',
  })
  const ready = await waitFor(runtimePort, 12_000)
  if (!ready) {
    console.error('[fde-x] 本地核心没有在 12 秒内起来。请看上方 runtime 报错。')
    process.exit(1)
  }
} else {
  console.log(`[fde-x] 复用已有本地核心 http://${host}:${runtimePort}`)
}

console.log(`[fde-x] 打开界面 http://127.0.0.1:${webPort}`)
run(process.execPath, [
  resolve(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1',
  '--port', String(webPort),
])
