export const PERSONAL_WORKSPACE_ID = 'ws_personal'

export function sessionListWorkspaceId(
  activeWorkspaceId: string,
  workspaces: Array<{ id?: string }>,
): string {
  const active = String(activeWorkspaceId || '').trim()
  if (active) return active
  for (const row of workspaces || []) {
    const id = String(row?.id || '').trim()
    if (id) return id
  }
  return PERSONAL_WORKSPACE_ID
}

export async function takeSessionList<T>(
  workspaceId: string,
  list: (workspaceId: string) => Promise<T[]>,
): Promise<T[]> {
  const id = String(workspaceId || '').trim()
  if (!id) throw new Error('session list workspace is empty')
  return list(id)
}

export type SessionListGate<T = unknown> = {
  generation: number
  applied?: T
}

export async function reloadSessionList<T>(
  gate: SessionListGate<T>,
  load: () => Promise<T>,
  apply: (value: T) => void,
): Promise<T> {
  const issued = ++gate.generation
  const value = await load()
  if (issued !== gate.generation) {
    if (gate.applied !== undefined) return gate.applied
    return value
  }
  gate.applied = value
  apply(value)
  return value
}

const UNNAMED_SESSION_TITLE = '未命名会话'

export type SessionTitleNotice = {
  sessionId: string
  title: string
  cwd?: string
}

type SessionListRow = {
  sessionId: string
  title?: string
  cwd?: string
}

type TitleListener = (notice: SessionTitleNotice) => void

let heldTitles = new Map<string, SessionTitleNotice>()
const titleListeners = new Set<TitleListener>()

export function resetRenamedSessionTitles(): void {
  heldTitles = new Map()
}

function cleanNotice(input: { sessionId?: unknown; title?: unknown; cwd?: unknown } | null | undefined): SessionTitleNotice | null {
  if (!input || typeof input !== 'object') return null
  const sessionId = String(input.sessionId ?? '').trim()
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!sessionId || !title) return null
  const cwd = typeof input.cwd === 'string' ? input.cwd.trim() : ''
  return cwd ? { sessionId, title, cwd } : { sessionId, title }
}

function isPlaceholderTitle(title: unknown): boolean {
  if (typeof title !== 'string') return true
  const trimmed = title.trim()
  return trimmed.length === 0 || trimmed === UNNAMED_SESSION_TITLE
}

function rememberTitle(notice: SessionTitleNotice) {
  heldTitles.set(notice.sessionId, notice)
}

export function noteRenamedSessionTitle(input: { sessionId?: string; title?: string; cwd?: string }): boolean {
  const notice = cleanNotice(input)
  if (!notice) return false
  rememberTitle(notice)
  for (const listener of titleListeners) listener(notice)
  return true
}

export function publishSuccessfulRename(
  result: unknown,
  input: { sessionId?: string; title?: string; cwd?: string },
): boolean {
  if (result == null) return false
  return noteRenamedSessionTitle(input)
}

export function subscribeRenamedSessionTitle(listener: TitleListener): () => void {
  titleListeners.add(listener)
  return () => {
    titleListeners.delete(listener)
  }
}

export function renamedNoticeFromEvent(event: {
  payload?: unknown
  workspaceCwd?: string | null
  sessionId?: string
} | null | undefined): SessionTitleNotice | null {
  if (!event || typeof event !== 'object') return null
  const payload = event.payload
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  if (row.kind !== 'renamed') return null
  const payloadCwd = typeof row.cwd === 'string' ? row.cwd : ''
  const eventCwd = typeof event.workspaceCwd === 'string' ? event.workspaceCwd : ''
  return cleanNotice({
    sessionId: typeof row.sessionId === 'string' && row.sessionId.trim() ? row.sessionId : event.sessionId,
    title: row.title,
    cwd: payloadCwd.trim() ? payloadCwd : eventCwd,
  })
}

export function applySessionList<T extends SessionListRow>(
  rows: readonly T[],
  notice: SessionTitleNotice | null,
  options?: { appendMissing?: boolean },
): T[] {
  const clean = cleanNotice(notice)
  if (clean) rememberTitle(clean)
  const list = Array.isArray(rows) ? rows : []
  const seen = new Set<string>()
  const next = list.map((row) => {
    const sessionId = String(row?.sessionId || '')
    if (sessionId) seen.add(sessionId)
    const fromEvent = clean && clean.sessionId === sessionId ? clean : undefined
    if (fromEvent) {
      if (row.title === fromEvent.title) return row
      return { ...row, title: fromEvent.title }
    }
    const held = heldTitles.get(sessionId)
    if (!held) return row
    if (isPlaceholderTitle(row?.title)) {
      if (row.title === held.title) return row
      return { ...row, title: held.title }
    }
    if (typeof row.title === 'string' && row.title.trim() !== held.title) heldTitles.delete(sessionId)
    return row
  })
  const appendMissing = options?.appendMissing !== false
  if (appendMissing && clean && !seen.has(clean.sessionId)) {
    next.push({
      sessionId: clean.sessionId,
      title: clean.title,
      updatedAt: Date.now(),
      running: false,
      blank: false,
      ...(clean.cwd ? { cwd: clean.cwd } : {}),
    } as T)
  }
  return next
}
