import { SurfaceBanner, SurfaceButton, SurfaceDialog, SurfaceField, SurfaceInput, SurfaceSelect } from '@/components/surface'

export function InstallDialog({
  open,
  source,
  root,
  roots,
  error,
  busy,
  onOpenChange,
  onSource,
  onRoot,
  onPick,
  onSave,
}: {
  open: boolean
  source: string
  root: string
  roots: Array<{ path: string; source: string }>
  error: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSource: (value: string) => void
  onRoot: (value: string) => void
  onPick: () => void
  onSave: () => void
}) {
  return (
    <SurfaceDialog open={open} onOpenChange={onOpenChange} title="安装技能" description="从本机目录装进一个技能根。">
      <div className="space-y-3">
        <SurfaceField label="来源目录">
          <div className="flex gap-2">
            <SurfaceInput aria-label="来源目录" className="font-mono" value={source} onChange={(event) => onSource(event.target.value)} />
            <SurfaceButton onClick={onPick}>选择</SurfaceButton>
          </div>
        </SurfaceField>
        <SurfaceField label="安装位置">
          <SurfaceSelect aria-label="安装位置" value={root} onChange={(event) => onRoot(event.target.value)}>
            <option value="">选择一个位置</option>
            {roots.map((row) => (
              <option key={row.path} value={row.path}>{row.source} · {row.path}</option>
            ))}
          </SurfaceSelect>
        </SurfaceField>
        {error ? <SurfaceBanner tone="danger">{error}</SurfaceBanner> : null}
        <div className="flex justify-end gap-2">
          <SurfaceButton onClick={() => onOpenChange(false)}>取消</SurfaceButton>
          <SurfaceButton variant="primary" disabled={busy} onClick={onSave}>{busy ? '安装中' : '安装'}</SurfaceButton>
        </div>
      </div>
    </SurfaceDialog>
  )
}
