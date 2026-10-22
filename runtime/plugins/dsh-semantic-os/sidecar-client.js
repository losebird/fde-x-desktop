import { request as httpRequest } from 'node:http'

export const DEFAULT_SIDECAR_TIMEOUT_MS = 60_000
export const DEFAULT_SIDECAR_MAX_BYTES = 16 * 1024 * 1024

export function requestSidecar(sidecar, options = {}) {
  const snap = sidecar.snapshot()
  if (!snap.ready || !snap.port) return Promise.resolve({ error: 'NOT_READY', reason: snap.reason || 'not_ready' })
  const method = String(options.method || 'POST').toUpperCase()
  const payload = options.body == null
    ? ''
    : typeof options.body === 'string' || Buffer.isBuffer(options.body)
      ? options.body
      : JSON.stringify(options.body)
  const timeoutMs = positive(options.timeoutMs, DEFAULT_SIDECAR_TIMEOUT_MS)
  const maxBytes = positive(options.maxBytes, DEFAULT_SIDECAR_MAX_BYTES)

  return new Promise((resolve) => {
    let settled = false
    let timer = null
    let req = null
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (options.signal) options.signal.removeEventListener('abort', onAbort)
      fn(value)
    }
    const fail = (code, detail, status) => finish(resolve, { error: code, detail: String(detail || ''), ...(status ? { status } : {}) })
    const onAbort = () => {
      if (req) req.destroy()
      fail('ABORTED', 'request aborted')
    }
    try {
      req = httpRequest({
        host: '127.0.0.1',
        port: snap.port,
        path: options.path || '/_dsh/python',
        method,
        headers: {
          ...(payload ? { 'content-type': options.contentType || 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...(sidecar.getApiKey() ? { 'x-api-key': sidecar.getApiKey() } : {}),
          ...(safeCwdHeader(options.cwd) ? { 'x-dsh-cwd': safeCwdHeader(options.cwd) } : {}),
          ...latin1Headers(options.headers),
        },
      }, (res) => {
        const chunks = []
        let size = 0
        res.on('data', (chunk) => {
          size += chunk.length
          if (size > maxBytes) {
            req.destroy()
            fail('SIDECAR_RESPONSE_TOO_LARGE', `response exceeded ${maxBytes} bytes`, res.statusCode)
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          if (settled) return
          const text = Buffer.concat(chunks).toString('utf8')
          let body
          try { body = text ? JSON.parse(text) : {} } catch {
            fail('BAD_PYTHON_RESPONSE', text.slice(0, 500), res.statusCode)
            return
          }
          if ((res.statusCode || 500) >= 400 && !(body && body.error)) {
            fail('SIDECAR_HTTP_ERROR', text.slice(0, 500), res.statusCode)
            return
          }
          finish(resolve, body)
        })
      })
    } catch (error) {
      fail('SIDECAR_BAD_REQUEST', error && error.message)
      return
    }
    timer = setTimeout(() => {
      req.destroy()
      fail('SIDECAR_TIMEOUT', `sidecar did not respond in ${timeoutMs}ms`)
    }, timeoutMs)
    req.on('error', (error) => {
      if (!settled) fail('SIDECAR_UNREACHABLE', error.message)
    })
    if (options.signal) {
      if (options.signal.aborted) {
        onAbort()
        return
      }
      options.signal.addEventListener('abort', onAbort, { once: true })
    }
    if (payload) req.end(payload)
    else req.end()
  })
}

export function postPython(sidecar, payload, options = {}) {
  return requestSidecar(sidecar, {
    method: 'POST',
    path: '/_dsh/python',
    body: payload,
    cwd: payload && payload.cwd,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes,
  })
}

function isLatin1Header(value) {
  const text = String(value || '')
  if (!text) return false
  // Node OutgoingMessage rejects CR/LF/TAB and any code point > 255.
  return !/[\r\n\t\u0100-\uFFFF]/.test(text)
}

function safeCwdHeader(cwd) {
  const text = String(cwd || '')
  return isLatin1Header(text) ? text : ''
}

function latin1Headers(headers) {
  if (!headers || typeof headers !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!isLatin1Header(key) || value == null) continue
    const text = String(value)
    if (!isLatin1Header(text)) continue
    out[key] = text
  }
  return out
}

function positive(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}
