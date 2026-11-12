import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { FDE_RUNTIME_DIR, FDE_RESOURCES } from './config.mjs'
import { cuaDriverDirs, desktopProcessPath } from './desktop-process-path.mjs'
import { mailProviderOptions } from './mail-providers.mjs'

const MAIL_FIELDS = [
  { key: 'MAIL_PROVIDER', label: '邮箱厂家', secret: false, options: mailProviderOptions() },
  { key: 'IMAP_USER', label: '邮箱账号', secret: false },
  { key: 'IMAP_PASS', label: '密码或授权码', secret: true },
  { key: 'IMAP_HOST', label: 'IMAP 主机', secret: false },
  { key: 'IMAP_PORT', label: 'IMAP 端口', secret: false },
  { key: 'SMTP_HOST', label: 'SMTP 主机', secret: false },
  { key: 'SMTP_PORT', label: 'SMTP 端口', secret: false },
]

function hostNode(env = process.env) {
  const explicit = String(env.FDE_HOST_NODE || '').trim()
  if (explicit && existsSync(explicit)) return explicit
  return process.execPath
}

export function defaultHostCuaBins(platform = process.platform, env = process.env) {
  const home = String(env.HOME || env.USERPROFILE || '').trim()
  const bins = []
  if (platform === 'darwin') {
    bins.push('/Applications/CuaDriver.app/Contents/MacOS/cua-driver')
    if (home) bins.push(join(home, 'Applications/CuaDriver.app/Contents/MacOS/cua-driver'))
  }
  if (home) {
    bins.push(join(home, '.local', 'bin', 'cua-driver'))
    if (platform === 'win32') bins.push(join(home, 'AppData', 'Local', 'cua-driver', 'cua-driver.exe'))
  }
  return bins
}

function findCuaBin(resources, platform = process.platform, arch = process.arch, {
  env = process.env,
  hostCuaBins,
} = {}) {
  const names = platform === 'win32' ? ['cua-driver.exe', 'cua-driver.cmd', 'cua-driver'] : ['cua-driver']
  for (const dir of cuaDriverDirs(resources, platform, arch)) {
    for (const name of names) {
      const file = join(dir, name)
      if (existsSync(file)) return { bin: file, source: 'envelope' }
    }
    try {
      const entries = readdirSync(dir)
      const match = entries.find((name) => /^cua-driver/i.test(name))
      if (match) return { bin: join(dir, match), source: 'envelope' }
    } catch {
      /* empty dir */
    }
  }
  const hostBins = Array.isArray(hostCuaBins) ? hostCuaBins : defaultHostCuaBins(platform, env)
  for (const file of hostBins) {
    if (file && existsSync(file)) return { bin: file, source: 'host' }
  }
  const fromPath = resolveRecipeCommand(platform === 'win32' ? 'cua-driver.exe' : 'cua-driver', {
    resources,
    platform,
    env,
  })
  if (fromPath) return { bin: fromPath, source: 'host' }
  return { bin: '', source: '' }
}

function resolveRecipeCommand(command, { resources, platform, env }) {
  const raw = String(command || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) return existsSync(raw) ? raw : ''
  const pathEnv = desktopProcessPath({
    resources,
    platform,
    inheritedPath: env.PATH || process.env.PATH || '',
  })
  const sep = platform === 'win32' ? ';' : delimiter
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue
    const candidate = join(dir, raw)
    if (existsSync(candidate)) return candidate
  }
  return ''
}

function launcherLoads(bin, timeoutMs = 4000) {
  const file = String(bin || '')
  if (!file || !existsSync(file)) return false
  const result = spawnSync(file, ['--version'], {
    encoding: 'utf8',
    timeout: timeoutMs,
    env: {
      ...process.env,
      PATH: `${dirname(file)}${delimiter}${process.env.PATH || ''}`,
    },
  })
  if (result.error || result.status !== 0) return false
  return String(result.stdout || '').trim().length > 0
}

export function listMcpRecipes({
  runtimeDir = FDE_RUNTIME_DIR,
  resources = process.env.FDE_RESOURCES || '',
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  hostCuaBins,
} = {}) {
  const node = hostNode(env)
  const mailLauncher = join(runtimeDir, 'mail-mcp-launch.mjs')
  const cuaHit = findCuaBin(resources, platform, arch, { env, hostCuaBins })
  const cuaBin = cuaHit.bin
  const npxName = platform === 'win32' ? 'npx.cmd' : 'npx'
  const npxBin = resolveRecipeCommand(npxName, { resources: resources || FDE_RESOURCES, platform, env })
  const npxOk = launcherLoads(npxBin)
  return [
    {
      id: 'mail',
      title: '邮件',
      hint: '先选厂家，再填账号和密码（或授权码）',
      available: existsSync(mailLauncher),
      transport: 'stdio',
      serverName: 'mail',
      command: node,
      args: [mailLauncher],
      fields: MAIL_FIELDS,
    },
    {
      id: 'playwright',
      title: 'Playwright',
      hint: npxOk ? 'npx @playwright/mcp --headless' : 'npx 启动器无法加载',
      available: npxOk,
      transport: 'stdio',
      serverName: 'playwright',
      command: npxBin || npxName,
      args: ['-y', '@playwright/mcp', '--headless'],
      fields: [],
    },
    {
      id: 'cua',
      title: 'Computer Use',
      hint: cuaHit.source === 'envelope'
        ? '使用安装包内的 Cua Driver'
        : cuaBin
          ? '使用本机已装的 Cua Driver'
          : '安装包未随带 Cua Driver，本机也没有 CuaDriver.app',
      available: Boolean(cuaBin),
      transport: 'stdio',
      serverName: 'cua-driver-mcp',
      command: cuaBin,
      args: ['mcp'],
      fields: [],
    },
    {
      id: 'aihot',
      title: 'AI 热榜',
      hint: '填写你自己的 MCP URL',
      available: true,
      transport: 'streamable-http',
      serverName: 'ai-hot',
      command: '',
      args: [],
      fields: [{ key: 'url', label: 'URL', secret: false }],
    },
  ]
}
