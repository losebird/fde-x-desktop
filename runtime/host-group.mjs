import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

const command = process.argv[2]
const args = process.argv.slice(3)
if (!command) process.exit(1)

let killed = false

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

function killOthers() {
  let names
  try {
    names = readdirSync('/proc')
  } catch {
    return
  }
  for (const name of names) {
    if (!/^\d+$/u.test(name)) continue
    const pid = Number(name)
    if (pid <= 1 || pid === process.pid) continue
    let pgrp
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8')
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      pgrp = Number(rest[2])
    } catch {
      continue
    }
    if (pgrp !== process.pid) continue
    try {
      process.kill(pid, 'SIGKILL')
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
    }
  }
}

function forwardExit(code, signal) {
  if (signal) {
    process.removeAllListeners(signal)
    try {
      process.kill(process.pid, signal)
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
      process.exit(1)
    }
    return
  }
  process.exit(code ?? 0)
}

process.stdin.on('end', killGroup)
process.stdin.on('error', (error) => {
  if (error?.code === 'EPIPE' || error?.code === 'ECONNRESET' || error?.code === 'ERR_STREAM_DESTROYED') killGroup()
})
process.stdin.resume()

const child = spawn(command, args, {
  stdio: ['ignore', 'inherit', 'inherit'],
  windowsHide: true,
})

child.on('error', () => {
  if (!killed) process.exit(1)
})

child.on('exit', (code, signal) => {
  if (killed) return
  killed = true
  killOthers()
  forwardExit(code, signal)
})
