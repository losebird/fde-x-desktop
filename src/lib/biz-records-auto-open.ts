import { rememberBizPendingSheet } from '@/lib/biz-session-sheet'
import { shouldStageRoundEndPending } from '@/lib/biz-pending-stage'
import { registerFdeEventListener } from '@/lib/events'
import { useApp } from '@/store/app'

let registered = false

/** Successful 现查 round-end must focus records even from 操作记录; other lists keep the operations guard. */
export function shouldFocusBizRecordsForPending(sheet: Record<string, unknown>): boolean {
  const action = String(sheet.action || '').trim()
  if (action === '现查' && shouldStageRoundEndPending(sheet)) return true
  return useApp.getState().activeDataSubview !== 'operations'
}

export function onBizSheetPending(event: { payload: unknown; source?: string }) {
  const payload = event.payload as { sheet?: Record<string, unknown>; source?: string }
  const source = String(event.source || payload.source || '').trim()
  if (source === 'lan-assist') return
  const sheet = payload.sheet && typeof payload.sheet === 'object' ? payload.sheet : null
  if (!sheet || !shouldStageRoundEndPending(sheet)) return
  rememberBizPendingSheet(sheet)
  if (!shouldFocusBizRecordsForPending(sheet)) return
  useApp.getState().focusBizRecordsPanel()
}

/** Register before React mounts so SSE cannot be missed during IMScreen hydration. */
export function ensureBizRecordsAutoOpen() {
  if (registered) return
  registered = true
  registerFdeEventListener(['biz.sheet.pending'], onBizSheetPending)
}
