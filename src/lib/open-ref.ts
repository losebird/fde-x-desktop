import { openFilesAtPath } from '@/lib/app-platform'
import { applyDataLand } from '@/lib/data-browse'
import { useApp } from '@/store/app'

export type OpenRefHref = {
  panel?: string
  pane?: string
  tab?: string
  taskId?: string
  requestId?: string
  peerId?: string
  groupId?: string
  sessionId?: string
  agentId?: string
  traceId?: string
  rowId?: string
  slug?: string
  entity?: string
  kind?: string
  briefingId?: string
  path?: string
  cardId?: string
  originId?: string
  workspaceAppId?: string | null
}

const PLAN_TABS = new Set(['todo', 'schedule', 'workflow'])

export function revealAi(sessionId?: string) {
  const app = useApp.getState()
  const memory = app.panels.find((panel) => panel.id === 'memory' || panel.view === 'memory')
  if (memory && (memory.state === 'full' || memory.state === 'half')) {
    app.togglePanel('memory', 'tab')
  }
  window.dispatchEvent(new CustomEvent('fde-x-ai-open', {
    detail: { sessionId: String(sessionId || '') },
  }))
}

export function openRef(href: OpenRefHref) {
  const app = useApp.getState()
  if (href.sessionId) app.setActiveAiSessionId(href.sessionId)
  if (href.agentId) app.setActiveAgent(href.agentId)

  const panel = String(href.panel || '')
  if (panel === 'ai') {
    revealAi(href.sessionId)
    return
  }
  if (panel === 'im') {
    const threadId = href.peerId || href.groupId || href.requestId
    app.openIMPanel(threadId)
    if (href.groupId && href.requestId) {
      app.setImBrowse({
        threadId: href.groupId,
        topicId: href.requestId,
        lane: app.imBrowse.lane || 'workspace',
      })
    }
    return
  }
  if (panel === 'plan') {
    if (href.tab && PLAN_TABS.has(href.tab)) app.setActivePlanTab(href.tab as 'todo' | 'schedule' | 'workflow')
    if (href.taskId) app.selectTask(href.taskId)
    app.togglePanel('plan', 'full')
    return
  }
  if (panel === 'data') {
    app.setDataBrowse(applyDataLand(app.dataBrowse, href))
    app.togglePanel('data', 'full')
    return
  }
  if (panel === 'briefing') {
    app.togglePanel('briefing', 'full')
    return
  }
  if (panel === 'files') {
    if (href.path) openFilesAtPath(href.path)
    else app.togglePanel('files', 'full')
    return
  }
  if (panel === 'memory') {
    app.setMemoryBrowse({
      pane: href.pane || 'home',
      drawer: '',
      cardId: href.cardId || '',
      originId: href.originId || '',
    })
    app.togglePanel('memory', 'full')
    return
  }
  if (panel) app.togglePanel(panel, 'full')
}
