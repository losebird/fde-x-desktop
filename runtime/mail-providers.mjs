export const MAIL_PROVIDERS = [
  { id: 'qq', label: 'QQ 邮箱', imapHost: 'imap.qq.com', imapPort: '993', smtpHost: 'smtp.qq.com', smtpPort: '465', hint: '密码请填 QQ 邮箱授权码' },
  { id: 'foxmail', label: 'Foxmail', imapHost: 'imap.qq.com', imapPort: '993', smtpHost: 'smtp.qq.com', smtpPort: '465', hint: '密码请填授权码' },
  { id: 'gmail', label: 'Gmail', imapHost: 'imap.gmail.com', imapPort: '993', smtpHost: 'smtp.gmail.com', smtpPort: '465', hint: '请使用 Google 应用专用密码' },
  { id: 'outlook', label: 'Outlook', imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587', hint: '可用账户密码或应用密码' },
  { id: '163', label: '网易 163', imapHost: 'imap.163.com', imapPort: '993', smtpHost: 'smtp.163.com', smtpPort: '465', hint: '密码请填客户端授权码' },
  { id: '126', label: '网易 126', imapHost: 'imap.126.com', imapPort: '993', smtpHost: 'smtp.126.com', smtpPort: '465', hint: '密码请填客户端授权码' },
  { id: 'custom', label: '其他 IMAP', imapHost: '', imapPort: '993', smtpHost: '', smtpPort: '465', hint: '填写 IMAP/SMTP 主机' },
]

export function mailProviderById(id) {
  const key = String(id || '').trim().toLowerCase()
  return MAIL_PROVIDERS.find((row) => row.id === key) || null
}

export function mailProviderOptions() {
  return MAIL_PROVIDERS.map((row) => ({ value: row.id, label: row.label }))
}

export function isMailMcpServerName(serverName) {
  const name = String(serverName || '').trim()
  return name === 'mail' || name.startsWith('mail-')
}

export function isMailProbeEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (isMailMcpServerName(entry.serverName)) return true
  const env = entry.env && typeof entry.env === 'object' ? entry.env : {}
  return Boolean(String(env.IMAP_HOST || '').trim())
}

export function mailImapErrorText(raw) {
  const text = String(raw || '').trim()
  let inner = text
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') inner = parsed.error
  } catch {
    /* keep */
  }
  if (/self-signed certificate|unable to verify the first certificate|UNABLE_TO_GET_ISSUER|DEPTH_ZERO_SELF_SIGNED|CERT_HAS_EXPIRED|use-system-ca/i.test(inner)) {
    return '邮箱安全连接失败（证书）'
  }
  if (/invalid credentials|authentication failed|auth.*fail/i.test(inner)) {
    return '邮箱账号或授权码无效'
  }
  return ''
}

export function isMailMcpRow(row) {
  if (!row) return false
  if (isMailMcpServerName(row.serverName || row.server)) return true
  const tools = Array.isArray(row.tools) ? row.tools : []
  return tools.some((tool) => /imap_search|imap_/i.test(String(tool)))
}

export function mailToolOf(row, fallback = 'imap_search') {
  const tools = Array.isArray(row?.tools) ? row.tools.map(String) : []
  const hit = tools.find((tool) => /imap_search/i.test(tool)) || tools.find((tool) => /imap_/i.test(tool))
  if (!hit) return fallback
  return hit.replace(/^mcp__[^_]+__/, '')
}

export function nextMailServerName(existing) {
  const taken = new Set((Array.isArray(existing) ? existing : []).map((name) => String(name || '').trim()))
  if (!taken.has('mail')) return 'mail'
  let n = 2
  while (taken.has(`mail-${n}`)) n += 1
  return `mail-${n}`
}

export function mailEnvFromProvider(providerId, user, pass, extra = {}) {
  const provider = mailProviderById(providerId) || mailProviderById('custom')
  const account = String(user || '').trim()
  const secret = String(pass || '').trim()
  const host = String(extra.IMAP_HOST || provider.imapHost || '').trim()
  const smtpHost = String(extra.SMTP_HOST || provider.smtpHost || '').trim()
  const imapPort = String(extra.IMAP_PORT || provider.imapPort || '993').trim()
  const smtpPort = String(extra.SMTP_PORT || provider.smtpPort || '465').trim()
  const env = {}
  if (host) env.IMAP_HOST = host
  if (imapPort) env.IMAP_PORT = imapPort
  if (account) {
    env.IMAP_USER = account
    env.SMTP_USER = account
    env.EMAIL_USER = account
  }
  if (secret) {
    env.IMAP_PASS = secret
    env.SMTP_PASS = secret
    env.EMAIL_PASS = secret
  }
  if (smtpHost) env.SMTP_HOST = smtpHost
  if (smtpPort) env.SMTP_PORT = smtpPort
  return env
}

export function applyMailProviderToEnv(env = {}, fieldValues = {}) {
  const merged = { ...env, ...fieldValues }
  const providerId = String(merged.MAIL_PROVIDER || '').trim()
  if (!providerId) {
    const { MAIL_PROVIDER: _drop, ...rest } = merged
    return rest
  }
  const filled = mailEnvFromProvider(providerId, merged.IMAP_USER, merged.IMAP_PASS, merged)
  const { MAIL_PROVIDER: _drop, ...rest } = { ...merged, ...filled }
  return rest
}
