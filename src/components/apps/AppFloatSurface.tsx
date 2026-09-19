import { useEffect, useState } from 'react'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { isFdeAppSpec, type FdeAppDetail } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export function AppFloatSurface({ appId }: { appId: string }) {
  const workspace = useApp((s) => s.workspaces.find((row) => row.id === s.activeWorkspaceId))
  const cwd = workspace?.cwd && workspace.cwd.startsWith('/') ? workspace.cwd : ''
  const [app, setApp] = useState<FdeAppDetail | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    void runtimeApi.getDeclarativeApp(appId)
      .then((detail) => setApp(detail))
      .catch((cause) => {
        setApp(null)
        setError(cause instanceof Error ? cause.message : '打开应用失败')
      })
  }

  useEffect(() => {
    let alive = true
    setError('')
    setApp(null)
    void runtimeApi.getDeclarativeApp(appId)
      .then((detail) => { if (alive) setApp(detail) })
      .catch((cause) => {
        if (!alive) return
        setApp(null)
        setError(cause instanceof Error ? cause.message : '打开应用失败')
      })
    return () => { alive = false }
  }, [appId])

  if (error) {
    return <div className="px-4 py-8 text-sm text-accent-red">{error}</div>
  }
  if (!app || !cwd) {
    return <div className="px-4 py-8 text-sm text-ink-muted">正在打开工作面…</div>
  }
  if (!isFdeAppSpec(app.spec)) {
    return <div className="px-4 py-8 text-sm text-ink-muted">不是声明式应用</div>
  }
  return (
    <div data-app-float-surface="true" data-app-float-id={appId}>
      <AppRuntime
        app={app}
        workspaceCwd={cwd}
        variant="workspace"
        onChanged={load}
      />
    </div>
  )
}
