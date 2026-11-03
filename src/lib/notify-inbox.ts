import { mailOnLane, normalizeCwd, talkKey, type UnreadSheet, type UnreadTalk } from '@/lib/im-letter-home'
import type { OpenRefHref } from '@/lib/open-ref'
import type { Notification as NoticeRow } from '@/lib/types'

export type InboxRow = {
  id: string
  source: 'task' | 'im'
  title: string
  body?: string
  ts?: string
  count?: number
  land: OpenRefHref
}

export function landNoticeHref(href?: string, sessionId?: string, cwd?: string): OpenRefHref {
  const key = String(href || '').trim()
  const sid = String(sessionId || '').trim()
  const workspaceCwd = String(cwd || '').trim()
  const aiLand = (): OpenRefHref => ({
    panel: 'ai',
    ...(sid ? { sessionId: sid } : {}),
    ...(workspaceCwd ? { workspaceCwd } : {}),
  })
  if (key === 'plan' || key === '/tasks' || key === 'todo') return { panel: 'plan' }
  if (key === 'ai' || key === '/ai') return aiLand()
  if (key === 'briefing' || key === '/briefing') return { panel: 'briefing' }
  if (key === 'im' || key === '/im') return { panel: 'im' }
  if (key === 'memory' || key === '/memory') return { panel: 'memory' }
  if (key === 'settings' || key === '/settings') return { panel: 'settings' }
  if (key === 'files' || key === '/files') return { panel: 'files' }
  if (key === 'mcp' || key === '/mcp') return { panel: 'mcp' }
  return aiLand()
}

export function inboxFromNotifications(rows: NoticeRow[]): InboxRow[] {
  return rows
    .filter((row) => !row.read)
    .map((row) => ({
      id: row.id,
      source: 'task' as const,
      title: row.title,
      body: row.body,
      ts: row.ts,
      land: landNoticeHref(row.href, row.sessionId, row.cwd),
    }))
}

function talkVisible(talk: UnreadTalk, imOpen: boolean, currentHome: string): boolean {
  if (imOpen) return mailOnLane([talk.home], 'unassigned', currentHome, false)
  return mailOnLane([talk.home], 'unassigned', currentHome, false)
    || mailOnLane([talk.home], 'workspace', currentHome, false)
}

function hallSelfId(hall: Record<string, unknown> | null | undefined): string {
  const self = hall && hall.self && typeof hall.self === 'object' ? hall.self as Record<string, unknown> : null
  return String(self?.id || '')
}

function hallRequests(hall: Record<string, unknown> | null | undefined): Array<Record<string, unknown>> {
  return hall && Array.isArray(hall.requests) ? hall.requests as Array<Record<string, unknown>> : []
}

function peerOfTalk(talk: UnreadTalk, selfId: string, requests: Array<Record<string, unknown>>): string {
  if (talk.rosterId) return talk.rosterId
  const row = requests.find((item) => talkKey(item) === talk.talkId)
  if (!row) return ''
  const from = String(row.from || '')
  if (from && from !== selfId) return from
  const to = Array.isArray(row.to) ? row.to.map((id) => String(id || '')).filter((id) => id && id !== selfId) : []
  return to[0] || from
}

function titleOfTalk(talk: UnreadTalk, selfId: string, requests: Array<Record<string, unknown>>): string {
  const row = requests.find((item) => talk.rosterId
    ? String(item.groupId || '') === talk.rosterId
    : talkKey(item) === talk.talkId)
  const named = String(row?.fromName || row?.groupName || row?.title || row?.peerName || '').trim()
  if (named) return named
  const peer = peerOfTalk(talk, selfId, requests)
  return peer ? `IM · ${peer}` : 'IM 未读'
}

export function inboxFromImSheet(
  sheet: UnreadSheet | null | undefined,
  hall: Record<string, unknown> | null | undefined,
  imOpen: boolean,
  currentHome: string,
): InboxRow[] {
  if (!sheet) return []
  const selfId = hallSelfId(hall)
  const requests = hallRequests(hall)
  const here = normalizeCwd(currentHome)
  const rows: InboxRow[] = []
  for (const talk of sheet.talks) {
    if (!talk.n) continue
    if (!talkVisible(talk, imOpen, here)) continue
    const peer = peerOfTalk(talk, selfId, requests)
    const unassigned = !normalizeCwd(talk.home)
    rows.push({
      id: `im_${talk.talkId}`,
      source: 'im',
      title: titleOfTalk(talk, selfId, requests),
      body: unassigned ? '未分工作区' : `${talk.n} 条未读`,
      count: talk.n,
      land: talk.rosterId
        ? { panel: 'im', groupId: talk.rosterId }
        : { panel: 'im', peerId: peer },
    })
  }
  return rows
}

export function collectInbox(
  notifications: NoticeRow[],
  sheet: UnreadSheet | null | undefined,
  hall: Record<string, unknown> | null | undefined,
  imOpen: boolean,
  currentHome: string,
  opts: { skipIm?: boolean } = {},
): InboxRow[] {
  return [
    ...(opts.skipIm ? [] : inboxFromImSheet(sheet, hall, imOpen, currentHome)),
    ...inboxFromNotifications(notifications),
  ]
}
