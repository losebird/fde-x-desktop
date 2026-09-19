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
const PLATFORM_USES: FdePlatformUse[] = ['ai', 'files', 'float', 'memory', 'im', 'briefing', 'biz']

export function declaredPlatformUses(spec: FdeAppSpec): FdePlatformUse[] {
  const allowed = new Set(PLATFORM_USES)
  const out: FdePlatformUse[] = []
  for (const item of spec.uses ?? []) {
    if (!allowed.has(item) || out.includes(item)) continue
    out.push(item)
  }
  return out
}

export function specHasUse(spec: FdeAppSpec, use: FdePlatformUse): boolean {
  return declaredPlatformUses(spec).includes(use)
}

export function fieldLooksLikeLink(field: FdeAppField): boolean {
  if (field.type !== 'text' && field.type !== 'longtext' && field.type !== 'ref') return false
  return LINK_FIELD_RE.test(field.name)
}

export function fieldLooksLikeFile(field: FdeAppField): boolean {
  if (!fieldLooksLikeLink(field)) return false
  return /file|path/i.test(field.name)
}

export function fieldLooksLikeBizRef(field: FdeAppField): boolean {
  return field.type === 'ref' && typeof field.ref === 'string' && field.ref.startsWith('biz:')
}

export function bizKindFromRef(ref: string | undefined): string {
  if (!ref || !ref.startsWith('biz:')) return ''
  return ref.slice(4)
}

export function entityHasLinkOrFile(entity: FdeAppEntity | undefined): boolean {
  return Boolean(entity?.fields.some((field) => fieldLooksLikeLink(field)))
}

const GENERATED_CODE_RE = /^[\u4e00-\u9fffA-Za-z]{1,6}-[a-z0-9]{5,}$/i
const GENERATED_TOKEN_RE = /[\u4e00-\u9fffA-Za-z]{1,6}-[a-z0-9]{5,}/gi
const REC_ID_RE = /\brec[a-z0-9]{8,}\b/gi

export function looksLikeGeneratedCode(value: unknown): boolean {
  const text = String(value ?? '').trim()
  if (!text) return true
  if (/^rec[a-z0-9]{8,}$/i.test(text)) return true
  if (GENERATED_CODE_RE.test(text) && text.length <= 24) return true
  return false
}

/** Drop verification-probe tokens from a spec field. Do not hardcode one probe id. */
export function stripGeneratedCodeTokens(value: unknown): string {
  let text = String(value ?? '').trim()
  if (!text) return ''
  text = text.replace(REC_ID_RE, ' ')
  text = text.replace(GENERATED_TOKEN_RE, (token) => (token.length <= 24 ? ' ' : token))
  return text.replace(/\s+/g, ' ').trim()
}

export function workspaceChromeUses(spec: FdeAppSpec): FdePlatformUse[] {
  return declaredPlatformUses(spec).filter((use) => use === 'float')
}

export function pageColumnUses(spec: FdeAppSpec, entityName: string): FdePlatformUse[] {
  const covered = new Set<FdePlatformUse>(['float'])
  const ent = entityDef(spec, entityName)
  if (ent?.fields.some((field) => fieldLooksLikeFile(field))) covered.add('files')
  if (ent?.fields.some((field) => fieldLooksLikeBizRef(field))) covered.add('biz')
  return declaredPlatformUses(spec).filter((use) => !covered.has(use))
}

function readableValue(row: Record<string, unknown>, name: string): string {
  const text = String(row[name] ?? '').trim()
  if (!text || looksLikeGeneratedCode(text)) return ''
  return text
}

