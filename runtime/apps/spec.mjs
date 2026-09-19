const FIELD_TYPES = new Set(['text', 'longtext', 'number', 'bool', 'date', 'datetime', 'enum', 'ref', 'json'])
const VIEW_TYPES = new Set(['table', 'form', 'detail', 'kanban', 'stat', 'cards', 'chart', 'compose', 'feed'])
const ACTION_KINDS = new Set(['set', 'biz', 'agent'])
const PLATFORM_USES = new Set(['ai', 'files', 'float', 'memory', 'im', 'briefing', 'biz', 'plan'])
const BLOCK_KINDS = new Set(['stats', 'compose', 'chart', 'feed', 'cards', 'table', 'kanban', 'form'])
const RESERVED_FIELDS = new Set(['id', 'created_at', 'updated_at', 'workspace_cwd', 'deleted_at'])
const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/
const NAME_RE = /^[a-z][a-z0-9_]{0,30}$/
const ACTION_NAME_RE = /^[a-z][a-z0-9-]{0,30}$/
const REF_RE = /^(entity:[a-z][a-z0-9_]*|biz:[^\s]{1,40})$/

/**
 * @typedef {{ path: string, message: string }} SpecError
 */

/**
 * @param {unknown} value
 * @param {string} path
 * @param {SpecError[]} errors
 */
function requireObject(value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({ path, message: '必须是对象' })
    return null
  }
  return value
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string[]} allowed
 * @param {string} path
 * @param {SpecError[]} errors
 */
function rejectExtraKeys(obj, allowed, path, errors) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push({ path: `${path}.${key}`, message: '不允许的字段' })
    }
  }
}

const SURFACE_NAV = new Set(['tabs', 'stack'])
const SURFACE_DENSITY = new Set(['air', 'cozy', 'packed'])
const SURFACE_MIN_WIDTH = new Set(['narrow', 'regular', 'wide'])
const SURFACE_HERO = new Set(['cover', 'below'])
const SURFACE_COMPOSE_CHART = new Set(['pair', 'stack'])
const SURFACE_FEED = new Set(['rows', 'full'])
const SURFACE_PRIMARY_WHERE = new Set(['card', 'compose', 'chrome'])
const SURFACE_PRIMARY_KIND = new Set(['play', 'open', 'compose'])

/**
 * @param {unknown} value
 * @param {string} path
 * @param {SpecError[]} errors
 * @param {unknown} pages
 */
function validateSurface(value, path, errors, pages) {
  const surface = requireObject(value, path, errors)
  if (!surface) return
  rejectExtraKeys(surface, ['nav', 'defaultPage', 'density', 'cards', 'ledger', 'primary'], path, errors)
  if (surface.nav !== undefined && !SURFACE_NAV.has(String(surface.nav))) {
    errors.push({ path: `${path}.nav`, message: 'nav 无效' })
  }
  if (surface.density !== undefined && !SURFACE_DENSITY.has(String(surface.density))) {
    errors.push({ path: `${path}.density`, message: 'density 无效' })
  }
  if (surface.defaultPage !== undefined) {
    if (typeof surface.defaultPage !== 'string' || !surface.defaultPage) {
      errors.push({ path: `${path}.defaultPage`, message: 'defaultPage 必须是非空字符串' })
    } else if (Array.isArray(pages) && pages.length > 0) {
      const ids = pages.filter((p) => p && typeof p === 'object' && typeof p.id === 'string').map((p) => p.id)
      if (!ids.includes(surface.defaultPage)) {
        errors.push({ path: `${path}.defaultPage`, message: 'defaultPage 必须匹配已有 page.id' })
      }
    }
  }
  if (surface.cards !== undefined) {
    const cards = requireObject(surface.cards, `${path}.cards`, errors)
    if (cards) {
      rejectExtraKeys(cards, ['minWidth', 'hero', 'columns'], `${path}.cards`, errors)
      if (cards.minWidth !== undefined && !SURFACE_MIN_WIDTH.has(String(cards.minWidth))) {
        errors.push({ path: `${path}.cards.minWidth`, message: 'minWidth 无效' })
      }
      if (cards.hero !== undefined && !SURFACE_HERO.has(String(cards.hero))) {
        errors.push({ path: `${path}.cards.hero`, message: 'hero 无效' })
      }
      if (cards.columns !== undefined) {
        const col = cards.columns
        if (typeof col !== 'number' || !Number.isInteger(col) || col < 1 || col > 6) {
          errors.push({ path: `${path}.cards.columns`, message: 'columns 必须是 1–6 的整数' })
        }
      }
    }
  }
  if (surface.ledger !== undefined) {
    const ledger = requireObject(surface.ledger, `${path}.ledger`, errors)
    if (ledger) {
      rejectExtraKeys(ledger, ['composeChart', 'feed'], `${path}.ledger`, errors)
      if (ledger.composeChart !== undefined && !SURFACE_COMPOSE_CHART.has(String(ledger.composeChart))) {
        errors.push({ path: `${path}.ledger.composeChart`, message: 'composeChart 无效' })
      }
      if (ledger.feed !== undefined && !SURFACE_FEED.has(String(ledger.feed))) {
        errors.push({ path: `${path}.ledger.feed`, message: 'feed 无效' })
      }
    }
  }
  if (surface.primary !== undefined) {
    const primary = requireObject(surface.primary, `${path}.primary`, errors)
    if (primary) {
      rejectExtraKeys(primary, ['where', 'kind'], `${path}.primary`, errors)
      if (primary.where !== undefined && !SURFACE_PRIMARY_WHERE.has(String(primary.where))) {
        errors.push({ path: `${path}.primary.where`, message: 'where 无效' })
      }
      if (primary.kind !== undefined && !SURFACE_PRIMARY_KIND.has(String(primary.kind))) {
        errors.push({ path: `${path}.primary.kind`, message: 'kind 无效' })
      }
    }
  }
}

