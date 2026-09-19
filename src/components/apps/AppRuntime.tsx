import { useState } from 'react'
import clsx from 'clsx'
import { AppProductPage } from '@/components/apps/AppProductPage'
import { appBuilderPrompt } from '@/lib/app-builder-prompt'
import { askAiForResult } from '@/lib/ask-ai'
import { SpecKanban } from '@/components/apps/SpecKanban'
import { SpecStat } from '@/components/apps/SpecStat'
import { SpecTable } from '@/components/apps/SpecTable'
import { SpecForm } from '@/components/apps/SpecForm'
import { SpecEditor } from '@/components/apps/SpecEditor'
import { hasProductPages, isCurrentRevisionPending, isFdeAppSpec, mockRowsForEntity, type FdeAppDetail } from '@/lib/app-spec'
import { runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: FdeAppDetail
  workspaceCwd: string
  previewMode?: boolean
  variant?: 'dialog' | 'workspace'
  onChanged: () => void
  onRequestDelete?: () => void
}

function mockRows(spec: FdeAppDetail['spec']): Record<string, unknown>[] {
  const table = spec.views.find((v) => v.type === 'table' || v.type === 'feed' || v.type === 'cards')
  const entity = table?.entity || spec.entities[0]?.name
  if (!entity) return []
  return mockRowsForEntity(spec, entity)
}

