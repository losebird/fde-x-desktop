// 工作区切换器:切换、新建、编辑、删除工作区。
// 下拉与模态框通过 Portal 渲染到 body，避免被顶部横向滚动容器裁切。
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, FolderOpen, Link2, Plus, Settings, Unlink, X, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useApp, useCurrentWorkspace, useWorkspaces } from '@/store/app'
import { runtimeApi } from '@/lib/runtime-api'
import {
  getDirectoryPermission,
  getWorkspaceDirectory,
  removeWorkspaceDirectory,
  saveWorkspaceDirectory,
  type DirectoryPermission,
  type LocalDirectoryHandle,
} from '@/lib/workspaceDirectory'

const COLORS = [
  { id: 'blue', label: '蓝色', cls: 'bg-blue-500' },
  { id: 'amber', label: '琥珀', cls: 'bg-amber-500' },
  { id: 'violet', label: '紫色', cls: 'bg-violet-500' },
  { id: 'teal', label: '青色', cls: 'bg-teal-500' },
  { id: 'rose', label: '玫红', cls: 'bg-rose-500' },
  { id: 'slate', label: '灰色', cls: 'bg-slate-500' },
]

const COLOR_DOT: Record<string, string> = Object.fromEntries(COLORS.map((c) => [c.id, c.cls]))

type WorkspaceDraft = { name: string; emoji: string; desc: string; color: string; localDirectoryName: string; path: string }
const blankDraft = (): WorkspaceDraft => ({ name: '', emoji: '🧭', desc: '', color: 'blue', localDirectoryName: '', path: '' })

