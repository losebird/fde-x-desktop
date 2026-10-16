import { bundleEntryName, isWebAppSpec, readBundleBytes } from './bundle.mjs'
import { getDocument } from './documents.mjs'

const BRIDGE_SRC = `(() => {
  const script = document.currentScript
  const storeBase = script && script.getAttribute('data-fde-store') || ''
  const boot = window.__FDE_BOOT__ && typeof window.__FDE_BOOT__ === 'object' ? window.__FDE_BOOT__ : {}
  const mem = Object.assign({}, boot.localStorage && typeof boot.localStorage === 'object' ? boot.localStorage : {})
  async function req(path, method, body) {
    const res = await fetch(path, {
      method: method || 'GET',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((json.error && json.error.message) || ('请求失败 (' + res.status + ')'))
    return json.data
  }
  const api = {
    async getDoc(key) {
      return req(storeBase + '/' + encodeURIComponent(key))
    },
    async setDoc(key, value) {
      return req(storeBase + '/' + encodeURIComponent(key), 'PUT', { value })
    },
  }
  let timer = 0
  const flush = () => {
    if (!storeBase) return
    void api.setDoc('localStorage', { ...mem }).catch(() => undefined)
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(flush, 250)
  }
  const storage = {
    getItem(key) {
      const k = String(key)
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null
    },
    setItem(key, value) {
      mem[String(key)] = String(value)
      schedule()
    },
    removeItem(key) {
      delete mem[String(key)]
      schedule()
    },
    clear() {
      for (const k of Object.keys(mem)) delete mem[k]
      schedule()
    },
    key(index) {
      return Object.keys(mem)[index] ?? null
    },
    get length() { return Object.keys(mem).length },
  }
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { return storage } })
  } catch {}
  window.addEventListener('pagehide', flush)
  window.fdeApp = api
})();`

function sendBytes(response, status, mime, bytes, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': mime,
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  response.end(bytes)
}

export function injectWebBridge(html, { storePrefix, livePrefix }) {
  const boot = ''
  const tag = `<script>window.__FDE_BOOT__=window.__FDE_BOOT__||{}</script><script src="${livePrefix}/__fde/bridge.js" data-fde-store="${storePrefix}"></script>`
  const text = String(html || '')
  if (text.includes('__fde/bridge.js')) return text
  if (/<head[^>]*>/i.test(text)) return text.replace(/<head[^>]*>/i, (m) => `${m}${tag}`)
  return `${tag}${text}`
}

export function injectWebBridgeWithBoot(html, boot, prefixes) {
  const payload = JSON.stringify(boot || {})
  const injected = injectWebBridge(html, prefixes)
  return injected.replace(
    /window\.__FDE_BOOT__=window\.__FDE_BOOT__\|\|\{\}/,
    `window.__FDE_BOOT__=${payload}`,
  )
}

/**
 * Serve a hosted web-app file or the FDE bridge.
 * @returns {boolean}
 */
export function serveWebAppAsset(request, response, {
  spec,
  workspaceCwd,
  relPath,
  livePrefix,
  storePrefix,
  db,
  appId,
}) {
  if (!isWebAppSpec(spec)) return false
  const method = request.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') return false
  const rel = String(relPath || '').replace(/^\/+/, '')
  if (rel === '__fde/bridge.js') {
    sendBytes(response, 200, 'text/javascript; charset=utf-8', BRIDGE_SRC)
    return true
  }
  const path = rel || bundleEntryName(spec)
  const hit = readBundleBytes(workspaceCwd, spec, path)
  if (!hit) return false
  let bytes = hit.bytes
  let mime = hit.mime
  if (mime.startsWith('text/html')) {
    const ls = db && appId ? getDocument(db, { appId, workspaceCwd, key: 'localStorage' }) : null
    const html = bytes.toString('utf8')
    const injected = injectWebBridgeWithBoot(html, { localStorage: ls && typeof ls === 'object' ? ls : {} }, {
      livePrefix,
      storePrefix,
    })
    bytes = Buffer.from(injected, 'utf8')
  }
  if (method === 'HEAD') {
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'Content-Length': bytes.length })
    response.end()
    return true
  }
  sendBytes(response, 200, mime, bytes)
  return true
}

export { isWebAppSpec }
