import { SurfaceGroup } from '@/components/surface/Group'

const SHORTCUTS = [
  ['全局搜索', '⌘ K'],
  ['新会话', '⌘ N'],
  ['新建任务', '⌘ T'],
  ['新建事件', '⌘ E'],
  ['打开早报', '⌘ 0'],
  ['切换 IM 静音', '⌘ ;'],
  ['上一会话', '⌘ ↑'],
  ['下一会话', '⌘ ↓'],
] as const

export function ShortcutsSection() {
  return (
    <SurfaceGroup hint="这些是工作台里已经接上的按键。这一页不能改键位。">
      {SHORTCUTS.map(([label, keys]) => (
        <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-kit text-kit-ink">{label}</span>
          <span className="shrink-0">
            {keys.split(' ').map((key) => <span key={key} className="kbd ml-1">{key}</span>)}
          </span>
        </div>
      ))}
    </SurfaceGroup>
  )
}
