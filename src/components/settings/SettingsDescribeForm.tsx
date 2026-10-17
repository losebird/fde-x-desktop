import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { SurfaceButton } from '@/components/surface/Button'
import { SurfaceField, SurfaceInput, SurfaceSelect, SurfaceTextarea } from '@/components/surface/Field'
import { SurfaceSegmented } from '@/components/surface/Segmented'
import { SurfaceSwitch } from '@/components/surface/Switch'
import {
  catalogRowKey,
  catalogRowLabel,
  dictInnerUid,
  dirtyTopLevelOps,
  isScalarNode,
  joinCatalog,
  objectFieldEntries,
  objectFieldsAreScalar,
  requiredStringFields,
  rootObjectUid,
  schemaNode,
  secretSlot,
  unionConstOptions,
  type SettingsCatalog,
} from '@/lib/settings-schema'

type Schema = Record<string, unknown>

function cloneValue(value: unknown) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function defaultFor(schema: Schema, uid: unknown) {
  const node = schemaNode(schema, uid)
  const meta = node?.meta && typeof node.meta === 'object' ? node.meta as { default?: unknown } : null
  if (meta && Object.prototype.hasOwnProperty.call(meta, 'default')) return cloneValue(meta.default)
  const type = String(node?.type || '')
  if (type === 'object' || type === 'dict') return {}
  if (type === 'array') return []
  if (type === 'boolean') return false
  if (type === 'number') return 0
  return ''
}

function fieldCopy(meta: Record<string, unknown>, name: string) {
  const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : name
  const hint = typeof meta.description === 'string' && meta.description.trim() ? meta.description.trim() : ''
  return { title, hint }
}

function FieldShell({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  if (!label && !hint && !error) return <>{children}</>
  return (
    <SurfaceField label={label || undefined} hint={hint} error={error}>
      {children}
    </SurfaceField>
  )
}

function JsonValueField({
  value,
  disabled,
  onChange,
}: {
  value: unknown
  disabled?: boolean
  onChange: (next: unknown) => void
}) {
  const serialized = JSON.stringify(value, null, 2)
  const [text, setText] = useState(serialized)
  const [error, setError] = useState('')
  useEffect(() => {
    setText(serialized)
    setError('')
  }, [serialized])
  return (
    <SurfaceField error={error || undefined}>
      <SurfaceTextarea
        className="font-mono text-kit-sm"
        disabled={disabled}
        value={text}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          try {
            onChange(JSON.parse(next))
            setError('')
          } catch {
            setError('这段还不是合法的 JSON。')
          }
        }}
      />
    </SurfaceField>
  )
}

function summaryOf(value: unknown) {
  if (value === true) return '开'
  if (value === false) return '关'
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return `${value.length} 项`
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    if (typeof rec.provider === 'string' && typeof rec.model === 'string') return `${rec.provider} · ${rec.model}`
    const keys = Object.keys(rec)
    if (keys.length === 1 && rec.enabled !== undefined) return rec.enabled ? '开' : '关'
    const bits = keys.map((key) => {
      const item = rec[key]
      if (typeof item === 'boolean') return item ? '开' : '关'
      if (typeof item === 'number' || typeof item === 'string') return String(item)
      if (Array.isArray(item)) return `${item.length} 项`
      return ''
    }).filter(Boolean).slice(0, 3)
    return bits.join(' · ')
  }
  return ''
}

function pickRequired(row: Record<string, unknown>, required: string[]) {
  const next: Record<string, unknown> = {}
  for (const key of required) next[key] = row[key]
  return next
}

