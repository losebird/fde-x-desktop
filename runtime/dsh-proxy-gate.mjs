import { isViteDevAsset } from './apps/share.mjs'
import { pathHasPrefix } from './path-prefix.mjs'

export function shouldProxyDshPath(pathname, { hostOrigin, staticDir, livePath } = {}) {
  if (pathname === '/dsh-app' || pathname.startsWith('/dsh-app/')) return true
  if (staticDir) return false
  if (!hostOrigin) return false
  if (pathname.startsWith('/api/v1')) return false
  if (pathname === '/a' || pathname.startsWith('/a/')) return false
  if (isViteDevAsset(pathname)) return false
  if (pathHasPrefix(pathname, '/semantic-os')) return false
  if (pathname === '/health' || pathname === livePath) return false
  if (pathname === '/' || pathname === '/favicon.ico') return false
  return true
}
