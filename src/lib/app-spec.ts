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

const LINK_FIELD_RE = /url|link|href|src|media|file|path|video/i

export function looksLikeGeneratedCode(value: unknown): boolean {
  const text = String(value ?? '').trim()
  if (!text) return true
  if (/^rec[a-z0-9]{8,}$/i.test(text)) return true
  if (/[\u4e00-\u9fffA-Za-z]{1,6}-[a-z0-9]{5,}/i.test(text) && text.length <= 24) return true
  return false
}

/** Human-readable title from spec fields. Skip generated ticket-like values. */
export function displayTitle(spec: FdeAppSpec, entityName: string, row: Record<string, unknown>): string {
  const ent = entityDef(spec, entityName)
  if (!ent) return ''
  const candidates: string[] = []
  if (ent.titleField) candidates.push(ent.titleField)
  for (const field of ent.fields) {
    if (field.type === 'text' || field.type === 'longtext') candidates.push(field.name)
  }
  for (const field of ent.fields) {
    if (field.type === 'enum') candidates.push(field.name)
  }
  const seen = new Set<string>()
  for (const name of candidates) {
    if (seen.has(name)) continue
    seen.add(name)
    const text = String(row[name] ?? '').trim()
    if (!text || looksLikeGeneratedCode(text)) continue
    return text
  }
  const enumField = ent.fields.find((field) => field.type === 'enum' && row[field.name] != null && String(row[field.name]).trim())
  const numField = ent.fields.find((field) => field.type === 'number' && row[field.name] != null && String(row[field.name]).trim() !== '')
  if (enumField && numField) return `${row[enumField.name]} · ${row[numField.name]}`
  if (enumField) return String(row[enumField.name])
  return ''
}

export function displayBlurb(spec: FdeAppSpec, entityName: string, row: Record<string, unknown>, title: string): string {
  const ent = entityDef(spec, entityName)
  if (!ent) return ''
  const longtext = ent.fields.find((field) => field.type === 'longtext')
  if (longtext) {
    const text = String(row[longtext.name] ?? '').trim()
    if (text && text !== title && !looksLikeGeneratedCode(text)) return text
  }
  for (const field of ent.fields) {
    if (field.type !== 'text' || field.name === ent.titleField) continue
    if (LINK_FIELD_RE.test(field.name)) continue
    const text = String(row[field.name] ?? '').trim()
    if (text && text !== title && !looksLikeGeneratedCode(text)) return text
  }
  return ''
}

export function cardAction(spec: FdeAppSpec, entityName: string, row: Record<string, unknown>): { href: string; kind: 'url' | 'file' } | null {
  const ent = entityDef(spec, entityName)
  if (!ent) return null
  for (const field of ent.fields) {
    const raw = String(row[field.name] ?? '').trim()
    if (!raw) continue
    if (/^https?:\/\//i.test(raw)) return { href: raw, kind: 'url' }
    if ((field.type === 'text' || field.type === 'longtext' || field.type === 'ref') && LINK_FIELD_RE.test(field.name)) {
      return { href: raw, kind: /^https?:\/\//i.test(raw) ? 'url' : 'file' }
    }
  }
  return null
}

export function cardGroupField(spec: FdeAppSpec, view: FdeAppView): string {
  if (view.groupBy) return view.groupBy
  return entityDef(spec, view.entity)?.fields.find((field) => field.type === 'enum')?.name || ''
}

export function pageLooksLikeLedger(page: FdeAppPage): boolean {
  const kinds = page.blocks.map((block) => block.kind)
  return kinds.includes('stats') && (kinds.includes('compose') || kinds.includes('form')) && kinds.includes('feed')
}

/** Cards view from spec. Do not invent a cards tab for a ledger page. */
export function cardsViewForSpec(spec: FdeAppSpec): FdeAppView | undefined {
  return spec.views.find((view) => view.type === 'cards')
}

/**
 * Daily work surface: declared pages as-is.
 * Ledger pages stay one screen (overview + compose + chart + feed).
 * Cards-only extra tabs are not injected — that hid the product page behind serial cards.
 */
export function workSurfacePages(spec: FdeAppSpec): { pages: FdeAppPage[]; extraViews: FdeAppView[] } {
  const pages = spec.pages ?? []
  if (!pages.length) return { pages: [], extraViews: [] }
  return { pages, extraViews: [] }
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
