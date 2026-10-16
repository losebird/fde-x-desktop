import { runtimeApi } from '@/lib/runtime-api'
import { appIsTrashed, type FdeAppDetail } from '@/lib/app-spec'

type Props = {
  app: FdeAppDetail
  publicSurface?: boolean
  variant?: 'dialog' | 'workspace'
  onRequestDelete?: () => void
  onActivate?: () => void
  pendingMaterialize?: boolean
}

export function AppWebRuntime({
  app,
  publicSurface = false,
  variant,
  onRequestDelete,
  onActivate,
  pendingMaterialize,
}: Props) {
  const trashed = appIsTrashed(app)
  const liveSrc = runtimeApi.shareId
    ? `/a/${encodeURIComponent(runtimeApi.shareId)}/`
    : `${runtimeApi.baseUrl}/api/v1/apps/${encodeURIComponent(app.id)}/live/`

  return (
    <div className={variant === 'dialog' || variant === 'workspace' ? '' : 'border-t border-line'}>
      {publicSurface ? null : (
        <div className="px-4 py-2 flex flex-wrap items-center justify-end gap-2 border-b border-line bg-surface-2">
          {pendingMaterialize && !trashed && onActivate && (
            <button type="button" className="btn-brand h-7" onClick={onActivate}>
              {app.status === 'draft' ? '采纳并激活' : '激活本次修订'}
            </button>
          )}
          {app.status === 'draft' && !trashed && onRequestDelete && (
            <button type="button" className="btn h-7" onClick={onRequestDelete}>删除草稿</button>
          )}
        </div>
      )}
      <iframe
        title={app.name}
        src={liveSrc}
        className="w-full min-h-[560px] bg-white"
        data-app-web-host="true"
      />
    </div>
  )
}
