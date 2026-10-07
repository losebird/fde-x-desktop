/**
 * IM letter home: a talk (1:1 pair, or one topic) has one home.
 * Empty is not a home. New outgoing stamps send-time cwd.
 * Unique home: incoming and replies follow it. Two homes stay unassigned.
 * 回一句 fills empty members of the talk. Sender paths are not a home.
 * @module dsh-lan-assist/letter-home
 */

export function normalizeCwd(value) {
  const raw = String(value || '').trim()
  if (!raw.startsWith('/')) return ''
  return raw.replace(/\/+$/, '') || '/'
}

export function localCwdSet(workspaces) {
  const out = new Set()
  for (const row of workspaces || []) {
    const cwd = normalizeCwd(typeof row === 'string' ? row : (row && (row.cwd || row.path)))
    if (cwd) out.add(cwd)
  }
  return out
}

export function talkKey(req) {
  if (!req) return ''
  const groupId = String(req.groupId || '')
  if (groupId) {
    const thread = String(req.threadId || '')
    if (thread) return `t:${thread}`
    const id = String(req.id || '')
    return id ? `t:${id}` : ''
  }
  const ids = [req.from, ...(Array.isArray(req.to) ? req.to : [])]
    .map((id) => String(id || ''))
    .filter(Boolean)
  const unique = [...new Set(ids)].sort()
  return unique.length ? `d:${unique.join('\0')}` : ''
}

export function dmTalkId(selfId, peerId) {
  return talkKey({ from: selfId, to: [peerId] })
}

export function topicTalkId(rootId) {
  const id = String(rootId || '')
  return id ? `t:${id}` : ''
}

/** Non-empty homes of one talk. Empty is not a home. */
export function talkHomes(requests, key) {
  const want = String(key || '')
  const homes = new Set()
  if (!want) return homes
  const list = Array.isArray(requests) ? requests : Object.values(requests || {})
  for (const row of list) {
    if (!row || talkKey(row) !== want) continue
    const stored = normalizeCwd(row.workspace)
    if (stored) homes.add(stored)
  }
  return homes
}

function uniqueTalkHome(requests, key) {
  const homes = talkHomes(requests, key)
  return homes.size === 1 ? [...homes][0] : ''
}

function talkKeyOf(inner, fallback) {
  if (fallback && talkKey(fallback)) return talkKey(fallback)
  return talkKey({
    from: inner && inner.from,
    to: inner && inner.to,
    groupId: inner && inner.groupId,
    threadId: inner && inner.threadId,
    id: inner && (inner.id || inner.requestId),
    topic: inner && inner.topic,
  })
}

export function homeForIncoming(state, inner) {
  const requests = state && state.requests ? state.requests : {}
  const seen = new Set()
  let cursorId = String((inner && inner.threadId) || '')
  let root = null
  while (cursorId && !seen.has(cursorId)) {
    seen.add(cursorId)
    const parent = requests[cursorId]
    if (!parent) break
    root = parent
    const inherited = normalizeCwd(parent.workspace)
    if (inherited) return inherited
    cursorId = String(parent.threadId || parent.parentId || '')
  }
  return uniqueTalkHome(requests, talkKeyOf(inner, root))
}

/** Unique home is kept. No home stamps send cwd. Two homes stay unassigned. */
export function homeForOutgoing(state, inner) {
  const stamp = normalizeCwd(inner && inner.workspace)
  const requests = state && state.requests ? state.requests : {}
  const thread = String((inner && inner.threadId) || '').trim()
  if (thread) {
    const inherited = homeForIncoming(state, inner)
    if (inherited) return inherited
    const root = requests[thread]
    if (talkHomes(requests, talkKeyOf(inner, root)).size > 1) return ''
    return stamp
  }
  const groupId = String((inner && inner.groupId) || '').trim()
  if (groupId) return stamp
  const key = talkKey({
    from: state && state.self && state.self.id,
    to: inner && inner.to,
    groupId: '',
  })
  const homes = talkHomes(requests, key)
  if (homes.size === 1) return [...homes][0]
  if (homes.size > 1) return ''
  return stamp
}

