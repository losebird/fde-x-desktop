import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { FDE_RUNTIME_PORT } from './config.mjs'

const execFileAsync = promisify(execFile)

function warnReclaim(message, onWarn) {
  const line = `[fde-x] ${message}`
  if (typeof onWarn === 'function') onWarn(line)
  else console.warn(line)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function isRuntimeServerCommand(command) {
  return /(?:^|[\\/\s])runtime\/server\.mjs(?:\s|$)/u.test(String(command || ''))
}

function parsePidList(stdout) {
  return String(stdout || '')
    .trim()
    .split(/\s+/u)
    .map(Number)
    .filter((pid) => Number.isInteger(pid) && pid > 1)
}

async function pgrepPattern(pattern, onWarn) {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('wmic', ['process', 'where', `CommandLine like '%${pattern.replace(/'/g, '')}%'`, 'get', 'ProcessId'], { timeout: 5000 })
      return String(stdout || '').split(/\r?\n/u)
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 1)
    } catch (error) {
      warnReclaim(`Windows 下无法用 wmic 查找进程：${errorMessage(error)}`, onWarn)
      return []
    }
  }
  try {
    const { stdout } = await execFileAsync('pgrep', ['-f', pattern], { timeout: 3000 })
    return parsePidList(stdout)
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined
    if (code !== 1 && code !== '1') {
      warnReclaim(`pgrep 不可用，跳过扫描：${errorMessage(error)}`, onWarn)
    }
    return []
  }
}

export async function pidsMatchingProfile(profileName, onWarn) {
  const name = String(profileName || '').trim()
  if (!name) return []
  return pgrepPattern(`profile ${name} --patch`, onWarn)
}

