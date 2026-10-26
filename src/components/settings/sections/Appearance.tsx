import { HostNsPanel } from '@/components/settings/HostNsPanel'

export function AppearanceSection() {
  return (
    <HostNsPanel
      home="appearance"
      title="外观"
      hint="主题和语言由本机核心保存。核心起来以后，这里会列出可以改的项目。"
    />
  )
}
