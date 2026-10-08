/** Host meta titles are `{ zh, en }` maps or plain strings. */

export function hostText(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!value || typeof value !== 'object') return ''
  const rec = value as Record<string, unknown>
  const lang = typeof navigator !== 'undefined' && String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
  for (const key of [lang, 'zh', 'en']) {
    const hit = rec[key]
    if (typeof hit === 'string' && hit.trim()) return hit.trim()
  }
  const first = Object.values(rec).find((item) => typeof item === 'string' && item.trim())
  return typeof first === 'string' ? first.trim() : ''
}
