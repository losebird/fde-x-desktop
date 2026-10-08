import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import {
  catalogRowKey,
  catalogRowLabel,
  dictInnerUid,
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

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  if (!label) return <>{children}</>
  return (
    <div className="block min-w-0">
      <div className="text-xs font-medium text-ink mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
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
  const enums = unionConstOptions(schema, uid)
  const slot = secretSlot(secrets, path)
  const wrap = (body: ReactNode) => (compact ? body : <FieldShell label={name}>{body}</FieldShell>)

  if (type === 'boolean') {
    return (
      <label className="flex items-center gap-2 min-h-8">
        <input
          type="checkbox"
          className="rounded border-line"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {name ? <span className="text-sm">{name}</span> : null}
      </label>
    )
  }

  if (type === 'number') {
    return wrap(
      <input
        className="input w-full"
        type="number"
        step={meta.step === undefined ? undefined : Number(meta.step)}
        min={meta.min === undefined ? undefined : Number(meta.min)}
        max={meta.max === undefined ? undefined : Number(meta.max)}
        value={value === undefined || value === null || Number.isNaN(value) ? '' : String(value)}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? undefined : Number(raw))
        }}
      />,
    )
  }

  if (type === 'union' && enums.length) {
    if (enums.length <= 5) {
      return wrap(
        <div className="flex flex-wrap gap-1">
          {enums.map((option) => {
            const selected = sameValue(value, option)
            return (
              <button
                key={String(option)}
                type="button"
                className={clsx('btn h-8 px-2 text-xs', selected && 'btn-primary')}
                disabled={disabled}
                onClick={() => onChange(option)}
              >
                {String(option)}
              </button>
            )
          })}
        </div>,
      )
    }
    return wrap(
      <select
        className="input w-full"
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
      </select>,
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
      <textarea
        className="input w-full min-h-[88px] font-mono text-xs"
        disabled={disabled}
        value={JSON.stringify(value, null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value))
          } catch {
            /* keep typing until JSON parses */
          }
        }}
      />,
    )
  }

  return wrap(
    <input
      className="input w-full"
      type={slot ? 'password' : 'text'}
      placeholder={slot?.set ? '已配置' : undefined}
      value={value === undefined || value === null ? '' : String(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />,
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
  dirty,
  disabled,
  onSave,
  onRevert,
}: {
  dirty: boolean
  disabled?: boolean
  onSave: () => void
  onRevert: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-primary h-8 px-3 text-xs" disabled={disabled || !dirty} onClick={onSave}>保存</button>
      <button type="button" className="btn-ghost h-8 px-3 text-xs" disabled={disabled || !dirty} onClick={onRevert}>还原</button>
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
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setDraft(value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {})
  }, [ns, revision, value])

  const dirty = useMemo(() => !sameValue(draft, initial), [draft, initial])
  const summary = summaryOf(value)
  const boolFields = fields.filter((field) => String(schemaNode(schema, field.uid)?.type || '') === 'boolean')
  const headerBool = boolFields.length === 1 ? boolFields[0] : null
  const bodyFields = headerBool ? fields.filter((field) => field.name !== headerBool.name) : fields
  const allBoolean = fields.length > 0 && boolFields.length === fields.length

  if (!rootUid || !fields.length) return null

  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <ChevronDown size={14} className="text-ink-subtle shrink-0" /> : <ChevronRight size={14} className="text-ink-subtle shrink-0" />}
        <span className="text-sm font-medium truncate">{title || ns}</span>
        {headerBool ? (
          <input
            type="checkbox"
            className="rounded border-line shrink-0"
            checked={Boolean(draft[headerBool.name])}
            disabled={disabled}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setDraft({ ...draft, [headerBool.name]: event.target.checked })}
          />
        ) : null}
        {summary ? <span className="ml-auto text-xs text-ink-muted truncate max-w-[45%]">{summary}</span> : null}
        {dirty ? <span className="text-[11px] text-accent-amber shrink-0">未保存</span> : null}
      </button>
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
          <SaveRow dirty={dirty} disabled={disabled} onSave={() => onSave(draft)} onRevert={() => setDraft({ ...initial })} />
        </div>
      )}
      {!open && dirty && (
        <div className="px-3 pb-3">
          <SaveRow dirty={dirty} disabled={disabled} onSave={() => onSave(draft)} onRevert={() => setDraft({ ...initial })} />
        </div>
      )}
    </div>
  )
}
