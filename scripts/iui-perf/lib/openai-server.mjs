import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { redactHeaders, redactText } from './redact.mjs'

function chatStaticSse() {
  const first = {
    id: 'chatcmpl-static',
    object: 'chat.completion.chunk',
    model: 'grok-4.6',
    choices: [{ index: 0, delta: { role: 'assistant', content: 'static-intercept' }, finish_reason: null }],
  }
  const stop = {
    id: 'chatcmpl-static',
    object: 'chat.completion.chunk',
    model: 'grok-4.6',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
  }
  return `data: ${JSON.stringify(first)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`
}

function responsesStaticSse() {
  const added = {
    type: 'response.output_item.added',
    output_index: 0,
    item: { type: 'message', id: 'msg_static', role: 'assistant', status: 'in_progress', content: [] },
  }
  const delta = { type: 'response.output_text.delta', output_index: 0, delta: 'static-intercept' }
  const doneItem = {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      type: 'message',
      id: 'msg_static',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'static-intercept' }],
    },
  }
  const completed = {
    type: 'response.completed',
    response: {
      id: 'resp_static',
      status: 'completed',
      output: [doneItem.item],
    },
  }
  return [added, delta, doneItem, completed].map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function usageFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const block = payload.usage
    || (payload.response && payload.response.usage)
    || (payload.message && payload.message.usage)
    || null
  if (!block || typeof block !== 'object') return null
  const details = block.input_tokens_details || block.prompt_tokens_details || {}
  const input = numberOrNull(block.input_tokens ?? block.prompt_tokens)
  const output = numberOrNull(block.output_tokens ?? block.completion_tokens)
  const cacheRead = numberOrNull(details.cached_tokens ?? block.cache_read_input_tokens)
  if (input == null && output == null && cacheRead == null) return null
  return { input, output, cacheRead }
}

export function usageFromSse(text) {
  let found = null
  for (const frame of String(text || '').split('\n\n')) {
    const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
    if (!dataLine) continue
    const raw = dataLine.slice(5).trim()
    if (!raw || raw === '[DONE]') continue
    try {
      const next = usageFromPayload(JSON.parse(raw))
      if (next) found = next
    } catch {
      /* keep the last parsed usage */
    }
  }
  return found
}

function upstreamUrl(base, pathname, search) {
  const root = new URL(base)
  const suffix = pathname.replace(/^\/v1(?=\/|$)/, '') || '/'
  const path = `${root.pathname.replace(/\/$/, '')}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
  return new URL(path + search, root.origin)
}

export async function startOpenAiServer({ dir, forward = false, upstream }) {
  await mkdir(dir, { recursive: true })
  let seq = 0
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/v1/models' || url.pathname === '/models')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        object: 'list',
        data: [{ id: 'grok-4.6', object: 'model' }],
      }))
      return
    }
    if (request.method !== 'POST') {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'not_found' }))
      return
    }
    const received = Date.now()
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
      at: new Date(received).toISOString(),
      method: request.method,
      path: url.pathname,
      headers: redactHeaders(request.headers),
      body,
    }
    await writeFile(join(dir, `request-${id}.json`), `${JSON.stringify(record)}\n`)
    const responsesApi = url.pathname.endsWith('/responses')
    if (!forward) {
      const payload = responsesApi ? responsesStaticSse() : chatStaticSse()
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      })
      response.end(payload)
      const totalMs = Date.now() - received
      await writeFile(join(dir, `meta-${id}.json`), `${JSON.stringify({
        id,
        path: url.pathname,
        synthetic: true,
        firstByteMs: totalMs,
        totalMs,
        usage: null,
      })}\n`)
      return
    }
    const target = upstreamUrl(upstream, url.pathname, url.search)
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
      await writeFile(join(dir, `meta-${id}.json`), `${JSON.stringify({
        id,
        path: url.pathname,
        synthetic: false,
        error: message,
        firstByteMs: null,
        totalMs: Date.now() - received,
        usage: null,
      })}\n`)
      return
    }
    const outHeaders = {}
    upstreamResponse.headers.forEach((value, name) => {
      if (name === 'content-encoding' || name === 'transfer-encoding' || name === 'content-length') return
      if (name.toLowerCase() === 'set-cookie') return
      outHeaders[name] = value
    })
    response.writeHead(upstreamResponse.status, outHeaders)
    const reader = upstreamResponse.body?.getReader()
    const chunks = []
    let firstByteMs = null
    if (reader) {
      while (true) {
        const step = await reader.read()
        if (step.done) break
        if (firstByteMs == null) firstByteMs = Date.now() - received
        chunks.push(Buffer.from(step.value))
        response.write(step.value)
      }
    }
    response.end()
    const sse = Buffer.concat(chunks).toString('utf8')
    await writeFile(join(dir, `response-${id}.sse`), redactText(sse))
    await writeFile(join(dir, `meta-${id}.json`), `${JSON.stringify({
      id,
      path: url.pathname,
      synthetic: false,
      status: upstreamResponse.status,
      firstByteMs,
      totalMs: Date.now() - received,
      usage: usageFromSse(sse),
    })}\n`)
  })
  server.unref()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    server,
    port,
    origin: `http://127.0.0.1:${port}`,
    close() {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      server.close()
      server.unref()
    },
  }
}
