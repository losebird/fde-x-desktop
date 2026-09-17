// 文件模块:树形侧栏 + 列表 + 多种类型预览(image/md/code/json/csv/pdf)
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Folder, FolderOpen, FileText, Image as ImageIcon, FileCode, FileJson,
  FileSpreadsheet, FileAudio, File as FilePdf, Star, ChevronRight, Search,
  Upload, Plus, Trash2, ArrowLeft, Download, Eye, MoreHorizontal, Hash, Send,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import type { FileNode, FileVersion } from '@/lib/types'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { runtimeApi } from '@/lib/runtime-api'
import { loadCurrentAiTarget } from '@/lib/ai-target'

function kindFromName(name: string): FileNode['kind'] {
  const lower = name.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'sheet'
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif') || lower.endsWith('.svg')) return 'image'
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'web'
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'ppt'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'doc'
  if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) return 'audio'
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.py') || lower.endsWith('.css')) return 'code'
  return 'doc'
}

function isBinaryKind(kind: FileNode['kind']) {
  return kind === 'image' || kind === 'pdf' || kind === 'web' || kind === 'ppt' || kind === 'audio' || kind === 'doc' || kind === 'sheet'
}

function rawFileUrl(path: string, sessionId?: string | null) {
  const query = new URLSearchParams({ path })
  if (sessionId) query.set('sessionId', sessionId)
  return `/api/v1/files/raw?${query.toString()}`
}


