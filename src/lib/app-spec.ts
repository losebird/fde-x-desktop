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

export type FdeAppViewType = 'table' | 'form' | 'detail' | 'kanban' | 'stat' | 'cards' | 'chart' | 'compose' | 'feed'

export interface FdeAppView {
  id?: string
  type: FdeAppViewType
  entity: string
  label?: string
  columns?: string[]
  filters?: string[]
  sort?: { field: string; dir: 'asc' | 'desc' }
  groupBy?: string
  metric?: { fn: 'count' | 'sum' | 'avg'; field?: string }
}

export type FdePlatformUse = 'ai' | 'files' | 'float' | 'memory' | 'im' | 'briefing' | 'biz'

export type FdePageBlock =
  | { kind: 'stats'; views: string[] }
  | { kind: 'compose' | 'chart' | 'feed' | 'cards' | 'table' | 'kanban' | 'form'; view: string }

export type FdeAppPage = {
  id: string
  label?: string
  blocks: FdePageBlock[]
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
  uses?: FdePlatformUse[]
  pages?: FdeAppPage[]
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

export function hasProductPages(spec: FdeAppSpec): boolean {
  return Array.isArray(spec.pages) && spec.pages.length > 0
}

export function viewById(spec: FdeAppSpec, id: string | undefined): FdeAppView | undefined {
  if (!id) return undefined
  return spec.views.find((view) => view.id === id)
}

export function mockRowsForEntity(spec: FdeAppSpec, entityName: string): Record<string, unknown>[] {
  const ent = entityDef(spec, entityName)
  if (!ent) return []
  const statusField = ent.fields.find((f) => f.type === 'enum')
  const statuses = statusField?.options ?? ['示例']
  return [0, 1, 2].map((i) => {
    const row: Record<string, unknown> = { id: `preview_${entityName}_${i}` }
    for (const f of ent.fields) {
      if (f.type === 'enum') row[f.name] = statuses[i % statuses.length]
      else if (f.type === 'date') row[f.name] = '2026-09-01'
      else if (f.type === 'number') row[f.name] = (i + 1) * 3
      else if (f.type === 'bool') row[f.name] = i % 2 === 0
      else row[f.name] = `${f.label || f.name} ${i + 1}`
    }
    return row
  })
}

export function isCurrentRevisionPending(app: FdeAppDetail): boolean {
  const row = app.revisions?.find((r) => r.revision === app.currentRevision)
  if (!row) return app.status === 'draft'
  return row.materialize_status !== 'applied'
}
