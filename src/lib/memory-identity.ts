/** Same hit identity as runtime/memory/identity.mjs. */

export const ORIGIN_PREFIXES = ['biz:', 'im:', 'task:', 'briefing:', 'app:', 'session:', 'file:', 'memory:'] as const

export function sessionIdOf(id: string) {
  const raw = String(id || '')
  const matched = raw.match(/^session:(session-[^:]+)/u) || raw.match(/^session:([^:]+)/u)
  return matched ? matched[1] : ''
}

export function filePathOf(id: string) {
  const raw = String(id || '')
  return raw.startsWith('file:') ? raw.slice(5) : ''
}

export function hostSourceOf(origin: string) {
  const raw = String(origin || '')
  if (raw.startsWith('session:') || raw.startsWith('file:')) return raw
  return ''
}

/** Origin that addresses one instance of content. Specs, receipts, and other cards are empty. */
export function instanceOriginOf(origin: string) {
  const raw = String(origin || '').trim()
  if (!raw) return ''
  if (raw.startsWith('memory:') || raw.startsWith('biz:')) return ''
  if (raw.startsWith('session:')) return sessionIdOf(raw) ? raw : ''
  if (raw.startsWith('file:')) return filePathOf(raw) ? raw : ''
  if (raw.startsWith('im:')) return raw.slice(3) ? raw : ''
  if (raw.startsWith('task:')) return raw.slice(5) ? raw : ''
  if (raw.startsWith('briefing:')) return raw.slice(9) ? raw : ''
  if (raw.startsWith('app:')) {
    const parts = raw.slice(4).split(':')
    if (parts.length >= 3 && parts[0] && parts[1] && parts.slice(2).join(':')) return raw
    return ''
  }
  return ''
}

function originPrefixOf(id: string) {
  const raw = String(id || '')
  return ORIGIN_PREFIXES.find((prefix) => raw.startsWith(prefix)) || ''
}

export function classifyHitId(id: string) {
  const raw = String(id || '').trim()
  const sessionId = sessionIdOf(raw)
  if (sessionId) {
    return { class: 'session' as const, id: raw, sessionId, href: { panel: 'ai', sessionId } }
  }
  const prefix = originPrefixOf(raw)
  if (prefix === 'memory:') {
    return { class: 'card' as const, id: raw, cardId: raw, href: { panel: 'memory', pane: 'cards', cardId: raw } }
  }
  if (prefix) {
    return { class: 'origin' as const, id: raw, originId: raw, href: { panel: 'memory', pane: 'cards', originId: raw } }
  }
  return { class: 'graph' as const, id: raw, href: { panel: 'memory', pane: 'explore' } }
}

export function memoryLandHref(id: string) {
  return classifyHitId(id).href
}

export function originOfCard(row: Record<string, unknown> | null | undefined) {
  const props = row && row.properties && typeof row.properties === 'object' ? row.properties as Record<string, unknown> : {}
  const meta = row && row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
  return String(props.origin || meta.origin || row?.origin || props.source || meta.source || row?.source || '')
}
