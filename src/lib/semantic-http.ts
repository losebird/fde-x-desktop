type HostBind = { el: HTMLElement; cwd: string }

const hosts: HostBind[] = []
let wrapped = false
let previousFetch: typeof fetch | null = null

function hostCwd(): string {
  for (let i = hosts.length - 1; i >= 0; i -= 1) {
    const { el, cwd } = hosts[i]
    if (!el.isConnected) continue
    if (el.offsetParent === null && el.getClientRects().length === 0) continue
    const live = el.getAttribute('data-cwd') || cwd
    if (live.startsWith('/')) return live
  }
  for (let i = hosts.length - 1; i >= 0; i -= 1) {
    const { el, cwd } = hosts[i]
    if (!el.isConnected) continue
    const live = el.getAttribute('data-cwd') || cwd
    if (live.startsWith('/')) return live
  }
  return ''
}

function withSemanticCwdQuery(url: string, cwd: string) {
  if (!cwd) return url
  try {
    const parsed = new URL(url, window.location.origin)
    if (!parsed.pathname.startsWith('/semantic-os')) return url
    if (!parsed.searchParams.get('cwd')) parsed.searchParams.set('cwd', cwd)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    if (!url.startsWith('/semantic-os')) return url
    if (/[?&]cwd=/.test(url)) return url
    return `${url}${url.includes('?') ? '&' : '?'}cwd=${encodeURIComponent(cwd)}`
  }
}

function rewriteInput(input: RequestInfo | URL, cwd: string): RequestInfo | URL {
  if (!cwd) return input
  if (typeof input === 'string') return withSemanticCwdQuery(input, cwd)
  if (input instanceof URL) return new URL(withSemanticCwdQuery(input.toString(), cwd), window.location.origin)
  if (typeof Request !== 'undefined' && input instanceof Request) {
    const next = withSemanticCwdQuery(input.url, cwd)
    if (next === input.url) return input
    return new Request(next, input)
  }
  return input
}

function ensureWrap() {
  if (wrapped || typeof window === 'undefined') return
  wrapped = true
  previousFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const cwd = hostCwd()
    return previousFetch!(rewriteInput(input, cwd), init)
  }
}

export function installSemanticOsHttp(el: HTMLElement, cwd: string): () => void {
  const bind: HostBind = { el, cwd: cwd.startsWith('/') ? cwd : '' }
  hosts.push(bind)
  ensureWrap()
  return () => {
    const index = hosts.lastIndexOf(bind)
    if (index >= 0) hosts.splice(index, 1)
    if (hosts.length === 0 && wrapped && previousFetch) {
      window.fetch = previousFetch
      wrapped = false
      previousFetch = null
    }
  }
}
