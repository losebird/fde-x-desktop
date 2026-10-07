type HostBind = { el: HTMLElement; cwd: string }
type FetchFn = typeof fetch

const GRAPH_UPDATES_PATH = '/ws/graph-updates'
const SEMANTIC_GRAPH_UPDATES_PATH = '/semantic-os/ws/graph-updates'

const hosts: HostBind[] = []
let wrapped = false
let previousFetch: FetchFn | null = null
let fetchWrap: (FetchFn & { __fdeSemanticHttp?: boolean }) | null = null
let previousWebSocket: typeof WebSocket | null = null
let socketWrap: typeof WebSocket | null = null

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

export function rewriteGraphUpdatesUrl(url: string | URL, cwd = ''): string | URL {
  const raw = typeof url === 'string' ? url : url.toString()
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1')
    if (parsed.pathname !== GRAPH_UPDATES_PATH) return url
    parsed.pathname = SEMANTIC_GRAPH_UPDATES_PATH
    const live = cwd || hostCwd()
    if (live.startsWith('/') && !parsed.searchParams.get('cwd')) parsed.searchParams.set('cwd', live)
    return typeof url === 'string' ? parsed.toString() : parsed
  } catch {
    return url
  }
}

function wrapWebSocket(NativeWS: typeof WebSocket): typeof WebSocket {
  const Wrapped = function (this: WebSocket, url: string | URL, protocols?: string | string[]) {
    return Reflect.construct(NativeWS, [rewriteGraphUpdatesUrl(url), protocols])
  } as unknown as typeof WebSocket
  Wrapped.prototype = NativeWS.prototype
  Object.setPrototypeOf(Wrapped, NativeWS)
  return Wrapped
}

function ensureWrap() {
  if (wrapped || typeof window === 'undefined') return
  wrapped = true
  const upstream = window.fetch.bind(window)
  previousFetch = upstream
  const nextFetch: FetchFn & { __fdeSemanticHttp?: boolean } = (input: RequestInfo | URL, init?: RequestInit) => {
    return upstream(rewriteInput(input, hostCwd()), init)
  }
  nextFetch.__fdeSemanticHttp = true
  fetchWrap = nextFetch
  window.fetch = nextFetch
  previousWebSocket = window.WebSocket
  socketWrap = wrapWebSocket(window.WebSocket)
  window.WebSocket = socketWrap
}

function unwrap() {
  if (!wrapped) return
  if (fetchWrap && window.fetch === fetchWrap && previousFetch) window.fetch = previousFetch
  if (socketWrap && window.WebSocket === socketWrap && previousWebSocket) window.WebSocket = previousWebSocket
  wrapped = false
  previousFetch = null
  fetchWrap = null
  previousWebSocket = null
  socketWrap = null
}

export function installSemanticOsHttp(el: HTMLElement, cwd: string): () => void {
  const bind: HostBind = { el, cwd: cwd.startsWith('/') ? cwd : '' }
  hosts.push(bind)
  ensureWrap()
  return () => {
    const index = hosts.lastIndexOf(bind)
    if (index >= 0) hosts.splice(index, 1)
    if (hosts.length === 0) unwrap()
  }
}
