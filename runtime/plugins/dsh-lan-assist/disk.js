/**
 * Cross-platform mailbox file replace and listen-pid stop.
 * Windows cannot rename over an existing file; SIGTERM does not stop a listen mouth.
 * @module dsh-lan-assist/disk
 */

import { spawn } from 'node:child_process'
import { chmod, rename, unlink, writeFile } from 'node:fs/promises'

export function isReplaceBusy(err) {
  const code = err && err.code
  return code === 'EPERM' || code === 'EEXIST' || code === 'EACCES'
}

/**
 * Write dest via a sibling tmp file. On Windows, fall back to overwrite
 * when rename cannot replace the live mailbox.
 */
export async function replaceFile(dest, contents, opts = {}) {
  const io = opts.io || { writeFile, rename, unlink, chmod }
  const mode = opts.mode || 0o600
  const tmp = String(dest) + '.tmp'
  await io.writeFile(tmp, contents, { encoding: 'utf8', mode })
  try {
    await io.rename(tmp, dest)
  } catch (err) {
    if (!isReplaceBusy(err)) throw err
    await io.writeFile(dest, contents, { encoding: 'utf8', mode })
    try { await io.unlink(tmp) } catch { /* leftover tmp is harmless */ }
  }
  try { await io.chmod(dest, mode) } catch { /* windows */ }
}

export function windowsKillArgs(pid) {
  return ['/PID', String(pid), '/T', '/F']
}

/**
 * Stop a detached listen mouth. Windows needs taskkill /T /F.
 */
export async function stopPid(pid, opts = {}) {
  const n = Number(pid)
  if (!n) return { ok: false }
  const platform = opts.platform || process.platform
  if (platform === 'win32') {
    const spawnImpl = opts.spawn || spawn
    await new Promise((resolve) => {
      const child = spawnImpl('taskkill', windowsKillArgs(n), {
        windowsHide: true,
        stdio: 'ignore',
      })
      child.on('exit', resolve)
      child.on('error', resolve)
    })
    return { ok: true, how: 'taskkill' }
  }
  const killImpl = opts.kill || ((p, sig) => process.kill(p, sig))
  try { killImpl(n, 'SIGTERM') } catch { /* already gone */ }
  return { ok: true, how: 'SIGTERM' }
}
