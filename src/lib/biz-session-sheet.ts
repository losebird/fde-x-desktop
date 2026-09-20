import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { rememberBizKindListSheet } from '@/lib/biz-kind-list-cache'

/** In-memory pending preview sheet for the current browser session (not persisted). */
let lastPending: { sheet: Record<string, unknown>; at: number } | null = null

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
  const prevRows = Array.isArray(lastPending?.sheet?.rows) ? lastPending.sheet.rows : []
  const prevAction = String(lastPending?.sheet?.action || '')
  const prevSpeech = String(lastPending?.sheet?.speech || '').trim()
  const nextSpeech = String(sheet.speech || '').trim()
  if (
    action === '现查'
    && rows.length === 0
    && prevRows.length > 0
    && (!prevAction || prevAction === '现查')
    && (!prevSpeech || !nextSpeech || prevSpeech === nextSpeech)
  ) return
  lastPending = { sheet, at: Date.now() }
}

export function peekBizPendingSheet(): Record<string, unknown> | null {
  const sheet = lastPending?.sheet ?? null
  if (sheet && isBizPreviewDismissed(sheet)) return null
  return sheet
}

export function clearBizPendingSheet() {
  lastPending = null
}
