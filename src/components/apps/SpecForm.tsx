import { useState } from 'react'
import clsx from 'clsx'
import { entityDef, fieldDef, type FdeAppSpec } from '@/lib/app-spec'
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
}

export function SpecForm({ app, entity, workspaceCwd, rid, initial, readOnly, onDone, layout = 'stack', submitLabel }: Props) {
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
            />
          )}
          {errors[field.name] && <div className="text-accent-red mt-0.5">{errors[field.name]}</div>}
        </label>
      ))}
      </div>
      {note && <div className="text-xs text-ink-muted">{note}</div>}
      {!readOnly && app.status !== 'archived' && (
        <button type="button" className="btn-brand h-8 w-full" disabled={saving} onClick={() => void submit()}>
          {saving ? '保存中…' : submitLabel || (rid ? '保存' : compose ? `记下${ent.label}` : '创建')}
        </button>
      )}
    </div>
  )
}

export function fieldLabel(spec: FdeAppSpec, entity: string, name: string) {
  return fieldDef(spec, entity, name)?.label || name
}
