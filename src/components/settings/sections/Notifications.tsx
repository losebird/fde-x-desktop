import { useEffect, useState } from 'react'
import { SurfaceSwitch } from '@/components/surface/Switch'
import { requestOsNotifyPermission } from '@/lib/task-notify'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

function osPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

function taskDoneHint(perm: NotificationPermission | 'unsupported') {
  if (perm === 'granted') return '计划待办完成、工作流跑完、会话这一轮结束时提示。窗口在后台时走系统通知中心。'
  if (perm === 'denied') return '浏览器拒绝了系统通知。打开「系统设置 → 通知」，允许 Chrome 或 FDE-X。'
  if (perm === 'unsupported') return '计划待办完成、工作流跑完、会话这一轮结束时提示。当前环境没有系统通知接口。'
  return '计划待办完成、工作流跑完、会话这一轮结束时提示。打开后请允许本页发送通知，后台才能弹出系统横幅。'
}

function syncBffPrefs() {
  const state = useApp.getState()
  void runtimeApi.setNotifyPrefs({
    taskDueSoonNotify: state.taskDueSoonNotify,
    mcpDownNotify: state.mcpDownNotify,
  }).catch(() => undefined)
}

export function NotificationsSection() {
  const imMuted = useApp((s) => s.imMuted)
  const setMuted = useApp((s) => s.setIMMuted)
  const taskDoneNotify = useApp((s) => s.taskDoneNotify)
  const setTaskDoneNotify = useApp((s) => s.setTaskDoneNotify)
  const taskDueSoonNotify = useApp((s) => s.taskDueSoonNotify)
  const setTaskDueSoonNotify = useApp((s) => s.setTaskDueSoonNotify)
  const mcpDownNotify = useApp((s) => s.mcpDownNotify)
  const setMcpDownNotify = useApp((s) => s.setMcpDownNotify)
  const muteBlocksIm = useApp((s) => s.muteBlocksIm)
  const setMuteBlocksIm = useApp((s) => s.setMuteBlocksIm)
  const [perm, setPerm] = useState(osPermission)

  useEffect(() => {
    syncBffPrefs()
  }, [taskDueSoonNotify, mcpDownNotify])

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
        label="任务完成时提醒"
        hint={taskDoneHint(perm)}
        checked={taskDoneNotify}
        onCheckedChange={(next) => {
          setTaskDoneNotify(next)
          if (next) {
            void requestOsNotifyPermission().then((value) => setPerm(value))
          }
        }}
      />
      <SurfaceSwitch
        label="任务截止前 24h 提醒"
        hint="待办截止日前 24 小时内提醒一次，进铃铛；后台走系统通知。"
        checked={taskDueSoonNotify}
        onCheckedChange={(next) => {
          setTaskDueSoonNotify(next)
          if (next) void requestOsNotifyPermission().then((value) => setPerm(value))
        }}
      />
      <SurfaceSwitch
        label="MCP 连接异常时推送"
        hint="已接连接器从正常变成连不上时推送。邮件连接器不在这一轮巡检里。"
        checked={mcpDownNotify}
        onCheckedChange={(next) => {
          setMcpDownNotify(next)
          if (next) void requestOsNotifyPermission().then((value) => setPerm(value))
        }}
      />
      <SurfaceSwitch
        label="静音时不接收任何 IM"
        hint="顶栏喇叭关掉时，未读 IM 不进铃铛、角标也不亮。打开 IM 仍能看见来信。"
        checked={muteBlocksIm}
        onCheckedChange={setMuteBlocksIm}
      />
    </section>
  )
}
