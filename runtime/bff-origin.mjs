/** Vite 5174/5175 map to BFF; packaged page is already on the BFF origin. */

const WEB_TO_RUNTIME = { 5174: 4318, 5175: 4319 }

export function resolveBffOrigin(envUrl, loc) {
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.replace(/\/$/u, '')
  const protocol = loc?.protocol || 'http:'
  const host = loc?.hostname || '127.0.0.1'
  const pagePort = Number(loc?.port || (protocol === 'https:' ? 443 : 80))
  const mapped = WEB_TO_RUNTIME[pagePort]
  if (mapped) return `${protocol}//${host}:${mapped}`
  const portPart = loc?.port ? `:${loc.port}` : ''
  return `${protocol}//${host}${portPart}`
}
