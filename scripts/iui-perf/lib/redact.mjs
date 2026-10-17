const SECRET_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'proxy-authorization',
  'set-cookie',
])

export function redactHeaders(headers) {
  const out = {}
  for (const [name, value] of Object.entries(headers || {})) {
    out[name] = SECRET_HEADERS.has(String(name).toLowerCase()) ? '[redacted]' : value
  }
  return out
}

export function redactText(value) {
  return String(value ?? '')
    .replace(/([?&]token=)[^&\s]+/giu, '$1[redacted]')
    .replace(/(authorization:\s*(?:bearer|token)\s+)[^\s]+/giu, '$1[redacted]')
    .replace(/(cookie:\s*)[^\r\n]+/giu, '$1[redacted]')
    .replace(/(x-api-key:\s*)[^\s]+/giu, '$1[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[redacted]')
}
