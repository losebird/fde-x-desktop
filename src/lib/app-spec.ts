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

export function viewById(spec: FdeAppSpec, id: string | undefined, extraViews: FdeAppView[] = []): FdeAppView | undefined {
  if (!id) return undefined
  return spec.views.find((view) => view.id === id) || extraViews.find((view) => view.id === id)
}

/** Cards view from spec, or a presentational stand-in from the first list/compose entity. No category names. */
export function cardsViewForSpec(spec: FdeAppSpec): FdeAppView | undefined {
  const existing = spec.views.find((view) => view.type === 'cards')
  if (existing) return existing
  const source = spec.views.find((view) => view.type === 'feed' || view.type === 'table' || view.type === 'compose' || view.type === 'form')
  const entityName = source?.entity || spec.entities[0]?.name
  if (!entityName) return undefined
  const ent = entityDef(spec, entityName)
  const columns = (source?.columns?.length ? source.columns : ent?.fields.map((field) => field.name) ?? []).slice(0, 4)
  return {
    id: `cards-${entityName}`,
    type: 'cards',
    entity: entityName,
    label: ent?.label || '卡片',
    columns,
  }
}

/**
 * Daily work surface: keep declared pages, but never stay on a single dashboard.
 * Extra cards page is presentational when the spec omitted it (not written back).
 */
export function workSurfacePages(spec: FdeAppSpec): { pages: FdeAppPage[]; extraViews: FdeAppView[] } {
  const pages = spec.pages ?? []
  if (!pages.length) return { pages: [], extraViews: [] }
  const extraViews: FdeAppView[] = []
  const cardsView = cardsViewForSpec(spec)
  if (cardsView && !spec.views.some((view) => view.id === cardsView.id)) extraViews.push(cardsView)
  const hasCards = pages.some((page) => page.blocks.some((block) => block.kind === 'cards'))

  const cardsPage = (taken: Set<string>): FdeAppPage | null => {
    if (!cardsView?.id) return null
    const preferred = cardsView.label || ''
    const label = preferred && !taken.has(preferred) ? preferred : '卡片'
    return {
      id: `${pages[0].id}-cards`,
      label,
      blocks: [{ kind: 'cards', view: cardsView.id }],
    }
  }

  if (pages.length > 1 && hasCards) return { pages, extraViews }

  if (pages.length > 1) {
    const extra = cardsPage(new Set(pages.map((page) => page.label || page.id)))
    return { pages: extra ? [...pages, extra] : pages, extraViews }
  }

  const page = pages[0]
  const dashBlocks = page.blocks.filter((block) => block.kind !== 'cards')
  const ownCards = page.blocks.filter((block) => block.kind === 'cards')
  const dash: FdeAppPage = {
    id: page.id,
    label: page.label || spec.name,
    blocks: dashBlocks.length ? dashBlocks : page.blocks,
  }
  const taken = new Set([dash.label || dash.id])
  const extra = ownCards.length
    ? {
        id: `${page.id}-cards`,
        label: (cardsView?.label && !taken.has(cardsView.label) ? cardsView.label : '卡片'),
        blocks: ownCards,
      }
    : cardsPage(taken)
  return { pages: extra ? [dash, extra] : pages, extraViews }
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
