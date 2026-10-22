import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function windowsToolDirs(env = process.env) {
  return [
    join(env.APPDATA || '', 'npm'),
    join(env.LOCALAPPDATA || '', 'pnpm'),
    join(env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
    join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs'),
  ].filter((dir) => Boolean(dir && !/^[\\/]*$/.test(dir)))
}

export function firstExisting(paths) {
  return (paths || []).find((path) => path && existsSync(path)) || ''
}

export function resolveOnPath(name, platform = process.platform) {
  const probe = platform === 'win32' ? ['where.exe', name] : ['sh', '-c', 'command -v ' + name]
  const result = spawnSync(probe[0], probe.slice(1), { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return ''
  return String(result.stdout || '').split(/\r?\n/).map((line) => line.trim()).find((line) => line && existsSync(line)) || ''
}

export function resolveWindowsTool(names, options = {}) {
  const env = options.env || process.env
  const platform = options.platform || process.platform
  if (platform !== 'win32') return resolveOnPath(names[0], platform)
  if (process.platform === 'win32') {
    for (const name of names) {
      const hit = resolveOnPath(name, platform)
      if (hit) return hit
    }
  }
  const candidates = []
  for (const dir of windowsToolDirs(env)) {
    for (const name of names) candidates.push(join(dir, name))
  }
  return firstExisting(candidates)
}
