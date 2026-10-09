// 文件模块:树形侧栏 + 列表 + 多种类型预览(image/md/code/json/csv/pdf)
import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Folder, FolderOpen, FileText, Image as ImageIcon, FileCode, FileJson,
  FileSpreadsheet, FileAudio, File as FilePdf, Star, ChevronRight, Search,
  Upload, Plus, Trash2, ArrowLeft, Download, Eye, MoreHorizontal, Hash, Send,
} from 'lucide-react'
import clsx from 'clsx'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useApp } from '@/store/app'
import type { FileNode } from '@/lib/types'
import { PageTitle, Card, Tag, Empty } from '@/components/ui'
import { runtimeApi, type WorkspaceFileVersion } from '@/lib/runtime-api'
import { DocxPackage, type DocxBlockView, type DocxRunView } from '@/lib/office-docx'
import { currentAiTarget } from '@/lib/ai-target'
import { attachToCurrentAi } from '@/lib/current-turn'
import { consumeFilePick } from '@/lib/app-platform'
import { lastModuleBag, rememberModuleBag } from '@/lib/module-catalog-cache'

function kindFromName(name: string): FileNode['kind'] {
  const lower = name.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (ext === 'json') return 'json'
  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') return 'sheet'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif' || ext === 'svg') return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'html' || ext === 'htm') return 'web'
  if (ext === 'pptx' || ext === 'ppt') return 'ppt'
  if (ext === 'docx' || ext === 'doc') return 'doc'
  if (ext === 'mp3' || ext === 'wav' || ext === 'm4a') return 'audio'
  if (
    ext === 'txt' || ext === 'text' || ext === 'log' || ext === 'yml' || ext === 'yaml' || ext === 'toml'
    || ext === 'ini' || ext === 'cfg' || ext === 'conf' || ext === 'sh' || ext === 'bash' || ext === 'zsh'
    || ext === 'xml' || ext === 'sql' || ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'mjs'
    || ext === 'cjs' || ext === 'py' || ext === 'css' || ext === 'go' || ext === 'rs' || ext === 'java'
    || ext === 'rb' || ext === 'php'
  ) return 'code'
  return 'doc'
}

function isBinaryKind(kind: FileNode['kind']) {
  return kind === 'image' || kind === 'pdf' || kind === 'web' || kind === 'ppt' || kind === 'audio' || kind === 'doc' || kind === 'sheet'
}

function canEditInPlace(file?: FileNode | null) {
  if (!file || file.kind === 'folder') return false
  if (file.kind === 'markdown' || file.kind === 'code' || file.kind === 'json') return true
  if (file.kind === 'sheet') return true
  return file.kind === 'doc' && /\.docx$/i.test(file.name)
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step))
  return btoa(binary)
}

function DocxRunSpan({ run, editing, onText }: { run: DocxRunView; editing?: boolean; onText: (key: string, text: string) => void }) {
  return (
    <span
      contentEditable={Boolean(editing)}
      suppressContentEditableWarning
      style={run.style}
      ref={(el) => {
        if (el && el.dataset.ready !== '1') {
          el.textContent = run.text || (editing ? '\u00a0' : '')
          el.dataset.ready = '1'
        }
      }}
      onInput={(event) => onText(run.key, event.currentTarget.textContent || '')}
    />
  )
}

