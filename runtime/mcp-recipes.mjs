import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { FDE_RUNTIME_DIR, FDE_RESOURCES } from './config.mjs'
import { cuaDriverDirs, desktopProcessPath } from './desktop-process-path.mjs'

const MAIL_FIELDS = [
  { key: 'IMAP_HOST', label: 'IMAP 主机', secret: false },
  { key: 'IMAP_PORT', label: 'IMAP 端口', secret: false },
  { key: 'IMAP_USER', label: 'IMAP 账号', secret: false },
  { key: 'IMAP_PASS', label: 'IMAP 密码', secret: true },
  { key: 'SMTP_HOST', label: 'SMTP 主机', secret: false },
  { key: 'SMTP_PORT', label: 'SMTP 端口', secret: false },
  { key: 'SMTP_USER', label: 'SMTP 账号', secret: false },
  { key: 'SMTP_PASS', label: 'SMTP 密码', secret: true },
]

function hostNode(env = process.env) {
  const explicit = String(env.FDE_HOST_NODE || '').trim()
  if (explicit && existsSync(explicit)) return explicit
  return process.execPath
}

function findCuaBin(resources, platform = process.platform, arch = process.arch) {
  const names = platform === 'win32' ? ['cua-driver.exe', 'cua-driver.cmd', 'cua-driver'] : ['cua-driver']
  for (const dir of cuaDriverDirs(resources, platform, arch)) {
    for (const name of names) {
      const file = join(dir, name)
      if (existsSync(file)) return file
    }
    try {
      const entries = readdirSync(dir)
      const match = entries.find((name) => /^cua-driver/i.test(name))
      if (match) return join(dir, match)
    } catch {
      /* empty dir */
    }
  }
  return ''
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
} = {}) {
  const node = hostNode(env)
  const mailLauncher = join(runtimeDir, 'mail-mcp-launch.mjs')
  const cuaBin = findCuaBin(resources, platform, arch)
  const npxName = platform === 'win32' ? 'npx.cmd' : 'npx'
  const npxBin = resolveRecipeCommand(npxName, { resources: resources || FDE_RESOURCES, platform, env })
  const npxOk = launcherLoads(npxBin)
  const stdioBridge = join(runtimeDir, 'mcp-stdio-bridge.mjs')
  return [
    {
      id: 'mail',
      title: '邮件',
      hint: '用界面填写 IMAP/SMTP，密码只写进本机 MCP 配置',
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
      hint: npxOk ? '经 FDE stdio 桥接，无窗口握手' : 'npx 启动器无法加载',
      available: npxOk && existsSync(stdioBridge),
      transport: 'stdio',
      serverName: 'playwright',
      command: node,
      args: [stdioBridge, '--', npxName, '-y', '@playwright/mcp', '--headless'],
      fields: [],
    },
    {
      id: 'cua',
      title: 'Computer Use',
      hint: cuaBin ? '使用安装包内的 Cua Driver' : '安装包未随带 Cua Driver',
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