export function AppRuntime({ app, workspaceCwd, previewMode: _previewMode, variant, onChanged, onRequestDelete }: Props) {
  const spec = app.spec
  const views = spec.views
  const [viewId, setViewId] = useState(views[0]?.id || views[0]?.type || '0')
  const [showBuilder, setShowBuilder] = useState(false)
  const [detailRid, setDetailRid] = useState('')
  const [note, setNote] = useState('')
  const [reviseDescription, setReviseDescription] = useState('')
  const [reviseGenerating, setReviseGenerating] = useState(false)
  const [reviseError, setReviseError] = useState('')
  const previewRows = app.status !== 'active' ? mockRows(spec) : undefined
  const current = views.find((v) => (v.id || v.type) === viewId) || views[0]
  const live = app.status === 'active'
  const pendingMaterialize = isCurrentRevisionPending(app)
  const product = hasProductPages(spec)
  const daily = variant === 'workspace' && product

  const activate = async () => {
    setNote('')
    try {
      const res = await runtimeApi.activateDeclarativeApp(app.id)
      if (!res.ok) {
        setNote(res.errors?.map((e) => `${e.path}: ${e.message}`).join('；') || '激活失败')
        return
      }
      onChanged()
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : '激活失败')
    }
  }

  const archive = async () => {
    if (onRequestDelete) {
      onRequestDelete()
      return
    }
    await runtimeApi.archiveDeclarativeApp(app.id)
    onChanged()
  }

  const submitRevisePrompt = async () => {
    const description = reviseDescription.trim()
    if (!description || reviseGenerating) return
    setReviseError('')
    setReviseGenerating(true)
    const beforeRev = app.currentRevision
    const deadline = Date.now() + 240_000
    let settled = false
    const finish = (ok: boolean, error?: string) => {
      if (settled) return
      settled = true
      if (ok) {
        setReviseDescription('')
        onChanged()
      } else {
        setReviseError(error || '修订失败')
      }
    }
    try {
      const waitBump = async () => {
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1500))
          const data = await runtimeApi.getDeclarativeApp(app.id).catch(() => null)
          if (data && data.currentRevision > beforeRev) return data
        }
        return null
      }
      void askAiForResult<{ appId: string; revision: number }>({
        intent: '修订业务应用',
        preset: 'fde-app-builder',
        title: `应用修订 · ${spec.name}`,
        context: ['workspace', 'apps'],
        prompt: appBuilderPrompt({
          mode: 'revise',
          description,
          appId: app.id,
          currentSpecJson: JSON.stringify(app.spec),
        }),
        schema: { type: 'object', required: ['appId', 'revision'] },
        timeoutMs: 240_000,
      }).then(async (result) => {
        if (result.ok) {
          finish(true)
          return
        }
        const bumped = await waitBump()
        finish(Boolean(bumped), result.error || '修订失败')
      })
      const bumped = await waitBump()
      if (bumped) finish(true)
      else finish(false, '生成超时。改描述再试。')
    } catch (cause) {
      finish(false, cause instanceof Error ? cause.message : '修订失败')
    } finally {
      setReviseGenerating(false)
    }
  }

  const rollback = async (revision: number) => {
    if (revision === app.currentRevision) return
    setNote('')
    try {
      await runtimeApi.rollbackDeclarativeApp(app.id, revision)
      onChanged()
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : '回滚失败')
    }
  }

  if (!isFdeAppSpec(spec)) {
    return <div className="px-4 py-3 text-xs text-ink-muted">不是 fde-app/v1 声明式应用</div>
  }

  const builderControls = (
    <div className="flex flex-wrap gap-2">
      {pendingMaterialize && (
        <button type="button" className="btn-brand h-7" onClick={() => void activate()}>
          {app.status === 'draft' ? '采纳并激活' : '激活本次修订'}
        </button>
      )}
      {app.status === 'draft' && onRequestDelete && (
        <button type="button" className="btn h-7" onClick={onRequestDelete}>删除草稿</button>
      )}
      {variant !== 'dialog' && (
        <select
          className="input h-7 text-xs"
          defaultValue=""
          onChange={(e) => {
            const rev = Number(e.target.value)
            if (rev > 0) void rollback(rev)
            e.target.value = ''
          }}
        >
          <option value="">版本回滚…</option>
          {app.revisions?.map((r) => (
            <option key={r.revision} value={r.revision}>修订 {r.revision}</option>
          ))}
        </select>
      )}
      {app.status === 'active' && (
        <button type="button" className="btn h-7" onClick={() => void archive()}>删除</button>
      )}
    </div>
  )

  return (
    <div className={variant === 'dialog' || variant === 'workspace' ? '' : 'border-t border-line'}>
      {daily ? (
        <div className="px-4 pt-2 flex justify-end">
          <button
            type="button"
            className="btn-ghost h-7 text-xs text-ink-muted"
            data-app-builder-open="true"
            onClick={() => setShowBuilder(true)}
          >
            建造
          </button>
        </div>
      ) : (
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2">
          {product ? (
            <div className="text-xs text-ink-muted">{spec.description || spec.name}</div>
          ) : (
            <div className="flex items-center rounded border border-line bg-surface p-0.5">
              {views.map((view) => {
                const key = view.id || `${view.type}-${view.entity}`
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setViewId(view.id || view.type); setDetailRid('') }}
                    className={clsx(
                      'h-7 px-2.5 rounded text-xs transition-colors',
                      (view.id || view.type) === viewId ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-2',
                    )}
                  >
                    {view.label || view.type}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {builderControls}
            <button type="button" className="btn h-7" onClick={() => setShowBuilder((v) => !v)}>编辑 spec</button>
          </div>
        </div>
      )}
      {note && <div className="px-4 py-2 text-xs text-accent-red">{note}</div>}
      {showBuilder && daily && (
        <div className="fixed inset-0 z-[85] flex justify-end" data-app-builder-drawer="true">
          <button type="button" className="flex-1 bg-ink/20" aria-label="关闭建造" onClick={() => setShowBuilder(false)} />
          <div className="w-full max-w-md h-full bg-surface border-l border-line overflow-y-auto shadow-pop">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="text-sm font-medium">建造</div>
              <button type="button" className="btn h-7" onClick={() => setShowBuilder(false)}>关闭</button>
            </div>
            <div className="px-4 py-3 space-y-3">
              {spec.description && <div className="text-xs text-ink-muted leading-relaxed">{spec.description}</div>}
              {builderControls}
            </div>
            <div className="px-4 py-3 border-t border-line space-y-2">
              <div className="text-sm font-medium">用一句话改</div>
              <div data-app-revise-prompt="true">
                <textarea
                  className="input w-full min-h-[4.5rem] text-sm resize-y"
                  placeholder="例如：卡片再密一点，主操作放播放"
                  value={reviseDescription}
                  disabled={reviseGenerating}
                  onChange={(e) => setReviseDescription(e.target.value)}
                />
              </div>
              {reviseGenerating && (
                <div className="text-xs text-ink-muted">正在按这句话写进 spec</div>
              )}
              {reviseError && <div className="text-xs text-accent-red">{reviseError}</div>}
              <button
                type="button"
                className="btn-brand h-8"
                data-app-revise-submit="true"
                disabled={!reviseDescription.trim() || reviseGenerating}
                onClick={() => void submitRevisePrompt()}
              >
                生成修订
              </button>
            </div>
            <SpecEditor app={app} onSaved={onChanged} />
          </div>
        </div>
      )}
      {showBuilder && !daily && <SpecEditor app={app} onSaved={onChanged} />}
      {product ? (
        <div className="px-4 py-3">
          <AppProductPage app={app} workspaceCwd={workspaceCwd} onRefresh={onChanged} />
          {app.status === 'archived' && (
            <div className="text-xs text-ink-muted mt-2">已归档，只读。</div>
          )}
        </div>
      ) : (
      <div className="px-4 py-3">
        {current?.type === 'table' && (
          <SpecTable
            app={app}
            view={current}
            workspaceCwd={workspaceCwd}
            previewRows={previewRows}
            onSelectRid={setDetailRid}
            onRefresh={onChanged}
          />
        )}
        {current?.type === 'form' && (
          <SpecForm app={app} entity={current.entity} workspaceCwd={workspaceCwd} readOnly={!live} onDone={onChanged} />
        )}
        {current?.type === 'kanban' && (
          <SpecKanban app={app} view={current} workspaceCwd={workspaceCwd} previewRows={previewRows} />
        )}
        {current?.type === 'stat' && (
          <SpecStat app={app} view={current} workspaceCwd={workspaceCwd} />
        )}
        {detailRid && current?.type === 'table' && (
          <div className="mt-4 border-t border-line pt-3">
            <SpecForm
              app={app}
              entity={current.entity}
              workspaceCwd={workspaceCwd}
              rid={detailRid}
              readOnly={!live}
              onDone={onChanged}
            />
          </div>
        )}
        {app.status === 'archived' && (
          <div className="text-xs text-ink-muted mt-2">已归档，只读。</div>
        )}
      </div>
      )}
    </div>
  )
}
