import { existsSync } from 'node:fs'
import { delimiter as pathDelimiter, dirname, join, win32 as pathWin32 } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mcpNpxBinDir } from './mcp-npx.mjs'

const runtimeDir = dirname(fileURLToPath(import.meta.url))

export function cuaDriverDirs(resources, platform = process.platform, arch = process.arch) {
  const root = String(resources || '')
  if (!root) return []
  const key = `${platform}-${arch}`
  const candidates = [
    join(root, 'cua-driver', key, 'bin'),
    join(root, 'cua-driver', key),
    join(root, 'cua-driver', 'bin'),
  ]
  return candidates.filter((dir) => existsSync(dir))
}

/** Login-shell bins a Dock/Start-menu Electron process often drops. */
export function osDefaultPathDirs(platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    const systemRoot = env.SystemRoot || 'C:\\Windows'
    const local = env.LOCALAPPDATA
    const programs = env.ProgramFiles
    return [
      pathWin32.join(systemRoot, 'System32'),
      pathWin32.join(systemRoot, 'System32', 'Wbem'),
      local ? pathWin32.join(local, 'npm') : '',
      programs ? pathWin32.join(programs, 'nodejs') : '',
    ].filter(Boolean)
  }
  return ['/usr/bin', '/bin', '/usr/sbin', '/sbin', '/opt/homebrew/bin', '/usr/local/bin']
}

function nodeAndDshDirs(resources, platform) {
  const root = String(resources || '')
  if (!root) return []
  if (platform === 'win32') {
    return [join(root, 'node'), join(root, 'node', 'bin'), join(root, 'dsh', 'bin')]
  }
  return [join(root, 'node', 'bin'), join(root, 'node'), join(root, 'dsh', 'bin')]
}

export function desktopProcessPath({
  resources = '',
  platform = process.platform,
  arch = process.arch,
  inheritedPath = '',
  extraDirs = [],
} = {}) {
  const sep = platform === 'win32' ? ';' : pathDelimiter
  const dirs = []
  const seen = new Set()
  const push = (dir) => {
    const text = String(dir || '').trim()
    if (!text || seen.has(text) || !existsSync(text)) return
    seen.add(text)
    dirs.push(text)
  }
  push(mcpNpxBinDir(runtimeDir))
  for (const dir of nodeAndDshDirs(resources, platform)) push(dir)
  for (const dir of extraDirs) push(dir)
  for (const dir of cuaDriverDirs(resources, platform, arch)) push(dir)
  for (const dir of osDefaultPathDirs(platform)) push(dir)
  for (const dir of String(inheritedPath || '').split(sep)) push(dir)
  return dirs.join(sep)
}
