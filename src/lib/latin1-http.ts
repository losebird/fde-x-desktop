function isLatin1(value: string) {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 255) return false
  }
  return true
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

function sanitize(input: RequestInfo | URL, init: RequestInit | undefined): [RequestInfo | URL, RequestInit] {
  const nextInit: RequestInit = init ? { ...init } : {}
  if (nextInit.headers) nextInit.headers = safeHeaderMap(nextInit.headers)
  return [input, nextInit]
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
    const [nextInput, nextInit] = sanitize(input, init)
    try {
      return previousFetch(nextInput, nextInit)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (!text.includes('ISO-8859-1') && !text.includes('code point')) throw error
      return previousFetch(nextInput, {
        method: nextInit.method,
        body: nextInit.body,
        headers: { 'content-type': 'application/json' },
      })
    }
  }
}
