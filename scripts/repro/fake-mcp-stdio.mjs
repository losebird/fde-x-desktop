import { stdin, stdout } from 'node:process'

const serverName = process.argv[2] === 'ai-hot' ? 'ai-hot' : 'mail'
const toolName = serverName === 'ai-hot' ? 'aihot_get_latest' : 'imap_search'
const sampleText = serverName === 'ai-hot' ? 'fake-news-item' : 'fake-mail-item'

let buffer = Buffer.alloc(0)

function writeMessage(message) {
  stdout.write(`${JSON.stringify(message)}\n`)
}

function reply(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result })
}

function handleMessage(message) {
  if (!message || typeof message !== 'object') return
  if (message.id == null) return
  if (message.method === 'initialize') {
    reply(message.id, {
      protocolVersion: message.params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: serverName, version: '0.0.0' },
    })
    return
  }
  if (message.method === 'tools/list') {
    reply(message.id, {
      tools: [{
        name: toolName,
        description: 'Fake briefing tool. No mailbox and no network.',
        inputSchema: { type: 'object', properties: {} },
      }],
    })
    return
  }
  if (message.method === 'tools/call') {
    reply(message.id, {
      content: [{ type: 'text', text: sampleText }],
      isError: false,
    })
    return
  }
  reply(message.id, {})
}

function drain() {
  while (buffer.length) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    const lineEnd = buffer.indexOf('\n')
    if (headerEnd >= 0 && (lineEnd < 0 || headerEnd <= lineEnd)) {
      const header = buffer.slice(0, headerEnd).toString('utf8')
      const match = /Content-Length:\s*(\d+)/i.exec(header)
      if (!match) {
        buffer = buffer.slice(headerEnd + 4)
        continue
      }
      const length = Number(match[1])
      const start = headerEnd + 4
      if (buffer.length < start + length) return
      const body = buffer.slice(start, start + length).toString('utf8')
      buffer = buffer.slice(start + length)
      handleMessage(JSON.parse(body))
      continue
    }
    if (lineEnd < 0) return
    const line = buffer.slice(0, lineEnd).toString('utf8').trim()
    buffer = buffer.slice(lineEnd + 1)
    if (!line) continue
    handleMessage(JSON.parse(line))
  }
}

stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  drain()
})
