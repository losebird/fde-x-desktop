// 工作台主壳：AI 永久作为主工作区，IM 与业务能力统一从右侧功能面板打开。
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '@/store/app'
import { runtimeApi } from '@/lib/runtime-api'
import AI from '@/pages/AI'
import { CommandPalette } from './CommandPalette'
import { FloatingPanel } from './FloatingPanel'
import { IMMiniHeader } from './IMMiniHeader'
import { StagePanel } from './StagePanel'
import { ThumbnailStack } from './ThumbnailStack'

const ROUTE_PANEL: Record<string, string> = {
  im: 'im',
  briefing: 'briefing',
  plan: 'plan',
  tasks: 'plan',
  schedule: 'plan',
  files: 'files',
  data: 'data',
  mcp: 'mcp',
  skills: 'skills',
  memory: 'memory',
  settings: 'settings',
}

export function IMScreen() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const panels = useApp((state) => state.panels)
  const setPaletteOpen = useApp((state) => state.setPaletteOpen)
  const routeKey = pathname.split('/')[1] ?? ''
  const activePanel = panels.find((panel) => panel.state === 'full') ?? panels.find((panel) => panel.state === 'half')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        let status = await runtimeApi.aiStatus()
        if (!status.connected) status = await runtimeApi.connectAi()
        if (!alive || !status.connected) return
        const items = await runtimeApi.listAiWorkspaces()
        if (!alive || items.length === 0) return
        useApp.getState().replaceWorkspaces(items.map((item) => ({
          id: item.workspaceId,
          name: item.title || item.path.split('/').filter(Boolean).at(-1) || item.path,
          emoji: '📁',
          desc: item.path,
          cwd: item.path,
          createdAt: new Date().toISOString(),
        })))
      } catch {
        /* 文件/AI 页会各自再拉一次 */
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const panelId = ROUTE_PANEL[routeKey]
    if (!panelId) return
    const state = useApp.getState()
    if (state.panels.find((panel) => panel.id === panelId)?.state !== 'full') state.togglePanel(panelId, 'full')
    // /im、/files 等旧深链只负责打开右侧功能；主地址回到 AI，避免功能面板替换主工作区。
    navigate('/ai', { replace: true })
  }, [navigate, routeKey])

  useEffect(() => {
    let alive = true
    const tick = () => {
      void runtimeApi.imState().then((data) => {
        if (!alive) return
        const im = useApp.getState().panels.find((panel) => panel.id === 'im')
        if (im && (im.state === 'full' || im.state === 'half')) return
        const rows = Array.isArray(data.requests) ? data.requests as Array<Record<string, unknown>> : []
        const n = rows.filter((row) => row.unread && row.kind === 'incoming').length
        const badge = n || undefined
        if (im?.badge === badge) return
        useApp.getState().setPanelBadge('im', badge)
      }).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, 4000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
      if (event.key === 'Escape') {
        const state = useApp.getState()
        if (state.paletteOpen) {
          setPaletteOpen(false)
          return
        }
        const target = event.target
        if (target instanceof Element) {
          const field = target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
          if (field && !field.closest('[data-floating-title]')) return
        }
        if (Object.keys(state.floating).length > 0) {
          state.closeFloating()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [setPaletteOpen])

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-neutral-50">
      <div className="flex-1 min-w-0 flex flex-col">
        <IMMiniHeader />
        <div className="flex-1 min-h-0 flex relative">
          <main className="flex-1 min-w-0 min-h-0 bg-white">
            <AI />
          </main>
          <StagePanel item={activePanel} overlay={false} />
        </div>
      </div>
      <ThumbnailStack />
      <CommandPalette />
      <FloatingPanel />
    </div>
  )
}
