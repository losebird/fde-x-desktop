/** Data panel browse sheet. href fields are the patch; views keep separate keys. */

export const DATA_VIEWS = ['overview', 'records', 'operations'] as const

export type DataView = (typeof DATA_VIEWS)[number]

let lastLandView: DataView = 'overview'

export function dataLandView(): DataView {
  return lastLandView
}

export type DataBrowse = {
  view: DataView
  workspaceAppId: string | null
  slug: string
  entity: string
  rowId: string
  kind: string
  traceId: string
  land: number
}

export type DataLandHref = {
  tab?: string
  traceId?: string
  kind?: string
  rowId?: string
  entity?: string
  slug?: string
  workspaceAppId?: string | null
}

export function emptyDataBrowse(): DataBrowse {
  return {
    view: 'overview',
    workspaceAppId: null,
    slug: '',
    entity: '',
    rowId: '',
    kind: '',
    traceId: '',
    land: 0,
  }
}

export function hrefHasDataLand(href: DataLandHref | null | undefined) {
  const row = href && typeof href === 'object' ? href : {}
  return Boolean(
    row.tab
    || row.traceId
    || row.kind
    || row.rowId
    || row.entity
    || row.slug
    || row.workspaceAppId,
  )
}

export function dataViewOfHref(href: DataLandHref | null | undefined, currentView: string = 'overview'): DataView {
  const tab = String(href?.tab || '')
  if ((DATA_VIEWS as readonly string[]).includes(tab)) return tab as DataView
  if (href?.traceId) return 'operations'
  if (href?.kind || href?.rowId || href?.entity) return 'records'
  if (href?.slug || href?.workspaceAppId) return 'overview'
  return (DATA_VIEWS as readonly string[]).includes(currentView) ? currentView as DataView : 'overview'
}

export function applyDataLand(browse: DataBrowse | null | undefined, href: DataLandHref | null | undefined): DataBrowse {
  const current: DataBrowse = browse && typeof browse === 'object' ? { ...emptyDataBrowse(), ...browse } : emptyDataBrowse()
  if (!hrefHasDataLand(href)) return current
  const view = dataViewOfHref(href, current.view)
  lastLandView = view
  const land = Number(current.land || 0) + 1
  const next: DataBrowse = { ...current, view, land }
  if (view === 'operations') {
    next.traceId = String(href?.traceId || '')
    return next
  }
  if (view === 'records') {
    next.kind = String(href?.kind || '')
    next.rowId = String(href?.rowId || '')
    next.entity = String(href?.entity || '')
    if (href?.slug) next.slug = String(href.slug)
    return next
  }
  next.slug = String(href?.slug || '')
  if (Object.prototype.hasOwnProperty.call(href || {}, 'workspaceAppId')) {
    next.workspaceAppId = href?.workspaceAppId || null
  }
  return next
}
