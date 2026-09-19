import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  bizKindFromRef,
  entityDef,
  fieldDef,
  fieldLooksLikeBizRef,
  fieldLooksLikeFile,
  specHasUse,
  type FdeAppSpec,
} from '@/lib/app-spec'
import { lookupBizKind, openFilesAtPath, requestFilePick } from '@/lib/app-platform'
import { RuntimeApiError, runtimeApi } from '@/lib/runtime-api'

type Props = {
  app: { id: string; spec: FdeAppSpec; status: string }
  entity: string
  workspaceCwd: string
  rid?: string
  initial?: Record<string, unknown>
  readOnly?: boolean
  onDone?: () => void
  layout?: 'stack' | 'compose'
  submitLabel?: string
  renderSubmit?: (submitButton: ReactNode) => ReactNode
}

export function SpecForm({ app, entity, workspaceCwd, rid, initial, readOnly, onDone, layout = 'stack', submitLabel, renderSubmit }: Props) {
  const ent = entityDef(app.spec, entity)
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = {}
    for (const f of ent?.fields ?? []) {
      base[f.name] = initial?.[f.name] ?? (f.type === 'bool' ? false : '')
    }
    return base
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!ent) return <div className="text-xs text-ink-muted">未知实体</div>

  const submit = async () => {
    if (readOnly || app.status === 'archived') return
    setSaving(true)
    setErrors({})
    setNote('')
    try {
      const payload = { ...values }
      const result = rid
        ? await runtimeApi.patchAppRecord(app.spec.slug, entity, rid, workspaceCwd, payload)
        : await runtimeApi.createAppRecord(app.spec.slug, entity, workspaceCwd, payload)
      if (!result.ok && result.errors) {
        const map: Record<string, string> = {}
        for (const row of result.errors) map[row.path] = row.message
        setErrors(map)
        return
      }
      if (!rid) {
        const base: Record<string, unknown> = {}
        for (const f of ent?.fields ?? []) {
          base[f.name] = f.type === 'bool' ? false : ''
        }
        setValues(base)
      }
      setNote(rid ? '已保存' : '已记下')
      onDone?.()
    } catch (cause) {
      setNote(cause instanceof RuntimeApiError ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const compose = layout === 'compose'
  const canSubmit = !readOnly && app.status !== 'archived'
  const submitButton = canSubmit ? (
    <button
      type="button"
      className={clsx('btn-brand h-8', renderSubmit ? '' : 'w-full')}
      disabled={saving}
      onClick={() => { void submit() }}
    >
      {saving ? '保存中…' : submitLabel || (rid ? '保存' : compose ? `记下${ent.label}` : '创建')}
    </button>
  ) : null

  return (
    <div className="space-y-3" data-app-compose={compose ? 'true' : undefined}>
      <div className={compose ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
      {ent.fields.map((field) => (
        <label key={field.name} className={clsx('block text-xs text-ink-muted', field.type === 'longtext' && compose && 'sm:col-span-2')}>
          {field.label || field.name}
          {field.required && <span className="text-accent-red"> *</span>}
          {field.type === 'longtext' ? (
            <textarea
              className="input mt-1 w-full"
              rows={compose ? 2 : 3}
              disabled={readOnly}
              value={String(values[field.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          ) : field.type === 'enum' ? (
            <select
              className="input mt-1 w-full"
              disabled={readOnly}
              value={String(values[field.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            >
              <option value="">请选择</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'bool' ? (
            <input
              type="checkbox"
              className="mt-2"
              disabled={readOnly}
              checked={Boolean(values[field.name])}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
            />
          ) : field.type === 'number' ? (
            <input
              type="number"
              className="input mt-1 w-full"
              disabled={readOnly}
              value={values[field.name] === '' ? '' : Number(values[field.name])}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value === '' ? '' : Number(e.target.value) }))}
            />
          ) : (
            <input
              className="input mt-1 w-full"
              type={field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'}
              disabled={readOnly}
              value={String(values[field.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              onDragOver={(event) => {
                if (specHasUse(app.spec, 'files') && fieldLooksLikeFile(field)) event.preventDefault()
              }}
              onDrop={(event) => {
                if (!specHasUse(app.spec, 'files') || !fieldLooksLikeFile(field)) return
                event.preventDefault()
                const raw = event.dataTransfer.getData('application/x-fde-file') || event.dataTransfer.getData('text/plain')
                let path = ''
                try {
                  const parsed = JSON.parse(raw.replace(/^fde-file:/, '')) as { path?: string }
                  path = String(parsed.path || '')
                } catch {
                  path = raw.replace(/^file:\/\//i, '')
                }
                if (path) setValues((v) => ({ ...v, [field.name]: path }))
              }}
            />
          )}
          {errors[field.name] && <div className="text-accent-red mt-0.5">{errors[field.name]}</div>}
          {specHasUse(app.spec, 'files') && fieldLooksLikeFile(field) && !readOnly && (
            <button
              type="button"
              className="btn h-7 mt-1"
              data-app-file-pick={field.name}
              onClick={() => {
                openFilesAtPath(String(values[field.name] || ''))
                void requestFilePick().then((path) => {
                  if (path) setValues((v) => ({ ...v, [field.name]: path }))
                })
              }}
            >
              从文件模块引用
            </button>
          )}
          {specHasUse(app.spec, 'biz') && fieldLooksLikeBizRef(field) && (
            <button
              type="button"
              className="btn h-7 mt-1"
              data-app-biz-lookup={field.name}
              onClick={() => {
                const kind = bizKindFromRef(field.ref)
                void lookupBizKind(kind).then((text) => setNote(text)).catch((cause) => {
                  setNote(cause instanceof Error ? cause.message : '现查失败')
                })
              }}
            >
              现查
            </button>
          )}
        </label>
      ))}
      </div>
      {note && <div className="text-xs text-ink-muted">{note}</div>}
      {renderSubmit ? renderSubmit(submitButton) : submitButton}
    </div>
  )
}

export function fieldLabel(spec: FdeAppSpec, entity: string, name: string) {
  return fieldDef(spec, entity, name)?.label || name
}
