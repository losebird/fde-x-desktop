import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { rememberBizKindListSheet } from '@/lib/biz-kind-list-cache'

/** In-memory pending preview sheet for the current browser session (not persisted). */
let lastPending: { sheet: Record<string, unknown>; at: number } | null = null

const dismissedPreviewIds = new Set<string>()

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
  if (previewId) dismissedPreviewIds.add(previewId)
}

export function clearBizPreviewDismissed(previewId: string) {
  if (previewId) dismissedPreviewIds.delete(previewId)
}

export function rememberBizPendingSheet(sheet: Record<string, unknown>) {
  if (!sheet || typeof sheet !== 'object') return
  if (isBizPreviewDismissed(sheet)) return
  const action = String(sheet.action || '')
  const rows = Array.isArray(sheet.rows) ? sheet.rows : []
  if (action === '现查' && rows.length > 1) {
    const ws = loadCurrentWorkspaceCwd()
    if (ws.ok) rememberBizKindListSheet(ws.cwd, sheet)
  }
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
