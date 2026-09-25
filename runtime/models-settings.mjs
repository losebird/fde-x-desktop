import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROBE_ROUTE = '\0probe'

export function providerKeyRef(providerOrRoute) {
  return `${String(providerOrRoute || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

export function getPath(root, path) {
  if (!path?.length) return root
  let cur = root
  for (const segment of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = cur[segment]
  }
  return cur
}

export function hasPath(root, path) {
  if (!path?.length) return root !== undefined && root !== null
  let cur = root
  for (const segment of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object' || !(segment in cur)) return false
    cur = cur[segment]
  }
  return true
}

export function joinProviderDirectory(registered, declared) {
  const rows = []
  const seen = new Set()
  for (const entry of Array.isArray(declared) ? declared : []) {
    const provider = String(entry.provider || '')
    if (!provider) continue
    seen.add(provider)
    rows.push({
      provider,
      displayName: String(entry.displayName || entry.provider || ''),
      settingsNs: String(entry.settingsNs || ''),
      settingsPath: Array.isArray(entry.settingsPath) ? entry.settingsPath.map(String) : [],
      active: false,
    })
  }
  const reg = Array.isArray(registered) ? registered : []
  for (const row of rows) {
    row.active = reg.some((item) => String(item.id || '') === row.provider)
  }
  for (const item of reg) {
    const id = String(item.id || '')
    if (!id || seen.has(id)) continue
    rows.push({
      provider: id,
      displayName: String(item.name || id),
      settingsNs: '',
      settingsPath: [],
      active: true,
    })
  }
  return rows
}

function nodeAtPath(schema, path) {
  let node = schema
  for (const segment of path) {
    if (!node || typeof node !== 'object') return undefined
    if (node.type === 'object' && node.properties) {
      node = node.properties[segment]
      continue
    }
    if (node.type === 'record' && node.value) {
      node = node.value
      continue
    }
    return undefined
  }
  return node
}

export function protocolChoicesFromNamespace(namespaceView) {
  if (!namespaceView?.schema) return []
  const list = nodeAtPath(namespaceView.schema, ['providers', PROBE_ROUTE, 'api'])
  if (!list || list.type !== 'union' || !Array.isArray(list.list)) return []
  return list.list.map((entry) => entry?.value).filter((value) => typeof value === 'string')
}

export function apiKeyEnvOf(namespaceView, settingsPath) {
  if (!namespaceView) return undefined
  const profile = getPath(namespaceView.value, settingsPath)
  if (!profile || typeof profile !== 'object') return undefined
  const ref = profile.apiKeyEnv
  return typeof ref === 'string' && ref.length > 0 ? ref : undefined
}

export function pathOps(base, before, after) {
  const previous = typeof before === 'object' && before !== null && !Array.isArray(before) ? before : {}
  const next = typeof after === 'object' && after !== null && !Array.isArray(after) ? after : {}
  const ops = []
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(previous[key]) === JSON.stringify(value)) continue
    ops.push({ op: 'set', path: [...base, key], value })
  }
  for (const key of Object.keys(previous)) {
    if (!(key in next)) ops.push({ op: 'unset', path: [...base, key] })
  }
  return ops
}

export function pickModelRowFields(row) {
  const id = String(row?.id || '').trim()
  if (!id) return null
  const name = String(row?.name || row?.id || '').trim() || id
  const out = { id, name }
  if (typeof row?.contextWindow === 'number') out.contextWindow = row.contextWindow
  if (typeof row?.maxTokens === 'number') out.maxTokens = row.maxTokens
  if (row?.reasoningEfforts !== undefined && row?.reasoningEfforts !== null) {
    out.reasoningEfforts = row.reasoningEfforts
  }
  return out
}

/** Keep reasoningEfforts only when discover/schema returned them for that model id. */
export function alignModelRowsWithDiscover(models, discovered) {
  const byId = new Map(
    (Array.isArray(discovered) ? discovered : [])
      .map((row) => {
        const id = String(row?.id || '').trim()
        return id ? [id, row] : null
      })
      .filter(Boolean),
  )
  return (Array.isArray(models) ? models : [])
    .map((row) => pickModelRowFields(row))
    .filter(Boolean)
    .map((row) => {
      const disc = byId.get(row.id)
      if (disc && disc.reasoningEfforts !== undefined) {
        return { ...row, reasoningEfforts: disc.reasoningEfforts }
      }
      const { reasoningEfforts: _drop, ...rest } = row
      return rest
    })
}

export async function discoverProviderModels(aiRuntime, profile, providerRoute) {
  if (!aiRuntime?.status?.().connected) return []
  const baseURL = String(profile?.baseURL || '').trim().replace(/\/$/, '')
  const api = String(profile?.api || 'openai-completions').trim()
  if (!/^https?:\/\//.test(baseURL)) return []
  try {
    const found = await aiRuntime.rpc('llm/discoverModels', {
      settingsNs: 'llm-pi-ai',
      request: {
        ...(providerRoute ? { provider: providerRoute } : {}),
        baseURL,
        api,
      },
    })
    return Array.isArray(found) ? found : []
  } catch {
    return []
  }
}

export function mergeModelRows(existing, pickedCandidates) {
  const byId = new Map()
  for (const row of existing) {
    const id = String(row?.id || '').trim()
    if (id) byId.set(id, row)
  }
  for (const candidate of pickedCandidates) {
    const id = String(candidate?.id || '').trim()
    if (!id) continue
    if (!byId.has(id)) {
      byId.set(id, pickModelRowFields(candidate) || { id, name: id })
    }
  }
  return [...byId.values()]
}

export function formatReasoningEffortsYaml(efforts, indent) {
  if (efforts === undefined || efforts === null) return []
  if (typeof efforts !== 'object' || Array.isArray(efforts)) {
    return [`${indent}reasoningEfforts: ${efforts}`]
  }
  if (efforts._flow) {
    return [`${indent}reasoningEfforts: { ${efforts._flow} }`]
  }
  const pad = indent
  const lines = [`${pad}reasoningEfforts:`]
  for (const [key, value] of Object.entries(efforts)) {
    if (value === null) lines.push(`${pad}  ${key}: null`)
    else if (typeof value === 'boolean' || typeof value === 'number') lines.push(`${pad}  ${key}: ${value}`)
    else lines.push(`${pad}  ${key}: ${JSON.stringify(String(value))}`)
  }
  return lines
}

function namespaceMap(describe) {
  const map = new Map()
  for (const view of describe?.namespaces || []) {
    if (view?.ns) map.set(String(view.ns), view)
  }
  return map
}

export function buildModelsSettingsSnapshot({
  registered,
  declared,
  describe,
  credentials,
  readSettingsProviderProfile,
  settingsFile,
}) {
  const providers = joinProviderDirectory(registered, declared)
  const writable = Boolean(describe?.writable)
  const namespaces = namespaceMap(describe)
  const piAi = namespaces.get('llm-pi-ai')
  const protocolChoices = protocolChoicesFromNamespace(piAi)

  const declaredIds = new Set(
    (Array.isArray(declared) ? declared : []).map((row) => String(row.provider || '')),
  )

  const rows = providers.map((entry) => {
    const ns = entry.settingsNs ? namespaces.get(entry.settingsNs) : undefined
    const configured = ns !== undefined && (
      entry.settingsPath.length === 0 || getPath(ns.value, entry.settingsPath) !== undefined
    )
    const removable = ns !== undefined
      && entry.settingsPath.length > 0
      && hasPath(ns.user, entry.settingsPath)
      && !hasPath(ns.base, entry.settingsPath)
    const apiKeyEnv = apiKeyEnvOf(ns, entry.settingsPath)
    const keyRef = apiKeyEnv || providerKeyRef(entry.provider)
    const cred = credentials[keyRef]
    const declaredCustom = entry.settingsNs === 'llm-pi-ai'
      && entry.settingsPath[0] === 'providers'
      && entry.settingsPath.length === 2
      && !declaredIds.has(entry.provider)
    let profile
    if (ns && entry.settingsPath.length > 0) {
      profile = getPath(ns.value, entry.settingsPath)
    } else if (entry.settingsNs === 'llm-pi-ai' && entry.settingsPath.length === 2) {
      const route = entry.settingsPath[1]
      profile = readSettingsProviderProfile(settingsFile, route)
    }
    const userSubtree = ns ? getPath(ns.user, entry.settingsPath) : undefined
    const modelsOverridden = typeof userSubtree === 'object' && userSubtree !== null && hasPath(userSubtree, ['models'])
    const revision = ns?.revision

    return {
      ...entry,
      kind: declaredIds.has(entry.provider) ? 'catalog' : 'custom',
      configured: entry.settingsPath.length === 0 ? Boolean(cred?.configured) : configured,
      removable,
      apiKeyEnv,
      keyRef,
      credentialConfigured: Boolean(cred?.configured),
      credentialWritable: cred?.writable !== false,
      declared: declaredCustom,
      modelsOverridden,
      revision,
      profile: profile && typeof profile === 'object' ? profile : undefined,
      userProfile: typeof userSubtree === 'object' && userSubtree !== null ? userSubtree : undefined,
    }
  })

  const namespacePayload = {}
  for (const [ns, view] of namespaces) {
    namespacePayload[ns] = {
      revision: view.revision,
      applies: view.applies,
    }
  }

  return {
    writable,
    protocolChoices,
    namespaces: namespacePayload,
    rows,
  }
}

export async function fetchModelsSettingsSnapshot(aiRuntime, readSettingsProviderProfile) {
  const settingsFile = join(aiRuntime.dshHome, 'settings.yaml')
  const [registered, declared] = await Promise.all([
    aiRuntime.rpc('llm/listProviders', {}),
    aiRuntime.rpc('llm/listConfigurableProviders', {}),
  ])
  let describe = { writable: false, namespaces: [] }
  try {
    describe = await aiRuntime.rpc('settings/describe', {}) || describe
  } catch {
    describe = { writable: false, namespaces: [] }
  }

  const providers = joinProviderDirectory(registered, declared)
  const refs = new Set()
  const namespaces = namespaceMap(describe)
  for (const entry of providers) {
    const ns = entry.settingsNs ? namespaces.get(entry.settingsNs) : undefined
    const apiKeyEnv = apiKeyEnvOf(ns, entry.settingsPath)
    refs.add(apiKeyEnv || providerKeyRef(entry.provider))
  }
  let credentials = {}
  if (refs.size) {
    try {
      credentials = await aiRuntime.rpc('credentials/describe', { refs: [...refs] }) || {}
    } catch {
      credentials = {}
    }
  }

  return buildModelsSettingsSnapshot({
    registered,
    declared,
    describe,
    credentials,
    readSettingsProviderProfile,
    settingsFile,
  })
}

export function readDescribeFallback(dshHome) {
  let text = ''
  try { text = readFileSync(join(dshHome, 'settings.yaml'), 'utf8') } catch { text = '' }
  const writable = true
  return {
    writable,
    namespaces: [{
      ns: 'llm-pi-ai',
      revision: 0,
      applies: 'restart',
      schema: null,
      value: null,
      base: null,
      user: null,
    }],
    _offlineYaml: text,
  }
}

export function validateApiKeyInput(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return 'empty'
  for (const ch of trimmed) {
    const code = ch.codePointAt(0)
    if (code === undefined || code < 0x21 || code > 0x7e) return 'non_ascii'
  }
  return undefined
}
