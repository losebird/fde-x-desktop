import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

function logPath() {
  const home = String(process.env.FDE_DSH_HOME || '').trim()
  const root = home ? join(home, '..') : join(homedir(), 'Library', 'Application Support', 'FDE-X')
  return join(root, 'lifecycle.log')
}

export function lifecycleLog(line) {
  try {
    const path = logPath()
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${new Date().toISOString()} pid=${process.pid} ${line}\n`)
  } catch { /* diagnostic only */ }
}

export function armLifecycleTraps() {
  if (globalThis.__fdeLifecycleArmed) return
  globalThis.__fdeLifecycleArmed = true
  lifecycleLog('bff-start')
  process.on('uncaughtException', (error) => {
    lifecycleLog(`uncaughtException ${error && error.stack ? error.stack : error}`)
  })
  process.on('unhandledRejection', (error) => {
    lifecycleLog(`unhandledRejection ${error && error.stack ? error.stack : error}`)
  })
  process.on('exit', (code) => {
    lifecycleLog(`process.exit code=${code}`)
  })
  for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGPIPE']) {
    process.on(name, () => {
      lifecycleLog(name)
    })
  }
}
