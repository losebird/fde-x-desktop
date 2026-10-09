/** Packaged static owns FDE routes; only /dsh-app is the Host iframe mouth. */

export function shouldProxyDshPath(pathname, { hostOrigin, staticDir, livePath } = {}) {
  if (pathname === '/dsh-app' || pathname.startsWith('/dsh-app/')) return true
  if (staticDir) return false
  if (!hostOrigin) return false
  if (pathname.startsWith('/api/v1')) return false
  if (pathname === '/semantic-os' || pathname.startsWith('/semantic-os/')) return false
  if (pathname === '/health' || pathname === livePath) return false
  if (pathname === '/' || pathname === '/favicon.ico') return false
  return true
}
