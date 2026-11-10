import { canonicalWorkspaceCwd } from '../../runtime/cwd.mjs'

type HostBind = { el: HTMLElement; cwd: string }
type FetchFn = typeof fetch

const GRAPH_UPDATES_PATH = '/ws/graph-updates'
const SEMANTIC_GRAPH_UPDATES_PATH = '/semantic-os/ws/graph-updates'
const EXPLORER_API_ROOTS = [
  'graph', 'temporal', 'enrich', 'provenance', 'reason', 'decisions',
  'import', 'export', 'sparql', 'ontology', 'vocabulary', 'analytics',
  'annotations', 'coverage',
]

function isExplorerApiPath(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false
  const rest = pathname.slice('/api/'.length)
  if (!rest) return false
  return EXPLORER_API_ROOTS.some((root) => rest === root || rest.startsWith(`${root}/`))
}

function rewriteExplorerApi(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin)
    if (isExplorerApiPath(parsed.pathname)) {
      parsed.pathname = `/semantic-os${parsed.pathname}`
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    /* keep */
  }
  const path = url.split('?')[0]
  if (isExplorerApiPath(path) && url.startsWith('/api/')) return `/semantic-os${url}`
  return url
}

const hosts: HostBind[] = []
let wrapped = false
let previousFetch: FetchFn | null = null
let fetchWrap: (FetchFn & { __fdeSemanticHttp?: boolean }) | null = null
let previousWebSocket: typeof WebSocket | null = null
let socketWrap: typeof WebSocket | null = null

function hostCwd(): string {
  // Floating Memory is position:fixed (offsetParent=null). Skipping those hosts
  // made the first /api/graph/nodes fetch miss cwd → 404 and explore stuck PREPARE.
  for (let i = hosts.length - 1; i >= 0; i -= 1) {
    const { el, cwd } = hosts[i]
    if (!el.isConnected) continue
    const live = el.getAttribute('data-cwd') || cwd
    const absolute = canonicalWorkspaceCwd(live)
    if (absolute) return absolute
  }
  if (typeof document !== 'undefined') {
    const el = document.querySelector('[data-cwd]')
    const live = el?.getAttribute('data-cwd') || ''
    const absolute = canonicalWorkspaceCwd(live)
    if (absolute) return absolute
  }
  return ''
}

function withSemanticCwdQuery(url: string, cwd: string) {
  const rewritten = rewriteExplorerApi(url)
  if (!cwd) return rewritten
  try {
    const parsed = new URL(rewritten, window.location.origin)
    if (!parsed.pathname.startsWith('/semantic-os')) return rewritten
    if (!parsed.searchParams.get('cwd')) parsed.searchParams.set('cwd', cwd)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    if (!rewritten.startsWith('/semantic-os')) return rewritten
    if (/[?&]cwd=/.test(rewritten)) return rewritten
    return `${rewritten}${rewritten.includes('?') ? '&' : '?'}cwd=${encodeURIComponent(cwd)}`
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

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return String(input)
}

function isGraphLoadPath(url: string): boolean {
  try {
    const path = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1').pathname
    return /\/api\/graph\/(nodes|edges)\/?$/.test(path)
  } catch {
    return /\/api\/graph\/(nodes|edges)(?:\?|$)/.test(url)
  }
}

export async function fetchWithGraphRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  upstream: FetchFn,
): Promise<Response> {
  const method = String(init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method !== 'GET' || !isGraphLoadPath(requestUrl(input))) {
    const rewritten = rewriteInput(input, hostCwd())
    const stamped = await stampCanvasMergeFetch(rewritten, init)
    return upstream(stamped.input, stamped.init)
  }
  let last: Response | null = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rewritten = rewriteInput(input, hostCwd())
    last = await upstream(rewritten, init)
    if (last.ok) return last
    const retryable = last.status === 503 || last.status === 400
    if (!retryable || attempt === 3) return last
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
  }
  return last as Response
}

function isEnrichMergePath(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1')
    const path = parsed.pathname
    return path === '/api/enrich/merge' || path === '/semantic-os/api/enrich/merge'
  } catch {
    return /\/api\/enrich\/merge(?:\?|$)/.test(url)
  }
}

/** Canvas Merge click is the nod. Raw HTTP without confirm stays refused. */
export function stampOfficialMergeBody(raw: string): string {
  let payload: Record<string, unknown> = {}
  try {
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw
    payload = parsed as Record<string, unknown>
  } catch {
    return raw
  }
  if (payload.confirm || payload.nodded) return JSON.stringify(payload)
  return JSON.stringify({ ...payload, confirm: true, nodded: true })
}

async function bodyText(body: BodyInit | null | undefined): Promise<string> {
  if (body == null) return ''
  if (typeof body === 'string') return body
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.text()
  if (body instanceof URLSearchParams) return body.toString()
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return new TextDecoder().decode(body)
  if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body)
  return String(body)
}

export async function stampCanvasMergeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ input: RequestInfo | URL; init?: RequestInit }> {
  const url = requestUrl(input)
  const method = String(init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method !== 'POST' || !isEnrichMergePath(url)) return { input, init }
  let text = ''
  if (init?.body != null) text = await bodyText(init.body)
  else if (typeof Request !== 'undefined' && input instanceof Request) text = await input.clone().text()
  const stamped = stampOfficialMergeBody(text || '{}')
  const headers = new Headers(init?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined))
  headers.set('content-type', 'application/json')
  const nextInit: RequestInit = { ...(init || {}), method: 'POST', headers, body: stamped }
  const nextInput = typeof input === 'string' || input instanceof URL
    ? input
    : (typeof Request !== 'undefined' && input instanceof Request ? input.url : input)
  return { input: nextInput, init: nextInit }
}

export function rewriteGraphUpdatesUrl(url: string | URL, cwd = ''): string | URL {
  const raw = typeof url === 'string' ? url : url.toString()
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1')
    if (parsed.pathname !== GRAPH_UPDATES_PATH) return url
    parsed.pathname = SEMANTIC_GRAPH_UPDATES_PATH
    const live = cwd || hostCwd()
    const cwdLive = canonicalWorkspaceCwd(live)
    if (cwdLive && !parsed.searchParams.get('cwd')) parsed.searchParams.set('cwd', cwdLive)
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
    return fetchWithGraphRetry(input, init, upstream)
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
  const bind: HostBind = { el, cwd: canonicalWorkspaceCwd(cwd) }
  hosts.push(bind)
  ensureWrap()
  return () => {
    const index = hosts.lastIndexOf(bind)
    if (index >= 0) hosts.splice(index, 1)
    if (hosts.length === 0) unwrap()
  }
}
