import { useEffect, useRef, useState } from 'react'
import { fieldLabel } from '@/components/apps/SpecForm'
import { SpecForm } from '@/components/apps/SpecForm'
import { type FdeAppAction, type FdeAppSpec } from '@/lib/app-spec'
import { type AgentWriteBackPrompt, isAgentActionStep, runAppAgentJobs } from '@/lib/app-agent-action'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: FdeAppSpec; status: string }
  entity: string
  rid: string
  workspaceCwd: string
  onEdit?: () => void
}

export function SpecDetail({ app, entity, rid, workspaceCwd, onEdit }: Props) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [writeBackPrompt, setWriteBackPrompt] = useState<AgentWriteBackPrompt | null>(null)
  const writeBackResolveRef = useRef<((accepted: boolean) => void) | null>(null)
  const entityActions = (app.spec.actions ?? []).filter((a) => a.entity === entity)

  const reloadRow = () => {
    void fetch(
      `${runtimeApi.baseUrl}/api/v1/apps/${encodeURIComponent(app.spec.slug)}/${encodeURIComponent(entity)}/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    ).then((r) => r.json()).then((j) => setRow(j.data ?? null)).catch(() => setRow(null))
  }

  useEffect(() => {
    if (app.status !== 'active') return
    void runtimeApi.listAppRecords(app.spec.slug, entity, workspaceCwd, { size: 1 }).catch(() => null)
    void fetch(
      `${runtimeApi.baseUrl}/api/v1/apps/${encodeURIComponent(app.spec.slug)}/${encodeURIComponent(entity)}/${encodeURIComponent(rid)}?workspace=${encodeURIComponent(workspaceCwd)}`,
    ).then((r) => r.json()).then((j) => setRow(j.data ?? null)).catch(() => setRow(null))
  }, [app.spec.slug, app.status, entity, rid, workspaceCwd])

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
      const res = await runtimeApi.runAppAction(app.spec.slug, action.name, workspaceCwd, [rid])
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
      reloadRow()
      onEdit?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '动作失败')
    } finally {
      setActionBusy(false)
    }
  }

  const runAction = async (action: FdeAppAction) => {
    if (app.status !== 'active' || actionBusy) return
    if (action.kind === 'agent') {
      await runAgentAction(action)
      return
    }
    setError('')
    try {
      await runtimeApi.runAppAction(app.spec.slug, action.name, workspaceCwd, [rid])
      reloadRow()
      onEdit?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '动作失败')
    }
  }

  const ent = app.spec.entities.find((e) => e.name === entity)
  if (!ent) return null

  if (editing) {
    return (
      <SpecForm
        app={app}
        entity={entity}
        workspaceCwd={workspaceCwd}
        rid={rid}
        initial={row ?? undefined}
        onDone={() => { setEditing(false); onEdit?.() }}
      />
    )
  }

  return (
    <div className="space-y-2">
      {ent.fields.map((f) => (
        <div key={f.name} className="text-xs">
          <span className="text-ink-muted">{fieldLabel(app.spec, entity, f.name)}：</span>
          <span>{String(row?.[f.name] ?? '—')}</span>
        </div>
      ))}
      {error && <div className="text-xs text-accent-red">{error}</div>}
      {writeBackPrompt && (
        <div className="text-xs flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">AI 建议（{fieldLabel(app.spec, entity, writeBackPrompt.field)}）：</span>
          <span>{String(writeBackPrompt.value ?? '')}</span>
          <button type="button" className="btn h-7" onClick={() => finishWriteBack(true)}>写入</button>
          <button type="button" className="btn h-7" onClick={() => finishWriteBack(false)}>取消</button>
        </div>
      )}
      {app.status === 'active' && (
        <div className="flex flex-wrap gap-2">
          {entityActions.map((action) => (
            <button
              key={action.name}
              type="button"
              className="btn h-8"
              disabled={actionBusy}
              onClick={() => void runAction(action)}
            >
              {action.label}
            </button>
          ))}
          <button type="button" className="btn h-8" onClick={() => setEditing(true)}>编辑</button>
        </div>
      )}
    </div>
  )
}
