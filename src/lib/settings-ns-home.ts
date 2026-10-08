/** One settings/describe ns lands on one FDE writer. */

export type SettingsNsHome = 'elsewhere' | 'appearance' | 'account' | 'chrome' | 'core'

export function settingsNsHome(ns: string, ownedNs: Iterable<string> = []) {
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

type PluginRow = { id?: string; title?: unknown; fields?: Record<string, unknown> }

function pluginMatchesNs(id: unknown, fields: Record<string, unknown> | undefined, ns: string, includeId: string) {
  return id === includeId
    || id === ns
    || String(fields?.entryId || '') === includeId
    || String(fields?.rowId || '') === ns
}

function walkPluginRow(row: PluginRow, ns: string, includeId: string): PluginRow | null {
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : {}
  if (pluginMatchesNs(row.id, fields, ns, includeId)) return row
  const nested = Array.isArray(fields.rows) ? fields.rows : []
  for (const child of nested) {
    if (!child || typeof child !== 'object') continue
    const rec = child as Record<string, unknown>
    const hit = walkPluginRow({
      id: String(rec.entryId || rec.id || rec.rowId || ''),
      title: rec.title,
      fields: rec,
    }, ns, includeId)
    if (hit) return hit
  }
  return null
}

export function pluginRecordForNs(plugins: PluginRow[], ns: string) {
  const includeId = `include:${ns}`
  for (const row of Array.isArray(plugins) ? plugins : []) {
    const hit = walkPluginRow(row, ns, includeId)
    if (hit) {
      const fields = hit.fields && typeof hit.fields === 'object' ? hit.fields : {}
      const meta = fields.meta && typeof fields.meta === 'object' ? fields.meta as Record<string, unknown> : {}
      return { meta, title: hit.title ?? fields.title ?? '' }
    }
  }
  return { meta: {} as Record<string, unknown>, title: '' as unknown }
}

export function pluginMetaForNs(plugins: PluginRow[], ns: string) {
  return pluginRecordForNs(plugins, ns).meta
}

export function hostPackageHeading(title: unknown) {
  const text = String(title || '').trim()
  if (!text.startsWith('@')) return text
  const slash = text.lastIndexOf('/')
  return slash >= 0 ? text.slice(slash + 1) : text
}

export function flattenModelRoutes(
  models: { rows?: Array<{ provider?: unknown; displayName?: unknown; profile?: { models?: Array<{ id?: unknown; name?: unknown }> } }> } | null | undefined,
  aiCatalog: { groups?: Array<{ id?: unknown; name?: unknown; models?: Array<{ id?: unknown; name?: unknown }> }> } | null | undefined,
) {
  const rows: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  const add = (provider: unknown, model: unknown, providerName: unknown, modelName: unknown) => {
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
