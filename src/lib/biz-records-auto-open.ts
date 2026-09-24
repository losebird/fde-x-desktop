import { rememberBizPendingSheet } from '@/lib/biz-session-sheet'
import { registerFdeEventListener } from '@/lib/events'
import { useApp } from '@/store/app'

let registered = false

export function onBizSheetPending(event: { payload: unknown; source?: string }) {
  const payload = event.payload as { sheet?: Record<string, unknown>; source?: string }
  const source = String(event.source || payload.source || '').trim()
  if (source === 'lan-assist') return
  if (payload.sheet && typeof payload.sheet === 'object') {
    rememberBizPendingSheet(payload.sheet)
  }
  if (useApp.getState().activeDataSubview === 'operations') return
  useApp.getState().focusBizRecordsPanel()
}

/** Register before React mounts so SSE cannot be missed during IMScreen hydration. */
export function ensureBizRecordsAutoOpen() {
  if (registered) return
  registered = true
  registerFdeEventListener(['biz.sheet.pending'], onBizSheetPending)
}