/**
 * @param {unknown} spec
 * @param {{ slugTaken?: boolean }} [ctx]
 * @returns {{ ok: boolean, errors: SpecError[], spec?: Record<string, unknown> }}
 */
export function validateAppSpec(spec, ctx = {}) {
  const errors = []
  const root = requireObject(spec, '', errors)
  if (!root) return { ok: false, errors }

  rejectExtraKeys(root, [
    'spec', 'slug', 'name', 'description', 'entities', 'views', 'actions', 'permissions', 'memory', 'uses', 'pages', 'surface', '_workspaceCwd',
  ], '', errors)

  if (root.spec !== 'fde-app/v1') {
    errors.push({ path: 'spec', message: '必须是 fde-app/v1' })
  }
  if (typeof root.slug !== 'string' || !SLUG_RE.test(root.slug)) {
    errors.push({ path: 'slug', message: 'slug 格式无效' })
  }
  if (typeof root.name !== 'string' || root.name.length < 1 || root.name.length > 40) {
    errors.push({ path: 'name', message: 'name 长度须在 1–40' })
  }
  if (root.description !== undefined) {
    if (typeof root.description !== 'string' || root.description.length > 400) {
      errors.push({ path: 'description', message: 'description 最长 400' })
    }
  }
  if (!Array.isArray(root.entities) || root.entities.length < 1 || root.entities.length > 12) {
    errors.push({ path: 'entities', message: 'entities 数量须在 1–12' })
    return { ok: false, errors }
  }
  if (!Array.isArray(root.views) || root.views.length < 1 || root.views.length > 20) {
    errors.push({ path: 'views', message: 'views 数量须在 1–20' })
    return { ok: false, errors }
  }
  if (root.actions !== undefined) {
    if (!Array.isArray(root.actions) || root.actions.length > 20) {
      errors.push({ path: 'actions', message: 'actions 最多 20 条' })
    }
  }
  if (root.uses !== undefined) {
    if (!Array.isArray(root.uses) || root.uses.length > 8) {
      errors.push({ path: 'uses', message: 'uses 最多 8 项' })
    } else {
      for (let ui = 0; ui < root.uses.length; ui++) {
        if (!PLATFORM_USES.has(String(root.uses[ui]))) {
          errors.push({ path: `uses[${ui}]`, message: 'uses 只能是 ai/files/float/memory/im/briefing/biz/plan' })
        }
      }
    }
  }
  if (root.pages !== undefined) {
    if (!Array.isArray(root.pages) || root.pages.length > 12) {
      errors.push({ path: 'pages', message: 'pages 最多 12 栏' })
    }
  }
  if (root.surface !== undefined) {
    validateSurface(root.surface, 'surface', errors, root.pages)
  }

  /** @type {Map<string, { fields: Map<string, Record<string, unknown>> }>} */
  const entities = new Map()

  for (let i = 0; i < root.entities.length; i++) {
    const entPath = `entities[${i}]`
    const ent = requireObject(root.entities[i], entPath, errors)
    if (!ent) continue
    rejectExtraKeys(ent, ['name', 'label', 'titleField', 'fields'], entPath, errors)
    if (typeof ent.name !== 'string' || !NAME_RE.test(ent.name)) {
      errors.push({ path: `${entPath}.name`, message: '实体 name 格式无效' })
      continue
    }
    if (entities.has(ent.name)) {
      errors.push({ path: `${entPath}.name`, message: '实体 name 重复' })
      continue
    }
    if (typeof ent.label !== 'string' || ent.label.length > 20) {
      errors.push({ path: `${entPath}.label`, message: 'label 最长 20' })
    }
    if (!Array.isArray(ent.fields) || ent.fields.length < 1 || ent.fields.length > 40) {
      errors.push({ path: `${entPath}.fields`, message: 'fields 数量须在 1–40' })
      continue
    }
    const fields = new Map()
    for (let fi = 0; fi < ent.fields.length; fi++) {
      const fPath = `${entPath}.fields[${fi}]`
      const field = requireObject(ent.fields[fi], fPath, errors)
      if (!field) continue
      rejectExtraKeys(field, ['name', 'label', 'type', 'required', 'options', 'ref', 'default', 'unique'], fPath, errors)
      if (typeof field.name !== 'string' || !NAME_RE.test(field.name)) {
        errors.push({ path: `${fPath}.name`, message: '字段 name 格式无效' })
        continue
      }
      if (RESERVED_FIELDS.has(field.name)) {
        errors.push({ path: `${fPath}.name`, message: '保留字段名不可用' })
      }
      if (fields.has(field.name)) {
        errors.push({ path: `${fPath}.name`, message: '字段 name 重复' })
      }
      if (!FIELD_TYPES.has(String(field.type))) {
        errors.push({ path: `${fPath}.type`, message: '字段 type 无效' })
      }
      if (field.label !== undefined && (typeof field.label !== 'string' || field.label.length > 20)) {
        errors.push({ path: `${fPath}.label`, message: 'label 最长 20' })
      }
      if (field.type === 'enum') {
        if (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 30) {
          errors.push({ path: `${fPath}.options`, message: 'enum 需要 1–30 个选项' })
        }
      }
      if (field.type === 'ref') {
        if (typeof field.ref !== 'string' || !REF_RE.test(field.ref)) {
          errors.push({ path: `${fPath}.ref`, message: 'ref 格式无效' })
        } else if (String(field.ref).startsWith('entity:')) {
          const target = String(field.ref).slice('entity:'.length)
          if (!entities.has(target) && !root.entities.some((e) => e && typeof e === 'object' && e.name === target)) {
            errors.push({ path: `${fPath}.ref`, message: `引用的实体 ${target} 不存在` })
          }
        }
      }
      fields.set(field.name, field)
    }
    if (ent.titleField !== undefined) {
      if (typeof ent.titleField !== 'string' || !fields.has(ent.titleField)) {
        errors.push({ path: `${entPath}.titleField`, message: 'titleField 必须引用本实体字段' })
      }
    }
    entities.set(ent.name, { fields })
  }

  // second pass entity refs
  for (let i = 0; i < root.entities.length; i++) {
    const ent = root.entities[i]
    if (!ent || typeof ent !== 'object') continue
    const fields = entities.get(ent.name)?.fields
    if (!fields) continue
    for (const field of fields.values()) {
      if (field.type === 'ref' && typeof field.ref === 'string' && field.ref.startsWith('entity:')) {
        const target = field.ref.slice('entity:'.length)
        if (!entities.has(target)) {
          errors.push({ path: `entities[${i}].fields`, message: `entity:${target} 不存在` })
        }
      }
    }
  }

  const resolveField = (entityName, fieldName, path) => {
    const ent = entities.get(entityName)
    if (!ent) {
      errors.push({ path, message: `未知实体 ${entityName}` })
      return null
    }
    if (!ent.fields.has(fieldName)) {
      errors.push({ path, message: `未知字段 ${entityName}.${fieldName}` })
      return null
    }
    return ent.fields.get(fieldName)
  }

  for (let vi = 0; vi < root.views.length; vi++) {
    const vPath = `views[${vi}]`
    const view = requireObject(root.views[vi], vPath, errors)
    if (!view) continue
    rejectExtraKeys(view, ['id', 'type', 'entity', 'label', 'columns', 'filters', 'sort', 'groupBy', 'metric'], vPath, errors)
    if (!VIEW_TYPES.has(String(view.type))) {
      errors.push({ path: `${vPath}.type`, message: '视图 type 无效' })
    }
    if (typeof view.entity !== 'string' || !entities.has(view.entity)) {
      errors.push({ path: `${vPath}.entity`, message: 'entity 必须存在' })
      continue
    }
    if (view.columns !== undefined) {
      if (!Array.isArray(view.columns)) {
        errors.push({ path: `${vPath}.columns`, message: 'columns 必须是数组' })
      } else {
        for (const col of view.columns) {
          resolveField(view.entity, String(col), `${vPath}.columns`)
        }
      }
    }
    if (view.filters !== undefined && Array.isArray(view.filters)) {
      for (const f of view.filters) resolveField(view.entity, String(f), `${vPath}.filters`)
    }
    if (view.groupBy !== undefined) {
      const gf = resolveField(view.entity, String(view.groupBy), `${vPath}.groupBy`)
      if (gf && gf.type !== 'enum') {
        errors.push({ path: `${vPath}.groupBy`, message: 'groupBy 必须是 enum 字段' })
      }
    }
    if ((view.type === 'chart') && view.groupBy === undefined) {
      errors.push({ path: `${vPath}.groupBy`, message: 'chart 需要 groupBy' })
    }
    if (view.sort !== undefined) {
      const sort = requireObject(view.sort, `${vPath}.sort`, errors)
      if (sort?.field) resolveField(view.entity, String(sort.field), `${vPath}.sort.field`)
      if (sort?.dir !== undefined && sort.dir !== 'asc' && sort.dir !== 'desc') {
        errors.push({ path: `${vPath}.sort.dir`, message: 'sort.dir 必须是 asc 或 desc' })
      }
    }
    if (view.metric !== undefined) {
      const metric = requireObject(view.metric, `${vPath}.metric`, errors)
      if (metric?.field) resolveField(view.entity, String(metric.field), `${vPath}.metric.field`)
      if (metric?.fn !== undefined && !['count', 'sum', 'avg'].includes(String(metric.fn))) {
        errors.push({ path: `${vPath}.metric.fn`, message: 'metric.fn 无效' })
      }
    }
  }

  const viewById = new Map()
  for (const view of root.views) {
    if (view && typeof view === 'object' && typeof view.id === 'string' && view.id) {
      viewById.set(view.id, view)
    }
  }

  if (Array.isArray(root.pages)) {
    for (let pi = 0; pi < root.pages.length; pi++) {
      const pPath = `pages[${pi}]`
      const page = requireObject(root.pages[pi], pPath, errors)
      if (!page) continue
      rejectExtraKeys(page, ['id', 'label', 'blocks'], pPath, errors)
      if (typeof page.id !== 'string' || !page.id) {
        errors.push({ path: `${pPath}.id`, message: 'page.id 必填' })
      }
      if (page.label !== undefined && (typeof page.label !== 'string' || page.label.length > 20)) {
        errors.push({ path: `${pPath}.label`, message: 'label 最长 20' })
      }
      if (!Array.isArray(page.blocks) || page.blocks.length < 1 || page.blocks.length > 12) {
        errors.push({ path: `${pPath}.blocks`, message: 'blocks 数量须在 1–12' })
        continue
      }
      for (let bi = 0; bi < page.blocks.length; bi++) {
        const bPath = `${pPath}.blocks[${bi}]`
        const block = requireObject(page.blocks[bi], bPath, errors)
        if (!block) continue
        rejectExtraKeys(block, ['kind', 'view', 'views'], bPath, errors)
        if (!BLOCK_KINDS.has(String(block.kind))) {
          errors.push({ path: `${bPath}.kind`, message: 'block.kind 无效' })
          continue
        }
        if (block.kind === 'stats') {
          if (!Array.isArray(block.views) || block.views.length < 1) {
            errors.push({ path: `${bPath}.views`, message: 'stats 需要 views' })
          } else {
            for (const id of block.views) {
              const target = viewById.get(String(id))
              if (!target) errors.push({ path: `${bPath}.views`, message: `未知视图 ${id}` })
              else if (target.type !== 'stat') errors.push({ path: `${bPath}.views`, message: `${id} 必须是 stat` })
            }
          }
        } else {
          const target = viewById.get(String(block.view || ''))
          if (!target) {
            errors.push({ path: `${bPath}.view`, message: 'view 必须引用已有视图 id' })
          }
        }
      }
    }
  }

  /** @type {Record<string, unknown>[]} */
  const normalizedActions = []
  const actions = Array.isArray(root.actions) ? root.actions : []
  for (let ai = 0; ai < actions.length; ai++) {
    const aPath = `actions[${ai}]`
    const action = requireObject(actions[ai], aPath, errors)
    if (!action) continue
    rejectExtraKeys(action, ['name', 'label', 'entity', 'kind', 'set', 'biz', 'agent', 'approval'], aPath, errors)
    if (typeof action.name !== 'string' || !ACTION_NAME_RE.test(action.name)) {
      errors.push({ path: `${aPath}.name`, message: '动作 name 格式无效' })
    }
    if (typeof action.label !== 'string' || action.label.length > 12) {
      errors.push({ path: `${aPath}.label`, message: 'label 最长 12' })
    }
    if (typeof action.entity !== 'string' || !entities.has(action.entity)) {
      errors.push({ path: `${aPath}.entity`, message: 'entity 必须存在' })
      continue
    }
    if (!ACTION_KINDS.has(String(action.kind))) {
      errors.push({ path: `${aPath}.kind`, message: 'kind 无效' })
      continue
    }
    const entFields = entities.get(action.entity)?.fields
    if (action.kind === 'set') {
      const setObj = requireObject(action.set, `${aPath}.set`, errors)
      if (setObj) {
        for (const [key, val] of Object.entries(setObj)) {
          const field = entFields?.get(key)
          if (!field) {
            errors.push({ path: `${aPath}.set.${key}`, message: '只能 set 本实体字段' })
            continue
          }
          if (!valueMatchesField(val, field)) {
            errors.push({ path: `${aPath}.set.${key}`, message: '值类型与字段不匹配' })
          }
        }
      }
    }
    if (action.kind === 'biz') {
      action.approval = 'required'
      const biz = requireObject(action.biz, `${aPath}.biz`, errors)
      if (biz) {
        if (typeof biz.kind !== 'string' || !biz.kind) {
          errors.push({ path: `${aPath}.biz.kind`, message: 'biz.kind 必填' })
        }
        const allowedActions = ['现查', '改行', '新建', '删除', '过审']
        if (!allowedActions.includes(String(biz.action))) {
          errors.push({ path: `${aPath}.biz.action`, message: 'biz.action 无效' })
        }
      }
    }
    if (action.kind === 'agent') {
      const agent = requireObject(action.agent, `${aPath}.agent`, errors)
      if (agent) {
        if (typeof agent.preset !== 'string' || !agent.preset) {
          errors.push({ path: `${aPath}.agent.preset`, message: 'preset 必填' })
        }
        if (typeof agent.prompt !== 'string' || !agent.prompt) {
          errors.push({ path: `${aPath}.agent.prompt`, message: 'prompt 必填' })
        }
      }
    }
    normalizedActions.push(action)
  }

  if (ctx.slugTaken) {
    errors.push({ path: 'slug', message: 'slug 在本工作区已被占用' })
  }

  if (errors.length > 0) return { ok: false, errors }

  const normalized = {
    ...root,
    actions: normalizedActions,
  }
  return { ok: true, errors: [], spec: normalized }
}

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} field
 */
