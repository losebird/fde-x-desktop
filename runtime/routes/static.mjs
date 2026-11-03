import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { injectPageTokenHtml } from '../page-token-html.mjs'
import { pathHasPrefix } from '../path-prefix.mjs'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

/**
 * @param {string} rootDir
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @returns {boolean} true if handled
 */
function pathSkipped(pathname, prefixes) {
  for (const prefix of prefixes || []) {
    if (pathHasPrefix(pathname, prefix) || pathname === prefix) return true
  }
  return false
}

export function workbenchStaticOpts(uiToken) {
  return { spaFallback: true, uiToken, skipPrefixes: ['/a'] }
}

export function tryServeStatic(rootDir, request, response, { spaFallback = true, uiToken = '', skipPrefixes = [] } = {}) {
  if (!rootDir || request.method !== 'GET' && request.method !== 'HEAD') return false
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (url.pathname.startsWith('/api/')) return false
  if (pathSkipped(url.pathname, skipPrefixes)) return false

  const root = resolve(rootDir)
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const segments = rel.split('/').filter(Boolean)
  if (segments.some((part) => part === '..' || part === '.')) {
    response.writeHead(400, { 'Cache-Control': 'no-store' })
    response.end()
    return true
  }

  let filePath = join(root, ...segments)
  if (!filePath.startsWith(root)) {
    response.writeHead(403, { 'Cache-Control': 'no-store' })
    response.end()
    return true
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    const fallback = join(root, 'index.html')
    if (spaFallback && existsSync(fallback) && statSync(fallback).isFile()) {
      filePath = fallback
    } else {
      return false
    }
  }

  const ext = extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  if (ext === '.html') {
    let html = readFileSync(filePath, 'utf8')
    html = injectPageTokenHtml(html, uiToken)
    const body = Buffer.from(html)
    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
    })
    if (request.method === 'HEAD') {
      response.end()
      return true
    }
    response.end(body)
    return true
  }
  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
  if (request.method === 'HEAD') {
    response.end()
    return true
  }
  createReadStream(filePath).on('error', () => {
    if (!response.headersSent) {
      response.writeHead(500, { 'Cache-Control': 'no-store' })
      response.end()
    }
  }).pipe(response)
  return true
}
