import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { fieldLabel, SpecForm } from '@/components/apps/SpecForm'
import { type FdeAppAction, type FdeAppSpec, type FdeAppView } from '@/lib/app-spec'
import { type AgentWriteBackPrompt, isAgentActionStep, runAppAgentJobs } from '@/lib/app-agent-action'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: FdeAppSpec; status: string }
  view: FdeAppView
  workspaceCwd: string
  previewRows?: Record<string, unknown>[]
  onSelectRid?: (rid: string) => void
  onRefresh?: () => void
}

export function SpecTable({ app, view, workspaceCwd, previewRows, onSelectRid, onRefresh }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(previewRows ?? [])
  const [total, setTotal] = useState(previewRows?.length ?? 0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [writeBackPrompt, setWriteBackPrompt] = useState<AgentWriteBackPrompt | null>(null)
  const [creating, setCreating] = useState(false)
  const writeBackResolveRef = useRef<((accepted: boolean) => void) | null>(null)
  const columns = view.columns?.length ? view.columns : app.spec.entities.find((e) => e.name === view.entity)?.fields.map((f) => f.name) ?? []
  const entityActions = (app.spec.actions ?? []).filter((a) => a.entity === view.entity)

  const load = useCallback(async () => {
    if (previewRows) {
      setRows(previewRows)
      setTotal(previewRows.length)
      return
    }
    if (app.status !== 'active') return
    setLoading(true)
    setError('')
    try {
      const data = await runtimeApi.listAppRecords(app.spec.slug, view.entity, workspaceCwd, {
        page,
        size: 20,
        filter,
        sort: view.sort?.field,
        dir: view.sort?.dir,
      })
      setRows(data.rows)
      setTotal(data.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [app.spec.slug, app.status, filter, page, previewRows, view.entity, view.sort?.dir, view.sort?.field, workspaceCwd])

  useEffect(() => {
    void load()
  }, [load])

  const promptWriteBack = (next: AgentWriteBackPrompt) => new Promise<boolean>((resolve) => {
    writeBackResolveRef.current = resolve
    setWriteBackPrompt(next)
  })

  const finishWriteBack = (accepted: boolean) => {
    writeBackResolveRef.current?.(accepted)
    writeBackResolveRef.current = null
    setWriteBackPrompt(null)
  }

  const runAgentAction = async (action: FdeAppAction) => {
    setActionBusy(true)
    setError('')
    try {
      const res = await runtimeApi.runAppAction(app.spec.slug, action.name, workspaceCwd, selected)
      if (!isAgentActionStep(res.data)) {
        setError('动作响应无效')
        return
      }
      await runAppAgentJobs(res.data.jobs, {
        appName: app.spec.name,
        actionLabel: action.label,
        slug: app.spec.slug,
        entity: action.entity,
        workspaceCwd,
        promptWriteBack,
        onError: (message) => setError(message),
      })
      setSelected([])
      await load()
      onRefresh?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '动作失败')
    } finally {
      setActionBusy(false)
    }
  }

  const runAction = async (action: FdeAppAction) => {
    if (!selected.length || previewRows || actionBusy) return
    if (action.kind === 'agent') {
      await runAgentAction(action)
      return
    }
    try {
      await runtimeApi.runAppAction(app.spec.slug, action.name, workspaceCwd, selected)
      setSelected([])
      await load()
      onRefresh?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '动作失败')
    }
  }

  return (
    <div className="space-y-2">
      {app.status === 'active' && !previewRows && (
        <button type="button" className="btn-brand h-7" onClick={() => setCreating((v) => !v)}>
          {creating ? '取消新建' : '新建'}
        </button>
      )}
      {creating && app.status === 'active' && !previewRows && (
        <SpecForm
          app={app}
          entity={view.entity}
          workspaceCwd={workspaceCwd}
          onDone={() => {
            setCreating(false)
            void load()
            onRefresh?.()
          }}
        />
      )}
      {view.filters?.map((fname) => {
        const field = app.spec.entities.flatMap((e) => e.fields).find((f) => f.name === fname)
        if (field?.type === 'enum') {
          return (
            <select
              key={fname}
              className="input h-8 text-xs mr-2"
              value={filter[fname] ?? ''}
              onChange={(e) => { setFilter((f) => ({ ...f, [fname]: e.target.value })); setPage(1) }}
            >
              <option value="">{fieldLabel(app.spec, view.entity, fname)}</option>
              {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )
        }
        return (
          <input
            key={fname}
            className="input h-8 text-xs mr-2"
            placeholder={fieldLabel(app.spec, view.entity, fname)}
            value={filter[fname] ?? ''}
            onChange={(e) => { setFilter((f) => ({ ...f, [fname]: e.target.value })); setPage(1) }}
          />
        )
      })}
      {error && <div className="text-xs text-accent-red">{error}</div>}
      {writeBackPrompt && (
        <div className="text-xs flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">AI 建议（{fieldLabel(app.spec, view.entity, writeBackPrompt.field)}）：</span>
          <span>{String(writeBackPrompt.value ?? '')}</span>
          <button type="button" className="btn h-7" onClick={() => finishWriteBack(true)}>写入</button>
          <button type="button" className="btn h-7" onClick={() => finishWriteBack(false)}>取消</button>
        </div>
      )}
      <div className="border border-line overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 border-b border-line">
            <tr>
              <th className="w-8 px-2 py-2" />
              {columns.map((col) => (
                <th key={col} className="px-2 py-2 text-left font-medium">{fieldLabel(app.spec, view.entity, col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-ink-muted">加载中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-ink-muted">暂无记录</td></tr>
            ) : rows.map((row) => (
              <tr key={String(row.id)} className="border-t border-line hover:bg-surface-2">
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(String(row.id))}
                    onChange={() => {
                      const id = String(row.id)
                      setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])
                    }}
                  />
                </td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-2 py-1.5 cursor-pointer"
                    onClick={() => onSelectRid?.(String(row.id))}
                  >
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>共 {total} 条{total > 100000 ? '（约）' : ''}</span>
        <div className="flex gap-1">
          <button type="button" className="btn h-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <button type="button" className="btn h-7" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      </div>
      {entityActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entityActions.map((action) => (
            <button
              key={action.name}
              type="button"
              className="btn h-7"
              disabled={!selected.length || Boolean(previewRows) || actionBusy}
              onClick={() => void runAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