export function WorkspaceSwitcher() {
  const current = useCurrentWorkspace()
  const workspaces = useWorkspaces()
  const setActive = useApp((s) => s.setActiveWorkspace)
  const addWorkspace = useApp((s) => s.addWorkspace)
  const updateWorkspace = useApp((s) => s.updateWorkspace)
  const removeWorkspace = useApp((s) => s.removeWorkspace)

  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'manage' | 'new' | null>(null)
  const [draft, setDraft] = useState<WorkspaceDraft>(blankDraft())
  const [pendingDirectory, setPendingDirectory] = useState<LocalDirectoryHandle | null>(null)
  const [directoryPermission, setDirectoryPermission] = useState<DirectoryPermission | null>(null)
  const [directoryError, setDirectoryError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!open) return
    const position = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuWidth = 288
      setMenuPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
        top: rect.bottom + 6,
      })
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    position()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  useEffect(() => {
    let cancelled = false
    if (dialog === 'manage' && current) {
      setDraft({
        name: current.name,
        emoji: current.emoji,
        desc: current.desc,
        color: current.color ?? 'slate',
        localDirectoryName: current.localDirectoryName ?? '',
        path: current.cwd ?? '',
      })
      setPendingDirectory(null)
      setDirectoryPermission(null)
      setDirectoryError('')
      void getWorkspaceDirectory(current.id)
        .then(async (handle) => {
          if (cancelled || !handle) return
          setPendingDirectory(handle)
          setDirectoryPermission(await getDirectoryPermission(handle))
          setDraft((value) => ({ ...value, localDirectoryName: handle.name }))
        })
        .catch(() => {})
      setConfirmDelete(false)
    }
    if (dialog === 'new') {
      setDraft(blankDraft())
      setPendingDirectory(null)
      setDirectoryPermission(null)
      setDirectoryError('')
      setConfirmDelete(false)
    }
    return () => { cancelled = true }
  }, [dialog, current?.id])

  if (!current) return null

  const openDialog = (kind: 'manage' | 'new') => {
    setOpen(false)
    setDialog(kind)
  }

  const chooseDirectory = async () => {
    setDirectoryError('')
    try {
      const path = await runtimeApi.pickAiWorkspaceDirectory()
      if (!path) return
      const name = path.split('/').filter(Boolean).at(-1) || path
      setPendingDirectory(null)
      setDirectoryPermission('granted')
      setDraft((value) => ({
        ...value,
        path,
        localDirectoryName: name,
        name: value.name.trim() ? value.name : name,
      }))
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : '无法选择这个文件夹')
    }
  }

  const unlinkDirectory = () => {
    setPendingDirectory(null)
    setDirectoryPermission(null)
    setDirectoryError('')
    setDraft((value) => ({ ...value, localDirectoryName: '', path: '' }))
  }

  const saveCurrent = async () => {
    if (!draft.name.trim()) return
    updateWorkspace(current.id, {
      name: draft.name.trim(), emoji: draft.emoji.trim() || '🧭',
      desc: draft.desc.trim() || '暂无工作区说明', color: draft.color,
      localDirectoryName: draft.localDirectoryName || undefined,
      localDirectoryLinkedAt: draft.localDirectoryName ? new Date().toISOString() : undefined,
    })
    if (pendingDirectory) await saveWorkspaceDirectory(current.id, pendingDirectory)
    else await removeWorkspaceDirectory(current.id).catch(() => {})
    setDialog(null)
  }

  const createWorkspace = async () => {
    const path = draft.path.trim()
    if (!draft.name.trim() || !path.startsWith('/')) {
      setDirectoryError('请填写本机绝对路径，重启后才会还在')
      return
    }
    setDirectoryError('')
    try {
      const created = await runtimeApi.createAiWorkspace({ path, title: draft.name.trim() })
      const id = addWorkspace({
        id: created.workspaceId,
        name: draft.name.trim(),
        emoji: draft.emoji.trim() || '🧭',
        desc: draft.desc.trim() || path,
        color: draft.color,
        cwd: created.path || path,
        localDirectoryName: draft.localDirectoryName || path.split('/').filter(Boolean).at(-1),
        localDirectoryLinkedAt: new Date().toISOString(),
      })
      if (pendingDirectory) await saveWorkspaceDirectory(id, pendingDirectory)
      setActive(id)
      setDialog(null)
    } catch (cause) {
      setDirectoryError(cause instanceof Error ? cause.message : '创建工作区失败')
    }
  }

  const deleteCurrent = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (removeWorkspace(current.id)) {
      await removeWorkspaceDirectory(current.id).catch(() => {})
      setDialog(null)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-full text-sm transition-colors border border-line',
          open ? 'bg-surface-2 ring-1 ring-line border-transparent' : 'hover:bg-surface-2 bg-surface',
        )}
        title={`当前工作区: ${current.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', COLOR_DOT[current.color ?? 'slate'] ?? 'bg-slate-500')} />
        <span className="text-base leading-none">{current.emoji}</span>
        <span className="font-medium max-w-[120px] truncate">{current.name}</span>
        <ChevronDown size={12} className={clsx('text-ink-subtle transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-72 bg-surface border border-line rounded-lg shadow-pop py-1.5"
          style={{ left: menuPos.left, top: menuPos.top, zIndex: 10000 }}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-subtle">切换工作区</div>
          {workspaces.map((w) => {
            const active = w.id === current.id
            return (
              <button
                key={w.id}
                onClick={() => { setActive(w.id); setOpen(false) }}
                className={clsx('w-full px-3 py-2 flex items-start gap-2.5 text-left', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}
                role="menuitem"
              >
                <span className="text-xl leading-none mt-0.5">{w.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', COLOR_DOT[w.color ?? 'slate'] ?? 'bg-slate-500')} />
                    <span className={clsx('text-sm truncate', active && 'font-medium text-brand')}>{w.name}</span>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-2 leading-snug">{w.desc}</div>
                </div>
                {active && <Check size={14} className="text-brand mt-1 shrink-0" />}
              </button>
            )
          })}
          <div className="my-1 border-t border-line" />
          <button onClick={() => openDialog('manage')} className="w-full px-3 py-1.5 text-sm hover:bg-surface-2 flex items-center gap-2 text-ink-muted" role="menuitem">
            <Settings size={14} /> 管理当前工作区…
          </button>
          <button onClick={() => openDialog('new')} className="w-full px-3 py-1.5 text-sm hover:bg-surface-2 flex items-center gap-2 text-ink-muted" role="menuitem">
            <Plus size={14} /> 新建工作区…
          </button>
          <div className="px-3 py-1.5 text-[10px] text-ink-subtle border-t border-line mt-1">
            工作区隔离:Agent / AI 会话 / 记忆 / 文件 / 工作流
          </div>
        </div>,
        document.body,
      )}

      {dialog && createPortal(
        <div className="fixed inset-0 z-[10020] bg-ink/25 flex items-center justify-center p-4" onClick={() => setDialog(null)}>
          <div className="bg-surface border border-line rounded-xl shadow-pop w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium">{dialog === 'new' ? '新建工作区' : '管理当前工作区'}</h3>
                <p className="text-xs text-ink-muted mt-0.5">{dialog === 'new' ? '创建一套独立的 Agent、会话、记忆和文件空间。' : '修改名称、标识和说明，或删除当前工作区。'}</p>
              </div>
              <button className="btn-ghost p-1" onClick={() => setDialog(null)} aria-label="关闭工作区管理"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-[72px_1fr] gap-3">
                <label className="text-xs text-ink-muted pt-2">图标</label>
                <input className="input w-20 text-center text-xl" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} maxLength={4} />
                <label className="text-xs text-ink-muted pt-2">名称</label>
                <input className="input w-full" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="例如:客户 A 项目" />
                <label className="text-xs text-ink-muted pt-2">说明</label>
                <textarea className="input w-full min-h-24 resize-y" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} placeholder="这个工作区用于处理什么?" />
                <label className="text-xs text-ink-muted pt-1.5">本地目录</label>
                <div>
                  <div className={clsx('rounded-lg border p-3', draft.localDirectoryName ? 'border-brand/30 bg-brand-soft/40' : 'border-dashed border-line bg-surface-2/50')}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center text-ink-muted shrink-0"><FolderOpen size={17} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{draft.localDirectoryName || '尚未选择文件夹'}</div>
                        <div className="text-[11px] text-ink-muted mt-0.5 break-all">
                          {draft.path
                            ? draft.path
                            : '点选择文件夹，用系统对话框选出目录。浏览器选夹拿不到真实路径，重启会丢。'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="btn flex-1 justify-center" onClick={() => void chooseDirectory()}>
                        <Link2 size={13} /> {draft.path ? '更换文件夹' : '选择本地文件夹'}
                      </button>
                      {draft.localDirectoryName && <button className="btn px-2.5" onClick={unlinkDirectory} title="取消关联"><Unlink size={13} /></button>}
                    </div>
                  </div>
                  {directoryError && <div className="text-[11px] text-accent-red mt-1.5">{directoryError}</div>}
                </div>
                <label className="text-xs text-ink-muted pt-1.5">标识色</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button key={color.id} onClick={() => setDraft({ ...draft, color: color.id })} className={clsx('w-8 h-8 rounded-full flex items-center justify-center border-2', draft.color === color.id ? 'border-ink' : 'border-transparent hover:border-line')} title={color.label}>
                      <span className={clsx('w-4 h-4 rounded-full', color.cls)} />
                    </button>
                  ))}
                </div>
              </div>

              {dialog === 'manage' && (
                <div className="pt-4 border-t border-line">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-accent-red">删除工作区</div>
                      <div className="text-xs text-ink-muted mt-0.5">将同时删除这里的 Agent、AI 会话、记忆、文件和工作流。</div>
                    </div>
                    <button className={clsx('btn shrink-0', confirmDelete && '!bg-red-50 !text-accent-red !border-red-200')} disabled={workspaces.length <= 1} onClick={deleteCurrent}>
                      <Trash2 size={13} /> {confirmDelete ? '再次点击确认' : '删除'}
                    </button>
                  </div>
                  {workspaces.length <= 1 && <div className="text-xs text-ink-subtle mt-2">至少需要保留一个工作区。</div>}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-line bg-surface-2 flex justify-end gap-2">
              <button className="btn" onClick={() => setDialog(null)}>取消</button>
              <button className="btn-primary" disabled={!draft.name.trim() || (dialog === 'new' && !draft.path.trim())} onClick={dialog === 'new' ? () => void createWorkspace() : saveCurrent}>
                {dialog === 'new' ? '创建并进入' : '保存修改'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
