import assert from 'node:assert/strict'
import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  encodeContentLength,
  parseBridgeArgv,
  pullChildMessages,
  pullContentLengthFrames,
} from '../mcp-stdio-bridge.mjs'
import { checkMcpHealth } from '../routes/mcp.mjs'

test('parseBridgeArgv reads command after --', () => {
  assert.deepEqual(parseBridgeArgv(['--', 'npx', '-y', 'pkg']), { command: 'npx', args: ['-y', 'pkg'] })
})

test('pullContentLengthFrames reads Host frames', () => {
  const payload = { jsonrpc: '2.0', id: 1, method: 'initialize' }
  const { messages, rest } = pullContentLengthFrames(Buffer.from(encodeContentLength(payload)))
  assert.equal(messages.length, 1)
  assert.equal(messages[0].method, 'initialize')
  assert.equal(rest.length, 0)
})

test('pullChildMessages reads JSON lines', () => {
  const { messages } = pullChildMessages(Buffer.from('{"jsonrpc":"2.0","id":1,"result":{}}\n'))
  assert.equal(messages[0].id, 1)
  assert.ok(messages[0].result)
})

test('stdio bridge turns Host Content-Length into JSONL and back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-bridge-'))
  const fake = join(dir, 'jsonl-mcp')
  await writeFile(fake, `#!/usr/bin/env node
let buf = ''
process.stdin.on('data', (chunk) => {
  buf += chunk
  const lines = buf.split('\\n')
  buf = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    const msg = JSON.parse(line)
    if (msg.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake', version: '0' } },
      }) + '\\n')
    }
  }
})
`)
  await chmod(fake, 0o755)
  const bridge = fileURLToPath(new URL('../mcp-stdio-bridge.mjs', import.meta.url))
  const health = await checkMcpHealth({
    transport: 'stdio',
    command: process.execPath,
    args: [bridge, '--', process.execPath, fake],
  })
  assert.equal(health.ok, true)
  assert.match(health.message, /MCP 可达/)
})
