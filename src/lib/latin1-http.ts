function isLatin1(value: string) {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 255) return false
  }
  return true
}

function pageCwd() {
  if (typeof document === 'undefined') return ''
  const nodes = document.querySelectorAll('.dsos-root')
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i]
    if (!(el instanceof HTMLElement)) continue
    if (el.offsetParent === null && el.getClientRects().length === 0) continue
    const cwd = el.getAttribute('data-cwd') || ''
    if (cwd.startsWith('/')) return cwd
  }
  return ''
}

function safeHeaderMap(raw: HeadersInit | undefined) {
  const out: Record<string, string> = {}
  if (!raw) return out
  try {
    const pairs = raw instanceof Headers
      ? [...raw.entries()]
      : Array.isArray(raw)
        ? raw
        : Object.entries(raw)
    for (const [key, value] of pairs) {
      const text = String(value)
      if (isLatin1(text)) out[String(key)] = text
    }
  } catch {
    return out
  }
  return out
}

function withCwdQuery(url: string, cwd: string) {
  if (!cwd || /[?&]cwd=/.test(url)) return url
  try {
    const parsed = new URL(url, window.location.origin)
    if (!parsed.pathname.startsWith('/semantic-os') && !parsed.pathname.startsWith('/api/')) return url
    if (!parsed.searchParams.get('cwd')) parsed.searchParams.set('cwd', cwd)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    if (!url.startsWith('/semantic-os') && !url.startsWith('/api/')) return url
    return `${url}${url.includes('?') ? '&' : '?'}cwd=${encodeURIComponent(cwd)}`
  }
}

function withCwdBody(body: BodyInit | null | undefined, cwd: string) {
  if (!cwd || typeof body !== 'string' || !body.trim().startsWith('{')) return body
  try {
    const json = JSON.parse(body) as Record<string, unknown>
    if (json && typeof json === 'object' && !Array.isArray(json) && json.cwd == null) {
      json.cwd = cwd
      return JSON.stringify(json)
    }
  } catch {
    return body
  }
  return body
}

function sanitize(input: RequestInfo | URL, init: RequestInit | undefined, cwd: string): [RequestInfo | URL, RequestInit] {
  const nextInit: RequestInit = init ? { ...init } : {}
  if (nextInit.headers) nextInit.headers = safeHeaderMap(nextInit.headers)
  nextInit.body = withCwdBody(nextInit.body, cwd) as BodyInit | undefined
  let nextInput: RequestInfo | URL = input
  if (typeof input === 'string') nextInput = withCwdQuery(input, cwd)
  else if (input instanceof URL) nextInput = new URL(withCwdQuery(input.toString(), cwd), window.location.origin)
  return [nextInput, nextInit]
}

export function installLatin1Http() {
  if (typeof window === 'undefined' || (window as Window & { __fdeLatin1Http?: boolean }).__fdeLatin1Http) return
  ;(window as Window & { __fdeLatin1Http?: boolean }).__fdeLatin1Http = true

  const NativeHeaders = window.Headers
  const origSet = NativeHeaders.prototype.set
  const origAppend = NativeHeaders.prototype.append
  NativeHeaders.prototype.set = function (name: string, value: string) {
    if (!isLatin1(String(value))) return
    return origSet.call(this, name, value)
  }
  NativeHeaders.prototype.append = function (name: string, value: string) {
    if (!isLatin1(String(value))) return
    return origAppend.call(this, name, value)
  }
  const SafeHeaders = function (this: Headers, init?: HeadersInit) {
    return Reflect.construct(NativeHeaders, [safeHeaderMap(init)])
  } as unknown as typeof Headers
  SafeHeaders.prototype = NativeHeaders.prototype
  Object.setPrototypeOf(SafeHeaders, NativeHeaders)
  window.Headers = SafeHeaders

  const previousFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const cwd = pageCwd()
    const [nextInput, nextInit] = sanitize(input, init, cwd)
    try {
      return previousFetch(nextInput, nextInit)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (!text.includes('ISO-8859-1') && !text.includes('code point')) throw error
      return previousFetch(
        typeof nextInput === 'string' ? withCwdQuery(nextInput, cwd) : nextInput,
        { method: nextInit.method, body: nextInit.body, headers: { 'content-type': 'application/json' } },
      )
    }
  }
}