function FieldEditor({
  schema,
  uid,
  name,
  path,
  value,
  secrets,
  catalogs,
  compact,
  disabled,
  onChange,
}: {
  schema: Schema
  uid: unknown
  name: string
  path: string[]
  value: unknown
  secrets?: unknown
  catalogs?: SettingsCatalog[]
  compact?: boolean
  disabled?: boolean
  onChange: (next: unknown) => void
}) {
  const node = schemaNode(schema, uid)
  const type = String(node?.type || '')
  const meta = node?.meta && typeof node.meta === 'object' ? node.meta as Record<string, unknown> : {}
  const copy = fieldCopy(meta, name)
  const enums = unionConstOptions(schema, uid)
  const slot = secretSlot(secrets, path)
  const wrap = (body: ReactNode) => (compact ? body : <FieldShell label={copy.title} hint={copy.hint}>{body}</FieldShell>)

  if (type === 'boolean') {
    return (
      <SurfaceSwitch
        checked={Boolean(value)}
        disabled={disabled}
        label={copy.title || '开关'}
        hint={copy.hint || undefined}
        onCheckedChange={onChange}
      />
    )
  }

  if (type === 'number') {
    const numeric = typeof value === 'number' ? value : value === '' || value == null ? null : Number(value)
    let error = ''
    if (typeof numeric === 'number' && !Number.isNaN(numeric)) {
      if (meta.min !== undefined && numeric < Number(meta.min)) error = `不能小于 ${meta.min}。`
      if (meta.max !== undefined && numeric > Number(meta.max)) error = `不能大于 ${meta.max}。`
    }
    return (
      <FieldShell label={copy.title} hint={copy.hint} error={error}>
        <SurfaceInput
          type="number"
          step={meta.step === undefined ? undefined : Number(meta.step)}
          min={meta.min === undefined ? undefined : Number(meta.min)}
          max={meta.max === undefined ? undefined : Number(meta.max)}
          value={value === undefined || value === null || Number.isNaN(value) ? '' : String(value)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const raw = event.target.value
            onChange(raw === '' ? undefined : Number(raw))
          }}
        />
      </FieldShell>
    )
  }

  if (type === 'union' && enums.length) {
    if (enums.length <= 5) {
      return (
        <FieldShell label={copy.title} hint={copy.hint}>
          <SurfaceSegmented
            value={value === undefined || value === null ? '' : String(value)}
            disabled={disabled}
            options={enums.map((option) => ({ id: String(option), label: String(option) }))}
            onChange={(id) => {
              const hit = enums.find((option) => String(option) === id)
              if (hit !== undefined) onChange(hit)
            }}
          />
        </FieldShell>
      )
    }
    return (
      <FieldShell label={copy.title} hint={copy.hint}>
        <SurfaceSelect
          value={value === undefined || value === null ? '' : String(value)}
          disabled={disabled}
          onChange={(event) => {
            const hit = enums.find((option) => String(option) === event.target.value)
            onChange(hit)
          }}
        >
          {enums.map((option) => (
            <option key={String(option)} value={String(option)}>{String(option)}</option>
          ))}
        </SurfaceSelect>
      </FieldShell>
    )
  }

  if (type === 'object') {
    const catalog = joinCatalog(schema, uid, catalogs)
    const required = requiredStringFields(schema, uid).map((field) => field.name)
    const fields = objectFieldEntries(schema, uid)
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    if (catalog) {
      const extras = fields.filter((field) => !required.includes(field.name))
      return (
        <div className="space-y-3">
          {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
          <CatalogObjectPicker
            catalog={catalog}
            required={required}
            value={record}
            disabled={disabled}
            onChange={onChange}
          />
          {extras.length > 0 && (
            <ScalarCluster
              schema={schema}
              fields={extras}
              record={record}
              path={path}
              secrets={secrets}
              catalogs={catalogs}
              disabled={disabled}
              onChange={onChange}
            />
          )}
        </div>
      )
    }
    if (objectFieldsAreScalar(schema, uid)) {
      return (
        <div className="space-y-3">
          {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
          <ScalarCluster
            schema={schema}
            fields={fields}
            record={record}
            path={path}
            secrets={secrets}
            catalogs={catalogs}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      )
    }
    const scalars = fields.filter((field) => isScalarNode(schema, field.uid))
    const rest = fields.filter((field) => !scalars.includes(field))
    return (
      <div className="space-y-3">
        {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
        {scalars.length > 0 && (
          <ScalarCluster
            schema={schema}
            fields={scalars}
            record={record}
            path={path}
            secrets={secrets}
            catalogs={catalogs}
            disabled={disabled}
            onChange={onChange}
          />
        )}
        {rest.map((field) => (
          <FieldEditor
            key={field.name}
            schema={schema}
            uid={field.uid}
            name={field.name}
            path={[...path, field.name]}
            value={record[field.name]}
            secrets={secrets}
            catalogs={catalogs}
            disabled={disabled}
            onChange={(next) => onChange({ ...record, [field.name]: next })}
          />
        ))}
      </div>
    )
  }

  if (type === 'dict') {
    const innerUid = dictInnerUid(node)
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    const keys = Object.keys(record)
    if (objectFieldsAreScalar(schema, innerUid)) {
      return (
        <ScalarObjectTable
          schema={schema}
          uid={innerUid}
          name={name}
          path={path}
          rows={keys.map((key) => ({ key, value: record[key] }))}
          keyed
          secrets={secrets}
          catalogs={catalogs}
          disabled={disabled}
          onChange={(nextRows) => {
            const next: Record<string, unknown> = {}
            for (const row of nextRows) next[row.key] = row.value
            onChange(next)
          }}
          onAddKey={(key) => onChange({ ...record, [key]: defaultFor(schema, innerUid) })}
        />
      )
    }
    return (
      <div className="space-y-2">
        {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
        {keys.map((key) => (
          <div key={key} className="rounded-lg border border-line p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium font-mono truncate">{key}</div>
              <button
                type="button"
                className="btn-ghost h-7 px-2 text-xs shrink-0"
                disabled={disabled}
                onClick={() => {
                  const next = { ...record }
                  delete next[key]
                  onChange(next)
                }}
              >
                删除
              </button>
            </div>
            <FieldEditor
              schema={schema}
              uid={innerUid}
              name=""
              path={[...path, key]}
              value={record[key]}
              secrets={secrets}
              catalogs={catalogs}
              disabled={disabled}
              onChange={(next) => onChange({ ...record, [key]: next })}
            />
          </div>
        ))}
        <DictKeyAdd disabled={disabled} existing={keys} onAdd={(key) => onChange({ ...record, [key]: defaultFor(schema, innerUid) })} />
      </div>
    )
  }

  if (type === 'array') {
    const innerUid = node?.inner
    const rows = Array.isArray(value) ? value : []
    const catalog = joinCatalog(schema, innerUid, catalogs)
    if (catalog) {
      return (
        <CatalogArrayField
          schema={schema}
          uid={innerUid}
          name={name}
          catalog={catalog}
          rows={rows}
          disabled={disabled}
          onChange={onChange}
        />
      )
    }
    if (isScalarNode(schema, innerUid)) {
      return <ScalarChipList name={name} schema={schema} uid={innerUid} rows={rows} disabled={disabled} onChange={onChange} />
    }
    if (objectFieldsAreScalar(schema, innerUid)) {
      return (
        <ScalarObjectTable
          schema={schema}
          uid={innerUid}
          name={name}
          path={path}
          rows={rows.map((row, index) => ({ key: String(index), value: row }))}
          secrets={secrets}
          catalogs={catalogs}
          disabled={disabled}
          onChange={(nextRows) => onChange(nextRows.map((row) => row.value))}
          onAdd={() => onChange([...rows, defaultFor(schema, innerUid)])}
        />
      )
    }
    return (
      <div className="space-y-2">
        {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
        {rows.map((row, index) => (
          <div key={index} className="rounded-lg border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-ink-subtle">#{index + 1}</div>
              <button
                type="button"
                className="btn-ghost h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                删除
              </button>
            </div>
            <FieldEditor
              schema={schema}
              uid={innerUid}
              name=""
              path={[...path, String(index)]}
              value={row}
              secrets={secrets}
              catalogs={catalogs}
              disabled={disabled}
              onChange={(next) => {
                const copy = rows.slice()
                copy[index] = next
                onChange(copy)
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn h-8 px-2 text-xs"
          disabled={disabled}
          onClick={() => onChange([...rows, defaultFor(schema, innerUid)])}
        >
          添加
        </button>
      </div>
    )
  }

  if (type === 'const') {
    return (
      <div className="text-sm">
        {name ? <span className="text-ink-muted mr-2">{name}</span> : null}
        <span className="font-mono text-xs">{String(node?.value ?? value ?? '')}</span>
      </div>
    )
  }

  if (value && typeof value === 'object') {
    return wrap(
      <JsonValueField value={value} disabled={disabled} onChange={onChange} />,
    )
  }

  const required = meta.required === true
  const missing = required && !String(value ?? '').trim() && !slot?.set
  const secretSet = Boolean(slot?.set) && (value === undefined || value === null || value === '')
  return (
    <FieldShell
      label={copy.title}
      hint={copy.hint || (secretSet ? '已配置。留空表示不改。' : undefined)}
      error={missing ? '这一项必填。' : undefined}
    >
      <SurfaceInput
        type={slot ? 'password' : 'text'}
        placeholder={secretSet ? '已配置' : undefined}
        value={value === undefined || value === null ? '' : String(value)}
        disabled={disabled}
        aria-invalid={missing ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

function ScalarCluster({
  schema,
  fields,
  record,
  path,
  secrets,
  catalogs,
  disabled,
  onChange,
}: {
  schema: Schema
  fields: Array<{ name: string; uid: unknown }>
  record: Record<string, unknown>
  path: string[]
  secrets?: unknown
  catalogs?: SettingsCatalog[]
  disabled?: boolean
  onChange: (next: Record<string, unknown>) => void
}) {
  return (
    <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
      {fields.map((field) => (
        <FieldEditor
          key={field.name}
          schema={schema}
          uid={field.uid}
          name={field.name}
          path={[...path, field.name]}
          value={record[field.name]}
          secrets={secrets}
          catalogs={catalogs}
          disabled={disabled}
          onChange={(next) => onChange({ ...record, [field.name]: next })}
        />
      ))}
    </div>
  )
}

function ScalarChipList({
  name,
  schema,
  uid,
  rows,
  disabled,
  onChange,
}: {
  name: string
  schema: Schema
  uid: unknown
  rows: unknown[]
  disabled?: boolean
  onChange: (next: unknown[]) => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <div className="space-y-2">
      {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
      <div className="flex flex-wrap gap-1">
        {rows.map((item, index) => (
          <span key={index} className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-line text-xs">
            {String(item ?? '')}
            <button
              type="button"
              className="text-ink-muted"
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              删除
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 min-w-0"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !draft.trim()) return
            event.preventDefault()
            onChange([...rows, draft.trim()])
            setDraft('')
          }}
        />
        <button
          type="button"
          className="btn h-8 px-2 text-xs shrink-0"
          disabled={disabled || !draft.trim()}
          onClick={() => {
            onChange([...rows, draft.trim() || defaultFor(schema, uid)])
            setDraft('')
          }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

function ScalarObjectTable({
  schema,
  uid,
  name,
  path,
  rows,
  keyed,
  secrets,
  catalogs,
  disabled,
  onChange,
  onAdd,
  onAddKey,
}: {
  schema: Schema
  uid: unknown
  name: string
  path: string[]
  rows: Array<{ key: string; value: unknown }>
  keyed?: boolean
  secrets?: unknown
  catalogs?: SettingsCatalog[]
  disabled?: boolean
  onChange: (next: Array<{ key: string; value: unknown }>) => void
  onAdd?: () => void
  onAddKey?: (key: string) => void
}) {
  const fields = objectFieldEntries(schema, uid)
  const [query, setQuery] = useState('')
  const filtered = rows.filter((row) => {
    if (!query.trim()) return true
    return summaryOf(row.value).toLowerCase().includes(query.trim().toLowerCase()) || row.key.toLowerCase().includes(query.trim().toLowerCase())
  })
  return (
    <div className="space-y-2">
      {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
      {rows.length > 8 && (
        <input className="input w-full" placeholder="过滤" value={query} onChange={(event) => setQuery(event.target.value)} />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              {keyed ? <th className="py-1 pr-2 font-medium">键</th> : null}
              {fields.map((field) => (
                <th key={field.name} className="py-1 pr-2 font-medium">{field.name}</th>
              ))}
              <th className="py-1 w-14" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((row) => {
              const record = row.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value as Record<string, unknown> : {}
              const index = rows.indexOf(row)
              return (
                <tr key={row.key}>
                  {keyed ? <td className="py-2 pr-2 font-mono text-xs align-top">{row.key}</td> : null}
                  {fields.map((field) => (
                    <td key={field.name} className="py-2 pr-2 align-top min-w-[8rem]">
                      <FieldEditor
                        schema={schema}
                        uid={field.uid}
                        name=""
                        path={[...path, keyed ? row.key : String(index), field.name]}
                        value={record[field.name]}
                        secrets={secrets}
                        catalogs={catalogs}
                        compact
                        disabled={disabled}
                        onChange={(next) => {
                          const copy = rows.slice()
                          copy[index] = { key: row.key, value: { ...record, [field.name]: next } }
                          onChange(copy)
                        }}
                      />
                    </td>
                  ))}
                  <td className="py-2 align-top">
                    <button
                      type="button"
                      className="btn-ghost h-7 px-2 text-xs"
                      disabled={disabled}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {onAddKey ? (
        <DictKeyAdd disabled={disabled} existing={rows.map((row) => row.key)} onAdd={onAddKey} />
      ) : (
        <button type="button" className="btn h-8 px-2 text-xs" disabled={disabled} onClick={onAdd}>添加</button>
      )}
    </div>
  )
}

function CatalogObjectPicker({
  catalog,
  required,
  value,
  disabled,
  onChange,
}: {
  catalog: SettingsCatalog
  required: string[]
  value: Record<string, unknown>
  disabled?: boolean
  onChange: (next: Record<string, unknown>) => void
}) {
  const current = catalogRowKey(value, required)
  const inCatalog = catalog.rows.some((row) => catalogRowKey(row, required) === current)
  return (
    <select
      className="input w-full"
      value={current}
      disabled={disabled}
      onChange={(event) => {
        const hit = catalog.rows.find((row) => catalogRowKey(row, required) === event.target.value)
        if (!hit) return
        onChange({ ...value, ...pickRequired(hit, required) })
      }}
    >
      {!inCatalog && current ? <option value={current}>{catalogRowLabel(value, required) || current}</option> : null}
      {catalog.rows.map((row) => {
        const key = catalogRowKey(row, required)
        return <option key={key} value={key}>{catalogRowLabel(row, required)}</option>
      })}
    </select>
  )
}

function CatalogArrayField({
  schema,
  uid,
  name,
  catalog,
  rows,
  disabled,
  onChange,
}: {
  schema: Schema
  uid: unknown
  name: string
  catalog: SettingsCatalog
  rows: unknown[]
  disabled?: boolean
  onChange: (next: unknown[]) => void
}) {
  const required = requiredStringFields(schema, uid).map((field) => field.name)
  const stored = rows.map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : {}))
  const selected = new Set(stored.map((row) => catalogRowKey(row, required)))
  const extras = stored.filter((row) => !catalog.rows.some((item) => catalogRowKey(item, required) === catalogRowKey(row, required)))
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const needle = query.trim().toLowerCase()
  const visible = catalog.rows.filter((row) => !needle || catalogRowLabel(row, required).toLowerCase().includes(needle))
  const showFilter = catalog.rows.length + extras.length > 8
  const toggle = (row: Record<string, unknown>, on: boolean) => {
    const key = catalogRowKey(row, required)
    if (on) {
      if (selected.has(key)) return
      onChange([...stored, pickRequired(row, required)])
      return
    }
    onChange(stored.filter((item) => catalogRowKey(item, required) !== key))
  }
  return (
    <div className="space-y-2">
      {name ? <div className="text-xs font-medium text-ink">{name}</div> : null}
      {showFilter && (
        <input className="input w-full" placeholder="过滤" value={query} onChange={(event) => setQuery(event.target.value)} />
      )}
      <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
        {visible.map((row) => {
          const key = catalogRowKey(row, required)
          return (
            <label key={key} className="flex items-center gap-2 min-h-8 px-1">
              <input
                type="checkbox"
                className="rounded border-line"
                checked={selected.has(key)}
                disabled={disabled}
                onChange={(event) => toggle(row, event.target.checked)}
              />
              <span className="text-sm truncate">{catalogRowLabel(row, required)}</span>
            </label>
          )
        })}
        {extras.map((row) => {
          const key = catalogRowKey(row, required)
          return (
            <div key={key} className="flex items-center gap-2 min-h-8 px-1">
              <span className="text-sm truncate flex-1">{catalogRowLabel(row, required) || key}</span>
              <button
                type="button"
                className="btn-ghost h-7 px-2 text-xs shrink-0"
                disabled={disabled}
                onClick={() => onChange(stored.filter((item) => catalogRowKey(item, required) !== key))}
              >
                删除
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {required.map((key) => (
          <label key={key} className="min-w-[8rem] flex-1">
            <div className="text-xs font-medium text-ink mb-1.5">{key}</div>
            <input
              className="input w-full"
              value={draft[key] || ''}
              disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        <button
          type="button"
          className="btn h-8 px-2 text-xs shrink-0"
          disabled={disabled || required.some((key) => !String(draft[key] || '').trim())}
          onClick={() => {
            const rec: Record<string, unknown> = {}
            for (const key of required) rec[key] = String(draft[key] || '').trim()
            if (selected.has(catalogRowKey(rec, required))) {
              setDraft({})
              return
            }
            onChange([...stored, rec])
            setDraft({})
          }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

function SaveRow({
  count,
  disabled,
  onSave,
  onRevert,
}: {
  count: number
  disabled?: boolean
  onSave: () => void
  onRevert: () => void
}) {
  if (!count) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-kit-line pt-3">
      <span className="text-kit-sm text-kit-secondary">未保存 {count} 项</span>
      <span className="flex gap-2">
        <SurfaceButton variant="ghost" disabled={disabled} onClick={onRevert}>还原</SurfaceButton>
        <SurfaceButton variant="primary" disabled={disabled} onClick={onSave}>保存</SurfaceButton>
      </span>
    </div>
  )
}

function DictKeyAdd({
  existing,
  disabled,
  onAdd,
}: {
  existing: string[]
  disabled?: boolean
  onAdd: (key: string) => void
}) {
  const [key, setKey] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input
        className="input flex-1 min-w-0"
        placeholder="新键名"
        value={key}
        disabled={disabled}
        onChange={(event) => setKey(event.target.value)}
      />
      <button
        type="button"
        className="btn h-8 px-2 text-xs shrink-0"
        disabled={disabled || !key.trim() || existing.includes(key.trim())}
        title={!key.trim() ? '键名不能为空' : existing.includes(key.trim()) ? '键名不能重复' : undefined}
        onClick={() => {
          onAdd(key.trim())
          setKey('')
        }}
      >
        添加
      </button>
    </div>
  )
}

export function SettingsDescribeForm({
  ns,
  title,
  hint,
  schema,
  value,
  secrets,
  catalogs,
  revision,
  disabled,
  onSave,
}: {
  ns: string
  title?: string
  hint?: string
  schema: Schema
  value: unknown
  secrets?: unknown
  catalogs?: SettingsCatalog[]
  revision?: number
  disabled?: boolean
  onSave: (next: Record<string, unknown>) => void
}) {
  const rootUid = rootObjectUid(schema)
  const fields = objectFieldEntries(schema, rootUid)
  const initial = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
  const [draft, setDraft] = useState<Record<string, unknown>>(initial)
  const [open, setOpen] = useState(true)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const current = valueRef.current
    setDraft(current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {})
  }, [ns, revision])

  const dirtyCount = dirtyTopLevelOps(initial, draft).length
  const summary = summaryOf(value)
  const boolFields = fields.filter((field) => String(schemaNode(schema, field.uid)?.type || '') === 'boolean')
  const headerBool = boolFields.length === 1 ? boolFields[0] : null
  const bodyFields = headerBool ? fields.filter((field) => field.name !== headerBool.name) : fields
  const allBoolean = fields.length > 0 && boolFields.length === fields.length

  if (!rootUid || !fields.length) return null

  return (
    <div className="rounded-kit border border-kit-line">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <ChevronDown size={14} className="shrink-0 text-kit-tertiary" /> : <ChevronRight size={14} className="shrink-0 text-kit-tertiary" />}
          <span className="truncate text-kit font-medium text-kit-ink">{title || ns}</span>
          {summary ? <span className="ml-auto truncate text-kit-meta text-kit-secondary max-w-[45%]">{summary}</span> : null}
          {dirtyCount ? <span className="shrink-0 text-kit-meta text-kit-warn">未保存 {dirtyCount} 项</span> : null}
        </button>
        {headerBool ? (
          <SurfaceSwitch
            bare
            checked={Boolean(draft[headerBool.name])}
            disabled={disabled}
            label={headerBool.name}
            onCheckedChange={(next) => setDraft({ ...draft, [headerBool.name]: next })}
          />
        ) : null}
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-line pt-3">
          {hint ? <div className="text-xs text-ink-muted leading-5">{hint}</div> : null}
          {allBoolean && boolFields.length > 1 ? (
            <ScalarCluster
              schema={schema}
              fields={boolFields}
              record={draft}
              path={[]}
              secrets={secrets}
              catalogs={catalogs}
              disabled={disabled}
              onChange={setDraft}
            />
          ) : null}
          {!allBoolean && !headerBool && bodyFields.length > 0 ? (
            <FieldEditor
              schema={schema}
              uid={rootUid}
              name=""
              path={[]}
              value={draft}
              secrets={secrets}
              catalogs={catalogs}
              disabled={disabled}
              onChange={(next) => {
                if (next && typeof next === 'object' && !Array.isArray(next)) setDraft(next as Record<string, unknown>)
              }}
            />
          ) : null}
          {!allBoolean && headerBool ? (
            <>
              {bodyFields.filter((field) => isScalarNode(schema, field.uid)).length > 0 && (
                <ScalarCluster
                  schema={schema}
                  fields={bodyFields.filter((field) => isScalarNode(schema, field.uid))}
                  record={draft}
                  path={[]}
                  secrets={secrets}
                  catalogs={catalogs}
                  disabled={disabled}
                  onChange={setDraft}
                />
              )}
              {bodyFields.filter((field) => !isScalarNode(schema, field.uid)).map((field) => (
                <FieldEditor
                  key={field.name}
                  schema={schema}
                  uid={field.uid}
                  name={field.name}
                  path={[field.name]}
                  value={draft[field.name]}
                  secrets={secrets}
                  catalogs={catalogs}
                  disabled={disabled}
                  onChange={(next) => setDraft({ ...draft, [field.name]: next })}
                />
              ))}
            </>
          ) : null}
          <SaveRow count={dirtyCount} disabled={disabled} onSave={() => onSave(draft)} onRevert={() => setDraft({ ...initial })} />
        </div>
      )}
      {!open && dirtyCount > 0 && (
        <div className="px-3 pb-3">
          <SaveRow count={dirtyCount} disabled={disabled} onSave={() => onSave(draft)} onRevert={() => setDraft({ ...initial })} />
        </div>
      )}
    </div>
  )
}
