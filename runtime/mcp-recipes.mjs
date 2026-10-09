import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FDE_RUNTIME_DIR } from './config.mjs'
import { cuaDriverDirs } from './desktop-process-path.mjs'

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
      hint: '用安装包自带的 npx 启动',
      available: true,
      transport: 'stdio',
      serverName: 'playwright',
      command: platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['-y', '@playwright/mcp'],
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