/** Root + follow-ups of one talk. 归到 writes this set, empty homes only. */
export function talkMemberIds(requests, id) {
  const list = Array.isArray(requests) ? requests : Object.values(requests || {})
  const want = String(id || '')
  const row = list.find((item) => item && String(item.id || '') === want)
  if (!row) return []
  const thread = String(row.threadId || '')
  if (thread || row.topic) {
    const rootId = thread || String(row.id || '')
    return list
      .filter((item) => item && (String(item.id || '') === rootId || String(item.threadId || '') === rootId))
      .map((item) => String(item.id))
  }
  const key = talkKey(row)
  if (!key) return [want]
  return list.filter((item) => talkKey(item) === key).map((item) => String(item.id))
}

/** Write cwd onto empty members of the talks seeded by ids. Already-homed rows stay. */
export function placeEmptyHomes(requests, ids, cwd, at) {
  const home = normalizeCwd(cwd)
  if (!home || !requests || typeof requests !== 'object' || Array.isArray(requests)) return []
  const expanded = new Set()
  for (const id of Array.isArray(ids) ? ids : []) {
    for (const member of talkMemberIds(requests, id)) expanded.add(member)
  }
  const placed = []
  for (const id of expanded) {
    const row = requests[id]
    if (!row || normalizeCwd(row.workspace)) continue
    row.workspace = home
    if (at) row.updatedAt = at
    placed.push(id)
  }
  return placed
}

/** A roster with no mail, or mail with empty home, belongs on the unassigned lane. */
export function mailOnLane(homes, lane, currentHome, emptyToUnassigned) {
  const list = Array.isArray(homes) ? homes.map((home) => normalizeCwd(home)) : []
  if (lane === 'unassigned') {
    if (list.some((home) => !home)) return true
    return !!(emptyToUnassigned && list.length === 0)
  }
  const here = normalizeCwd(currentHome)
  return !!(here && list.some((home) => home === here))
}

export function letterHome(req, all, localCwds) {
  if (!req) return ''
  const locals = localCwds instanceof Set ? localCwds : localCwdSet(localCwds)
  const list = Array.isArray(all) ? all : Object.values(all || {})
  const byId = new Map()
  for (const row of list) {
    if (row && row.id) byId.set(String(row.id), row)
  }
  const seen = new Set()
  let cursor = req
  while (cursor && !seen.has(String(cursor.id || ''))) {
    seen.add(String(cursor.id || ''))
    const stored = normalizeCwd(cursor.workspace)
    if (stored && locals.has(stored)) return stored
    const parentId = String(cursor.threadId || cursor.parentId || '')
    cursor = parentId ? byId.get(parentId) : null
  }
  const key = talkKey(req)
  if (!key) return ''
  const homes = new Set()
  for (const row of byId.values()) {
    if (talkKey(row) !== key) continue
    const stored = normalizeCwd(row.workspace)
    if (stored && locals.has(stored)) homes.add(stored)
  }
  if (homes.size === 1) return [...homes][0]
  return ''
}

/** Hall shells carry computed `unread`. Opened-thread rows carry `reads` and omit `unread`. */
export function incomingUnread(row, selfId) {
  if (!row || row.kind !== 'incoming' || row.roster) return false
  if (row.status === 'withdrawn' || row.status === 'closed' || row.status === 'failed') return false
  if (typeof row.unread === 'boolean') return row.unread
  const reads = row.reads && typeof row.reads === 'object' && !Array.isArray(row.reads) ? row.reads : null
  const id = String(selfId || '')
  if (id) return !(reads && reads[id])
  return !reads || !Object.keys(reads).length
}

export function emptyUnreadSheet() {
  return { talks: [], byTalk: {}, byCwd: {}, unassigned: 0 }
}

