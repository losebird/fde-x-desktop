const PLATFORM_USES = ['ai', 'files', 'float', 'memory', 'im', 'briefing', 'biz', 'plan']

export function allowedPlatformUses() {
  return PLATFORM_USES.slice()
}

/** @returns {Record<string, unknown>} */
export function defaultSurface() {
  return {
    nav: 'tabs',
    density: 'cozy',
    cards: { minWidth: 'regular', hero: 'cover' },
    ledger: { composeChart: 'pair', feed: 'rows' },
    primary: { where: 'card', kind: 'play' },
  }
}

/**
 * @param {Record<string, unknown>} spec
 * @returns {{ nav: string, defaultPage?: string, density: string, cards: Record<string, unknown>, ledger: Record<string, unknown>, primary: Record<string, unknown> }}
 */
export function resolveSurface(spec) {
  const def = defaultSurface()
  const declared = spec?.surface
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    return {
      nav: def.nav,
      density: def.density,
      cards: { ...def.cards },
      ledger: { ...def.ledger },
      primary: { ...def.primary },
    }
  }
  const cardsIn = declared.cards && typeof declared.cards === 'object' && !Array.isArray(declared.cards)
    ? declared.cards
    : {}
  const ledgerIn = declared.ledger && typeof declared.ledger === 'object' && !Array.isArray(declared.ledger)
    ? declared.ledger
    : {}
  const primaryIn = declared.primary && typeof declared.primary === 'object' && !Array.isArray(declared.primary)
    ? declared.primary
    : {}
  const cards = { ...def.cards, ...cardsIn }
  const ledger = { ...def.ledger, ...ledgerIn }
  const primary = { ...def.primary, ...primaryIn }
  const out = {
    nav: declared.nav ?? def.nav,
    density: declared.density ?? def.density,
    cards,
    ledger,
    primary,
  }
  if (declared.defaultPage !== undefined) {
    out.defaultPage = declared.defaultPage
  }
  return out
}

function surfaceIsNonemptyObject(surface) {
  return surface && typeof surface === 'object' && !Array.isArray(surface) && Object.keys(surface).length > 0
}

function fillSurfaceOnSpec(next) {
  const declared = next.surface
  if (declared === undefined) {
    next.surface = clone(defaultSurface())
    return
  }
  if (!surfaceIsNonemptyObject(declared)) {
    next.surface = clone(defaultSurface())
    return
  }
  const merged = resolveSurface(next)
  const out = { ...declared }
  if (out.nav === undefined) out.nav = merged.nav
  if (out.density === undefined) out.density = merged.density
  out.cards = { ...(merged.cards), ...(declared.cards && typeof declared.cards === 'object' ? declared.cards : {}) }
  out.ledger = { ...(merged.ledger), ...(declared.ledger && typeof declared.ledger === 'object' ? declared.ledger : {}) }
  out.primary = { ...(merged.primary), ...(declared.primary && typeof declared.primary === 'object' ? declared.primary : {}) }
  next.surface = out
}

// keep in sync with src/lib/app-spec.ts cardGridTemplate
/**
 * @param {{ density?: string, cards?: { minWidth?: string, columns?: number } }} surface
 * @param {number} count
 */
