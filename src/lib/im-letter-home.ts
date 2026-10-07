/** Browser port of `runtime/vendor-overlays/dsh-lan-assist/letter-home.js`. Write-path homeForIncoming / homeForOutgoing stays on the overlay. */

export function normalizeCwd(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw.startsWith('/')) return ''
  return raw.replace(/\/+$/, '') || '/'
}

export function localCwdSet(workspaces: Array<{ cwd?: string; path?: string } | string>): Set<string> {
  const out = new Set<string>()
  for (const row of workspaces) {
    const cwd = normalizeCwd(typeof row === 'string' ? row : (row.cwd || row.path))
    if (cwd) out.add(cwd)
  }
  return out
}

export function talkKey(req: Record<string, unknown>): string {
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

export function dmTalkId(selfId: string, peerId: string): string {
  return talkKey({ from: selfId, to: [peerId] })
}

export function topicTalkId(rootId: string): string {
  const id = String(rootId || '')
  return id ? `t:${id}` : ''
}

export function letterHome(
  req: Record<string, unknown>,
  all: Array<Record<string, unknown>>,
  localCwds: Set<string> | Array<{ cwd?: string; path?: string } | string>,
): string {
  const locals = localCwds instanceof Set ? localCwds : localCwdSet(localCwds)
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of all) {
    const id = String(row.id || '')
    if (id) byId.set(id, row)
  }
  const seen = new Set<string>()
  let cursor: Record<string, unknown> | undefined = req
  while (cursor && !seen.has(String(cursor.id || ''))) {
    seen.add(String(cursor.id || ''))
    const stored = normalizeCwd(cursor.workspace)
    if (stored && locals.has(stored)) return stored
    const ancestor: string = String(cursor.threadId || cursor.parentId || '')
    cursor = ancestor ? byId.get(ancestor) : undefined
  }
  const key = talkKey(req)
  if (!key) return ''
  const homes = new Set<string>()
  for (const row of byId.values()) {
    if (talkKey(row) !== key) continue
    const stored = normalizeCwd(row.workspace)
    if (stored && locals.has(stored)) homes.add(stored)
  }
  if (homes.size === 1) return [...homes][0]
  return ''
}

export function incomingUnread(row: Record<string, unknown> | null | undefined, selfId?: string): boolean {
  if (!row || row.kind !== 'incoming' || row.roster) return false
  if (row.status === 'withdrawn' || row.status === 'closed' || row.status === 'failed') return false
  if (typeof row.unread === 'boolean') return row.unread
  const reads = row.reads && typeof row.reads === 'object' && !Array.isArray(row.reads)
    ? row.reads as Record<string, unknown>
    : null
  const id = String(selfId || '')
  if (id) return !(reads && reads[id])
  return !reads || !Object.keys(reads).length
}

export function mailOnLane(
  homes: Array<string | undefined | null>,
  lane: 'workspace' | 'unassigned',
  currentHome: string,
  emptyToUnassigned = false,
): boolean {
  const list = homes.map((home) => normalizeCwd(home))
  if (lane === 'unassigned') {
    if (list.some((home) => !home)) return true
    return !!(emptyToUnassigned && list.length === 0)
  }
  const here = normalizeCwd(currentHome)
  return !!(here && list.some((home) => home === here))
}

export type UnreadTalk = {
  talkId: string
  rosterId: string
  home: string
  n: number
}

export type UnreadSheet = {
  talks: UnreadTalk[]
  byTalk: Record<string, number>
  byCwd: Record<string, number>
  unassigned: number
}

export function emptyUnreadSheet(): UnreadSheet {
  return { talks: [], byTalk: {}, byCwd: {}, unassigned: 0 }
}

