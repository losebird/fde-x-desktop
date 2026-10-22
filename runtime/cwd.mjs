export function canonicalWorkspaceCwd(value) {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/')) return ''
  if (raw === '/') return '/'
  return raw.replace(/\/+$/u, '')
}

export function sameWorkspaceCwd(left, right) {
  const a = canonicalWorkspaceCwd(left)
  const b = canonicalWorkspaceCwd(right)
  return Boolean(a && b && a === b)
}