export function cardGridTemplate(surface, count) {
  const columns = surface?.cards?.columns
  if (typeof columns === 'number' && Number.isInteger(columns) && columns >= 1 && columns <= 6) {
    return `repeat(${columns}, minmax(0, 1fr))`
  }
  const density = surface?.density ?? 'cozy'
  const minWidth = surface?.cards?.minWidth ?? 'regular'
  let rem = '13.5rem'
  if (density === 'packed' || minWidth === 'narrow') rem = '10rem'
  else if (density === 'air' || minWidth === 'wide') rem = '18rem'
  if (count >= 2) return `repeat(auto-fit, minmax(${rem}, 1fr))`
  return `repeat(auto-fill, minmax(${rem}, ${rem}))`
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function entityFields(entity) {
  return Array.isArray(entity?.fields) ? entity.fields : []
}

function numberFields(entity) {
  return entityFields(entity).filter((field) => field.type === 'number')
}

function enumFields(entity) {
  return entityFields(entity).filter((field) => field.type === 'enum')
}

const LINK_FIELD_RE = /url|link|href|src|media|file|path|video/i

function isCatalogEntity(entity) {
  const fields = entityFields(entity)
  const hasNumber = fields.some((field) => field.type === 'number')
  const hasDate = fields.some((field) => field.type === 'date' || field.type === 'datetime')
  const hasLong = fields.some((field) => field.type === 'longtext')
  if (hasNumber || hasDate) return false
  return Boolean(entity.titleField || hasLong)
}

function isResourceEntity(entity) {
  if (isCatalogEntity(entity)) return true
  return entityFields(entity).some((field) => {
    if (field.type !== 'text' && field.type !== 'longtext' && field.type !== 'ref') return false
    return LINK_FIELD_RE.test(String(field.name || ''))
  })
}

function findView(spec, entityName, types) {
  return (spec.views || []).find((view) => view && types.includes(view.type) && view.entity === entityName)
}

function ensureId(view, fallback) {
  if (view.id) return view.id
  view.id = fallback
  return view.id
}

function ensureView(spec, view) {
  if (!Array.isArray(spec.views)) spec.views = []
  const byId = spec.views.find((row) => row && row.id === view.id)
  if (byId) return byId.id
  const same = spec.views.find((row) => row && row.entity === view.entity && row.type === view.type)
  if (same) {
    if (!same.id) same.id = view.id
    return same.id
  }
  spec.views.push(view)
  return view.id
}

function inferUses(spec) {
  const uses = new Set()
  const actions = Array.isArray(spec.actions) ? spec.actions : []
  if (actions.some((action) => action?.kind === 'agent')) uses.add('ai')
  if (actions.some((action) => action?.kind === 'biz')) uses.add('biz')
  const entities = Array.isArray(spec.entities) ? spec.entities : []
  for (const entity of entities) {
    for (const field of entityFields(entity)) {
      if (field?.type === 'ref' && String(field.ref || '').startsWith('biz:')) uses.add('biz')
      if (LINK_FIELD_RE.test(String(field.name || '')) && /file|path/i.test(String(field.name || ''))) uses.add('files')
    }
  }
  if (spec.memory && spec.memory.onWrite === 'draft-card') uses.add('memory')
  return [...uses]
}

function pageHasCardsForEntity(spec, page, entityName) {
  return (page?.blocks || []).some((block) => {
    if (block?.kind !== 'cards') return false
    const view = (spec.views || []).find((row) => row && row.id === block.view)
    return view?.entity === entityName
  })
}

function buildEntityPage(spec, entity) {
  const name = String(entity.name)
  const label = String(entity.label || name)
  const nums = numberFields(entity)
  const enums = enumFields(entity)
  const resource = isResourceEntity(entity)
  const columns = entityFields(entity).map((field) => field.name)

  const composeSource = findView(spec, name, ['compose', 'form'])
  const composeId = composeSource
    ? ensureId(composeSource, `compose-${name}`)
    : ensureView(spec, {
      id: `compose-${name}`,
      type: 'compose',
      entity: name,
      label: `记下${label}`,
    })

  if (resource) {
    const cardsView = {
      id: `cards-${name}`,
      type: 'cards',
      entity: name,
      label,
      columns: columns.slice(0, 4),
    }
    if (enums[0]) cardsView.groupBy = enums[0].name
    const cardsId = ensureView(spec, cardsView)
    return {
      id: `page-${name}`,
      label,
      blocks: [
        { kind: 'cards', view: cardsId },
        { kind: 'compose', view: composeId },
      ],
    }
  }

  const statViews = (spec.views || []).filter((view) => view?.type === 'stat' && view.entity === name)
  const stats = []
  if (statViews.length) {
    for (const view of statViews) {
      if (!view.id) view.id = `stat-${name}-${stats.length + 1}`
      stats.push(view.id)
    }
  } else {
    stats.push(ensureView(spec, {
      id: `stat-${name}-count`,
      type: 'stat',
      entity: name,
      label: `${label}数量`,
      metric: { fn: 'count' },
    }))
    if (nums[0]) {
      stats.push(ensureView(spec, {
        id: `stat-${name}-${nums[0].name}`,
        type: 'stat',
        entity: name,
        label: nums[0].label || nums[0].name,
        metric: { fn: 'sum', field: nums[0].name },
      }))
    }
  }

  const blocks = [
    { kind: 'stats', views: stats.slice(0, 4) },
    { kind: 'compose', view: composeId },
  ]

  if (enums[0]) {
    const chartId = ensureView(spec, {
      id: `chart-${name}`,
      type: 'chart',
      entity: name,
      label: enums[0].label || '构成',
      groupBy: enums[0].name,
      metric: nums[0] ? { fn: 'sum', field: nums[0].name } : { fn: 'count' },
    })
    blocks.push({ kind: 'chart', view: chartId })
  }

  const feedSource = findView(spec, name, ['feed', 'table'])
  const dateField = entityFields(entity).find((field) => field.type === 'date' || field.type === 'datetime')
  const feedId = feedSource
    ? ensureId(feedSource, `feed-${name}`)
    : ensureView(spec, {
      id: `feed-${name}`,
      type: 'feed',
      entity: name,
      label: `${label}流水`,
      columns,
      sort: dateField ? { field: dateField.name, dir: 'desc' } : undefined,
    })
  blocks.push({ kind: 'feed', view: feedId })

  return {
    id: `page-${name}`,
    label,
    blocks,
  }
}

/**
 * New drafts get product pages from field shape: ledger = overview + compose + chart + feed;
 * resource/catalog = grouped cards + compose. Existing pages/uses are kept. No category names.
 * @param {Record<string, unknown>} spec
 * @param {{ fillPages?: boolean }} [options]
 */
export function withProductLayout(spec, { fillPages = true } = {}) {
  if (!spec || typeof spec !== 'object') return spec
  const next = clone(spec)
  fillSurfaceOnSpec(next)
  const usesAlreadySet = Array.isArray(next.uses) && next.uses.length > 0
  if (fillPages && !usesAlreadySet) {
    next.uses = inferUses(next)
  } else if (Array.isArray(next.uses)) {
    next.uses = [...new Set(next.uses.map(String).filter((item) => PLATFORM_USES.includes(item)))]
  }
  if (next.uses?.includes('memory')) {
    const memory = next.memory && typeof next.memory === 'object' ? next.memory : {}
    next.memory = { ...memory, onWrite: 'draft-card' }
  }
  if (!fillPages) {
    return next
  }
  const entities = Array.isArray(next.entities) ? next.entities.filter((entity) => entity && typeof entity.name === 'string') : []
  if (Array.isArray(next.pages) && next.pages.length > 0) {
    for (const entity of entities) {
      if (!isResourceEntity(entity)) continue
      if (next.pages.some((page) => pageHasCardsForEntity(next, page, entity.name))) continue
      next.pages.unshift(buildEntityPage(next, entity))
    }
    return next
  }
  next.pages = entities.map((entity) => buildEntityPage(next, entity))
  return next
}
