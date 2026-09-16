// 根据 view 渲染对应 page 组件。在 StageModal 内显示,带 .stage-content class 触发 PageTitle 隐藏 CSS。
import { useApp } from '@/store/app'
import type { SidePanelItem } from '@/store/app'
import Briefing from '@/pages/Briefing'
import Plan from '@/pages/Plan'
import Files from '@/pages/Files'
import { IMWorkspace } from './IMWorkspace'
import Data from '@/pages/Data'
import MCP from '@/pages/MCP'
import Skills from '@/pages/Skills'
import Memory from '@/pages/Memory'
import Settings from '@/pages/Settings'
import clsx from 'clsx'

export function PanelContent({
  item,
  className,
}: {
  item: SidePanelItem
  className?: string
}) {
  const immersive = item.view === 'im' || item.view === 'memory'
  return (
    // @container:面板内所有 @md/@3xl 断点以面板宽度为准,不依赖视口
    // IM / 语义画布贴合面板四边；其他页面保持留白和独立滚动。
    <div className={clsx('stage-content w-full h-full min-h-0 @container', className)}>
      <div className={clsx(
        immersive ? 'h-full min-h-0 overflow-hidden' : 'px-6 py-5 min-h-full overflow-auto',
      )}>
        <ViewSwitch view={item.view} />
      </div>
    </div>
  )
}

function ViewSwitch({ view }: { view: SidePanelItem['view'] }) {
  // 这里直接渲染 page:PageTitle 被 CSS 隐藏,StageModal 顶部已经有 title bar,所以不会有重复。
  switch (view) {
    case 'im':       return <IMWorkspace compact />
    case 'briefing': return <Briefing />
    case 'plan':     return <Plan />
    case 'files':    return <Files />
    case 'data':     return <Data />
    case 'mcp':      return <MCP />
    case 'skills':   return <Skills />
    case 'memory':   return <Memory />
    case 'settings': return <Settings />
    default:         return null
  }
}
