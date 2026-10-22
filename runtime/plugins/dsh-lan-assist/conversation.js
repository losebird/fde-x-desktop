/**
 * Conversation / Message ids over the live letter map.
 * Disk writes conversations; memory aliases the same rows as requests.
 * @module dsh-lan-assist/conversation
 */

export function parseMessageId(id) {
  const raw = String(id || '').trim()
  const at = raw.lastIndexOf(':')
  if (at <= 0) return { requestId: raw, turn: '' }
  return { requestId: raw.slice(0, at), turn: raw.slice(at + 1) }
}

export function messageIdOf(requestId, turn) {
  const id = String(requestId || '').trim()
  const part = String(turn || 'v1').trim() || 'v1'
  return id ? `${id}:${part}` : ''
}

export function letterIds(id) {
  const requestId = String(id || '').trim()
  return { requestId, messageId: messageIdOf(requestId, 'v1') }
}

export function requestIdOf(value) {
  if (value && typeof value === 'object') {
    const mid = String(value.messageId || '').trim()
    if (mid) return parseMessageId(mid).requestId
    return String(value.requestId || '').trim()
  }
  const raw = String(value || '').trim()
  return raw.includes(':') ? parseMessageId(raw).requestId : raw
}

export function messagesOf(req) {
  if (!req || !req.id) return []
  const id = String(req.id)
  const versions = Array.isArray(req.versions) ? req.versions : []
  const replies = Array.isArray(req.replies) ? req.replies : []
  const out = []
  if (!versions.length) {
    out.push({
      id: messageIdOf(id, 'v1'),
      requestId: id,
      turn: 'v1',
      from: req.from || '',
      body: String(req.body || req.excerpt || ''),
      at: Number(req.createdAt || 0),
    })
  }
  for (const row of versions) {
    const n = Number(row && row.n) || out.length + 1
    const turn = `v${n}`
    out.push({
      id: messageIdOf(id, turn),
      requestId: id,
      turn,
      from: (row && row.from) || req.from || '',
      body: String((row && (row.body || row.excerpt)) || ''),
      at: Number((row && row.at) || req.createdAt || 0),
    })
  }
  replies.forEach((row, i) => {
    const turn = `r${i + 1}`
    out.push({
      id: messageIdOf(id, turn),
      requestId: id,
      turn,
      from: (row && row.from) || '',
      body: String((row && row.body) || ''),
      at: Number((row && row.at) || 0),
    })
  })
  return out
}

export function conversationOf(req) {
  return {
    id: String((req && (req.threadId || req.id)) || ''),
    requestId: req && req.id ? String(req.id) : '',
    messages: messagesOf(req),
  }
}
