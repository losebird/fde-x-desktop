import { SurfaceSwitch } from '@/components/surface/Switch'
import { useApp } from '@/store/app'

const UNWIRED = '核心还没有这个开关'

export function NotificationsSection() {
  const imMuted = useApp((s) => s.imMuted)
  const setMuted = useApp((s) => s.setIMMuted)
  return (
    <section className="rounded-kit-lg border border-kit-line bg-kit-card px-4 py-2 shadow-kit">
      <h3 className="pt-2 text-kit-title font-medium text-kit-ink">通知偏好</h3>
      <SurfaceSwitch
        label="早间 IM 静音模式"
        hint="工作日 07:00 到 10:00 自动静音"
        checked={imMuted}
        onCheckedChange={setMuted}
      />
      <SurfaceSwitch
        disabled
        label="任务截止前 24h 提醒"
        hint={UNWIRED}
        checked={false}
        onCheckedChange={() => undefined}
      />
      <SurfaceSwitch
        disabled
        label="MCP 连接异常时推送"
        hint={UNWIRED}
        checked={false}
        onCheckedChange={() => undefined}
      />
      <SurfaceSwitch
        disabled
        label="静音时不接收任何 IM"
        hint={UNWIRED}
        checked={false}
        onCheckedChange={() => undefined}
      />
    </section>
  )
}