/** One talk row per 1:1 pair or topic. Group id is roster only. */
export function unreadSheet(requests, localCwds, selfId) {
  const locals = localCwds instanceof Set ? localCwds : localCwdSet(localCwds)
  const list = Array.isArray(requests) ? requests : Object.values(requests || {})
  /** @type {Map<string, { talkId: string, rosterId: string, home: string, n: number }>} */
  const byTalkRows = new Map()
  for (const row of list) {
    if (!incomingUnread(row, selfId)) continue
    const talkId = talkKey(row)
    if (!talkId) continue
    const home = letterHome(row, list, locals)
    const rosterId = String(row.groupId || '')
    const cur = byTalkRows.get(talkId)
    if (!cur) {
      byTalkRows.set(talkId, { talkId, rosterId, home, n: 1 })
      continue
    }
    cur.n += 1
    if (cur.home !== home) cur.home = ''
  }
  const talks = [...byTalkRows.values()]
  /** @type {Record<string, number>} */
  const byTalk = {}
  /** @type {Record<string, number>} */
  const byCwd = {}
  for (const cwd of locals) byCwd[cwd] = 0
  let unassigned = 0
  for (const row of talks) {
    byTalk[row.talkId] = row.n
    if (!row.home) unassigned += row.n
    else byCwd[row.home] = (byCwd[row.home] || 0) + row.n
  }
  return { talks, byTalk, byCwd, unassigned }
}

export function unreadByHome(requests, localCwds, selfId) {
  const sheet = unreadSheet(requests, localCwds, selfId)
  return { byCwd: sheet.byCwd, unassigned: sheet.unassigned }
}

export function unreadOfTalk(sheet, talkId, lane, currentHome) {
  const want = String(talkId || '')
  if (!sheet || !want) return 0
  const talks = Array.isArray(sheet.talks) ? sheet.talks : []
  const row = talks.find((item) => item && item.talkId === want)
  if (!row) return 0
  if (lane) return mailOnLane([row.home], lane, currentHome, false) ? Number(row.n) || 0 : 0
  return Number(row.n) || 0
}

export function unreadOfRoster(sheet, rosterId, lane, currentHome) {
  const want = String(rosterId || '')
  if (!sheet || !want) return 0
  let n = 0
  for (const row of Array.isArray(sheet.talks) ? sheet.talks : []) {
    if (!row || row.rosterId !== want) continue
    if (mailOnLane([row.home], lane, currentHome, false)) n += Number(row.n) || 0
  }
  return n
}

/** IM 面板 full/half 或撕出的浮窗才是可见区。 */
export function imPaneOpen(panelState, floatingIm) {
  return panelState === 'full' || panelState === 'half' || !!floatingIm
}

/**
 * IM closed: current cwd + 未分. IM open: 未分 only. Folds unreadSheet.
 */
export function imUnreadMouth(split, imOpen, currentHome) {
  const byCwd = split && split.byCwd && typeof split.byCwd === 'object' ? split.byCwd : {}
  const currentN = currentHome ? (Number(byCwd[normalizeCwd(currentHome)]) || 0) : 0
  const unassigned = Number(split && split.unassigned) || 0
  return (imOpen ? 0 : currentN) + unassigned
}

export function imBrowseOccupancy(browse) {
  const lane = browse && browse.lane === 'unassigned' ? 'unassigned' : 'workspace'
  const threadId = browse && browse.threadId ? String(browse.threadId) : null
  const topicId = threadId && browse && browse.topicId ? String(browse.topicId) : null
  return { threadId, topicId, lane }
}

/** Occupancy of a visible IM pane. Missing talk on this lane becomes an empty list. Hidden panes keep occupancy. */
export function imBrowseForVisibleTalk(browse, present) {
  const next = imBrowseOccupancy(browse)
  if (!next.threadId) return { threadId: null, topicId: null, lane: next.lane }
  if (typeof present === 'function' && !present(next.threadId, next.lane)) {
    return { threadId: null, topicId: null, lane: next.lane }
  }
  return next
}
