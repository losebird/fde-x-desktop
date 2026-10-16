import { request as httpRequest } from 'node:http'
import { isPublicAppFace, isViteDevAsset } from '../apps/share.mjs'
import { tryServeStatic } from './static.mjs'

/**
 * Public document `/a/:shareId` is the BFF origin.
 * Packaged static falls back to index.html; pnpm-dev proxies Vite on loopback.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {URL} url
 * @param {{ staticDir?: string, webPort?: number }} opts
 */
export function handlePublicAppDocument(request, response, url, opts = {}) {
  const method = request.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') return false
  const pathname = url.pathname
  const document = pathname === '/a' || pathname.startsWith('/a/')
  const viteAsset = isViteDevAsset(pathname)
  if (!document && !viteAsset) return false
  if (pathname.startsWith('/api/')) return false

  const staticDir = String(opts.staticDir || '')
  if (staticDir && tryServeStatic(staticDir, request, response)) return true
  if (staticDir) return false

  const webPort = Number(opts.webPort)
  if (!Number.isInteger(webPort) || webPort <= 0) return false
  if (!isPublicAppFace(pathname, { staticDir: '' })) return false

  const up = httpRequest({
    hostname: '127.0.0.1',
    port: webPort,
    path: `${pathname}${url.search}`,
    method,
    headers: {
      ...request.headers,
      host: `127.0.0.1:${webPort}`,
    },
  }, (incoming) => {
    const headers = { ...incoming.headers }
    delete headers.connection
    response.writeHead(incoming.statusCode || 200, headers)
    incoming.pipe(response)
  })
  up.on('error', () => {
    if (response.headersSent || response.writableEnded) return
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify({ error: { code: 'public_app_unavailable', message: '公开页前端未就绪' } }))
  })
  if (method === 'GET' || method === 'HEAD') up.end()
  else request.pipe(up)
  return true
}
