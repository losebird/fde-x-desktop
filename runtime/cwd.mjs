export function canonicalWorkspaceCwd(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const absolute = text.startsWith('/')
    || text.startsWith('\\\\')
    || /^[A-Za-z]:[\\/]/.test(text)
  if (!absolute) return ''
  const slashed = text.replace(/\\/g, '/')
  if (slashed === '/') return '/'
  return slashed.replace(/\/+$/u, '')
}

export function sameWorkspaceCwd(left, right) {
  const a = canonicalWorkspaceCwd(left)
  const b = canonicalWorkspaceCwd(right)
  return Boolean(a && b && a === b)
}
