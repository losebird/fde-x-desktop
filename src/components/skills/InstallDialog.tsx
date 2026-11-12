import { SurfaceBanner, SurfaceButton, SurfaceDialog, SurfaceField, SurfaceInput, SurfaceSelect } from '@/components/surface'

export type SkillScanFinding = { id?: string; severity?: string; title?: string; file?: string }
export type SkillPreview = {
  found: boolean
  hint?: string
  previewId?: string
  name?: string
  origin?: string
  source?: string
  match?: { slug?: string; displayName?: string; summary?: string }
  scan?: {
    engine?: string
    score?: number
    verdict?: string
    findings?: SkillScanFinding[]
    advice?: string
  }
}

export function InstallDialog({
  open,
  query,
  fallback,
  root,
  roots,
  error,
  busy,
  preview,
  onOpenChange,
  onQuery,
  onFallback,
  onRoot,
  onLookup,
  onConfirm,
  onBack,
}: {
  open: boolean
  query: string
  fallback: string
  root: string
  roots: Array<{ path: string; source: string }>
  error: string
  busy: boolean
  preview: SkillPreview | null
  onOpenChange: (open: boolean) => void
  onQuery: (value: string) => void
  onFallback: (value: string) => void
  onRoot: (value: string) => void
  onLookup: () => void
  onConfirm: () => void
  onBack: () => void
}) {
  const missing = preview && preview.found === false
  const ready = preview && preview.found === true
  const findings = ready ? (preview.scan?.findings || []) : []
  const verdict = ready ? String(preview.scan?.verdict || '') : ''
  const tone = verdict === 'do-not-install' ? 'danger' : verdict === 'review' ? 'warn' : 'quiet'

  return (
    <SurfaceDialog
      open={open}
      onOpenChange={onOpenChange}
      title="安装技能"
      description={ready ? '先看扫描结果，确认后再装。' : '填技能名称。找不到再补地址或命令。'}
    >
      <div className="space-y-3">
        {!ready ? (
          <SurfaceField label="技能名称">
            <SurfaceInput
              aria-label="技能名称"
              placeholder="例如 find-skill"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
            />
          </SurfaceField>
        ) : null}

        {missing ? (
          <SurfaceField label="安装地址或命令">
            <SurfaceInput
              aria-label="安装地址或命令"
              className="font-mono"
              placeholder="GitHub 地址 · clawhub install slug · npx skills add owner/repo"
              value={fallback}
              onChange={(event) => onFallback(event.target.value)}
            />
          </SurfaceField>
        ) : null}

        {ready ? (
          <div className="space-y-2 rounded-kit border border-kit-line p-3">
            <div className="text-kit-sm font-medium text-kit-ink">{preview.name}</div>
            <div className="text-kit-meta text-kit-secondary">来源 {preview.origin} · {preview.source}</div>
            {preview.match?.summary ? <div className="text-kit-sm text-kit-secondary">{preview.match.summary}</div> : null}
            <SurfaceBanner tone={tone}>
              风险 {preview.scan?.score ?? '—'} · {preview.scan?.advice || '已扫描'}
            </SurfaceBanner>
            {findings.length ? (
              <ul className="max-h-36 space-y-1 overflow-auto text-kit-sm text-kit-secondary">
                {findings.slice(0, 8).map((row, index) => (
                  <li key={`${row.id || 'f'}-${index}`}>
                    {row.severity} · {row.title}{row.file ? ` · ${row.file}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <SurfaceField label="安装位置">
          <SurfaceSelect aria-label="安装位置" value={root} onChange={(event) => onRoot(event.target.value)}>
            <option value="">选择一个位置</option>
            {roots.map((row) => (
              <option key={row.path} value={row.path}>{row.source} · {row.path}</option>
            ))}
          </SurfaceSelect>
        </SurfaceField>
        {error ? <SurfaceBanner tone="danger">{error}</SurfaceBanner> : null}
        {missing && preview?.hint ? <SurfaceBanner tone="quiet">{preview.hint}</SurfaceBanner> : null}
        <div className="flex justify-end gap-2">
          {ready ? <SurfaceButton onClick={onBack}>返回</SurfaceButton> : <SurfaceButton onClick={() => onOpenChange(false)}>取消</SurfaceButton>}
          {ready ? (
            <SurfaceButton variant="primary" disabled={busy} onClick={onConfirm}>{busy ? '安装中' : '确认安装'}</SurfaceButton>
          ) : (
            <SurfaceButton variant="primary" disabled={busy} onClick={onLookup}>{busy ? '查找中' : missing ? '用这个来源查找' : '查找'}</SurfaceButton>
          )}
        </div>
      </div>
    </SurfaceDialog>
  )
}
