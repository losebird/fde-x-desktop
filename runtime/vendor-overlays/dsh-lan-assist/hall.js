/**
 * Browser hall slice: last line + unread + reply count.
 * Not the full letter. Opened chat still goes through /thread.
 * @module dsh-lan-assist/hall
 */

export function isDirectChat(req) {
  return !!(req && !req.topic && !req.groupId)
}

export function sameDirectTalk(a, b) {
  if (!isDirectChat(a) || !isDirectChat(b)) return false
  const left = [...new Set([a.from, ...(a.to || [])].filter(Boolean))].sort().join('\0')
  const right = [...new Set([b.from, ...(b.to || [])].filter(Boolean))].sort().join('\0')
  return !!(left && left === right)
}

export function isTopicRoot(req) {
  return !!(req && req.topic && req.groupId && !req.threadId)
}

export function inThread(req, rootId) {
  const id = String(rootId || '')
  if (!req || !id || req.status === 'closed') return false
  return req.id === id || String(req.threadId || '') === id
}

export function lastBodyOf(req) {
  const replies = req && req.replies
  const lastReply = Array.isArray(replies) && replies[replies.length - 1]
  const versions = req && req.versions
  const lastVer = Array.isArray(versions) && versions[versions.length - 1]
  return String((lastReply && lastReply.body) || (lastVer && (lastVer.body || req.excerpt)) || (req && (req.excerpt || req.body)) || '')
}

export function shellUnread(req, selfId) {
  if (!req || req.roster) return false
  if (req.status === 'withdrawn' || req.status === 'closed' || req.status === 'failed') return false
  if (req.kind === 'incoming') return !(req.reads && selfId && req.reads[selfId])
  if (req.kind !== 'outgoing') return false
  const n = Array.isArray(req.replies) ? req.replies.length : Number(req.replies || 0)
  return n > Number(req.seenReplies || 0)
}

export function requestShell(req, selfId) {
  return req && !req.roster && {
    id: req.id,
    kind: req.kind,
    status: req.status,
    from: req.from || '',
    fromName: req.fromName || '',
    to: req.to || [],
    excerpt: String(req.excerpt || '').slice(0, 80),
    last: lastBodyOf(req).replace(/\s+/g, ' ').slice(0, 40),
    unread: shellUnread(req, selfId),
    replies: Array.isArray(req.replies) ? req.replies.length : Number(req.replies || 0),
    seenReplies: Number(req.seenReplies || 0),
    workspace: req.workspace || '',
    adopted: !!req.adopted,
    held: !!req.held,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    groupId: req.groupId || '',
    groupName: req.groupName || '',
    topic: !!req.topic,
    threadId: req.threadId || '',
    withdrawn: !!(req.status === 'withdrawn' || (req.withdrawn || []).length),
    delivered: req.delivered || {},
    relayed: req.relayed || {},
    lastError: req.lastError || {},
  }
}

export function hallRequests(state, selfId) {
  return Object.values((state && state.requests) || {})
    .filter((req) => req && req.status !== 'closed' && !req.roster)
    .map((req) => requestShell(req, selfId))
    .filter(Boolean)
}

export function letterGoneFor(req, peerId) {
  if (!req) return false
  if (req.status === 'withdrawn') return true
  const gone = Array.isArray(req.withdrawn) ? req.withdrawn : []
  return !!(req.kind === 'outgoing' && peerId && gone.indexOf(peerId) >= 0)
}

export function lastLineOf(letters) {
  const list = (letters || []).slice().sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
  const last = list[list.length - 1]
  return last && (last.last || last.excerpt)
    ? String(last.last || last.excerpt).replace(/\s+/g, ' ').slice(0, 24)
    : '还没有往来'
}
