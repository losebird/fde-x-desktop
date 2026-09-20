import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { rememberBizKindListSheet } from '@/lib/biz-kind-list-cache'
import { shouldSkipCoveringPending } from './connected-kind.ts'

const GLOBAL_PENDING_KEY = ''

/** In-memory pending preview sheets keyed by AI session (not persisted). */
const pendingBySession = new Map<string, { sheet: Record<string, unknown>; at: number }>()

const dismissedPreviewIds = new Set<string>()
const DISMISSED_STORAGE_KEY = 'fde.biz.dismissedPreviewIds'

function loadDismissedFromStorage() {
  if (typeof sessionStorage === 'undefined') return
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    for (const id of parsed) {
      const next = String(id || '').trim()
      if (next) dismissedPreviewIds.add(next)
    }
  } catch {
    // ignore corrupt storage
  }
}

function persistDismissedToStorage() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...dismissedPreviewIds]))
  } catch {
    // ignore quota / private mode
  }
}

loadDismissedFromStorage()

function pendingStorageKey(sessionId?: string | null): string {
  const sid = sessionId === undefined ? '' : String(sessionId || '').trim()
  return sid || GLOBAL_PENDING_KEY
}

function sheetSessionKey(sheet: Record<string, unknown>): string {
  const sid = String(sheet.sessionId || '').trim()
  return sid || GLOBAL_PENDING_KEY
}

/** Named session only hydrates a sheet stamped with that sessionId. */
export function sheetBelongsToSession(
  sheet: Record<string, unknown> | null | undefined,
  sessionId?: string | null,
): boolean {
  const sid = String(sessionId || '').trim()
  if (!sid) return true
  if (!sheet || typeof sheet !== 'object') return false
  return String(sheet.sessionId || '').trim() === sid
}

export function sheetPreviewIdFromRecord(sheet: Record<string, unknown>) {
  const id = sheet.preview_id ?? sheet.previewId
  return typeof id === 'string' ? id : ''
}

export function isBizPreviewDismissed(sheet: Record<string, unknown>) {
  const previewId = sheetPreviewIdFromRecord(sheet)
  const action = String(sheet.action || '')
  return Boolean(previewId && action !== '现查' && dismissedPreviewIds.has(previewId))
}

export function dismissBizPreviewId(previewId: string) {
  if (previewId) {
    dismissedPreviewIds.add(previewId)
    persistDismissedToStorage()
  }
}

export function clearBizPreviewDismissed(previewId: string) {
  if (previewId) {
    dismissedPreviewIds.delete(previewId)
    persistDismissedToStorage()
  }
}

export function rememberBizPendingSheet(sheet: Record<string, unknown>) {
  if (!sheet || typeof sheet !== 'object') return
  if (isBizPreviewDismissed(sheet)) return
  const action = String(sheet.action || '')
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  if (action === '现查' && rows.length > 0) {
    const ws = loadCurrentWorkspaceCwd()
    if (ws.ok) rememberBizKindListSheet(ws.cwd, sheet)
  }
  const key = sheetSessionKey(sheet)
  const prev = pendingBySession.get(key)?.sheet ?? null
  const prevRows = Array.isArray(prev?.rows) ? prev.rows : []
  if (shouldSkipCoveringPending(prev, sheet)) return
  if (
    String(sheet.action || '') === '现查'
    && Array.isArray(sheet.rows)
    && sheet.rows.length === 0
    && prevRows.length > 0
  ) return
  pendingBySession.set(key, { sheet, at: Date.now() })
}

export function peekBizPendingSheet(sessionId?: string | null): Record<string, unknown> | null {
  const key = pendingStorageKey(sessionId)
  const entry = pendingBySession.get(key)
  const sheet = entry?.sheet ?? null
  if (sheet && isBizPreviewDismissed(sheet)) return null
  return sheet
}

export function clearBizPendingSheet(sessionId?: string | null) {
  if (sessionId === undefined) {
    pendingBySession.clear()
    return
  }
  pendingBySession.delete(pendingStorageKey(sessionId))
}
