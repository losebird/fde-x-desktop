import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

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
export function tryServeStatic(rootDir, request, response) {
  if (!rootDir || request.method !== 'GET' && request.method !== 'HEAD') return false
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (url.pathname.startsWith('/api/')) return false

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
    if (existsSync(fallback) && statSync(fallback).isFile()) {
      filePath = fallback
    } else {
      return false
    }
  }

  const ext = extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
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
