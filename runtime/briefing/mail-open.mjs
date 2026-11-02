import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { FDE_DSH_HOME } from '../config.mjs'

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function parseMailEnvText(text) {
  const env = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const raw = line.trim()
    if (!raw || raw.startsWith('#') || !raw.includes('=')) continue
    const at = raw.indexOf('=')
    const key = raw.slice(0, at).trim()
    let value = raw.slice(at + 1).trim()
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1)
    }
    if (key) env[key] = value
  }
  return env
}

function providerOf(host, user = '') {
  const h = String(host || '').trim().toLowerCase()
  const domain = String(user || '').split('@')[1]?.toLowerCase() || ''
  if (h.includes('qq.com') || h.includes('foxmail.com') || domain === 'qq.com' || domain.endsWith('.qq.com') || domain === 'foxmail.com') {
    return 'qq'
  }
  if (h.includes('gmail.com') || h.includes('googlemail.com') || domain === 'gmail.com') return 'gmail'
  if (h.includes('outlook') || h.includes('office365') || h.includes('hotmail.com') || h.includes('live.com') || domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
    return 'outlook'
  }
  if (h.includes('163.com') || domain === '163.com') return '163'
  if (h.includes('126.com') || domain === '126.com') return '126'
  if (h.includes('188.com') || domain === '188.com') return '188'
  if (h.includes('sina.com') || domain === 'sina.com' || domain === 'sina.com.cn') return 'sina'
  return domain ? 'generic' : ''
}

export function webmailUrlFromHost(host, user = '') {
  const kind = providerOf(host, user)
  if (kind === 'qq') return 'https://mail.qq.com/'
  if (kind === 'gmail') return 'https://mail.google.com/mail/'
  if (kind === 'outlook') return 'https://outlook.live.com/mail/'
  if (kind === '163') return 'https://mail.163.com/'
  if (kind === '126') return 'https://mail.126.com/'
  if (kind === '188') return 'https://mail.188.com/'
  if (kind === 'sina') return 'https://mail.sina.com.cn/'
  const domain = String(user || '').split('@')[1]?.toLowerCase() || ''
  if (domain) return `https://mail.${domain}/`
  return ''
}

export function readMailEnv(home = FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')) {
  const file = join(home, 'mail.env')
  return parseMailEnvText(readFileSync(file, 'utf8'))
}

export function writeMailEnvFile(env, home = FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')) {
  if (!env || !env.IMAP_HOST || !env.IMAP_USER) return
  const keys = ['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_USER', 'EMAIL_PASS']
  const lines = keys.filter((key) => String(env[key] || '').trim()).map((key) => `${key}=${env[key]}`)
  if (!lines.length) return
  writeFileSync(join(home, 'mail.env'), `${lines.join('\n')}\n`, { mode: 0o600 })
}

export async function openBriefingMail() {
  const env = readMailEnv()
  const url = webmailUrlFromHost(env.IMAP_HOST || env.SMTP_HOST || '', env.EMAIL_USER || env.IMAP_USER || '')
  if (!url) {
    const error = new Error('当前邮箱没有网页入口')
    error.code = 'mail_web_missing'
    throw error
  }
  return { url }
}
