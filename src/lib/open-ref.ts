import { useApp } from '@/store/app'

export type OpenRefHref = {
  panel?: string
  tab?: string
  taskId?: string
  requestId?: string
  traceId?: string
  rowId?: string
  slug?: string
  entity?: string
  kind?: string
  briefingId?: string
}

export function openRef(href: OpenRefHref) {
  const app = useApp.getState()
  const panel = String(href.panel || '')
  if (panel === 'im' && href.requestId) {
    app.openIMPanel()
    app.togglePanel('im', 'full')
    return
  }
  if (panel === 'plan') {
    if (href.tab === 'todo' || href.tab) app.setActivePlanTab('todo')
    if (href.taskId) app.selectTask(href.taskId)
    app.togglePanel('plan', 'full')
    return
  }
  if (panel === 'data') {
    app.togglePanel('data', 'full')
    return
  }
  if (panel === 'briefing') {
    app.togglePanel('briefing', 'full')
    return
  }
  if (panel === 'files') {
    app.togglePanel('files', 'full')
    return
  }
  if (panel) app.togglePanel(panel, 'full')
}
