import { openFilesAtPath } from '@/lib/app-platform'
import { applyDataLand } from '@/lib/data-browse'
import { landMcpSegment } from '@/lib/mcp-browse'
import { revealAi } from '@/lib/reveal-ai'
import { useApp } from '@/store/app'
import { canonicalWorkspaceCwd, sameWorkspaceCwd } from '../../runtime/cwd.mjs'

export { revealAi }

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
  appRid?: string
  accessory?: string
  workspaceCwd?: string
}

const PLAN_TABS = new Set(['todo', 'schedule', 'workflow'])

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
    openRef({ ...extra, panel: 'ai', sessionId: extra.sessionId })
    return
  }
  if (key === 'terminal') {
    openRef({ ...extra, panel: 'ai', sessionId: extra.sessionId, accessory: 'terminal' })
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

function workspaceIdForCwd(cwd: string): string {
  const want = canonicalWorkspaceCwd(cwd)
  if (!want) return ''
  const hit = useApp.getState().workspaces.find((row) => sameWorkspaceCwd(row.cwd || '', want))
  return hit?.id || ''
}

export function openRef(href: OpenRefHref) {
  const app = useApp.getState()
  const landCwd = String(href.workspaceCwd || '').trim()
  if (landCwd) {
    const workspaceId = workspaceIdForCwd(landCwd)
    if (workspaceId) app.setActiveWorkspace(workspaceId)
  }
  if (href.sessionId) app.setActiveAiSessionId(href.sessionId)
  if (href.agentId) app.setActiveAgent(href.agentId)

  const panel = String(href.panel || '')
  if (panel === 'ai') {
    revealAi(href.sessionId, href.accessory, { cwd: landCwd })
    return
  }
  if (panel === 'im') {
    const threadId = href.peerId || href.groupId
    const requestId = String(href.requestId || '').trim()
    if (threadId) {
      app.openIMPanel(threadId)
      if (requestId) {
        app.setImBrowse({
          threadId,
          topicId: requestId,
          lane: app.imBrowse.lane || 'workspace',
        })
      }
      return
    }
    app.togglePanel('im', 'full')
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
    app.setBriefingBrowse({ land: Number(app.briefingBrowse?.land || 0) + 1 })
    app.togglePanel('briefing', 'full')
    return
  }
  if (panel === 'mcp') {
    if (href.section === 'business' || href.tab === 'business') landMcpSegment('business')
    app.togglePanel('mcp', 'full')
    return
  }
  if (panel === 'files') {
    if (href.path) openFilesAtPath(href.path)
    else app.togglePanel('files', 'full')
    return
  }
  if (panel === 'settings') {
    if (href.section) {
      app.setSettingsBrowse({ section: href.section })
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
