import { spawn } from 'node:child_process'

export function killProcessGroup(pid, signal = 'SIGKILL') {
  const n = Number(pid)
  if (!Number.isInteger(n) || n <= 1) return false
  if (process.platform === 'win32') {
    try {
      process.kill(n, signal)
      return true
    } catch {
      return false
    }
  }
  try {
    process.kill(-n, signal)
    return true
  } catch {
    try {
      process.kill(n, signal)
      return true
    } catch {
      return false
    }
  }
}

export function pidAlive(pid) {
  const n = Number(pid)
  if (!Number.isInteger(n) || n <= 1) return false
  try {
    process.kill(n, 0)
    return true
  } catch {
    return false
  }
}

export function waitPidExit(pid, timeoutMs = 2000) {
  const n = Number(pid)
  const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0)
  return new Promise((resolve) => {
    const tick = () => {
      if (!pidAlive(n) || Date.now() >= deadline) {
        resolve(!pidAlive(n))
        return
      }
      setTimeout(tick, 40)
    }
    tick()
  })
}

/**
 * Survives parent SIGKILL: stdin EOF from the dead parent then SIGKILL -pgid.
 * The reaper itself is not detached so it stays a child; killing one pid
 * does not take the POSIX group, so the reaper is adopted and still runs.
 */
export function armParentDeathReaper(pgid) {
  if (process.platform === 'win32') return null
  const n = Number(pgid)
  if (!Number.isInteger(n) || n <= 1) return null
  const script = [
    'const pgid = Number(process.env.FDE_REAP_PGID)',
    'if (!Number.isInteger(pgid) || pgid <= 1) process.exit(0)',
    "process.on('SIGTERM', () => {})",
    'function reap() {',
    "  try { process.kill(-pgid, 'SIGKILL') } catch {}",
    '  process.exit(0)',
    '}',
    "process.stdin.on('end', reap)",
    "process.stdin.on('error', reap)",
    'process.stdin.resume()',
  ].join('\n')
  const reaper = spawn(process.execPath, ['-e', script], {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      FDE_REAP_PGID: String(n),
    },
  })
  reaper.unref()
  reaper.stdin?.on('error', () => {})
  return reaper
}

export function stopParentDeathReaper(reaper) {
  if (!reaper) return
  try { reaper.stdin?.end() } catch { /* ignore */ }
  try { reaper.kill('SIGKILL') } catch { /* ignore */ }
}