export async function pidsListeningOnPort(port, onWarn) {
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1) return []
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('netstat', ['-ano'], { timeout: 5000 })
      const pids = []
      for (const line of String(stdout || '').split(/\r?\n/u)) {
        if (!line.includes('LISTENING')) continue
        const match = line.match(new RegExp(`:${n}\\s+\\S+\\s+(\\d+)\\s*$`, 'u'))
        if (match) pids.push(Number(match[1]))
      }
      return pids.filter((pid) => Number.isInteger(pid) && pid > 1)
    } catch (error) {
      warnReclaim(`netstat 不可用，无法解析端口占用：${errorMessage(error)}`, onWarn)
      return []
    }
  }
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${n}`, '-sTCP:LISTEN', '-t'], { timeout: 3000 })
    return parsePidList(stdout)
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined
    if (code !== 1 && code !== '1') {
      warnReclaim(`lsof 不可用，无法解析端口占用：${errorMessage(error)}`, onWarn)
    }
    return []
  }
}

export async function parentPid(pid) {
  if (!isPidAlive(pid)) return null
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'ParentProcessId'], { timeout: 3000 })
      const n = String(stdout || '').split(/\r?\n/u).map((line) => Number(line.trim())).find((value) => Number.isInteger(value) && value > 0)
      return n && n !== pid ? n : null
    } catch {
      return null
    }
  }
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'ppid=', '-p', String(pid)], { timeout: 2000 })
    const n = Number(String(stdout || '').trim())
    return Number.isInteger(n) && n > 1 ? n : null
  } catch {
    return null
  }
}

export async function processCommand(pid) {
  if (!isPidAlive(pid)) return ''
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'CommandLine'], { timeout: 3000 })
      return String(stdout || '').split(/\r?\n/u).slice(1).join(' ').trim()
    } catch {
      return ''
    }
  }
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'command=', '-p', String(pid)], { timeout: 2000 })
    return String(stdout || '').trim()
  } catch {
    return ''
  }
}

async function processEnvCommand(pid) {
  if (process.platform === 'win32') return processCommand(pid)
  try {
    const { stdout } = await execFileAsync('ps', ['eww', '-p', String(pid), '-o', 'command='], { timeout: 2000 })
    return String(stdout || '')
  } catch {
    return processCommand(pid)
  }
}

export async function processHasRuntimePort(pid, runtimePort) {
  const n = Number(runtimePort)
  if (!Number.isInteger(n) || n < 1 || !isPidAlive(pid)) return false
  const blob = await processEnvCommand(pid)
  return new RegExp(`(?:^|\\s)FDE_RUNTIME_PORT=${n}(?:\\s|$)`, 'u').test(blob)
}

export async function processHasDshHome(pid, dshHome) {
  const home = String(dshHome || '').replace(/\/+$/u, '')
  if (!home || !isPidAlive(pid)) return false
  const blob = await processEnvCommand(pid)
  return blob.includes(`DSH_HOME=${home}`) || blob.includes(`FDE_DSH_HOME=${home}`)
}

export async function pidsChildrenOf(pid) {
  if (!isPidAlive(pid)) return []
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('wmic', ['process', 'where', `ParentProcessId=${pid}`, 'get', 'ProcessId'], { timeout: 3000 })
      return String(stdout || '').split(/\r?\n/u)
        .map((line) => Number(line.trim()))
        .filter((value) => Number.isInteger(value) && value > 1)
    } catch {
      return []
    }
  }
  try {
    const { stdout } = await execFileAsync('pgrep', ['-P', String(pid)], { timeout: 2000 })
    return parsePidList(stdout)
  } catch {
    return []
  }
}

export async function pidsMatchingRuntimeServer({ runtimePort = FDE_RUNTIME_PORT, keep = [], onWarn } = {}) {
  const keepSet = new Set([...keep, process.pid].filter((pid) => Number.isInteger(pid) && pid > 1))
  const n = Number(runtimePort)
  const listeners = Number.isInteger(n) && n > 1 ? await pidsListeningOnPort(n, onWarn) : []
  const candidates = await pgrepPattern('runtime/server.mjs', onWarn)
  const out = new Set()
  for (const pid of listeners) {
    if (!keepSet.has(pid) && isPidAlive(pid)) out.add(pid)
  }
  for (const pid of candidates) {
    if (keepSet.has(pid) || !isPidAlive(pid)) continue
    const command = await processCommand(pid)
    if (!isRuntimeServerCommand(command)) continue
    if (listeners.includes(pid) || (Number.isInteger(n) && n > 1 && await processHasRuntimePort(pid, n))) {
      out.add(pid)
    }
  }
  return [...out]
}

async function pidsOnThisHome(pids, dshHome) {
  const home = String(dshHome || '').replace(/\/+$/u, '')
  if (!home) return []
  const out = []
  for (const pid of pids) {
    if (await processHasDshHome(pid, home)) out.push(pid)
  }
  return out
}

export async function collectStrayPids({
  keep = [],
  profileName,
  lanPort,
  runtimePort = FDE_RUNTIME_PORT,
  recordedPids = [],
  dshHome = '',
  onWarn,
} = {}) {
  const keepSet = new Set([...keep, process.pid].filter((pid) => Number.isInteger(pid) && pid > 1))
  const recorded = [...new Set(recordedPids)].filter((pid) => !keepSet.has(pid) && isPidAlive(pid))
  const profileRaw = profileName ? await pidsMatchingProfile(profileName, onWarn) : []
  const lanRaw = await pidsListeningOnPort(lanPort, onWarn)
  const profile = await pidsOnThisHome(profileRaw, dshHome)
  const lan = await pidsOnThisHome(lanRaw, dshHome)
  const bff = await pidsMatchingRuntimeServer({ runtimePort, keep: [...keepSet], onWarn })
  const bffKids = []
  for (const pid of bff) bffKids.push(...await pidsChildrenOf(pid))
  const core = [...new Set([...recorded, ...profile, ...lan])].filter((pid) => !keepSet.has(pid) && isPidAlive(pid))
  const parents = []
  for (const pid of core) {
    const ppid = await parentPid(pid)
    if (!ppid || keepSet.has(ppid) || !isPidAlive(ppid)) continue
    const command = await processCommand(ppid)
    if (!isRuntimeServerCommand(command)) continue
    const samePort = Number(runtimePort) > 1 && await processHasRuntimePort(ppid, runtimePort)
    const sameHome = dshHome && await processHasDshHome(ppid, dshHome)
    if (samePort || sameHome) parents.push(ppid)
  }
  return [...new Set([...core, ...bff, ...bffKids, ...parents])].filter((pid) => !keepSet.has(pid) && isPidAlive(pid))
}

export async function terminatePids(pids) {
  const unique = [...new Set(pids)].filter((pid) => Number.isInteger(pid) && pid > 1 && pid !== process.pid)
  for (const pid of unique) {
    try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
  }
  if (unique.length === 0) return
  await new Promise((resolveWait) => setTimeout(resolveWait, 400))
  for (const pid of unique) {
    try {
      process.kill(pid, 0)
      process.kill(pid, 'SIGKILL')
    } catch { /* gone */ }
  }
}

export async function reclaimStrayRuntime(options = {}) {
  const stray = await collectStrayPids(options)
  if (stray.length === 0) return []
  warnReclaim(`清掉残留核心 ${stray.join(',')}`, options.onWarn)
  await terminatePids(stray)
  return stray
}
