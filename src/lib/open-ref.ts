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
  section?: string
  cardId?: string
  originId?: string
  workspaceAppId?: string | null
  accessory?: string
}

const PLAN_TABS = new Set(['todo', 'schedule', 'workflow'])

export function revealAi(sessionId?: string, accessory?: string) {
  const app = useApp.getState()
  const memory = app.panels.find((panel) => panel.id === 'memory' || panel.view === 'memory')
  if (memory && (memory.state === 'full' || memory.state === 'half')) {
    app.togglePanel('memory', 'tab')
  }
  window.dispatchEvent(new CustomEvent('fde-x-ai-open', {
    detail: { sessionId: String(sessionId || ''), accessory: String(accessory || '') },
  }))
}

export function landRef(kind: string, extra: OpenRefHref = {}) {
  const key = String(kind || extra.kind || '').trim()
  if (key === 'file') {
    openRef({ ...extra, panel: 'files', path: extra.path })
    return
  }
  if (key === 'goal' || key === 'todo') {
    openRef({ ...extra, panel: 'plan', tab: extra.tab || 'todo', taskId: extra.taskId })
    return
  }
  if (key === 'workflow') {
    openRef({ ...extra, panel: 'plan', tab: extra.tab || 'workflow' })
    return
  }
  if (key === 'schedule' || key === 'job') {
    openRef({ ...extra, panel: 'plan', tab: extra.tab || 'schedule' })
    return
  }
  if (key === 'memory') {
    openRef({ ...extra, panel: 'memory' })
    return
  }
  if (key === 'session') {
    revealAi(extra.sessionId)
    return
  }
  if (key === 'terminal') {
    revealAi(extra.sessionId, 'terminal')
    return
  }
  if (key === 'plugin') {
    openRef({ ...extra, panel: 'settings', section: extra.section || 'core' })
    return
  }
  if (extra.panel) {
    openRef(extra)
    return
  }
  openRef({ ...extra, panel: 'settings', section: extra.section || 'core' })
}

export function openRef(href: OpenRefHref) {
  const app = useApp.getState()
  if (href.sessionId) app.setActiveAiSessionId(href.sessionId)
  if (href.agentId) app.setActiveAgent(href.agentId)

  const panel = String(href.panel || '')
  if (panel === 'ai') {
    revealAi(href.sessionId, href.accessory)
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
  if (panel === 'settings') {
    if (href.section) {
      window.dispatchEvent(new CustomEvent('fde-x-settings-open', { detail: { section: href.section } }))
    }
    app.togglePanel('settings', 'full')
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
