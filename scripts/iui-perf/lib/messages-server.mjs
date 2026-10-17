import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { redactHeaders, redactText } from './redact.mjs'

function sseFrame(name, data) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
}

export function staticSseBody() {
  return [
    sseFrame('message_start', {
      type: 'message_start',
      message: {
        id: 'msg_static',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'deepseek-flash',
        stop_reason: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      },
    }),
    sseFrame('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }),
    sseFrame('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'static-intercept' },
    }),
    sseFrame('content_block_stop', { type: 'content_block_stop', index: 0 }),
    sseFrame('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 1 },
    }),
    sseFrame('message_stop', { type: 'message_stop' }),
  ].join('')
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

export async function startMessagesServer({ dir, forward = false, upstream = 'https://api.deepseek.com/anthropic' }) {
  await mkdir(dir, { recursive: true })
  let seq = 0
  const saved = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/v1/models')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
      return
    }
    if (request.method !== 'POST') {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'not_found' }))
      return
    }
    const raw = await readBody(request)
    let body = null
    const text = redactText(raw.toString('utf8'))
    try {
      body = JSON.parse(text)
    } catch {
      body = { _unparsed: true, bytes: raw.length }
    }
    const id = String(++seq).padStart(3, '0')
    const record = {
      id,
      at: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      headers: redactHeaders(request.headers),
      body,
    }
    const file = join(dir, `request-${id}.json`)
    await writeFile(file, `${JSON.stringify(record)}\n`)
    saved.push({ id, file, path: url.pathname })
    if (!forward) {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      })
      response.end(staticSseBody())
      return
    }
    const target = new URL(url.pathname + url.search, upstream.endsWith('/') ? upstream : `${upstream}/`)
    const headers = { ...request.headers, host: target.host }
    delete headers['content-length']
    let upstreamResponse
    try {
      upstreamResponse = await fetch(target, {
        method: 'POST',
        headers,
        body: raw,
        redirect: 'manual',
      })
    } catch (error) {
      const message = redactText(error instanceof Error ? error.message : String(error))
      response.writeHead(502, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'upstream_failed', message }))
      return
    }
    const outHeaders = {}
    upstreamResponse.headers.forEach((value, name) => {
      if (name === 'content-encoding' || name === 'transfer-encoding' || name === 'content-length') return
      outHeaders[name] = value
    })
    response.writeHead(upstreamResponse.status, outHeaders)
    const reader = upstreamResponse.body?.getReader()
    const chunks = []
    if (!reader) {
      response.end()
      return
    }
    while (true) {
      const step = await reader.read()
      if (step.done) break
      chunks.push(Buffer.from(step.value))
      response.write(step.value)
    }
    response.end()
    const responseFile = join(dir, `response-${id}.sse`)
    await writeFile(responseFile, Buffer.concat(chunks))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    server,
    port,
    origin: `http://127.0.0.1:${port}`,
    saved: () => saved.slice(),
  }
}
