import { existsSync } from 'node:fs'
import { delimiter as pathDelimiter, join } from 'node:path'

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

function wellKnownDirs(platform) {
  if (platform === 'win32') {
    const local = process.env.LOCALAPPDATA
    const programs = process.env.ProgramFiles
    return [
      local ? join(local, 'npm') : '',
      programs ? join(programs, 'nodejs') : '',
    ].filter(Boolean)
  }
  return ['/opt/homebrew/bin', '/usr/local/bin']
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
  for (const dir of nodeAndDshDirs(resources, platform)) push(dir)
  for (const dir of extraDirs) push(dir)
  for (const dir of cuaDriverDirs(resources, platform, arch)) push(dir)
  for (const dir of wellKnownDirs(platform)) push(dir)
  for (const dir of String(inheritedPath || '').split(sep)) push(dir)
  return dirs.join(sep)
}