const ICON_BY_KIND: Record<FileNode['kind'], typeof FileText> = {
  folder: Folder,
  image: ImageIcon,
  doc: FileText,
  sheet: FileSpreadsheet,
  pdf: FilePdf,
  code: FileCode,
  json: FileJson,
  markdown: FileText,
  audio: FileAudio,
  web: FileCode,
  ppt: FileText,
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function renderPreview(file: FileNode, sessionId?: string | null) {
  const raw = rawFileUrl(file.id, sessionId)
  if (file.kind === 'image') {
    return (
      <div className="flex items-center justify-center bg-surface-2 rounded p-6 min-h-[280px]">
        <img src={raw} alt={file.name} className="max-w-full max-h-[480px] rounded shadow-card" />
      </div>
    )
  }
  if (file.kind === 'web') {
    return (
      <iframe title={file.name} src={raw} className="w-full min-h-[520px] rounded border border-line bg-white" />
    )
  }
  if (file.kind === 'pdf') {
    return (
      <iframe title={file.name} src={raw} className="w-full min-h-[560px] rounded border border-line bg-white" />
    )
  }
  if (file.kind === 'audio') {
    return (
      <div className="bg-surface border border-line rounded p-10 text-center">
        <FileAudio size={48} className="mx-auto text-accent-blue" />
        <div className="mt-3 text-sm">{file.name}</div>
        <audio controls className="mt-4 w-full" src={raw} />
      </div>
    )
  }
  if (file.kind === 'doc' && /\.docx?$/i.test(file.name)) {
    return <OfficeDocPreview url={raw} />
  }
  if (file.kind === 'sheet' && !file.name.toLowerCase().endsWith('.csv')) {
    return <OfficeSheetPreview url={raw} />
  }
  if (file.kind === 'ppt') {
    return (
      <div className="bg-surface border border-line rounded p-10 text-center">
        <div className="text-sm">{file.name}</div>
        <div className="text-xs text-ink-muted mt-2">PPT 请下载后用本地软件打开</div>
        <a className="btn mt-4 inline-flex" href={raw} download={file.name}><Download size={14} /> 下载</a>
      </div>
    )
  }
  if (file.kind === 'markdown') {
    return (
      <div className="bg-surface border border-line rounded p-6">
        <pre className="font-sans whitespace-pre-wrap text-sm leading-6 text-ink">{file.content || '(空)'}</pre>
      </div>
    )
  }
  if (file.kind === 'code') {
    return (
      <div className="bg-ink text-white rounded p-4 font-mono text-[13px] leading-6 overflow-auto">
        <pre>{file.content || '(空)'}</pre>
      </div>
    )
  }
  if (file.kind === 'json') {
    return (
      <div className="bg-surface-2 rounded p-4 font-mono text-[13px] leading-6 overflow-auto max-h-[420px]">
        <pre className="whitespace-pre">{file.content || '{}'}</pre>
      </div>
    )
  }
  if (file.kind === 'sheet') {
    // 把 csv 简单渲染成表格
    const rows = (file.content || '').split('\n').filter(Boolean).map((l) => l.split(','))
    if (rows.length === 0) return <Empty title="空表格" />
    return (
      <div className="overflow-auto border border-line rounded">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr>{rows[0].map((c, i) => <th key={i} className="text-left px-3 py-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(1).map((r, i) => (
              <tr key={i} className="border-t border-line">
                {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className="bg-surface border border-line rounded p-6 text-sm whitespace-pre-wrap">
      {file.content || '(此类型暂无内嵌预览)'}
    </div>
  )
}

function colLetter(index: number) {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

function OfficeDocPreview({ url }: { url: string }) {
  const [html, setHtml] = useState('正在预览 Word…')
  useEffect(() => {
    let alive = true
    void fetch(url).then((res) => res.arrayBuffer()).then(async (buffer) => {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        {
          convertImage: mammoth.images.imgElement((image) => image.read('base64').then((data) => ({
            src: `data:${image.contentType};base64,${data}`,
          }))),
        },
      )
      if (alive) setHtml(result.value || '<p>（空文档）</p>')
    }).catch(() => {
      if (alive) setHtml('<p>无法预览该 Word 文件，请下载后打开。</p>')
    })
    return () => { alive = false }
  }, [url])
  return (
    <div className="rounded border border-line bg-[#f3f3f3] p-6 overflow-auto max-h-[640px]">
      <style>{`
        .fde-word-page{width:min(816px,100%);margin:0 auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:96px 96px 96px;color:#1a1a1a;font:11pt/1.5 "Calibri","Segoe UI",system-ui,sans-serif}
        .fde-word-page p{margin:0 0 8pt}
        .fde-word-page h1{font-size:20pt;font-weight:700;margin:18pt 0 10pt}
        .fde-word-page h2{font-size:16pt;font-weight:700;margin:14pt 0 8pt}
        .fde-word-page h3{font-size:14pt;font-weight:600;margin:12pt 0 6pt}
        .fde-word-page ul,.fde-word-page ol{margin:0 0 8pt;padding-left:24pt}
        .fde-word-page table{border-collapse:collapse;width:100%;margin:8pt 0}
        .fde-word-page td,.fde-word-page th{border:1px solid #bfbfbf;padding:4pt 8pt;vertical-align:top}
        .fde-word-page img{max-width:100%;height:auto}
        .fde-word-page a{color:#0563c1}
      `}</style>
      <div className="fde-word-page" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function OfficeSheetPreview({ url }: { url: string }) {
  const [sheets, setSheets] = useState<Array<{ name: string; rows: string[][] }>>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    void fetch(url).then((res) => res.arrayBuffer()).then(async (buffer) => {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: false })
      const parsed = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name]
        const data = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
          header: 1,
          raw: false,
          defval: '',
          blankrows: true,
        })
        const rows = data.map((row) => (row ?? []).map((cell) => {
          if (cell instanceof Date) return cell.toLocaleString('zh-CN')
          return String(cell ?? '')
        }))
        const width = Math.max(8, ...rows.map((row) => row.length))
        const padded = (rows.length ? rows : [['']]).map((row) => {
          const next = [...row]
          while (next.length < width) next.push('')
          return next
        })
        while (padded.length < 12) padded.push(Array.from({ length: width }, () => ''))
        return { name, rows: padded }
      })
      if (alive) {
        setSheets(parsed)
        setActive(0)
      }
    }).catch(() => {
      if (alive) setError('无法预览该表格，请下载后打开。')
    })
    return () => { alive = false }
  }, [url])
  if (error) return <Empty title={error} />
  const current = sheets[active]
  if (!current) return <Empty title="空表格" />
  const cols = current.rows[0]?.length ?? 0
  return (
    <div className="border border-[#d0d0d0] rounded overflow-hidden bg-white">
      <div className="overflow-auto max-h-[560px]">
        <table className="border-collapse text-[12px] font-[Calibri,system-ui,sans-serif] text-[#222]">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-[#f3f3f3] border border-[#d0d0d0] w-10 min-w-10 font-normal text-[#666]" />
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="sticky top-0 z-10 bg-[#f3f3f3] border border-[#d0d0d0] px-2 py-1 min-w-[88px] font-semibold text-[#444] text-center">
                  {colLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.rows.map((row, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-10 bg-[#f3f3f3] border border-[#d0d0d0] px-1 py-1 font-normal text-[#666] text-center">
                  {r + 1}
                </th>
                {row.map((cell, c) => (
                  <td key={c} className="border border-[#d0d0d0] px-2 py-[3px] whitespace-nowrap bg-white align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-0 border-t border-[#d0d0d0] bg-[#f3f3f3] px-1 overflow-x-auto">
        {sheets.map((sheet, i) => (
          <button
            key={sheet.name}
            type="button"
            className={clsx(
              'px-3 py-1.5 text-[12px] border-r border-[#d0d0d0]',
              i === active ? 'bg-white font-medium text-[#1a1a1a]' : 'text-[#555] hover:bg-[#e8e8e8]',
            )}
            onClick={() => setActive(i)}
          >
            {sheet.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Files() {
  const addFile = useApp((s) => s.addFile)
  const activeWsId = useApp((s) => s.activeWorkspaceId)
  const workspaces = useApp((s) => s.workspaces)
  const workspaceCwd = workspaces.find((item) => item.id === activeWsId)?.cwd
  const setFilesBrowse = useApp((s) => s.setFilesBrowse)
  const [files, setFiles] = useState<FileNode[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [filesReady, setFilesReady] = useState(false)
  const [filesError, setFilesError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(() => useApp.getState().filesBrowse.selectedId)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [folderLoading, setFolderLoading] = useState(false)
  const [fileNotice, setFileNotice] = useState('')
  const [parentId, setParentId] = useState<string | null>(() => useApp.getState().filesBrowse.parentId)
  const uploadRef = useRef<HTMLInputElement>(null)
  const listingRef = useRef<{ sessionId?: string; cwd?: string }>({})
  const loadedDirs = useRef(new Set<string>())

  function mergeChildren(parentId: string, listing: { path?: string; entries?: Array<{ name: string; type: string; size?: number }> }) {
    const now = new Date().toISOString()
    setFiles((prev) => {
      const previous = new Map(prev.map((node) => [node.id, node]))
      const keep = prev.filter((node) => node.parentId !== parentId)
      const kids: FileNode[] = (listing.entries ?? []).map((entry) => {
        const id = parentId === '.' ? entry.name : `${parentId}/${entry.name}`
        const old = previous.get(id)
        return {
          id,
          name: entry.name,
          kind: entry.type === 'directory' ? 'folder' : kindFromName(entry.name),
          size: entry.size ?? old?.size ?? 0,
          parentId,
          updatedAt: old?.updatedAt ?? now,
          content: old?.content,
          versionHistory: old?.versionHistory,
          starred: old?.starred,
        }
      })
      return [...keep, ...kids]
    })
    loadedDirs.current.add(parentId)
  }

  async function fetchListing(path: string) {
    const { sessionId: sid, cwd } = listingRef.current
    if (sid) return runtimeApi.listWorkspaceFiles({ sessionId: sid, path })
    if (cwd) return runtimeApi.listWorkspaceFiles({ cwd, path })
    throw new Error('没有可列目录的工作区')
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        setFilesError('')
        let status = await runtimeApi.aiStatus()
        if (!status.connected) status = await runtimeApi.connectAi()
        if (!status.connected) {
          if (alive) {
            setFiles([])
            setFilesError('核心未接通，无法列出工作区文件')
            setFilesReady(true)
          }
          return
        }
        const dshWorkspaces = await runtimeApi.listAiWorkspaces().catch(() => [])
        const currentWs = dshWorkspaces.find((item) => item.workspaceId === activeWsId)
          || dshWorkspaces.find((item) => item.path === workspaceCwd)
          || dshWorkspaces[0]
        const cwd = currentWs?.path || workspaceCwd
        if (!cwd) {
          if (alive) {
            setFiles([])
            setFilesError('当前顶栏没有绑定本机目录')
            setFilesReady(true)
          }
          return
        }
        const target = await loadCurrentAiTarget()
        const sessionId = target.ok && target.cwd === cwd ? target.sessionId : ''
        listingRef.current = {
          ...(sessionId ? { sessionId } : {}),
          cwd,
        }
        loadedDirs.current = new Set()
        const listing = await fetchListing('.')
        if (!alive) return
        const now = new Date().toISOString()
        const rootPath = '.'
        setSessionId(sessionId || null)
        const browse = useApp.getState().filesBrowse
        const sameWs = browse.workspaceId === activeWsId
        setEditMode(false)
        setFiles([{
          id: rootPath,
          name: cwd.split('/').filter(Boolean).at(-1) || '工作区',
          kind: 'folder',
          size: 0,
          parentId: null,
          updatedAt: now,
        }])
        mergeChildren(rootPath, listing)
        setParentId(sameWs && browse.parentId ? browse.parentId : rootPath)
        setSelectedId(sameWs ? browse.selectedId : null)
      } catch (error) {
        if (alive) {
          setFiles([])
          const raw = error instanceof Error ? error.message : '列出工作区文件失败'
          setFilesError(/permission denied|EPERM|files_unreadable|path_forbidden/i.test(raw)
            ? '系统不允许当前 4318 进程读取这个工作区（在「文稿」下）。请用 macOS「终端.app」运行 ./runtime/start.sh，或在系统设置 → 隐私 → 文件与文件夹里给启动它的应用打开权限。'
            : raw)
        }
      } finally {
        if (alive) setFilesReady(true)
      }
    })()
    return () => { alive = false }
  }, [activeWsId, workspaceCwd])

  const navigate = useNavigate()
  useEffect(() => {
    if (!parentId) return
    setFilesBrowse({ workspaceId: activeWsId, parentId, selectedId })
  }, [activeWsId, parentId, selectedId, setFilesBrowse])
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'updatedAt' | 'size'>('updatedAt')
  const [showStarred, setShowStarred] = useState(false)

  // 工作区根目录(父 id = null 的那个 folder)
  const root = useMemo(() => files.find((f) => f.parentId === null), [files])

  // 当前 parentId 在新工作区可能找不到,fallback 到根,避免 TreeNode 渲染崩溃
  const validParentId = useMemo(
    () => (files.some((f) => f.id === parentId) ? parentId : root?.id ?? null),
    [files, parentId, root],
  )

  // 工作区切换时:同步 setState 给下次渲染用
  useEffect(() => {
    if (root && validParentId !== parentId) {
      setParentId(root.id)
      navigate(`/files`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWsId])

  const current = files.find((f) => f.id === selectedId)
  const folder = files.find((f) => f.id === validParentId && f.kind === 'folder')

  useEffect(() => {
    if (!validParentId || loadedDirs.current.has(validParentId)) return
    if (!listingRef.current.sessionId && !listingRef.current.cwd) return
    let alive = true
    setFolderLoading(true)
    void fetchListing(validParentId).then((listing) => {
      if (!alive) return
      mergeChildren(validParentId, listing)
    }).catch((error) => {
      if (alive) setFilesError(error instanceof Error ? error.message : '列出子目录失败')
    }).finally(() => {
      if (alive) setFolderLoading(false)
    })
    return () => { alive = false }
  }, [validParentId])

  useEffect(() => {
    if (!current || current.kind === 'folder' || isBinaryKind(current.kind) || current.content !== undefined) return
    const sid = sessionId || ''
    void runtimeApi.readWorkspaceFile(sid, current.id).then((file) => {
      if (typeof file.text !== 'string') return
      setFiles((nodes) => nodes.map((node) => node.id === current.id ? { ...node, content: file.text } : node))
    }).catch(() => undefined)
  }, [sessionId, current?.id, current?.kind, current?.content])

  const inParent = useMemo(() => {
    let result = files.filter((f) => f.parentId === validParentId)
    if (showStarred) result = result.filter((f) => f.starred)
    if (q) result = result.filter((f) => f.name.includes(q))
    result.sort((a, b) => {
      // folders first
      if (a.kind === 'folder' && b.kind !== 'folder') return -1
      if (a.kind !== 'folder' && b.kind === 'folder') return 1
      if (sortKey === 'name')       return a.name.localeCompare(b.name)
      if (sortKey === 'size')       return b.size - a.size
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    return result
  }, [files, validParentId, q, sortKey, showStarred])

  // 面包屑
  const crumbs = useMemo(() => {
    const out: FileNode[] = []
    let cur = folder
    while (cur) {
      out.unshift(cur)
      const p = files.find((f) => f.id === cur?.parentId)
      cur = p && p.kind === 'folder' ? p : undefined
    }
    return out
  }, [folder, files])

  function createFolder() {
    const name = prompt('新建文件夹名?')
    if (!name) return
    addFile({ name, kind: 'folder', size: 0, parentId: validParentId ?? root?.id ?? null })
  }

  return (
    <div>
      <PageTitle
        title={current ? current.name : '文件'}
        subtitle={current ? `预览 · ${formatBytes(current.size)} · 更新于 ${new Date(current.updatedAt).toLocaleString('zh-CN')}` : '工作区文件库,支持多类型预览与编辑。'}
        actions={
          current ? (
            <button className="btn" onClick={() => { setSelectedId(null); setEditMode(false) }}><ArrowLeft size={14} /> 返回列表</button>
          ) : (
            <>
              <input
                ref={uploadRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file || !sessionId) return
                  const folder = validParentId && validParentId !== '.' ? validParentId : ''
                  const rel = folder ? `${folder}/${file.name}` : file.name
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = typeof reader.result === 'string' ? reader.result : ''
                    const comma = result.indexOf(',')
                    const data = comma >= 0 ? result.slice(comma + 1) : result
                    void runtimeApi.uploadWorkspaceFile({ name: rel, data, sessionId }).then(() => {
                      const now = new Date().toISOString()
                      loadedDirs.current.delete(folder || '.')
                      setFiles((nodes) => [...nodes, {
                        id: rel,
                        name: file.name,
                        kind: kindFromName(file.name),
                        size: file.size,
                        parentId: folder || '.',
                        updatedAt: now,
                      }])
                    }).catch(() => undefined)
                  }
                  reader.readAsDataURL(file)
                }}
              />
              <button type="button" className="btn" disabled={!sessionId} title={sessionId ? '上传走当前会话工作区' : '请先连接核心并开会话'} onClick={() => uploadRef.current?.click()}><Upload size={14} /> 上传</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!sessionId}
                onClick={() => {
                  const name = window.prompt('文件夹名称')?.trim()
                  if (!name || !sessionId || name.includes('/') || name.includes('\\')) return
                  const folder = validParentId && validParentId !== '.' ? validParentId : ''
                  const rel = folder ? `${folder}/${name}` : name
                  void runtimeApi.mkdirWorkspace(rel, sessionId ?? undefined).then(() => {
                    const now = new Date().toISOString()
                    loadedDirs.current.delete(folder || '.')
                    setFiles((nodes) => [...nodes, {
                      id: rel,
                      name,
                      kind: 'folder',
                      size: 0,
                      parentId: folder || '.',
                      updatedAt: now,
                    }])
                  }).catch(() => undefined)
                }}
              ><Plus size={14} /> 新文件夹</button>
            </>
          )
        }
      />

      {fileNotice && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 text-sm">{fileNotice}</div>
      )}

      {filesReady && files.length === 0 && !current && (
        <div className="space-y-3">
          <Empty title="没有文件" hint={filesError || '当前工作区目录是空的'} />
          {filesError.includes('文稿') && (
            <div className="flex justify-center">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  window.open('x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders')
                }}
              >
                打开系统权限设置
              </button>
            </div>
          )}
        </div>
      )}

      {/* 详情模式 */}
      {current && (
        <div className="grid grid-cols-1 @3xl:grid-cols-[1fr_280px] gap-6">
          <div>
            {editMode ? (
              <textarea
                className="input w-full min-h-[360px] font-mono text-[13px] leading-6"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            ) : renderPreview(current, sessionId)}
            <div className="mt-4 flex gap-2 flex-wrap">
              {!isBinaryKind(current.kind) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (editMode) { setEditMode(false); return }
                  setDraft(current.content ?? '')
                  setEditMode(true)
                }}
              >{editMode ? '取消编辑' : '编辑'}</button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={!editMode || saving}
                onClick={() => {
                  setSaving(true)
                  const previous = current.content ?? ''
                  void runtimeApi.writeWorkspaceFile({ path: current.id, text: draft, sessionId: sessionId ?? undefined }).then(() => {
                    const ver: FileVersion = { id: `fv-${Date.now()}`, ts: current.updatedAt, content: previous, size: current.size, note: '保存前' }
                    setFiles((nodes) => nodes.map((node) => node.id === current.id ? {
                      ...node,
                      content: draft,
                      size: draft.length,
                      updatedAt: new Date().toISOString(),
                      versionHistory: [ver, ...(node.versionHistory ?? [])].slice(0, 20),
                    } : node))
                    setEditMode(false)
                  }).catch((error) => {
                    setFilesError(error instanceof Error ? error.message : '保存失败')
                  }).finally(() => setSaving(false))
                }}
              >{saving ? '保存中…' : '保存到工作区'}</button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const blob = new Blob([current.content || ''], { type: 'text/plain;charset=utf-8' })
                  const link = document.createElement('a')
                  link.href = URL.createObjectURL(blob)
                  link.download = current.name
                  link.click()
                  URL.revokeObjectURL(link.href)
                }}
              ><Download size={14} /> 下载</button>
              <button
                className={clsx('btn', current.starred && 'bg-brand-soft border-brand/30')}
                onClick={() => setFiles((nodes) => nodes.map((node) => node.id === current.id ? { ...node, starred: !node.starred } : node))}
              >
                <Star size={14} className={current.starred ? 'text-brand fill-brand' : ''} />
                {current.starred ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>
          <Card>
            <div className="text-sm font-medium mb-3">属性</div>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><dt className="text-ink-muted">类型</dt><dd><Tag>{current.kind}</Tag></dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">大小</dt><dd>{formatBytes(current.size)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">更新于</dt><dd>{new Date(current.updatedAt).toLocaleString('zh-CN')}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-muted shrink-0">路径</dt><dd className="truncate max-w-[160px]">{current.id}</dd></div>
            </dl>
            <div className="text-sm font-medium mb-2">版本历史</div>
            {(current.versionHistory ?? []).length === 0 ? (
              <div className="text-xs text-ink-muted">保存后会出现可回滚的版本</div>
            ) : (
              <ul className="space-y-2">
                {(current.versionHistory ?? []).map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{new Date(version.ts).toLocaleString('zh-CN')}{version.note ? ` · ${version.note}` : ''}</span>
                    <button
                      type="button"
                      className="btn h-7 px-2"
                      onClick={() => {
                        if (!window.confirm(`确定把「${current.name}」回滚到 ${new Date(version.ts).toLocaleString('zh-CN')} 吗？当前内容会先存一版。`)) return
                        void runtimeApi.writeWorkspaceFile({ path: current.id, text: version.content, sessionId: sessionId ?? undefined }).then(() => {
                          const nowVer: FileVersion = { id: `fv-${Date.now()}`, ts: current.updatedAt, content: current.content ?? '', size: current.size, note: '回滚前' }
                          setFiles((nodes) => nodes.map((node) => node.id === current.id ? {
                            ...node,
                            content: version.content,
                            size: version.content.length,
                            updatedAt: new Date().toISOString(),
                            versionHistory: [nowVer, ...(node.versionHistory ?? []).filter((item) => item.id !== version.id)].slice(0, 20),
                          } : node))
                          setDraft(version.content)
                          setEditMode(false)
                          setFileNotice(`已回滚 ${current.name}`)
                        }).catch((error) => {
                          setFilesError(error instanceof Error ? error.message : '回滚失败')
                        })
                      }}
                    >回滚</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {!current && (
        <div className="grid grid-cols-1 @3xl:grid-cols-[260px_1fr] gap-6">
          {/* 侧栏:文件树 */}
          <Card className="!p-2">
            <div className="text-xs uppercase tracking-wider text-ink-subtle px-2 py-1.5">文件树</div>
            {root ? (
              <TreeNode
                node={root}
                files={files}
                active={validParentId}
                onSelect={setParentId}
                depth={0}
              />
            ) : (
              <div className="text-xs text-ink-subtle px-2 py-3">当前工作区还没有文件</div>
            )}
          </Card>

          {/* 主区:列表 */}
          <div>
            {/* 面包屑 + 工具栏 */}
            <Card className="mb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-sm">
                  {crumbs.map((c, i) => (
                    <span key={c.id} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight size={12} className="text-ink-subtle" />}
                      <button
                        className={clsx('hover:underline', i === crumbs.length - 1 ? 'font-medium' : 'text-ink-muted')}
                        onClick={() => setParentId(c.id)}
                      >
                        <span className="mr-1">{c.kind === 'folder' ? '📁' : '📄'}</span>
                        {c.name}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input
                      className="input pl-8 h-8 w-44"
                      placeholder="搜索当前目录"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <select className="input h-8 text-sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
                    <option value="updatedAt">按更新时间</option>
                    <option value="name">按名称</option>
                    <option value="size">按大小</option>
                  </select>
                  <button
                    className={clsx('btn h-8', showStarred && 'bg-brand-soft border-brand/30 text-brand')}
                    onClick={() => setShowStarred(!showStarred)}
                  >
                    <Star size={14} /> 仅收藏
                  </button>
                  <button
                    type="button"
                    className="btn h-8"
                    onClick={() => {
                      const cwd = listingRef.current.cwd
                      if (!cwd) {
                        setFilesError('当前顶栏没有绑定本机目录')
                        return
                      }
                      const path = validParentId || '.'
                      setFileNotice('正在摄取此目录到记忆…')
                      void fetch('/semantic-os/ingest/start', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ cwd, path }),
                      }).then((r) => r.json()).then((job) => {
                        const state = String(job?.state || '')
                        setFileNotice(state === 'failed' ? String(job.detail || job.error || '摄取失败') : '已开始摄取，可在记忆页看进度')
                      }).catch((error) => {
                        setFilesError(error instanceof Error ? error.message : '摄取失败')
                      })
                    }}
                  >
                    摄取此目录到记忆
                  </button>
                </div>
              </div>
            </Card>

            {folderLoading ? (
              <Empty title="正在列出目录…" hint="读取当前工作区子文件夹" />
            ) : inParent.length === 0 ? (
              <Empty title="这个目录是空的" hint="试试上传文件,或新建一个文件夹" />
            ) : (
              <Card className="p-0 overflow-x-auto">
                <div className="min-w-[320px] grid grid-cols-[minmax(120px,1fr)_110px_50px] @xl:grid-cols-[minmax(160px,1fr)_120px_100px_120px_50px] text-xs text-ink-muted uppercase tracking-wider border-b border-line px-4 py-2.5">
                  <div>名称</div>
                  <div className="hidden @xl:block">类型</div>
                  <div className="hidden @xl:block text-right pr-2">大小</div>
                  <div>更新</div>
                  <div></div>
                </div>
                {inParent.map((f) => {
                  const I = ICON_BY_KIND[f.kind] ?? FileText
                  return (
                    <div
                      key={f.id}
                      draggable={f.kind !== 'folder'}
                      onDragStart={(event) => {
                        if (f.kind === 'folder') return
                        const payload = JSON.stringify({
                          path: f.id,
                          name: f.name,
                          sessionId: sessionId ?? '',
                        })
                        event.dataTransfer.setData('application/x-fde-file', payload)
                        event.dataTransfer.setData('text/plain', `fde-file:${payload}`)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      className="min-w-[320px] grid grid-cols-[minmax(120px,1fr)_110px_50px] @xl:grid-cols-[minmax(160px,1fr)_120px_100px_120px_50px] items-center px-4 py-2.5 border-b border-line last:border-b-0 hover:bg-surface-2/40 group"
                    >
                      <button
                        className="flex items-center gap-2 min-w-0 text-left"
                        onClick={() => f.kind === 'folder' ? setParentId(f.id) : setSelectedId(f.id)}
                      >
                        <I size={16} className={clsx('shrink-0', f.kind === 'folder' ? 'text-accent-amber' : 'text-ink-muted')} />
                        <span className="truncate text-sm">{f.name}</span>
                        {f.starred && <Star size={12} className="text-brand fill-brand shrink-0" />}
                      </button>
                      <div className="hidden @xl:block"><Tag>{f.kind}</Tag></div>
                      <div className="hidden @xl:block text-right pr-2 text-xs text-ink-muted tabular-nums">{f.kind === 'folder' ? '—' : formatBytes(f.size)}</div>
                      <div className="text-xs text-ink-muted">{new Date(f.updatedAt).toLocaleString('zh-CN').slice(0, 16)}</div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-ghost p-1 text-ink-subtle hover:text-brand"
                          onClick={() => setFiles((nodes) => nodes.map((node) => node.id === f.id ? { ...node, starred: !node.starred } : node))}
                        >
                          <Star size={14} className={f.starred ? 'fill-brand text-brand' : ''} />
                        </button>
                        {f.kind !== 'folder' && (
                          <button
                            type="button"
                            className="btn-ghost p-1 text-ink-subtle hover:text-brand opacity-0 group-hover:opacity-100"
                            title="发给当前 AI 会话"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('fde-x-attach-file', {
                                detail: { path: f.id, name: f.name, sessionId: sessionId ?? '' },
                              }))
                            }}
                          >
                            <Send size={14} />
                          </button>
                        )}
                        {f.kind !== 'folder' && (
                          <button
                            className="btn-ghost p-1 text-ink-subtle hover:text-accent-red opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              void runtimeApi.deleteWorkspaceFile(f.name, sessionId ?? undefined).then(() => {
                                setFiles((nodes) => nodes.filter((node) => node.id !== f.id))
                              }).catch(() => undefined)
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TreeNode({
  node, files, active, onSelect, depth,
}: { node: FileNode; files: FileNode[]; active: string | null; onSelect: (id: string) => void; depth: number }) {
  const [open, setOpen] = useState(true)
  const children = files.filter((f) => f.parentId === node.id && f.kind === 'folder')
  const selected = active === node.id
  return (
    <div>
      <button
        className={clsx(
          'flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-sm hover:bg-surface-2',
          selected && 'bg-brand-soft text-brand font-medium',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (open && selected) {
            setOpen(false)
            if (node.parentId) onSelect(node.parentId)
            return
          }
          setOpen(true)
          onSelect(node.id)
        }}
      >
        {open && children.length > 0 ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span className="truncate">{node.name}</span>
      </button>
      {open && children.length > 0 && (
        <div>
          {children.map((c) => (
            <TreeNode key={c.id} node={c} files={files} active={active} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
