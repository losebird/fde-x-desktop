import { SurfaceButton, SurfaceInput, SurfaceTextarea } from '@/components/surface'

export function SkillFiles({
  files,
  editor,
  newRel,
  busy,
  onOpen,
  onRemove,
  onNewRel,
  onAdd,
  onEdit,
  onSave,
}: {
  files: Array<{ rel: string; type: string }>
  editor: { rel: string; text: string } | null
  newRel: string
  busy: boolean
  onOpen: (rel: string, type: string) => void
  onRemove: (rel: string) => void
  onNewRel: (value: string) => void
  onAdd: () => void
  onEdit: (text: string) => void
  onSave: () => void
}) {
  return (
    <div className="mt-3 border-t border-kit-line pt-3">
      <div className="text-kit-sm font-medium text-kit-ink">文件 {files.length}</div>
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {files.map((file) => (
          <div key={file.rel} className="flex items-center gap-1.5">
            <button
              type="button"
              className="min-w-0 flex-1 truncate rounded-kit px-2 py-1 text-left font-mono text-kit-meta text-kit-ink hover:bg-kit-muted disabled:text-kit-tertiary"
              disabled={file.type === 'dir'}
              onClick={() => onOpen(file.rel, file.type)}
            >
              {file.rel}
            </button>
            {file.type === 'file' ? (
              <SurfaceButton size="sm" variant="ghost" className="shrink-0" disabled={busy} onClick={() => onRemove(file.rel)}>删除</SurfaceButton>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <SurfaceInput aria-label="新文件" className="font-mono" value={newRel} placeholder="scripts/run.mjs" onChange={(event) => onNewRel(event.target.value)} />
        <SurfaceButton size="sm" className="shrink-0" disabled={busy || !newRel.trim()} onClick={onAdd}>新增</SurfaceButton>
      </div>
      {editor ? (
        <div className="mt-3">
          <div className="mb-1 font-mono text-kit-meta text-kit-secondary">{editor.rel}</div>
          <SurfaceTextarea aria-label="文件内容" className="font-mono" rows={8} value={editor.text} onChange={(event) => onEdit(event.target.value)} />
          <div className="mt-2">
            <SurfaceButton size="sm" disabled={busy} onClick={onSave}>保存文件</SurfaceButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
