import { useState } from 'react'
import { X } from 'lucide-react'
import { runtimeApi, type AiPresetRecord, type PresetImportPreview } from '@/lib/runtime-api'

type Tab = 'dir' | 'git'

const SOURCE_LABEL: Record<AiPresetRecord['source'], string> = {
  shipped: '随包',
  user: '用户',
  root: '根',
  fde: 'FDE',
}

export function sourceLabel(source: AiPresetRecord['source']) {
  return SOURCE_LABEL[source] || source
}

export { SOURCE_LABEL }

type Props = {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function PresetImportDrawer({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('dir')
  const [path, setPath] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [gitSubdir, setGitSubdir] = useState('')
  const [preview, setPreview] = useState<PresetImportPreview | null>(null)
  const [tempPath, setTempPath] = useState('')
  const [cloneRoot, setCloneRoot] = useState('')
  const [overrideId, setOverrideId] = useState('')
  const [trusted, setTrusted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [gitDisabledHint, setGitDisabledHint] = useState('')

  if (!open) return null

  const resetPreview = () => {
    setPreview(null)
    setTempPath('')
    setCloneRoot('')
    setOverrideId('')
    setTrusted(false)
    setError('')
  }

  const runCheck = () => {
    setBusy(true)
    setError('')
    setGitDisabledHint('')
    resetPreview()
    const task = tab === 'dir'
      ? runtimeApi.previewImportPresetDir({ path: path.trim() }).then((data) => ({ preview: data.preview, tempPath: undefined as string | undefined, cloneRoot: undefined as string | undefined }))
      : runtimeApi.previewImportPresetGit({ url: gitUrl.trim(), subdir: gitSubdir.trim() || undefined }).then((data) => ({
        preview: data.preview,
        tempPath: data.tempPath,
        cloneRoot: data.cloneRoot,
      }))
    void task.then((data) => {
      setPreview(data.preview)
      if (data.tempPath) setTempPath(data.tempPath)
      if (data.cloneRoot) setCloneRoot(data.cloneRoot)
    }).catch((cause) => {
      const message = cause instanceof Error ? cause.message : '检查失败'
      setError(message)
      if (message.includes('git_import_disabled') || message.includes('Git 导入未开启')) {
        setGitDisabledHint('在 peer 栈启动前设置环境变量 FDE_ALLOW_GIT_IMPORT=1，并重启 runtime（4319）后再试。')
      }
    }).finally(() => setBusy(false))
  }

  const runImport = () => {
    if (!preview || !trusted) return
    setBusy(true)
    setError('')
    const body = tab === 'dir'
      ? { path: path.trim(), id: overrideId.trim() || undefined }
      : { tempPath, cloneRoot: cloneRoot || undefined, id: overrideId.trim() || undefined }
    const task = tab === 'dir'
      ? runtimeApi.confirmImportPresetDir(body as { path: string; id?: string })
      : runtimeApi.confirmImportPresetGit(body as { tempPath: string; cloneRoot?: string; id?: string })
    void task.then(() => {
      onImported()
      onClose()
    }).catch((cause) => setError(cause instanceof Error ? cause.message : '导入失败'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/20 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md h-full border-l border-line shadow-[-8px_0_32px_rgba(0,0,0,0.08)] rounded-l-xl p-5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium">导入 Agent 预设</h3>
          <button type="button" className="btn-ghost p-1" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button type="button" className={tab === 'dir' ? 'btn-primary h-8 px-3 text-xs' : 'btn h-8 px-3 text-xs'} onClick={() => { setTab('dir'); resetPreview() }}>本地目录</button>
          <button type="button" className={tab === 'git' ? 'btn-primary h-8 px-3 text-xs' : 'btn h-8 px-3 text-xs'} onClick={() => { setTab('git'); resetPreview() }}>Git 地址</button>
        </div>

        {tab === 'dir' ? (
          <label className="block mb-3">
            <div className="text-xs text-ink-muted mb-1">本机目录（含 agent.cordis.yml，目录名即 preset id）</div>
            <input className="input w-full font-mono text-xs" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/tmp/preset-demo" />
          </label>
        ) : (
          <div className="space-y-3 mb-3">
            <label className="block">
              <div className="text-xs text-ink-muted mb-1">Git 仓库 URL</div>
              <input className="input w-full font-mono text-xs" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder="https://github.com/…" />
            </label>
            <label className="block">
              <div className="text-xs text-ink-muted mb-1">子目录（可选）</div>
              <input className="input w-full font-mono text-xs" value={gitSubdir} onChange={(e) => setGitSubdir(e.target.value)} placeholder="minimal-zh" />
            </label>
            {gitDisabledHint && (
              <div className="text-xs text-ink-muted p-3 rounded bg-surface-2 border border-line">{gitDisabledHint}</div>
            )}
          </div>
        )}

        {error && <div className="mb-3 text-xs text-accent-red">{error}</div>}

        <button type="button" className="btn-primary mb-4" disabled={busy || (tab === 'dir' ? !path.trim() : !gitUrl.trim())} onClick={runCheck}>
          {busy ? '检查中…' : '检查'}
        </button>

        {preview && (
          <div className="border border-line rounded-lg p-3 space-y-3 mb-4">
            <div>
              <div className="text-sm font-medium">{preview.name || preview.id}</div>
              <div className="text-[11px] font-mono text-ink-subtle">{preview.id}</div>
              {preview.description && <div className="text-xs text-ink-muted mt-1">{preview.description}</div>}
            </div>
            {preview.hasLocalCode && (
              <div className="text-xs text-accent-amber">含本地代码 — 将以 shell 级信任运行，请先审查文件。</div>
            )}
            {preview.warnings?.map((line) => (
              <div key={line} className="text-xs text-accent-amber">{line}</div>
            ))}
            <div>
              <div className="text-xs text-ink-muted mb-1">文件清单</div>
              <ul className="text-[11px] font-mono text-ink-subtle max-h-32 overflow-y-auto space-y-0.5">
                {preview.files.map((file) => <li key={file}>{file}</li>)}
              </ul>
            </div>
            <label className="block">
              <div className="text-xs text-ink-muted mb-1">自定义 id（冲突时可改）</div>
              <input className="input w-full font-mono text-xs" value={overrideId} onChange={(e) => setOverrideId(e.target.value)} placeholder={preview.id} />
            </label>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />
              <span>我了解此 preset 将以 shell 级信任运行</span>
            </label>
            <button type="button" className="btn-primary w-full" disabled={busy || !trusted} onClick={runImport}>
              {busy ? '导入中…' : '导入'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
