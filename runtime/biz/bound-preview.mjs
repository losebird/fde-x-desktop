const previews = new Map()

export function rememberBoundPreview(id, record) {
  const key = String(id || '').trim()
  if (!key || !record || typeof record !== 'object') return
  previews.set(key, { ...record, at: Date.now() })
}

export function takeBoundPreview(id) {
  const key = String(id || '').trim()
  if (!key) return null
  const row = previews.get(key) || null
  if (row) previews.delete(key)
  return row
}

export function peekBoundPreview(id) {
  const key = String(id || '').trim()
  return key ? (previews.get(key) || null) : null
}
