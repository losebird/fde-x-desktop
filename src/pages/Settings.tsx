import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Activity, Bell, Bot, Brain, Database, Keyboard, Palette, User, type LucideIcon } from 'lucide-react'
import { PageTitle } from '@/components/ui'
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
import { useApp } from '@/store/app'

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
  const landed = useApp((s) => s.settingsBrowse.section)
  const setSettingsBrowse = useApp((s) => s.setSettingsBrowse)
  const initial = SECTIONS.some((item) => item.id === landed) ? landed : 'appearance'
  const [section, setSection] = useState(initial)
  const frame = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  const current = SECTIONS.find((item) => item.id === section) ?? SECTIONS[1]

  useEffect(() => {
    if (SECTIONS.some((item) => item.id === landed)) setSection(landed)
  }, [landed])

  const pickSection = (id: string) => {
    setSection(id)
    setSettingsBrowse({ section: id })
  }

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
      <PageTitle title="设置" subtitle="本机工作台的账户、外观和核心。" />
      <div className={wide ? 'grid grid-cols-[184px_minmax(0,1fr)] items-start gap-6' : 'grid items-start gap-4'}>
        <div className={wide ? 'sticky top-0' : undefined}>
          <SurfaceNav
            value={section}
            onChange={pickSection}
            items={SECTIONS}
            layout={wide ? 'stack' : 'wrap'}
          />
        </div>
        <div className={clsx('min-w-0', !wide && 'border-t border-kit-line pt-4')}>
          <h2 className="mb-4 text-[15px] font-semibold tracking-tight text-kit-ink">{current.label}</h2>
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
