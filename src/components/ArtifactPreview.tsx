import { useMemo, useState } from 'react'
import { Download, ExternalLink, FileText, LayoutDashboard, Monitor, Presentation, Image as ImageIcon, X } from 'lucide-react'
import clsx from 'clsx'
import type { ChatArtifact, FileNode } from '@/lib/types'
import { useApp } from '@/store/app'

const KIND_LABEL: Record<ChatArtifact['kind'], string> = {
  image: '图片',
  poster: '海报',
  web: 'Web 页面',
  dashboard: '看板',
  ppt: 'PPT',
  file: '文件',
}

const KIND_ICON = {
  image: ImageIcon,
  poster: ImageIcon,
  web: Monitor,
  dashboard: LayoutDashboard,
  ppt: Presentation,
  file: FileText,
}

export function artifactKindLabel(kind: ChatArtifact['kind']) {
  return KIND_LABEL[kind]
}

export function ArtifactCard({
  artifact,
  onOpen,
}: {
  artifact: ChatArtifact
  onOpen: (artifact: ChatArtifact) => void
}) {
  const Icon = KIND_ICON[artifact.kind]
  return (
    <button
      type="button"
      onClick={() => onOpen(artifact)}
      className="w-full text-left rounded-lg border border-line bg-white hover:border-brand/40 hover:bg-brand-soft/30 overflow-hidden"
    >
      {artifact.preview && (artifact.kind === 'image' || artifact.kind === 'poster') && (
        <img src={artifact.preview} alt={artifact.title} className="w-full h-28 object-cover bg-surface-2" />
      )}
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-md bg-surface-2 border border-line flex items-center justify-center text-ink-muted shrink-0">
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{artifact.title}</div>
          <div className="text-[11px] text-ink-muted truncate mt-0.5">{KIND_LABEL[artifact.kind]}{artifact.subtitle ? ` · ${artifact.subtitle}` : ''}</div>
        </div>
        <span className="text-[11px] text-brand shrink-0">预览</span>
      </div>
    </button>
  )
}

export function ArtifactPreviewDialog({
  artifact,
  onClose,
}: {
  artifact: ChatArtifact | null
  onClose: () => void
}) {
  const files = useApp((s) => s.files)
  const setActiveFile = useApp((s) => s.setActiveFile)
  const togglePanel = useApp((s) => s.togglePanel)
  const file = artifact?.fileId ? files.find((f) => f.id === artifact.fileId) : null
  if (!artifact) return null

  const openInFiles = () => {
    if (!file) return
    setActiveFile(file.id)
    togglePanel('files', 'full')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10040] bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-line rounded-xl shadow-pop w-full max-w-4xl h-[min(720px,90vh)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-12 px-4 border-b border-line flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium truncate">{artifact.title}</span>
          <span className="text-[11px] text-ink-muted">{KIND_LABEL[artifact.kind]}</span>
          <div className="flex-1" />
          {file && (
            <button className="btn" onClick={openInFiles}>
              <ExternalLink size={13} /> 在文件面板打开
            </button>
          )}
          <button className="btn-ghost p-1.5" onClick={onClose} aria-label="关闭预览"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-surface-2/40">
          <ArtifactBody artifact={artifact} file={file ?? undefined} />
        </div>
      </div>
    </div>
  )
}

export function ArtifactBody({ artifact, file }: { artifact: ChatArtifact; file?: FileNode }) {
  const kind = artifact.kind
  const src = artifact.preview || (file?.kind === 'image' ? file.content : undefined)

  if ((kind === 'image' || kind === 'poster') && src) {
    return (
      <div className="h-full min-h-[420px] flex items-center justify-center p-6">
        <img src={src} alt={artifact.title} className={clsx('rounded shadow-card max-h-full', kind === 'poster' ? 'max-w-[420px]' : 'max-w-full')} />
      </div>
    )
  }

  if ((kind === 'web' || kind === 'dashboard' || file?.kind === 'web') && file?.content) {
    return <iframe title={artifact.title} srcDoc={file.content} className="w-full h-full min-h-[520px] bg-white border-0" sandbox="allow-same-origin" />
  }

  if (kind === 'ppt' || file?.kind === 'ppt') {
    return <PptPreview content={file?.content ?? ''} title={artifact.title} />
  }

  if (file?.kind === 'sheet' && file.content) {
    const rows = file.content.split('\n').filter(Boolean).map((line) => line.split(','))
    return (
      <div className="p-4">
        <table className="w-full text-sm bg-white border border-line rounded overflow-hidden">
          <thead className="bg-surface-2">
            <tr>{rows[0]?.map((c, i) => <th key={i} className="text-left px-3 py-2">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(1).map((r, i) => (
              <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-white border border-line rounded-lg p-6">
        <div className="text-sm font-medium">{file?.name ?? artifact.title}</div>
        <pre className="mt-3 text-xs whitespace-pre-wrap text-ink-muted font-mono">{file?.content || '暂无内嵌内容，可转到文件面板查看。'}</pre>
        <button className="btn mt-4"><Download size={13} /> 下载占位</button>
      </div>
    </div>
  )
}

function PptPreview({ content, title }: { content: string; title: string }) {
  const slides = useMemo(() => {
    try {
      const parsed = JSON.parse(content) as { title: string; body: string }[]
      return Array.isArray(parsed) && parsed.length ? parsed : [{ title, body: content }]
    } catch {
      return [{ title, body: content || '空白演示文稿' }]
    }
  }, [content, title])
  const [index, setIndex] = useState(0)
  const slide = slides[index]
  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex-1 bg-[#1F3A2E] text-[#F4E9C8] rounded-lg p-8 flex flex-col justify-center">
        <div className="text-xs opacity-70 mb-3">{index + 1} / {slides.length}</div>
        <h3 className="text-2xl font-semibold">{slide.title}</h3>
        <p className="mt-4 text-sm whitespace-pre-wrap leading-7 opacity-90">{slide.body}</p>
      </div>
      <div className="flex justify-between">
        <button className="btn" disabled={index === 0} onClick={() => setIndex((v) => Math.max(0, v - 1))}>上一页</button>
        <button className="btn" disabled={index >= slides.length - 1} onClick={() => setIndex((v) => Math.min(slides.length - 1, v + 1))}>下一页</button>
      </div>
    </div>
  )
}
