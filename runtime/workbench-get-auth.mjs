import { pathHasPrefix } from './path-prefix.mjs'

export function workbenchGetNeedsToken(pathname) {
  const path = String(pathname || '')
  if (!path.startsWith('/api/v1/')) return false
  if (pathHasPrefix(path, '/api/v1/app-share/')) return false
  if (path === '/api/v1/ai/status') return false
  if (path === '/api/v1/events' || path === '/api/v1/events/recent') return false
  return true
}
