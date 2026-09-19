/** Resolve a card/file href into something the shell can actually open. No domain allowlist. */

export type AppOpenKind = 'http' | 'file'
export type AppOpenedMode = 'external' | 'popup' | 'anchor' | 'files' | 'invalid'

export type AppOpenTarget = {
  href: string
  kind: AppOpenKind
  path?: string
}

const BLOCKED_SCHEMES = /^(javascript|data|vbscript|blob):/i

export function resolveAppOpenTarget(raw: string): AppOpenTarget | null {
  const text = String(raw || '').trim()
  if (!text || BLOCKED_SCHEMES.test(text)) return null

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
      return { href: url.href, kind: 'http' }
    } catch {
      return null
    }
  }

  if (/^file:/i.test(text)) {
    try {
      const url = new URL(text)
      if (url.protocol !== 'file:') return null
      return { href: url.href, kind: 'file', path: fileUrlToPath(url) }
    } catch {
      return null
    }
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null
  return { href: text, kind: 'file', path: text }
}

export function isSafeExternalUrl(href: string): boolean {
  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:'
  } catch {
    return false
  }
}

export function externalUrlForTarget(target: AppOpenTarget): string | null {
  if (target.kind === 'http') return isSafeExternalUrl(target.href) ? target.href : null
  if (isSafeExternalUrl(target.href)) return target.href
  const path = String(target.path || '').trim()
  if (!path) return null
  if (path.startsWith('/')) return `file://${path}`
  if (/^[a-zA-Z]:[\\/]/.test(path)) return `file:///${path.replace(/\\/g, '/')}`
  return null
}

function fileUrlToPath(url: URL): string {
  if (url.protocol !== 'file:') return url.href
  let path = decodeURIComponent(url.pathname || '')
  if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1)
  return path
}
