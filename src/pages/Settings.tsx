import { useEffect, useRef, useState } from 'react'
import { Activity, Bell, Bot, Brain, Database, Keyboard, Palette, User, type LucideIcon } from 'lucide-react'
import { PageTitle } from '@/components/ui'
import { kitControl } from '@/components/surface/classes'
import { SurfaceNav } from '@/components/surface/NavList'
import { AccountSection } from '@/components/settings/sections/Account'
import { AppearanceSection } from '@/components/settings/sections/Appearance'
import { DataSection } from '@/components/settings/sections/Data'
import { NotificationsSection } from '@/components/settings/sections/Notifications'
import { RuntimeSection } from '@/components/settings/sections/Runtime'
import { ShortcutsSection } from '@/components/settings/sections/Shortcuts'
import { CoreSettings } from '@/components/settings/CoreSettings'
import { SemanticSettings } from '@/components/settings/SemanticSettings'
import { StatusErrorBoundary } from '@/components/settings/StatusErrorBoundary'

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'account', label: '账户', icon: User },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'notifs', label: '通知', icon: Bell },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'core', label: 'AI 核心', icon: Bot },
  { id: 'semantic', label: '语义记忆', icon: Brain },
  { id: 'runtime', label: '运行环境', icon: Activity },
  { id: 'data', label: '存储与数据', icon: Database },
]

export default function Settings() {
  const [section, setSection] = useState('appearance')
  const frame = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  const current = SECTIONS.find((item) => item.id === section) ?? SECTIONS[1]

  useEffect(() => {
    const node = frame.current
    if (!node) return
    const apply = () => setWide(node.getBoundingClientRect().width >= 560)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onOpen = (event: Event) => {
      const sectionId = String((event as CustomEvent<{ section?: string }>).detail?.section || '')
      if (SECTIONS.some((item) => item.id === sectionId)) setSection(sectionId)
    }
    window.addEventListener('fde-x-settings-open', onOpen)
    return () => window.removeEventListener('fde-x-settings-open', onOpen)
  }, [])

  return (
    <div ref={frame}>
      <PageTitle title="设置" subtitle="账户、外观、通知、快捷键、AI 核心、语义记忆、运行环境、存储与数据" />
      <div className={wide ? 'grid grid-cols-[200px_minmax(0,1fr)] items-start gap-6' : 'grid items-start gap-6'}>
        {wide ? (
          <div className="rounded-kit-lg border border-kit-line bg-kit-card p-2 shadow-kit">
            <SurfaceNav value={section} onChange={setSection} items={SECTIONS} />
          </div>
        ) : (
          <label className="block">
            <span className="sr-only">分类</span>
            <select
              aria-label="分类"
              className={`${kitControl} h-8`}
              value={section}
              onChange={(event) => setSection(event.target.value)}
            >
              {SECTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        )}
        <div className="min-w-0">
          <h2 className="mb-3 text-kit-title font-medium text-kit-ink">{current.label}</h2>
          <StatusErrorBoundary key={section}>
            {section === 'account' && <AccountSection />}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'notifs' && <NotificationsSection />}
            {section === 'shortcuts' && <ShortcutsSection />}
            {section === 'core' && <CoreSettings />}
            {section === 'semantic' && <SemanticSettings />}
            {section === 'runtime' && <RuntimeSection />}
            {section === 'data' && <DataSection />}
          </StatusErrorBoundary>
        </div>
      </div>
    </div>
  )
}
