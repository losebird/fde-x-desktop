import { spawn } from 'node:child_process'

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
  if (signal) {
    process.removeAllListeners(signal)
    try {
      process.kill(process.pid, signal)
    } catch {
      process.exit(1)
    }
    return
  }
  process.exit(code ?? 0)
})

// Group SIGTERM already reached the host. Exiting here would make stop() skip the host's grace period.
process.on('SIGTERM', () => {
  if (child.exitCode != null || child.signalCode != null) process.exit(0)
})
process.on('SIGINT', () => {
  if (child.exitCode != null || child.signalCode != null) process.exit(0)
})
