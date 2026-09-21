import { isBizSurfaceTool } from '@/lib/biz-tool-events'
import { rememberBizPendingSheet } from '@/lib/biz-session-sheet'
import { registerFdeEventListener } from '@/lib/events'
import { runtimeApi } from '@/lib/runtime-api'
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
  registerFdeEventListener(['ai.tool.finished'], (event) => {
    const payload = event.payload as { tool?: string; ok?: boolean }
    if (!payload.ok) return
    const tool = String(payload.tool || '')
    if (!isBizSurfaceTool(tool)) return
    void runtimeApi.getBizPendingSheet().then(({ sheet }) => {
      if (!sheet || typeof sheet !== 'object') return
      const action = String(sheet.action || '')
      if (!action) return
      if (!String(sheet.sessionId || '').trim()) return
      rememberBizPendingSheet(sheet)
      if (useApp.getState().activeDataSubview === 'operations') return
      useApp.getState().focusBizRecordsPanel()
    }).catch(() => undefined)
  })
}
