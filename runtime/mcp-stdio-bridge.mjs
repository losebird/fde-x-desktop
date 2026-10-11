#!/usr/bin/env node
/** Host Content-Length stdio ↔ child JSON-line stdio. Recipe args: node this.mjs -- <command> <args...> */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function encodeContentLength(payload) {
  const body = JSON.stringify(payload)
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`
}

export function pullContentLengthFrames(buffer) {
  const messages = []
  let rest = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  while (rest.length) {
    const headerEnd = rest.indexOf('\r\n\r\n')
    if (headerEnd < 0) break
    const header = rest.slice(0, headerEnd).toString('utf8')
    const match = header.match(/Content-Length:\s*(\d+)/iu)
    if (!match) break
    const length = Number(match[1])
    const start = headerEnd + 4
    if (rest.length < start + length) break
    const chunk = rest.slice(start, start + length).toString('utf8')
    rest = rest.slice(start + length)
    try {
      messages.push(JSON.parse(chunk))
    } catch {
      /* skip malformed */
    }
  }
  return { messages, rest }
}

export function pullChildMessages(buffer) {
  let buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const messages = []
  while (buf.length) {
    const asText = buf.toString('utf8')
    if (/^Content-Length:/iu.test(asText.trimStart())) {
      const pulled = pullContentLengthFrames(buf)
      if (!pulled.messages.length && pulled.rest.equals(buf)) break
      messages.push(...pulled.messages)
      buf = Buffer.from(pulled.rest)
      continue
    }
    const nl = buf.indexOf(0x0a)
    if (nl < 0) break
    const line = buf.slice(0, nl).toString('utf8').replace(/\r$/u, '').trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    try {
      messages.push(JSON.parse(line))
    } catch {
      /* skip non-json */
    }
  }
  return { messages, rest: buf }
}

export function parseBridgeArgv(argv) {
  const list = Array.isArray(argv) ? argv.map(String) : []
  const dash = list.indexOf('--')
  const parts = dash >= 0 ? list.slice(dash + 1) : list
  const command = String(parts[0] || '').trim()
  return { command, args: parts.slice(1) }
}

export function startStdioBridge(command, args, {
  stdin = process.stdin,
  stdout = process.stdout,
  stderr = process.stderr,
  env = process.env,
  spawnImpl = spawn,
  exitProcess = true,
} = {}) {
  const child = spawnImpl(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  })
  if (child.stderr && stderr) child.stderr.pipe(stderr)

  let hostBuf = Buffer.alloc(0)
  const onHostData = (chunk) => {
    hostBuf = Buffer.concat([hostBuf, chunk])
    const pulled = pullContentLengthFrames(hostBuf)
    hostBuf = Buffer.from(pulled.rest)
    for (const message of pulled.messages) {
      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.write(`${JSON.stringify(message)}\n`)
      }
    }
  }
  stdin.on('data', onHostData)
  stdin.on('end', () => {
    if (child.stdin && !child.stdin.destroyed) child.stdin.end()
  })
  if (typeof stdin.resume === 'function') stdin.resume()

  let childBuf = Buffer.alloc(0)
  child.stdout.on('data', (chunk) => {
    childBuf = Buffer.concat([childBuf, chunk])
    const pulled = pullChildMessages(childBuf)
    childBuf = Buffer.from(pulled.rest)
    for (const message of pulled.messages) {
      stdout.write(encodeContentLength(message))
    }
  })

  child.on('error', (error) => {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    if (exitProcess) process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    stdin.off('data', onHostData)
    if (!exitProcess) return
    if (signal) process.exit(1)
    process.exit(code ?? 1)
  })
  return child
}

function isMain() {
  const self = fileURLToPath(import.meta.url)
  const invoked = process.argv[1] ? resolve(process.argv[1]) : ''
  return Boolean(invoked) && self === invoked
}

if (isMain()) {
  const { command, args } = parseBridgeArgv(process.argv.slice(2))
  if (!command) {
    process.stderr.write('mcp-stdio-bridge needs: node mcp-stdio-bridge.mjs -- <command> <args...>\n')
    process.exit(1)
  }
  startStdioBridge(command, args)
}
