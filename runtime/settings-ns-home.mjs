export function settingsNsHome(ns, ownedNs = []) {
  const id = String(ns || '')
  if (!id) return 'core'
  for (const owned of ownedNs) {
    if (owned && id === owned) return 'elsewhere'
  }
  if (id === 'agent-preset-registry') return 'elsewhere'
  if (id === 'ui-theme' || id === 'locale') return 'appearance'
  if (id === 'ui-settings-account' || (id.startsWith('llm-') && id.endsWith('-account'))) return 'account'
  if (id === 'ui-settings' || id === 'ui-conversation' || id === 'ui-chat') return 'chrome'
  return 'core'
}

function pluginMatchesNs(id, fields, ns, includeId) {
  return id === includeId
    || id === ns
    || String(fields?.entryId || '') === includeId
    || String(fields?.rowId || '') === ns
}

function walkPluginRow(row, ns, includeId) {
  if (!row || typeof row !== 'object') return null
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  if (pluginMatchesNs(row.id, fields, ns, includeId)) return row
  const nested = Array.isArray(fields.rows) ? fields.rows : []
  for (const child of nested) {
    if (!child || typeof child !== 'object') continue
    const hit = walkPluginRow({
      id: child.entryId || child.id || child.rowId,
      title: child.title,
      fields: child,
    }, ns, includeId)
    if (hit) return hit
  }
  return null
}

export function pluginRecordForNs(plugins, ns) {
  const includeId = `include:${ns}`
  for (const row of Array.isArray(plugins) ? plugins : []) {
    const hit = walkPluginRow(row, ns, includeId)
    if (hit) {
      const fields = hit.fields && typeof hit.fields === 'object' ? hit.fields : {}
      const meta = fields.meta && typeof fields.meta === 'object' ? fields.meta : {}
      return { meta, title: hit.title || fields.title || '' }
    }
  }
  return { meta: {}, title: '' }
}

export function pluginMetaForNs(plugins, ns) {
  return pluginRecordForNs(plugins, ns).meta
}

export function hostPackageHeading(title) {
  const text = String(title || '').trim()
  if (!text.startsWith('@')) return text
  const slash = text.lastIndexOf('/')
  return slash >= 0 ? text.slice(slash + 1) : text
}

export function flattenModelRoutes(models, aiCatalog) {
  const rows = []
  const seen = new Set()
  const add = (provider, model, providerName, modelName) => {
    const route = String(provider || '')
    const id = String(model || '')
    if (!route || !id) return
    const key = `${route}\0${id}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      provider: route,
      model: id,
      providerName: String(providerName || route),
      modelName: String(modelName || id),
    })
  }
  for (const group of aiCatalog && Array.isArray(aiCatalog.groups) ? aiCatalog.groups : []) {
    for (const model of Array.isArray(group?.models) ? group.models : []) {
      add(group.id, model.id, group.name, model.name)
    }
  }
  for (const row of models && Array.isArray(models.rows) ? models.rows : []) {
    const list = row?.profile && Array.isArray(row.profile.models) ? row.profile.models : []
    for (const model of list) {
      add(row.provider, model.id, row.displayName, model.name)
    }
  }
  if (!rows.length) return []
  return [{ keys: Object.keys(rows[0]), rows }]
}
