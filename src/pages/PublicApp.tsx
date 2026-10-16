import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppRuntime } from '@/components/apps/AppRuntime'
import { type FdeAppDetail } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

export default function PublicApp() {
  const { shareId = '' } = useParams()
  const [app, setApp] = useState<FdeAppDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = String(shareId || '').trim()
    runtimeApi.bindShare(id)
    if (!id) {
      setApp(null)
      setError('分享不存在或已停止')
      return () => { runtimeApi.unbindShare() }
    }
    let cancelled = false
    setError('')
    void runtimeApi.getSharedApp(id).then((detail) => {
      if (cancelled) return
      setApp(detail)
    }).catch((cause) => {
      if (cancelled) return
      setApp(null)
      setError(cause instanceof Error ? cause.message : '分享不存在或已停止')
    })
    return () => {
      cancelled = true
      runtimeApi.unbindShare()
    }
  }, [shareId])

  const refresh = () => {
    const id = String(shareId || '').trim()
    if (!id) return
    void runtimeApi.getSharedApp(id).then(setApp).catch(() => undefined)
  }

  return (
    <div className="min-h-screen bg-canvas text-ink" data-app-public="true">
      <div className="px-4 py-3 border-b border-line">
        <div className="text-sm font-medium truncate">{app?.name || ''}</div>
      </div>
      {error ? (
        <div className="px-4 py-8 text-sm text-ink-muted">{error}</div>
      ) : app ? (
        <AppRuntime
          app={app}
          workspaceCwd=""
          variant="workspace"
          publicSurface
          onChanged={refresh}
        />
      ) : (
        <div className="px-4 py-8 text-sm text-ink-muted">正在打开…</div>
      )}
    </div>
  )
}
