#!/usr/bin/env node
import { spawn } from 'node:child_process'

const host = String(process.env.IMAP_HOST || '').trim()
const user = String(process.env.IMAP_USER || '').trim()
if (!host || !user) {
  process.stderr.write('mail MCP needs IMAP_HOST and IMAP_USER\n')
  process.exit(1)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(npx, ['-y', 'imap-smtp-email-mcp'], {
  stdio: 'inherit',
  env: process.env,
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
