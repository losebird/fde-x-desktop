import { ChevronLeft } from 'lucide-react'
import { SurfaceButton } from '@/components/surface'
import { SkillFiles } from '@/components/skills/SkillFiles'
import type { SkillBagItem } from '@/lib/runtime-api'

export function SkillDetail({
  row,
  showBack,
  busy,
  files,
  editor,
  newRel,
  onBack,
  onToggle,
  onUninstall,
  onOpenFile,
  onRemoveFile,
  onNewRel,
  onAddFile,
  onEdit,
  onSaveFile,
}: {
  row: SkillBagItem | null
  showBack: boolean
  busy: boolean
  files: Array<{ rel: string; type: string }>
  editor: { rel: string; text: string } | null
  newRel: string
  onBack: () => void
  onToggle: (row: SkillBagItem, enabled: boolean) => void
  onUninstall: (row: SkillBagItem) => void
  onOpenFile: (rel: string, type: string) => void
  onRemoveFile: (rel: string) => void
  onNewRel: (value: string) => void
  onAddFile: () => void
  onEdit: (text: string) => void
  onSaveFile: () => void
}) {
  if (!row) {
    return (
      <div className="rounded-kit-lg border border-dashed border-kit-line px-4 py-8 text-center text-kit-sm text-kit-secondary">
        {showBack ? (
          <div className="mb-3">
            <SurfaceButton size="sm" variant="ghost" onClick={onBack}><ChevronLeft size={14} /> 返回</SurfaceButton>
          </div>
        ) : null}
        选一个技能查看说明和文件。
      </div>
    )
  }
  const manageable = row.origin === 'catalog' && Boolean(row.path)
  return (
    <div className="rounded-kit-lg border border-kit-line bg-kit-card px-3 py-3">
      <div className="flex items-center gap-2">
        {showBack ? (
          <SurfaceButton size="sm" variant="ghost" onClick={onBack}><ChevronLeft size={14} /> 返回</SurfaceButton>
        ) : null}
        <div className="min-w-0 flex-1 truncate text-kit-title font-semibold text-kit-ink">{row.name}</div>
      </div>
      {row.description ? <p className="mt-2 text-kit-sm leading-5 text-kit-secondary">{row.description}</p> : null}
      {Array.isArray(row.methods) && row.methods.length ? (
        <div className="mt-3">
          <div className="text-kit-sm font-medium text-kit-ink">方法</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.methods.map((method) => (
              <span key={method} className="rounded-kit bg-kit-muted px-2 py-0.5 text-kit-meta text-kit-ink">{method}</span>
            ))}
          </div>
        </div>
      ) : null}
      {Array.isArray(row.triggers) && row.triggers.length ? (
        <div className="mt-3">
          <div className="text-kit-sm font-medium text-kit-ink">触发词</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.triggers.map((trigger) => (
              <span key={trigger} className="rounded-kit bg-kit-muted px-2 py-0.5 text-kit-meta text-kit-ink">{trigger}</span>
            ))}
          </div>
        </div>
      ) : null}
      {row.path ? (
        <div className="mt-3">
          <div className="text-kit-sm font-medium text-kit-ink">来源</div>
          <div className="mt-1 break-all font-mono text-kit-meta text-kit-secondary">{row.path}</div>
        </div>
      ) : null}
      {manageable ? (
        <SkillFiles
          files={files}
          editor={editor}
          newRel={newRel}
          busy={busy}
          onOpen={onOpenFile}
          onRemove={onRemoveFile}
          onNewRel={onNewRel}
          onAdd={onAddFile}
          onEdit={onEdit}
          onSave={onSaveFile}
        />
      ) : null}
      <div className="mt-3 flex gap-2 border-t border-kit-line pt-3">
        {manageable ? (
          <SurfaceButton size="sm" disabled={busy} onClick={() => onToggle(row, row.modelInvocable === false)}>
            {row.modelInvocable === false ? '启用' : '停用'}
          </SurfaceButton>
        ) : null}
        {manageable ? (
          <SurfaceButton size="sm" variant="danger" disabled={busy} onClick={() => onUninstall(row)}>卸载</SurfaceButton>
        ) : null}
      </div>
    </div>
  )
}
