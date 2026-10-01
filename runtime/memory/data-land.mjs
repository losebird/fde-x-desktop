/** Data panel browse sheet. href fields are the patch; views keep separate keys. */

export const DATA_VIEWS = ['overview', 'records', 'operations']

let lastLandView = 'overview'

export function dataLandView() {
  return lastLandView
}

export function emptyDataBrowse() {
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

export function hrefHasDataLand(href) {
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

export function dataViewOfHref(href, currentView = 'overview') {
  const tab = String(href?.tab || '')
  if (DATA_VIEWS.includes(tab)) return tab
  if (href?.traceId) return 'operations'
  if (href?.kind || href?.rowId || href?.entity) return 'records'
  if (href?.slug || href?.workspaceAppId) return 'overview'
  return DATA_VIEWS.includes(currentView) ? currentView : 'overview'
}

export function applyDataLand(browse, href) {
  const current = browse && typeof browse === 'object' ? { ...emptyDataBrowse(), ...browse } : emptyDataBrowse()
  if (!hrefHasDataLand(href)) return current
  const view = dataViewOfHref(href, current.view)
  lastLandView = view
  const land = Number(current.land || 0) + 1
  const next = { ...current, view, land }
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
    next.workspaceAppId = href.workspaceAppId || null
  }
  return next
}
