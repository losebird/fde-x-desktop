function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function unwrapMarkdownLink(text) {
  const raw = String(text || '').trim()
  if (!raw) return { text: '', href: '' }
  const whole = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/i)
  if (whole) return { text: whole[1].trim(), href: whole[2] }
  const href = (raw.match(/https?:\/\/[^\s)>\]]+/i) || [''])[0]
  const stripped = raw.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, '$1').replace(/\s+/g, ' ').trim()
  return { text: stripped, href }
}

export function presentBriefingItem(item) {
  if (typeof item === 'string') {
    const unwrapped = unwrapMarkdownLink(item)
    if (!unwrapped.text) return null
    return {
      text: unwrapped.text,
      ...(unwrapped.href ? { href: unwrapped.href } : {}),
    }
  }
  if (!isRecord(item)) return null
  const unwrapped = unwrapMarkdownLink(item.text)
  const text = unwrapped.text
  if (!text) return null
  const href = (isRecord(item.href) && item.href.panel ? item.href : '')
    || (typeof item.href === 'string' && item.href.trim())
    || unwrapped.href
  const sub = String(item.sub || '').trim()
  return {
    text,
    ...(sub ? { sub } : {}),
    ...(href ? { href } : {}),
    ...(item.ref ? { ref: item.ref } : {}),
  }
}

function beatToItem(beat) {
  const text = String(beat || '').trim()
  if (!text) return null
  const idx = text.indexOf('：')
  if (idx > 0 && idx < text.length - 1) {
    const head = text.slice(0, idx).trim()
    const tail = text.slice(idx + 1).trim()
    if (head && tail) return presentBriefingItem({ text: head, sub: tail })
  }
  return presentBriefingItem({ text })
}

function foldSentences(blob) {
  if (!blob) return []
  return String(blob)
    .split(/(?<=[。！？])\s*|\n+|；/)
    .map((part) => beatToItem(part.trim()))
    .filter(Boolean)
}

export function digestItems(section, opts = {}) {
  const limit = Number(opts.limit)
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 8
  const rows = Array.isArray(section?.items) ? section.items : []
  const presented = rows.map((row) => presentBriefingItem(row)).filter(Boolean)
  let items = presented
  if (presented.length <= 1) {
    const blob = presented[0]
      ? [presented[0].text, presented[0].sub].filter(Boolean).join('：')
      : String(section?.body || '').trim()
    items = foldSentences(blob)
  }
  return items.slice(0, cap)
}

export function digestBeats(section) {
  return digestItems(section).map((item) => (item.sub ? `${item.text}：${item.sub}` : item.text))
}
