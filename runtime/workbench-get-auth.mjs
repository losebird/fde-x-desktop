import { pathHasPrefix } from './path-prefix.mjs'

export function isAppLiveFace(pathname) {
  return /^\/api\/v1\/apps\/[^/]+\/live(?:\/|$)/.test(String(pathname || ''))
}

export function isAppStoreFace(pathname) {
  return /^\/api\/v1\/apps\/[^/]+\/store(?:\/|$)/.test(String(pathname || ''))
}

export function workbenchGetNeedsToken(pathname) {
  const path = String(pathname || '')
  if (!path.startsWith('/api/v1/')) return false
  if (pathHasPrefix(path, '/api/v1/app-share/')) return false
  if (isAppLiveFace(path) || isAppStoreFace(path)) return false
  if (path === '/api/v1/ai/status') return false
  if (path === '/api/v1/events' || path === '/api/v1/events/recent') return false
  return true
}

export function pageTokenRequired(pathname, method = 'GET') {
  const path = String(pathname || '')
  const verb = String(method || 'GET').toUpperCase()
  if (!path.startsWith('/api/v1/') || pathHasPrefix(path, '/api/v1/app-share/')) return false
  if (isAppStoreFace(path)) return false
  if (verb !== 'GET' && verb !== 'HEAD') return true
  return workbenchGetNeedsToken(path)
}
