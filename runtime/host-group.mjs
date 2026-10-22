import { spawn } from 'node:child_process'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const command = process.argv[2]
const args = process.argv.slice(3)
if (!command) process.exit(1)

let killed = false

function publishHostExit(code, signal) {
  const finalPath = process.env.FDE_HOST_EXIT_STATUS
  if (!finalPath) return
  mkdirSync(dirname(finalPath), { recursive: true })
  const tmpPath = `${finalPath}.${process.pid}.tmp`
  writeFileSync(tmpPath, JSON.stringify({
    code: Number.isInteger(code) ? code : null,
    signal: signal || null,
  }))
  renameSync(tmpPath, finalPath)
}

function killGroup() {
  if (killed) return
  killed = true
  try {
    process.kill(-process.pid, 'SIGKILL')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
    process.exit(1)
  }
}

process.stdin.on('end', killGroup)
process.stdin.on('error', (error) => {
  if (error?.code === 'EPIPE' || error?.code === 'ECONNRESET' || error?.code === 'ERR_STREAM_DESTROYED') killGroup()
})
process.stdin.resume()

const hostEnv = { ...process.env }
delete hostEnv.FDE_HOST_EXIT_STATUS
const child = spawn(command, args, {
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
  env: hostEnv,
})

child.on('error', () => {
  if (!killed) process.exit(1)
})

child.on('exit', (code, signal) => {
  if (killed) return
  try {
    publishHostExit(code, signal)
  } catch {
    /* still reap the group when the status file cannot be written */
  }
  killGroup()
})
