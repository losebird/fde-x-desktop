/** Round-end pending: what may paint on RecordsPanel / enter session cache. */

import { writeTokenLive } from './write-confirm.ts'

export function isFailedRoundEndSheet(sheet: Record<string, unknown> | null | undefined): boolean {
  if (!sheet || typeof sheet !== 'object') return true
  if (sheet.ok === false) return true
  const err = String(sheet.error || '').trim()
  if (err === 'TOO_MANY') return true
  return false
}

/** Official SSE may paint. Hand preview (`ui`) and raw lan-assist hall do not. */
export function shouldApplyPendingSheetSource(source: string | null | undefined): boolean {
  const value = String(source || '').trim()
  return value !== 'lan-assist' && value !== 'ui'
}

export type WriteResultAffordance = 'lookup' | 'confirm' | 'pick-rows' | 'pick-cells' | 'unbound' | 'write'

/** Next human action the workstation actually affords. Token beats pick; 对不上 beats listed. */
export function writeResultAffordance(pending: {
  action?: string
  previewId?: string
  listed?: boolean
  blockConfirm?: boolean
  hasPicks?: boolean
  lookupBound?: boolean
  rows?: number
}): WriteResultAffordance {
  const action = String(pending.action || '').trim()
  const rows = Number(pending.rows) || 0
  if (!action || action === '现查') return 'lookup'
  if (String(pending.previewId || '').trim()) return 'confirm'
  if (pending.hasPicks) return 'pick-cells'
  if (pending.blockConfirm || (pending.lookupBound && rows === 0)) return 'unbound'
  if (pending.listed && pending.lookupBound && rows >= 2) return 'pick-rows'
  return 'write'
}

/** Caption for the records pending chip. 待确认 only with a write token. */
export function writePendingHeadline(pending: {
  action?: string
  kind?: string
  rows?: number
  previewId?: string
  listed?: boolean
  blockConfirm?: boolean
  hasPicks?: boolean
  sessionId?: string
}): string {
  const kind = String(pending.kind || '').trim()
  const rows = Number(pending.rows) || 0
  const afford = writeResultAffordance(pending)
  if (afford === 'lookup') {
    const sid = String(pending.sessionId || '').trim()
    return `AI 刚查了 ${kind} · ${rows} 行${sid ? ` · 会话 ${sid.slice(0, 8)}` : ''}`
  }
  if (afford === 'confirm') return `AI 拟改 ${kind} ${rows} 行 · 待确认`
  if (afford === 'pick-rows') return `AI 拟改 ${kind} ${rows} 行 · 待点选`
  if (afford === 'pick-cells') return `AI 拟改 ${kind} · 待点格`
  if (afford === 'unbound') return `${kind}格对不上`
  return `AI 拟改 ${kind} ${rows} 行`
}

function sheetHasPicks(sheet: Record<string, unknown> | null | undefined): boolean {
  const cells = sheet && Array.isArray(sheet.cells) ? sheet.cells : []
  return cells.some((cell) => (
    cell && typeof cell === 'object'
    && Array.isArray((cell as { picks?: unknown }).picks)
    && (cell as { picks: unknown[] }).picks.length > 0
  ))
}

function whereTermsConstrain(where: unknown): boolean {
  if (!Array.isArray(where)) return false
  return where.some((term) => {
    if (!term || typeof term !== 'object') return false
    const row = term as { keys?: unknown; values?: unknown; text?: unknown; textPass?: unknown }
    const vals = Array.isArray(row.values)
      ? row.values.map((item) => String(item ?? '').trim()).filter(Boolean)
      : []
    if (!vals.length) return false
    if (row.text === true || row.textPass === 'contains') return true
    const keys = Array.isArray(row.keys) ? row.keys.map((item) => String(item || '').trim()).filter(Boolean) : []
    return keys.length > 0
  })
}

function sheetLookupBound(sheet: Record<string, unknown>) {
  if (String(sheet.lookupNo || '').trim()) return true
  if (whereTermsConstrain(sheet.where ?? sheet.listWhere)) return true
  if (whereTermsConstrain(sheet.hopWhere)) return true
  const from = sheet.from
  if (from && typeof from === 'object' && !Array.isArray(from) && whereTermsConstrain((from as { where?: unknown }).where)) return true
  if (Array.isArray(sheet.steps) && sheet.steps.some((step) => {
    if (!step || typeof step !== 'object') return false
    const row = step as { no?: unknown; where?: unknown }
    return Boolean(String(row.no || '').trim()) || whereTermsConstrain(row.where)
  })) return true
  return false
}

export function writePendingFieldsFromSheet(sheet: Record<string, unknown>) {
  return {
    listed: sheet.listed === true || sheet.ambiguous === true,
    blockConfirm: sheet.blockConfirm === true,
    hasPicks: sheetHasPicks(sheet),
    lookupBound: sheetLookupBound(sheet),
  }
}

/** Chip/affordance view of the official sheet. Closed tokens are not confirm. */
export function writePendingViewFromSheet(
  sheet: Record<string, unknown>,
  extra: { sessionId?: string; at?: number; tokenIndex?: Record<string, string> | null } = {},
) {
  const previewId = String(sheet.preview_id ?? sheet.previewId ?? '').trim()
  const livePreview = previewId && writeTokenLive(sheet, extra.tokenIndex) ? previewId : ''
  const sessionId = String(extra.sessionId || sheet.sessionId || '').trim()
  return {
    action: String(sheet.action || '').trim(),
    kind: String(sheet.kind || '').trim(),
    rows: Array.isArray(sheet.rows) ? sheet.rows.length : 0,
    previewId: livePreview,
    canWrite: Boolean(sheet.canWrite ?? sheet.can_write),
    ...writePendingFieldsFromSheet(sheet),
    sessionId: sessionId || undefined,
    at: extra.at,
  }
}

/** Successful round-end list / write preview (not refuse/TOO_MANY tool sheets). */
export function shouldStageRoundEndPending(sheet: Record<string, unknown> | null | undefined): boolean {
  if (isFailedRoundEndSheet(sheet)) return false
  const action = String(sheet?.action || '').trim()
  const previewId = String(sheet?.preview_id ?? sheet?.previewId ?? '').trim()
  const rows = Array.isArray(sheet?.rows) ? sheet!.rows!.length : 0
  if (previewId && action !== '现查') return rows > 0
  if (action === '现查') return rows > 0 || sheet?.querySettled === true
  return rows > 0 && Boolean(action)
}