/** One talk row per 1:1 pair or topic. Group id is roster only. */
export function unreadSheet(
  requests: Array<Record<string, unknown>>,
  localCwds: Set<string> | Array<{ cwd?: string; path?: string } | string>,
  selfId?: string,
): UnreadSheet {
  const locals = localCwds instanceof Set ? localCwds : localCwdSet(localCwds)
  const byTalkRows = new Map<string, UnreadTalk>()
  for (const row of requests) {
    if (!incomingUnread(row, selfId)) continue
    const id = talkKey(row)
    if (!id) continue
    const home = letterHome(row, requests, locals)
    const rosterId = String(row.groupId || '')
    const cur = byTalkRows.get(id)
    if (!cur) {
      byTalkRows.set(id, { talkId: id, rosterId, home, n: 1 })
      continue
    }
    cur.n += 1
    if (cur.home !== home) cur.home = ''
  }
  const talks = [...byTalkRows.values()]
  const byTalk: Record<string, number> = {}
  const byCwd: Record<string, number> = {}
  for (const cwd of locals) byCwd[cwd] = 0
  let unassigned = 0
  for (const row of talks) {
    byTalk[row.talkId] = row.n
    if (!row.home) unassigned += row.n
    else byCwd[row.home] = (byCwd[row.home] || 0) + row.n
  }
  return { talks, byTalk, byCwd, unassigned }
}

export function unreadByHome(
  requests: Array<Record<string, unknown>>,
  localCwds: Set<string> | Array<{ cwd?: string; path?: string } | string>,
  selfId?: string,
): { byCwd: Record<string, number>; unassigned: number } {
  const sheet = unreadSheet(requests, localCwds, selfId)
  return { byCwd: sheet.byCwd, unassigned: sheet.unassigned }
}

export function unreadOfTalk(
  sheet: UnreadSheet | null | undefined,
  talkId: string,
  lane?: 'workspace' | 'unassigned',
  currentHome?: string,
): number {
  const want = String(talkId || '')
  if (!sheet || !want) return 0
  const row = sheet.talks.find((item) => item.talkId === want)
  if (!row) return 0
  if (lane) return mailOnLane([row.home], lane, currentHome || '', false) ? row.n : 0
  return row.n
}

export function unreadOfRoster(
  sheet: UnreadSheet | null | undefined,
  rosterId: string,
  lane: 'workspace' | 'unassigned',
  currentHome: string,
): number {
  const want = String(rosterId || '')
  if (!sheet || !want) return 0
  let n = 0
  for (const row of sheet.talks) {
    if (row.rosterId !== want) continue
    if (mailOnLane([row.home], lane, currentHome, false)) n += row.n
  }
  return n
}

export type ImBrowse = {
  threadId: string | null
  topicId: string | null
  lane: 'workspace' | 'unassigned'
}

/** IM 面板 full/half 或撕出的浮窗才是可见区。 */
export function imPaneOpen(panelState?: string | null, floatingIm?: unknown): boolean {
  return panelState === 'full' || panelState === 'half' || !!floatingIm
}

/** IM closed: current cwd + 未分. IM open: 未分 only. Folds unreadSheet. */
export function imUnreadMouth(
  split: { byCwd?: Record<string, number>; unassigned?: number } | null | undefined,
  imOpen: boolean,
  currentHome?: string,
): number {
  const byCwd = split && split.byCwd && typeof split.byCwd === 'object' ? split.byCwd : {}
  const currentN = currentHome ? (Number(byCwd[normalizeCwd(currentHome)]) || 0) : 0
  const unassigned = Number(split && split.unassigned) || 0
  return (imOpen ? 0 : currentN) + unassigned
}

export function imBrowseOccupancy(browse: ImBrowse | null | undefined): ImBrowse {
  const lane = browse && browse.lane === 'unassigned' ? 'unassigned' : 'workspace'
  const threadId = browse && browse.threadId ? String(browse.threadId) : null
  const topicId = threadId && browse && browse.topicId ? String(browse.topicId) : null
  return { threadId, topicId, lane }
}

/** Occupancy of a visible IM pane. Missing talk on this lane becomes an empty list. Hidden panes keep occupancy. */
export function imBrowseForVisibleTalk(
  browse: ImBrowse | null | undefined,
  present: ((threadId: string, lane: ImBrowse['lane']) => boolean) | null | undefined,
): ImBrowse {
  const next = imBrowseOccupancy(browse)
  if (!next.threadId) return { threadId: null, topicId: null, lane: next.lane }
  if (typeof present === 'function' && !present(next.threadId, next.lane)) {
    return { threadId: null, topicId: null, lane: next.lane }
  }
  return next
}