/** Human-readable title from spec fields. Skip generated ticket-like values and enum-only labels. */
export function displayTitle(spec: FdeAppSpec, entityName: string, row: Record<string, unknown>): string {
  const ent = entityDef(spec, entityName)
  if (!ent) return ''
  const candidates: string[] = []
  if (ent.titleField) candidates.push(ent.titleField)
  for (const field of ent.fields) {
    if (fieldLooksLikeLink(field)) continue
    if (field.type === 'text' || field.type === 'longtext') candidates.push(field.name)
  }
  for (const field of ent.fields) {
    if (fieldLooksLikeLink(field) || field.type === 'enum') continue
    if (field.type === 'date' || field.type === 'datetime') candidates.push(field.name)
  }
  for (const field of ent.fields) {
    if (field.type === 'number') candidates.push(field.name)
  }
  const seen = new Set<string>()
  for (const name of candidates) {
    if (seen.has(name)) continue
    seen.add(name)
    const text = readableValue(row, name)
    if (text) return text
  }
  const enumField = ent.fields.find((field) => field.type === 'enum' && readableValue(row, field.name))
  return enumField ? readableValue(row, enumField.name) : ''
}

export function displayBlurb(spec: FdeAppSpec, entityName: string, row: Record<string, unknown>, title: string): string {
  const ent = entityDef(spec, entityName)
  if (!ent) return ''
  const longtext = ent.fields.find((field) => field.type === 'longtext')
  if (longtext) {
    const text = stripGeneratedCodeTokens(row[longtext.name])
    if (text && text !== title) return text
  }
  for (const field of ent.fields) {
    if (field.type !== 'text' || field.name === ent.titleField) continue
    if (fieldLooksLikeLink(field)) continue
    const text = stripGeneratedCodeTokens(row[field.name])
    if (text && text !== title) return text
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
    if (/^file:\/\//i.test(raw) || fieldLooksLikeLink(field)) {
      return { href: raw.replace(/^file:\/\//i, ''), kind: /^https?:\/\//i.test(raw) ? 'url' : 'file' }
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

function pageHasCardsForEntity(spec: FdeAppSpec, page: FdeAppPage, entityName: string, extraViews: FdeAppView[] = []): boolean {
  return page.blocks.some((block) => {
    if (block.kind !== 'cards') return false
    return viewById(spec, block.view, extraViews)?.entity === entityName
  })
}

/**
 * Daily work surface: declared pages as-is.
 * Ledger pages stay one screen (overview + compose + chart + feed) unless the
 * entity also has a link/file field — then grouped cards are added, not a fitness skin.
 */
export function workSurfacePages(spec: FdeAppSpec): { pages: FdeAppPage[]; extraViews: FdeAppView[] } {
  const pages = [...(spec.pages ?? [])]
  const extraViews: FdeAppView[] = []
  if (!pages.length) return { pages: [], extraViews: [] }
  for (const entity of spec.entities) {
    if (!entityHasLinkOrFile(entity)) continue
    if (pages.some((page) => pageHasCardsForEntity(spec, page, entity.name, extraViews))) continue
    let cardsView = spec.views.find((view) => view.type === 'cards' && view.entity === entity.name)
    if (!cardsView) {
      cardsView = {
        id: `cards-${entity.name}`,
        type: 'cards',
        entity: entity.name,
        label: entity.label,
        groupBy: entity.fields.find((field) => field.type === 'enum')?.name,
        columns: entity.fields.map((field) => field.name).slice(0, 4),
      }
      extraViews.push(cardsView)
    }
    const compose = spec.views.find((view) => (view.type === 'compose' || view.type === 'form') && view.entity === entity.name)
    const blocks: FdePageBlock[] = [{ kind: 'cards', view: cardsView.id || `cards-${entity.name}` }]
    if (compose?.id) blocks.push({ kind: compose.type === 'form' ? 'form' : 'compose', view: compose.id })
    pages.unshift({
      id: `page-cards-${entity.name}`,
      label: entity.label,
      blocks,
    })
  }
  return { pages, extraViews }
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
      else if (fieldLooksLikeLink(f)) row[f.name] = `https://example.com/${entityName}-${i + 1}`
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
