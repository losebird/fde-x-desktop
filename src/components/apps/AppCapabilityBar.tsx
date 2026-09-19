import { useState } from 'react'
import type { FdeAppSpec, FdePlatformUse } from '@/lib/app-spec'
import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

const LABELS: Record<FdePlatformUse, string> = {
  ai: '问 AI',
  float: '撕出浮窗',
  files: '打开文件',
  memory: '打开记忆',
  im: '打开 IM',
  briefing: '打开早报',
  biz: '打开业务记录',
}

type Props = {
  spec: FdeAppSpec
}

export function AppCapabilityBar({ spec }: Props) {
  const uses = (spec.uses ?? []).filter((item): item is FdePlatformUse => item in LABELS)
  const [note, setNote] = useState('')
  if (!uses.length) return null

  const run = async (use: FdePlatformUse) => {
    setNote('')
    const state = useApp.getState()
    if (use === 'ai') {
      const cwd = loadCurrentWorkspaceCwd()
      if (!cwd.ok) {
        setNote(cwd.error)
        return
      }
      try {
        const created = await runtimeApi.createAiSession({ cwd: cwd.cwd })
        await runtimeApi.renameAiSession(created.sessionId, `${spec.name} · 问`).catch(() => undefined)
        state.setActiveAiSessionId(created.sessionId)
        if (state.sidebarCollapsed) state.toggleSidebar()
        await runtimeApi.promptAi(created.sessionId, {
          text: `我正在用应用「${spec.name}」。${spec.description || ''}请根据这个应用里已有的记录帮我。不要写外部业务系统。`,
        })
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : '未能打开 AI 会话')
      }
      return
    }
    if (use === 'float') {
      state.setPanelState('data', 'tab')
      const width = Math.min(1180, Math.max(420, Math.round(window.innerWidth * 0.82)))
      const height = Math.min(820, Math.max(360, Math.round(window.innerHeight * 0.84)))
      state.openFloating('data', {
        width,
        height,
        x: Math.max(16, Math.round((window.innerWidth - width) / 2)),
        y: Math.max(16, Math.round((window.innerHeight - height) / 2)),
      })
      return
    }
    if (use === 'files') {
      state.togglePanel('files', 'full')
      return
    }
    if (use === 'memory') {
      state.togglePanel('memory', 'full')
      return
    }
    if (use === 'im') {
      state.togglePanel('im', 'full')
      return
    }
    if (use === 'briefing') {
      state.togglePanel('briefing', 'full')
      return
    }
    if (use === 'biz') {
      state.setActiveDataSubview('records')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-app-uses={uses.join(',')}>
      {uses.map((use) => (
        <button
          key={use}
          type="button"
          className="btn h-7"
          data-app-use={use}
          onClick={() => { void run(use) }}
        >
          {LABELS[use]}
        </button>
      ))}
      {note && <span className="text-xs text-accent-red">{note}</span>}
    </div>
  )
}
