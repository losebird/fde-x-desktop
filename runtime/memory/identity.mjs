/** One hit identity for cards, origins, sessions, and graph nodes. */

export const ORIGIN_PREFIXES = ['biz:', 'im:', 'task:', 'briefing:', 'app:', 'session:', 'file:', 'memory:']

export function hitId(row) {
  const node = row && row.node && typeof row.node === 'object' ? row.node : {}
  return String((row && (row.id || node.id)) || '')
}

export function sessionIdOf(id) {
  const raw = String(id || '')
  const matched = raw.match(/^session:(session-[^:]+)/u) || raw.match(/^session:([^:]+)/u)
  return matched ? matched[1] : ''
}

export function filePathOf(id) {
  const raw = String(id || '')
  return raw.startsWith('file:') ? raw.slice(5) : ''
}

export function hostSourceOf(origin) {
  const raw = String(origin || '')
  if (raw.startsWith('session:') || raw.startsWith('file:')) return raw
  return ''
}

/**
 * Origin that addresses one instance of content. Specs, receipts, and other cards are empty.
 */
export function instanceOriginOf(origin) {
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

/**
 * @returns {{ class: 'session' | 'card' | 'origin' | 'graph', id: string, href: Record<string, string>, sessionId?: string, cardId?: string, originId?: string }}
 */
function originPrefixOf(id) {
  const raw = String(id || '')
  return ORIGIN_PREFIXES.find((prefix) => raw.startsWith(prefix)) || ''
}

export function classifyHitId(id) {
  const raw = String(id || '').trim()
  const sessionId = sessionIdOf(raw)
  if (sessionId) {
    return { class: 'session', id: raw, sessionId, href: { panel: 'ai', sessionId } }
  }
  const prefix = originPrefixOf(raw)
  if (prefix === 'memory:') {
    return { class: 'card', id: raw, cardId: raw, href: { panel: 'memory', pane: 'cards', cardId: raw } }
  }
  if (prefix) {
    return { class: 'origin', id: raw, originId: raw, href: { panel: 'memory', pane: 'cards', originId: raw } }
  }
  return { class: 'graph', id: raw, href: { panel: 'memory', pane: 'explore' } }
}

export function memoryLandHref(id) {
  return classifyHitId(id).href
}

export function originOfCard(row) {
  const props = row && row.properties && typeof row.properties === 'object' ? row.properties : {}
  const meta = row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return String(props.origin || meta.origin || row?.origin || props.source || meta.source || row?.source || '')
}