function DocxPackageEditor({
  url,
  editing,
  onPack,
  onDirty,
}: {
  url: string
  editing?: boolean
  onPack?: (pack: DocxPackage) => void
  onDirty?: () => void
}) {
  const [blocks, setBlocks] = useState<DocxBlockView[]>([])
  const [error, setError] = useState('')
  const packRef = useRef<DocxPackage | null>(null)
  useEffect(() => {
    let alive = true
    void fetch(url).then((res) => res.arrayBuffer()).then((buf) => DocxPackage.fromArrayBuffer(buf)).then((pack) => {
      if (!alive) return
      packRef.current = pack
      onPack?.(pack)
      setBlocks(pack.blocks())
    }).catch((err) => {
      if (alive) setError(err instanceof Error ? err.message : '打不开这份 Word')
    })
    return () => { alive = false }
  }, [url])
  function onText(key: string, text: string) {
    packRef.current?.setRunText(key, text)
    if (editing) onDirty?.()
  }
  if (error) return <Empty title={error} />
  if (!blocks.length) return <Empty title="正在打开 Word…" />
  return (
    <div className="rounded border border-line bg-[#f3f3f3] p-6 overflow-auto max-h-[640px]">
      <div className="fde-word-page" style={{ width: 'min(816px,100%)', margin: '0 auto', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.12)', padding: '96px', color: '#1a1a1a' }}>
        {blocks.map((block) => {
          if (block.kind === 'tbl') {
            return (
              <table key={block.key} className="border-collapse w-full my-2">
                <tbody>
                  {(block.rows || []).map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="border border-[#bfbfbf] px-2 py-1 align-top">
                          {cell.map((run) => <DocxRunSpan key={run.key} run={run} editing={editing} onText={onText} />)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
          const align = block.align === 'center' ? 'center' : block.align === 'right' ? 'right' : block.align === 'both' ? 'justify' : 'left'
          return (
            <p key={block.key} style={{ margin: '0 0 8pt', textAlign: align }}>
              {block.runs.length ? block.runs.map((run) => <DocxRunSpan key={run.key} run={run} editing={editing} onText={onText} />) : (editing ? '\u00a0' : '')}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function rawFileUrl(path: string, sessionId?: string | null, epoch?: number) {
  const query = new URLSearchParams({ path })
  if (sessionId) query.set('sessionId', sessionId)
  if (epoch) query.set('v', String(epoch))
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

function formatVersionCaption(version: WorkspaceFileVersion) {
  const time = new Date(version.ts).toLocaleString('zh-CN')
  if (version.note === '回滚前') return `${time} · 被替换的版本`
  if (version.note === '保存前') return `${time} · 保存前`
  return version.note ? `${time} · ${version.note}` : time
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatListTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function ancestorDirs(parentId: string) {
  if (!parentId || parentId === '.') return ['.']
  const parts = parentId.split('/').filter(Boolean)
  const dirs = ['.']
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    dirs.push(acc)
  }
  return dirs
}

function HostOfficePreview({ sessionId, path, fallback, epoch }: { sessionId: string; path: string; fallback: ReactNode; epoch?: number }) {
  const [src, setSrc] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true
    let objectUrl = ''
    setSrc('')
    setErr('')
    void runtimeApi.catalogAction({
      kind: 'skill',
      action: 'render',
      sessionId,
      path,
      params: { priority: 'foreground' },
    }).then((bag) => {
      const mutation = bag && typeof bag === 'object' ? (bag as { mutation?: { data?: unknown } }).mutation : undefined
      const data = mutation?.data
      if (!alive) return
      if (typeof data === 'string' && data) {
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        setSrc(objectUrl)
        return
      }
      setErr('Host 没有返回 PDF')
    }).catch((error) => {
      if (alive) setErr(error instanceof Error ? error.message : '转换失败')
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sessionId, path, epoch])
  if (src) return <iframe title={path} src={src} className="w-full min-h-[560px] rounded border border-line bg-white" />
  if (err) return <>{fallback}</>
  return <Empty title="正在转换成 PDF…" />
}

function renderPreview(
  file: FileNode,
  sessionId: string | null | undefined,
  editing: boolean,
  onSheetPack?: (pack: { toUint8Array: () => Promise<Uint8Array> }) => void,
  onDocxPack?: (pack: DocxPackage) => void,
  onDirty?: () => void,
  epoch?: number,
) {
  const raw = rawFileUrl(file.id, sessionId, epoch)
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
  if (file.kind === 'doc' && /\.docx$/i.test(file.name)) {
    return <DocxPackageEditor key={epoch} url={raw} editing={editing} onPack={onDocxPack} onDirty={onDirty} />
  }
  if (file.kind === 'doc' && /\.docx?$/i.test(file.name)) {
    const fallback = <OfficeDocPreview url={raw} />
    if (sessionId) return <HostOfficePreview key={epoch} sessionId={sessionId} path={file.id} epoch={epoch} fallback={fallback} />
    return fallback
  }
  if (file.kind === 'sheet') {
    return <OfficeSheetPreview key={epoch} name={file.name} url={raw} editing={editing} onPack={onSheetPack} />
  }
  if (file.kind === 'ppt') {
    const fallback = (
      <div className="bg-surface border border-line rounded p-10 text-center">
        <div className="text-sm">{file.name}</div>
        <div className="text-xs text-ink-muted mt-2">PPT 请下载后用本地软件打开</div>
        <a className="btn mt-4 inline-flex" href={raw} download={file.name}><Download size={14} /> 下载</a>
      </div>
    )
    if (sessionId) return <HostOfficePreview key={epoch} sessionId={sessionId} path={file.id} epoch={epoch} fallback={fallback} />
    return fallback
  }
  if (file.kind === 'markdown') {
    return <MarkdownPreview content={file.content || ''} />
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

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="bg-surface border border-line rounded p-6 text-sm leading-6 text-ink overflow-auto max-h-[640px]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-semibold tracking-tight mt-4 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-2">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 pl-5 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 pl-5 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-line pl-3 my-2 text-ink-muted">{children}</blockquote>,
          hr: () => <hr className="border-line my-3" />,
          a: ({ href, children }) => <a href={href} className="text-brand underline" target="_blank" rel="noreferrer">{children}</a>,
          code: ({ className, children }) => (
            className
              ? <code className="font-mono text-[13px] leading-6">{children}</code>
              : <code className="font-mono text-[13px] bg-surface-2 px-1 rounded">{children}</code>
          ),
          pre: ({ children }) => <pre className="bg-surface-2 rounded p-3 overflow-auto mb-2 text-[13px] leading-6">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-auto border border-line rounded my-2">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
          th: ({ children }) => <th className="text-left px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-t border-line">{children}</td>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content || '(空)'}
      </Markdown>
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

function OfficeDocPreview({ url, editing, onHtml }: { url: string; editing?: boolean; onHtml?: (html: string) => void }) {
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
      const next = result.value || '<p>（空文档）</p>'
      if (alive) {
        setHtml(next)
        onHtml?.(next)
      }
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
      <div
        className="fde-word-page"
        contentEditable={Boolean(editing)}
        suppressContentEditableWarning
        onInput={(event) => onHtml?.(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function sheetKeepsBook(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.xlsx') || lower.endsWith('.xlsm')
}

function OfficeSheetPreview({
  name,
  url,
  editing,
  onPack,
}: {
  name: string
  url: string
  editing?: boolean
  onPack?: (pack: { toUint8Array: () => Promise<Uint8Array> }) => void
}) {
  const [sheets, setSheets] = useState<Array<{ name: string; rows: string[][] }>>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const xlsxRef = useRef<{ setCell: (sheetIndex: number, row0: number, col0: number, text: string) => void } | null>(null)
  const aoaRef = useRef<Array<{ name: string; rows: string[][] }>>([])
  useEffect(() => {
    let alive = true
    void fetch(url).then((res) => res.arrayBuffer()).then(async (buffer) => {
      if (sheetKeepsBook(name)) {
        const { XlsxPackage } = await import('@/lib/office-xlsx')
        const pack = await XlsxPackage.fromArrayBuffer(buffer)
        if (!alive) return
        xlsxRef.current = pack
        const parsed = pack.sheets()
        setSheets(parsed)
        setActive(0)
        onPack?.(pack)
        return
      }
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: false })
      const parsed = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName]
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
        return { name: sheetName, rows: padded }
      })
      if (!alive) return
      aoaRef.current = parsed
      xlsxRef.current = null
      setSheets(parsed)
      setActive(0)
      const bookType = name.toLowerCase().endsWith('.csv') ? 'csv' : 'xls'
      onPack?.({
        async toUint8Array() {
          const lib = await import('xlsx')
          const book = lib.utils.book_new()
          for (const sheet of aoaRef.current) {
            lib.utils.book_append_sheet(book, lib.utils.aoa_to_sheet(sheet.rows), sheet.name.slice(0, 31) || 'Sheet1')
          }
          const b64 = lib.write(book, { type: 'base64', bookType })
          const bin = atob(b64)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
          return bytes
        },
      })
    }).catch(() => {
      if (alive) setError('无法预览该表格，请下载后打开。')
    })
    return () => { alive = false }
  }, [url, name])
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
                    {editing ? (
                      <input
                        className="w-full bg-transparent outline-none"
                        value={cell}
                        onChange={(event) => {
                          const value = event.target.value
                          xlsxRef.current?.setCell(active, r, c, value)
                          setSheets((prev) => {
                            const next = prev.map((sheet, i) => {
                              if (i !== active) return sheet
                              const rows = sheet.rows.map((line, ri) => {
                                if (ri !== r) return line
                                return line.map((item, ci) => (ci === c ? value : item))
                              })
                              return { ...sheet, rows }
                            })
                            aoaRef.current = next
                            return next
                          })
                        }}
                      />
                    ) : cell}
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
  const activeWsId = useApp((s) => s.activeWorkspaceId)
  const workspaces = useApp((s) => s.workspaces)
  const workspaceCwd = workspaces.find((item) => item.id === activeWsId)?.cwd
  const setFilesBrowse = useApp((s) => s.setFilesBrowse)
  const filesBrowse = useApp((s) => s.filesBrowse)
  const parentId = filesBrowse.workspaceId === activeWsId ? filesBrowse.parentId : null
  const selectedId = filesBrowse.workspaceId === activeWsId ? filesBrowse.selectedId : null
  const [files, setFiles] = useState<FileNode[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [filesReady, setFilesReady] = useState(false)
  const [filesError, setFilesError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [folderLoading, setFolderLoading] = useState(false)
  const [fileNotice, setFileNotice] = useState('')
  const [versions, setVersions] = useState<WorkspaceFileVersion[]>([])
  const [dirty, setDirty] = useState(false)
  const [previewEpoch, setPreviewEpoch] = useState(0)
  const sheetPackRef = useRef<{ toUint8Array: () => Promise<Uint8Array> } | null>(null)
  const docxPackRef = useRef<DocxPackage | null>(null)
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'updatedAt' | 'size'>('updatedAt')
  const [showStarred, setShowStarred] = useState(false)
  const [fileActions, setFileActions] = useState<string[]>([])
  const uploadRef = useRef<HTMLInputElement>(null)
  const listingRef = useRef<{ sessionId?: string; cwd?: string }>({})
  const loadedDirs = useRef(new Set<string>())
  const filesRef = useRef(files)
  filesRef.current = files

  function setParentId(id: string | null) {
    setFilesBrowse({ workspaceId: activeWsId, parentId: id })
  }

  function setSelectedId(id: string | null) {
    setFilesBrowse({ workspaceId: activeWsId, selectedId: id })
  }

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
    if (!sessionId || !filesReady) return
    const abort = new AbortController()
    const dir = parentId || '.'
    void runtimeApi.catalogStream(
      { kind: 'file', action: 'changes', sessionId, path: dir },
      () => {
        void fetchListing(dir).then((listing) => mergeChildren(dir, listing)).catch((error) => {
          setFileNotice(error instanceof Error ? error.message : '列目录失败')
        })
      },
      abort.signal,
    ).catch((error) => {
      if (abort.signal.aborted) return
      setFileNotice(error instanceof Error ? error.message : '跟不了文件变更')
    })
    return () => abort.abort()
  }, [sessionId, filesReady, parentId])

  useEffect(() => {
    let alive = true
    const cached = lastModuleBag<{ workspaceId: string; files: FileNode[] }>('files')
    if (cached?.workspaceId === activeWsId && cached.files?.length) {
      setFiles(cached.files)
      setFilesReady(true)
    }
    void (async () => {
      try {
        setFilesError('')
        const status = await runtimeApi.aiStatus()
        if (!status.connected) {
          const next = await runtimeApi.connectAi()
          if (!next.connected) {
            if (alive) {
              setFiles([])
              setFilesError('核心未接通，无法列出工作区文件')
              setFilesReady(true)
            }
            return
          }
        }
        const dshWorkspaces = await runtimeApi.listAiWorkspaces().catch(() => [])
        const currentWs = dshWorkspaces.find((item) => item.workspaceId === activeWsId)
          || dshWorkspaces.find((item) => item.path === workspaceCwd)
          || dshWorkspaces[0]
        const cwd = currentWs?.path || workspaceCwd
        const wsRow = workspaces.find((item) => item.id === activeWsId)
        if (cwd && wsRow) {
          void runtimeApi.ensureWorkspace({ id: activeWsId, name: wsRow.name, description: wsRow.desc, cwd }).catch(() => undefined)
        }
        if (!cwd) {
          if (alive) {
            setFiles([])
            setFilesError('当前顶栏没有绑定本机目录')
            setFilesReady(true)
          }
          return
        }
        const target = await currentAiTarget()
        if (!alive) return
        const sessionId = target.ok ? target.sessionId : ''
        listingRef.current = { sessionId: sessionId || undefined, cwd }
        setSessionId(sessionId || null)
        loadedDirs.current = new Set()
        const listing = await fetchListing('.')
        if (!alive) return
        const now = new Date().toISOString()
        const rootPath = '.'
        const browse = useApp.getState().filesBrowse
        const sameWs = browse.workspaceId === activeWsId
        setEditMode(false)
        const root: FileNode = {
          id: rootPath,
          name: cwd.split('/').filter(Boolean).at(-1) || '工作区',
          kind: 'folder',
          size: 0,
          parentId: null,
          updatedAt: now,
        }
        setFiles([root])
        mergeChildren(rootPath, listing)
        setFilesReady(true)
        if (!sameWs) {
          setFilesBrowse({ workspaceId: activeWsId, parentId: rootPath, selectedId: null })
        } else if (!browse.parentId) {
          setFilesBrowse({ workspaceId: activeWsId, parentId: rootPath })
        }
        rememberModuleBag('files', { workspaceId: activeWsId, files: filesRef.current })
        if (sessionId) {
          void runtimeApi.catalogBag('file', { sessionId, path: '.' }).then((bag) => {
            if (alive) setFileActions(Array.isArray(bag.actions) ? bag.actions : [])
          }).catch(() => {
            if (alive) setFileActions([])
          })
          void runtimeApi.catalogBag('skill', { sessionId }).then((bag) => {
            if (!alive) return
            const actions = Array.isArray(bag.actions) ? bag.actions : []
            if (actions.includes('render')) setFileActions((current) => current.includes('render') ? current : [...current, 'render'])
          }).catch(() => undefined)
        } else if (alive) {
          setFileActions([])
        }
        if (alive) rememberModuleBag('files', { workspaceId: activeWsId, files: filesRef.current })
      } catch (error) {
        if (alive) {
          if (!lastModuleBag('files')) setFiles([])
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
    setEditMode(false)
    setDirty(false)
  }, [selectedId])

  // 工作区根目录(父 id = null 的那个 folder)
  const root = useMemo(() => files.find((f) => f.parentId === null), [files])

  // 当前 parentId 在新工作区可能找不到,fallback 到根,避免 TreeNode 渲染崩溃
  const validParentId = useMemo(() => {
    if (files.some((f) => f.id === parentId)) return parentId
    if (selectedId && parentId && parentId !== '.' && (selectedId === parentId || selectedId.startsWith(`${parentId}/`))) {
      return parentId
    }
    return root?.id ?? null
  }, [files, parentId, selectedId, root])

  // 工作区切换时:同步 setState 给下次渲染用
  useEffect(() => {
    if (root && validParentId !== parentId) {
      setFilesBrowse({ workspaceId: activeWsId, parentId: root.id, selectedId: null })
      navigate(`/files`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWsId])

  const selectedNode = files.find((f) => f.id === selectedId)
  const current = selectedNode && selectedNode.kind !== 'folder' ? selectedNode : undefined
  const folder = files.find((f) => f.id === validParentId && f.kind === 'folder')

  function sendToCurrentAi(file: FileNode) {
    void attachToCurrentAi({ path: file.id, name: file.name }).then((result) => {
      if (!result.ok) {
        setFilesError(result.error)
        setFileNotice(result.error)
        return
      }
      setFilesError('')
    }).catch((cause) => {
      const message = cause instanceof Error ? cause.message : '附加文件失败'
      setFilesError(message)
      setFileNotice(message)
    })
  }

  function absWorkspacePath(rel?: string | null) {
    const cwd = listingRef.current.cwd
    if (!cwd) return ''
    const trimmed = String(rel || '').replace(/\/+$/u, '')
    if (!trimmed || trimmed === '.') return cwd
    return `${cwd.replace(/\/+$/u, '')}/${trimmed}`
  }

  function openNative(rel: string | null | undefined, reveal = false) {
    const sid = sessionId || listingRef.current.sessionId
    const cwd = listingRef.current.cwd
    if (!cwd || !sid) return
    const path = absWorkspacePath(rel)
    void runtimeApi.catalogAction({
      kind: 'file',
      action: 'openWorkspacePath',
      sessionId: sid,
      path,
      ...(reveal ? { params: { action: 'reveal' } } : {}),
    }).catch((error) => {
      setFilesError(error instanceof Error ? error.message : (reveal ? '打不开这个位置' : '打不开系统应用'))
    })
  }

  function NativeOpenButtons({ openRel, revealRel }: { openRel: string; revealRel: string }) {
    if (!fileActions.includes('openWorkspacePath')) return null
    const ready = Boolean(listingRef.current.cwd && (sessionId || listingRef.current.sessionId))
    const title = !listingRef.current.cwd
      ? '当前顶栏没有绑定本机目录'
      : (!sessionId && !listingRef.current.sessionId ? '请先连接核心并开会话' : undefined)
    return (
      <>
        <button type="button" className="btn h-8" disabled={!ready} title={title} onClick={() => openNative(openRel)}>
          <FolderOpen size={14} /> 用系统应用打开
        </button>
        <button type="button" className="btn h-8" disabled={!ready} title={title} onClick={() => openNative(revealRel, true)}>
          <FolderOpen size={14} /> 显示位置
        </button>
      </>
    )
  }

  useEffect(() => {
    if (selectedNode?.kind !== 'folder') return
    setFilesBrowse({ workspaceId: activeWsId, parentId: selectedNode.id, selectedId: null })
  }, [activeWsId, selectedId, selectedNode?.id, selectedNode?.kind, setFilesBrowse])

  useEffect(() => {
    if (!filesReady) return
    if (!listingRef.current.sessionId && !listingRef.current.cwd) return
    const selectedParent = selectedId && selectedId.includes('/')
      ? selectedId.slice(0, selectedId.lastIndexOf('/'))
      : (selectedId && selectedId !== '.' ? '.' : '')
    const target = selectedParent || parentId
    if (!target) return
    const missingSelected = Boolean(selectedId && !filesRef.current.some((f) => f.id === selectedId))
    const missingFolder = Boolean(selectedParent && selectedParent !== '.' && !filesRef.current.some((f) => f.id === selectedParent))
    if (missingSelected || missingFolder) {
      for (const dir of ancestorDirs(selectedParent || target)) {
        loadedDirs.current.delete(dir)
      }
    }
    const pending = ancestorDirs(target).filter((dir) => !loadedDirs.current.has(dir))
    if (pending.length === 0) return
    let alive = true
    setFolderLoading(true)
    void (async () => {
      try {
        for (const dir of pending) {
          if (!alive) return
          if (loadedDirs.current.has(dir)) continue
          const listing = await fetchListing(dir)
          if (!alive) return
          mergeChildren(dir, listing)
        }
      } catch (error) {
        if (alive) setFilesError(error instanceof Error ? error.message : '列出子目录失败')
      } finally {
        if (alive) setFolderLoading(false)
      }
    })()
    return () => { alive = false }
  }, [filesReady, parentId, selectedId])

  useEffect(() => {
    if (!current || current.kind === 'folder' || isBinaryKind(current.kind) || current.content !== undefined) return
    const sid = sessionId || ''
    void runtimeApi.readWorkspaceFile(sid, current.id).then((file) => {
      if (typeof file.text !== 'string') return
      setFiles((nodes) => nodes.map((node) => node.id === current.id ? { ...node, content: file.text } : node))
    }).catch(() => undefined)
  }, [sessionId, current?.id, current?.kind, current?.content])

  useEffect(() => {
    if (!current || current.kind === 'folder') {
      setVersions([])
      return
    }
    void runtimeApi.listWorkspaceFileVersions(current.id, sessionId ?? undefined).then(setVersions).catch(() => setVersions([]))
  }, [sessionId, current?.id])

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

  return (
    <div>
      <PageTitle
        title={current ? current.name : '文件'}
        subtitle={current ? `预览 · ${formatBytes(current.size)} · 更新于 ${new Date(current.updatedAt).toLocaleString('zh-CN')}` : '工作区文件库,支持多类型预览与编辑。'}
        actions={
          current ? (
            <button className="btn" onClick={() => {
              if ((dirty || (editMode && draft !== (current.content ?? ''))) && !window.confirm('有未保存的修改，离开将丢失。继续？')) return
              setSelectedId(null)
              setEditMode(false)
              setDirty(false)
            }}><ArrowLeft size={14} /> 返回列表</button>
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
                    void runtimeApi.uploadWorkspaceFile({ name: rel, data, sessionId }).then((written) => {
                      const now = new Date().toISOString()
                      loadedDirs.current.delete(folder || '.')
                      setFiles((nodes) => [...nodes.filter((node) => node.id !== rel), {
                        id: rel,
                        name: file.name,
                        kind: kindFromName(file.name),
                        size: file.size,
                        parentId: folder || '.',
                        updatedAt: now,
                      }])
                      if (written.versions) setVersions(written.versions)
                    }).catch((error) => {
                      setFilesError(error instanceof Error ? error.message : '上传失败')
                    })
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
            {editMode && (current.kind === 'markdown' || current.kind === 'code' || current.kind === 'json') ? (
              <textarea
                className="input w-full min-h-[360px] font-mono text-[13px] leading-6"
                value={draft}
                onChange={(event) => { setDraft(event.target.value); setDirty(true) }}
              />
            ) : renderPreview(
              current,
              sessionId,
              editMode,
              (pack) => { sheetPackRef.current = pack; if (editMode) setDirty(true) },
              (pack) => { docxPackRef.current = pack },
              () => setDirty(true),
              previewEpoch,
            )}
            <div className="mt-4 flex gap-2 flex-wrap">
              {canEditInPlace(current) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (editMode) { setEditMode(false); setDirty(false); return }
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
                  const sid = sessionId ?? undefined
                  const finish = (versionsNext?: WorkspaceFileVersion[]) => {
                    if (versionsNext) setVersions(versionsNext)
                    else void runtimeApi.listWorkspaceFileVersions(current.id, sid).then(setVersions).catch(() => undefined)
                    setEditMode(false)
                    setDirty(false)
                    setPreviewEpoch((n) => n + 1)
                    sheetPackRef.current = null
                    docxPackRef.current = null
                    setFiles((nodes) => nodes.map((node) => node.id === current.id ? {
                      ...node,
                      content: current.kind === 'markdown' || current.kind === 'code' || current.kind === 'json' ? draft : node.content,
                      updatedAt: new Date().toISOString(),
                    } : node))
                  }
                  const fail = (error: unknown) => {
                    setFilesError(error instanceof Error ? error.message : '保存失败')
                  }
                  const run = async () => {
                    if (current.kind === 'sheet') {
                      const pack = sheetPackRef.current
                      if (!pack) throw new Error('表格还没加载完')
                      const bytes = await pack.toUint8Array()
                      const written = await runtimeApi.writeWorkspaceFile({ path: current.id, data: bytesToBase64(bytes), sessionId: sid })
                      finish(written.versions)
                      return
                    }
                    if (current.kind === 'doc' && /\.docx$/i.test(current.name)) {
                      const pack = docxPackRef.current
                      if (!pack) throw new Error('文档还没加载完')
                      const bytes = await pack.toUint8Array()
                      const written = await runtimeApi.writeWorkspaceFile({ path: current.id, data: bytesToBase64(bytes), sessionId: sid })
                      finish(written.versions)
                      return
                    }
                    const written = await runtimeApi.writeWorkspaceFile({ path: current.id, text: draft, sessionId: sid })
                    finish(written.versions)
                  }
                  void run().catch(fail).finally(() => setSaving(false))
                }}
              >{saving ? '保存中…' : '保存到工作区'}</button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = rawFileUrl(current.id, sessionId, previewEpoch)
                  link.download = current.name
                  link.click()
                }}
              ><Download size={14} /> 下载</button>
              <button
                type="button"
                className="btn-ghost p-1 text-ink-subtle hover:text-brand"
                title="发给当前 AI 会话"
                onClick={() => sendToCurrentAi(current)}
              >
                <Send size={14} />
              </button>
              <NativeOpenButtons
                openRel={current.id}
                revealRel={current.parentId && current.parentId !== '.' ? current.parentId : '.'}
              />
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
            {versions.length === 0 ? (
              <div className="text-xs text-ink-muted">保存后会出现可回滚的版本</div>
            ) : (
              <ul className="space-y-2">
                {versions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{formatVersionCaption(version)}</span>
                    <button
                      type="button"
                      className="btn h-7 px-2"
                      onClick={() => {
                        const undo = version.note === '回滚前'
                        const when = new Date(version.ts).toLocaleString('zh-CN')
                        const ok = window.confirm(
                          undo
                            ? `确定撤销这次回滚，恢复到 ${when} 被替换掉的内容吗？`
                            : `确定把「${current.name}」回滚到 ${when} 吗？当前内容会先存一版。`,
                        )
                        if (!ok) return
                        void runtimeApi.rollbackWorkspaceFile({ path: current.id, versionId: version.id, sessionId: sessionId ?? undefined }).then((written) => {
                          setVersions(written.versions || [])
                          setFiles((nodes) => nodes.map((node) => node.id === current.id ? {
                            ...node,
                            content: undefined,
                            updatedAt: new Date().toISOString(),
                          } : node))
                          setDraft('')
                          setEditMode(false)
                          setDirty(false)
                          setPreviewEpoch((n) => n + 1)
                          sheetPackRef.current = null
                          docxPackRef.current = null
                          setFileNotice(`已回滚 ${current.name}`)
                        }).catch((error) => {
                          setFilesError(error instanceof Error ? error.message : '回滚失败')
                        })
                      }}
                    >{version.note === '回滚前' ? '撤销回滚' : '回滚'}</button>
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
                  <NativeOpenButtons openRel={validParentId || '.'} revealRel={validParentId || '.'} />
                </div>
              </div>
            </Card>

            {folderLoading ? (
              <Empty title="正在列出目录…" hint="读取当前工作区子文件夹" />
            ) : inParent.length === 0 ? (
              <Empty title="这个目录是空的" hint="试试上传文件,或新建一个文件夹" />
            ) : (
              <Card className="p-0 overflow-x-auto">
                <div className="min-w-[448px] grid grid-cols-[minmax(120px,1fr)_168px_96px] @xl:grid-cols-[minmax(160px,1fr)_120px_100px_168px_96px] text-xs text-ink-muted uppercase tracking-wider border-b border-line px-4 py-2.5">
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
                        })
                        event.dataTransfer.setData('application/x-fde-file', payload)
                        event.dataTransfer.setData('text/plain', `fde-file:${payload}`)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      className="min-w-[448px] grid grid-cols-[minmax(120px,1fr)_168px_96px] @xl:grid-cols-[minmax(160px,1fr)_120px_100px_168px_96px] items-center px-4 py-2.5 border-b border-line last:border-b-0 hover:bg-surface-2/40 group"
                    >
                      <button
                        className="flex items-center gap-2 min-w-0 text-left"
                        onClick={() => {
                          if (f.kind === 'folder') {
                            setParentId(f.id)
                            return
                          }
                          setSelectedId(f.id)
                          consumeFilePick(f.id)
                        }}
                      >
                        <I size={16} className={clsx('shrink-0', f.kind === 'folder' ? 'text-accent-amber' : 'text-ink-muted')} />
                        <span className="truncate text-sm">{f.name}</span>
                        {f.starred && <Star size={12} className="text-brand fill-brand shrink-0" />}
                      </button>
                      <div className="hidden @xl:block"><Tag>{f.kind}</Tag></div>
                      <div className="hidden @xl:block text-right pr-2 text-xs text-ink-muted tabular-nums">{f.kind === 'folder' ? '—' : formatBytes(f.size)}</div>
                      <div className="text-xs text-ink-muted tabular-nums whitespace-nowrap pr-2">{formatListTime(f.updatedAt)}</div>
                      <div className="flex items-center justify-end gap-1 shrink-0">
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
                            onClick={() => sendToCurrentAi(f)}
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
