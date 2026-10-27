function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function dropEmptyOriginSub(value) {
  const sub = String(value || '').trim()
  if (!sub) return ''
  if (/^(biz|im|task|briefing|app|session|file|memory):$/u.test(sub)) return ''
  return sub
}

function isInstructionCue(text) {
  const value = String(text || '').trim()
  if (!value) return false
  if (/^回答提示$/.test(value)) return true
  if (/^先用一两句话概括/.test(value)) return true
  return false
}

function hrefOf(value) {
  if (isRecord(value) && value.panel) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  return ''
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
    if (!unwrapped.text || isInstructionCue(unwrapped.text)) return null
    return {
      text: unwrapped.text,
      ...(unwrapped.href ? { href: unwrapped.href } : {}),
    }
  }
  if (!isRecord(item)) return null
  const titleish = firstString(
    item.text,
    item.title,
    item.subject,
    item.summary,
    item.headline,
    item.cue,
    item.name,
  )
  const bodyish = firstString(item.body)
  const unwrapped = unwrapMarkdownLink(titleish || bodyish)
  const text = unwrapped.text
  if (!text || isInstructionCue(text)) return null
  const href = hrefOf(item.href) || hrefOf(item.url) || hrefOf(item.link) || unwrapped.href
  const sub = dropEmptyOriginSub(
    firstString(item.sub, item.from, item.source, item.author)
      || (titleish && bodyish && bodyish !== text ? bodyish : ''),
  )
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
