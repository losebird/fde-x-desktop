#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const preload = join(dirname(fileURLToPath(import.meta.url)), 'mail-tls-sni.cjs')

if (!String(process.env.EMAIL_USER || '').trim() && String(process.env.IMAP_USER || '').trim()) {
  process.env.EMAIL_USER = process.env.IMAP_USER.trim()
}
if (!String(process.env.EMAIL_PASS || '').trim() && String(process.env.IMAP_PASS || '').trim()) {
  process.env.EMAIL_PASS = process.env.IMAP_PASS
}

const host = String(process.env.IMAP_HOST || '').trim()
const user = String(process.env.EMAIL_USER || process.env.IMAP_USER || '').trim()
if (!host || !user) {
  process.stderr.write('mail MCP needs IMAP_HOST and IMAP_USER\n')
  process.exit(1)
}

function withNodeOption(flag) {
  const current = String(process.env.NODE_OPTIONS || '').trim()
  if (current.includes(flag)) return current
  return current ? `${current} ${flag}` : flag
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(npx, ['-y', 'imap-smtp-email-mcp'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: withNodeOption(`--require ${preload}`),
  },
  shell: process.platform === 'win32',
})
child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
child.on('error', (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
