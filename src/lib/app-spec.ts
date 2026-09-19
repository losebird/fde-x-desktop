export type FdeFieldType = 'text' | 'longtext' | 'number' | 'bool' | 'date' | 'datetime' | 'enum' | 'ref' | 'json'

export interface FdeAppField {
  name: string
  label?: string
  type: FdeFieldType
  required?: boolean
  options?: string[]
  ref?: string
  unique?: boolean
}

export interface FdeAppEntity {
  name: string
  label: string
  titleField?: string
  fields: FdeAppField[]
}

export interface FdeAppView {
  id?: string
  type: 'table' | 'form' | 'detail' | 'kanban' | 'stat'
  entity: string
  label?: string
  columns?: string[]
  filters?: string[]
  sort?: { field: string; dir: 'asc' | 'desc' }
  groupBy?: string
  metric?: { fn: 'count' | 'sum' | 'avg'; field?: string }
}

export interface FdeAppAction {
  name: string
  label: string
  entity: string
  kind: 'set' | 'biz' | 'agent'
  set?: Record<string, unknown>
  biz?: { kind: string; action: string; map?: Record<string, unknown> }
  agent?: { preset: string; prompt: string; writeBack?: string }
  approval?: 'none' | 'required'
}

export interface FdeAppSpec {
  spec: 'fde-app/v1'
  slug: string
  name: string
  description?: string
  entities: FdeAppEntity[]
  views: FdeAppView[]
  actions?: FdeAppAction[]
  _workspaceCwd?: string
}

export interface FdeAppDetail {
  id: string
  workspaceId: string
  name: string
  appKind: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  currentRevision: number
  spec: FdeAppSpec
  revisions: { revision: number; change_note?: string; created_at: string; materialize_status?: string }[]
  createdAt: string
  updatedAt: string
}

export interface AppRecordList {
  rows: Record<string, unknown>[]
  columns: string[]
  total: number
  page?: number
  size?: number
  approximate?: boolean
}

export function isFdeAppSpec(def: unknown): def is FdeAppSpec {
  return Boolean(def && typeof def === 'object' && (def as FdeAppSpec).spec === 'fde-app/v1')
}

export function entityDef(spec: FdeAppSpec, entityName: string): FdeAppEntity | undefined {
  return spec.entities.find((e) => e.name === entityName)
}

export function fieldDef(spec: FdeAppSpec, entityName: string, fieldName: string): FdeAppField | undefined {
  return entityDef(spec, entityName)?.fields.find((f) => f.name === fieldName)
}

/** Table columns: declared view.columns first, then any entity fields the current spec added. */
export function visibleTableColumns(spec: FdeAppSpec, view: FdeAppView): string[] {
  const fields = entityDef(spec, view.entity)?.fields.map((f) => f.name) ?? []
  const listed = view.columns?.filter(Boolean) ?? []
  if (!listed.length) return fields
  const extra = fields.filter((name) => !listed.includes(name))
  return [...listed, ...extra]
}

export function isCurrentRevisionPending(app: FdeAppDetail): boolean {
  const row = app.revisions?.find((r) => r.revision === app.currentRevision)
  if (!row) return app.status === 'draft'
  return row.materialize_status !== 'applied'
}
