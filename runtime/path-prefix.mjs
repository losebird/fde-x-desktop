export function pathHasPrefix(pathname, prefix) {
  const path = String(pathname || '')
  const head = String(prefix || '')
  if (!head.startsWith('/')) return false
  if (head.endsWith('/')) return path.startsWith(head)
  return path === head || path.startsWith(`${head}/`)
}