function valueMatchesField(value, field) {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'date':
    case 'datetime':
    case 'enum':
    case 'ref':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'bool':
      return typeof value === 'boolean'
    case 'json':
      return value !== undefined
    default:
      return false
  }
}

/**
 * @param {Record<string, unknown>} spec
 * @param {Record<string, unknown>} nextSpec
 */
export function detectBreakingSpecChange(spec, nextSpec) {
  const prevEntities = indexEntities(spec)
  const nextEntities = indexEntities(nextSpec)
  const breaking = []

  for (const [name, prev] of prevEntities) {
    const next = nextEntities.get(name)
    if (!next) {
      breaking.push({ path: `entities.${name}`, message: '不允许删除实体' })
      continue
    }
    for (const [fname, prevField] of prev.fields) {
      const nf = next.fields.get(fname)
      if (!nf) {
        breaking.push({ path: `entities.${name}.fields.${fname}`, message: '不允许删除字段' })
        continue
      }
      if (nf.type !== prevField.type) {
        breaking.push({ path: `entities.${name}.fields.${fname}.type`, message: '不允许修改字段类型' })
      }
    }
  }

  return breaking
}

/**
 * @param {Record<string, unknown>} spec
 */
function indexEntities(spec) {
  /** @type {Map<string, { fields: Map<string, { type: string }> }>} */
  const map = new Map()
  if (!Array.isArray(spec.entities)) return map
  for (const ent of spec.entities) {
    if (!ent || typeof ent !== 'object') continue
    const fields = new Map()
    if (Array.isArray(ent.fields)) {
      for (const f of ent.fields) {
        if (f && typeof f === 'object' && typeof f.name === 'string') {
          fields.set(f.name, { type: String(f.type) })
        }
      }
    }
    if (typeof ent.name === 'string') map.set(ent.name, { fields })
  }
  return map
}

export function tableNameForEntity(slug, entityName) {
  return `app_${slug}__${entityName}`
}

export function quoteTable(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}
