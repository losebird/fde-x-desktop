import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  DSH_LAN_ASSIST_PORT,
  FDE_APP_ROOT,
  FDE_DSH_HOME,
  FDE_RUNTIME_HOST,
  FDE_RUNTIME_PORT,
} from '../runtime/config.mjs'
import { isPidAlive, reclaimStrayRuntime } from '../runtime/reclaim-runtime.mjs'
import { ensureGenerationHost } from '../runtime/generation.mjs'
import { runtimePortOpen } from './runtime-port.mjs'

const restarterScript = fileURLToPath(import.meta.url)

export function spawnRuntimeRestarter({ cwd, env, pid }) {
  const unix = process.platform !== 'win32'
  const child = spawn(process.execPath, [restarterScript], {
    cwd,
    env: { ...env, FDE_RUNTIME_REPLACE_PID: String(pid) },
    detached: true,
    stdio: unix ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  })
  child.unref()
  child.stdin?.on('error', (error) => {
    const code = error && error.code
    if (code === 'EPIPE' || code === 'ECONNRESET' || code === 'ERR_STREAM_DESTROYED') return
    throw error
  })
  return child
}

export function releaseRuntimeRestarter(child) {
  const stdin = child?.stdin
  if (!stdin || stdin.writable !== true) return
  try {
    stdin.write('go\n')
  } catch (error) {
    const code = error && error.code
    if (code === 'EPIPE' || code === 'ECONNRESET' || code === 'ERR_STREAM_DESTROYED') return
    throw error
  }
}

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

let reaped = false

function reapRestarterGroup() {
  if (reaped || process.platform === 'win32') return
  reaped = true
  try {
    process.kill(-process.pid, 'SIGKILL')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
  process.exit(1)
}

async function waitUntilPlannedRestart() {
  if (process.platform === 'win32') return true
  let plannedRestart = false
  let pending = ''
  await new Promise((resolve) => {
    const finish = () => resolve()
    process.stdin.on('data', (chunk) => {
      pending += String(chunk)
      if (pending.includes('go')) {
        plannedRestart = true
        finish()
      }
    })
    process.stdin.on('end', finish)
    process.stdin.on('error', (error) => {
      const code = error && error.code
      if (code === 'EPIPE' || code === 'ECONNRESET' || code === 'ERR_STREAM_DESTROYED') finish()
    })
    process.stdin.resume()
  })
  if (!plannedRestart) reapRestarterGroup()
  return plannedRestart
}

async function main() {
  const plannedRestart = await waitUntilPlannedRestart()
  if (!plannedRestart) return

  const replacePid = Number(process.env.FDE_RUNTIME_REPLACE_PID)
  const host = FDE_RUNTIME_HOST
  const runtimePort = FDE_RUNTIME_PORT
  const deadline = Date.now() + 15_000

  while (Date.now() < deadline) {
    const dead = !Number.isInteger(replacePid) || replacePid <= 1 || !isPidAlive(replacePid)
    const free = !(await runtimePortOpen(runtimePort, host, 250))
    if (dead && free) break
    await new Promise((resolveWait) => setTimeout(resolveWait, 150))
  }

  await reclaimStrayRuntime({
    keep: [process.pid],
    profileName: process.env.FDE_DSH_PROFILE || 'fde-x',
    lanPort: process.env.DSH_LAN_ASSIST_PORT || DSH_LAN_ASSIST_PORT,
    runtimePort,
    recordedPids: [],
    dshHome: process.env.FDE_DSH_HOME || FDE_DSH_HOME,
  })

  await ensureGenerationHost()
  const child = spawn(process.execPath, ['runtime/boot.mjs'], {
    cwd: FDE_APP_ROOT,
    env: process.env,
    stdio: 'inherit',
    detached: true,
  })
  child.unref()
}

if (invokedDirectly()) {
  await main()
}
