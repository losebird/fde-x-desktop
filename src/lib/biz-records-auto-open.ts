import { rememberBizPendingSheet } from '@/lib/biz-session-sheet'
import { registerFdeEventListener } from '@/lib/events'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

const BIZ_TOOL_RE = /(?:preview|write|biz|gate|secretary|lookup|lan[-_]?assist|record)/i

let registered = false

export function onBizSheetPending(event: { payload: unknown }) {
  const payload = event.payload as { sheet?: Record<string, unknown> }
  if (payload.sheet && typeof payload.sheet === 'object') {
    rememberBizPendingSheet(payload.sheet)
  }
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
    if (!BIZ_TOOL_RE.test(tool)) return
    void runtimeApi.getBizPendingSheet().then(({ sheet }) => {
      if (!sheet || typeof sheet !== 'object') return
      const action = String(sheet.action || '')
      if (!action) return
      rememberBizPendingSheet(sheet)
      useApp.getState().focusBizRecordsPanel()
    }).catch(() => undefined)
  })
}
