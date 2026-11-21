export function safeWorkspaceRel(name) {
  const text = String(name || '').trim()
  if (!text || text.includes('\0')) return null
  const parts = text.split(/[\\/]/u).filter(Boolean)
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) return null
  return parts.join('/')
}

export function parentRel(rel) {
  const parts = String(rel || '').split(/[\\/]/u).filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

export function parentIdOf(rel) {
  return parentRel(rel) || '.'
}

export function baseRel(rel) {
  const parts = String(rel || '').split(/[\\/]/u).filter(Boolean)
  return parts.at(-1) || ''
}

export function joinRel(dir, name) {
  const file = String(name || '').trim()
  const folder = String(dir || '').trim().replace(/\/+$/u, '')
  if (!file) return folder && folder !== '.' ? folder : ''
  if (!folder || folder === '.') return file
  return `${folder}/${file}`
}

export function isSelfOrDescendant(from, dest) {
  const source = String(from || '')
  const target = String(dest || '')
  if (!source || !target) return false
  return target === source || target.startsWith(`${source}/`)
}

export function remapRel(id, from, to) {
  const current = String(id || '')
  if (!from) return current
  if (current === from) return to
  if (current.startsWith(`${from}/`)) return `${to}${current.slice(from.length)}`
  return current
}

export function nextCopyName(name, taken) {
  const original = String(name || '').trim() || '未命名'
  const used = new Set((taken || []).map((item) => String(item)))
  const dot = original.lastIndexOf('.')
  const hasExt = dot > 0 && dot < original.length - 1
  const stem = hasExt ? original.slice(0, dot) : original
  const ext = hasExt ? original.slice(dot) : ''
  let n = 0
  while (true) {
    const candidate = n === 0 ? `${stem} 副本${ext}` : `${stem} 副本 ${n}${ext}`
    if (!used.has(candidate)) return candidate
    n += 1
    if (n > 999) return `${stem} 副本 ${Date.now()}${ext}`
  }
}
