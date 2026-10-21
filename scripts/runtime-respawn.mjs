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
import { runtimePortOpen } from './runtime-port.mjs'

const restarterScript = fileURLToPath(import.meta.url)

export function spawnRuntimeRestarter({ cwd, env, pid }) {
  const child = spawn(process.execPath, [restarterScript], {
    cwd,
    env: { ...env, FDE_RUNTIME_REPLACE_PID: String(pid) },
    detached: true,
    stdio: 'inherit',
  })
  child.unref()
  return child
}

export function releaseRuntimeRestarter() {}

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

async function main() {
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

  const child = spawn(process.execPath, ['runtime/server.mjs'], {
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
