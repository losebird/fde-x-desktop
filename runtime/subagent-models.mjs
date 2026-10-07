/**
 * Keep Host subagent model-selection valid: enabled requires at least one
 * provider/model route, taken from the live llm-pi-ai catalog.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { profileCordisPatchPath, splitPatchBlocks } from './mcp-archive.mjs'

const SUBAGENT_NS = 'subagent-model-selection-settings'

export function routesFromProviders(providers, preferred) {
  const routes = []
  const seen = new Set()
  const push = (provider, model) => {
    const p = String(provider || '').trim()
    const m = String(model || '').trim()
    if (!p || !m) return
    const key = `${p}\0${m}`
    if (seen.has(key)) return
    seen.add(key)
    routes.push({ provider: p, model: m })
  }
  if (preferred && typeof preferred === 'object') push(preferred.provider, preferred.model)
  if (!providers || typeof providers !== 'object') return routes
  for (const [provider, profile] of Object.entries(providers)) {
    const models = Array.isArray(profile?.models) ? profile.models : []
    for (const row of models) {
      const id = typeof row === 'string' ? row : row?.id
      push(provider, id)
    }
  }
  return routes
}

export function routesFromLlmPatchBlock(block) {
  const providers = {}
  let provider = ''
  let inProviders = false
  for (const line of String(block || '').split('\n')) {
    if (/^\s+providers:\s*$/.test(line)) {
      inProviders = true
      continue
    }
    if (!inProviders) continue
    const key = line.match(/^(\s+)([A-Za-z0-9_.-]+):\s*$/)
    if (key && Number(key[1].length) <= 8 && !['models', 'input', 'headers', 'config'].includes(key[2])) {
      provider = key[2]
      if (!providers[provider]) providers[provider] = { models: [] }
      continue
    }
    const id = line.match(/^\s+- id:\s*(\S+)/)
    if (id && provider) {
      providers[provider].models.push({ id: id[1].replace(/^['"]|['"]$/g, '') })
    }
  }
  return routesFromProviders(providers)
}

function preferredFromPatchBlock(block) {
  const provider = String(block || '').match(/^\s+provider:\s*(\S+)/m)?.[1]
  const model = String(block || '').match(/^\s+model:\s*(\S+)/m)?.[1]
  if (!provider || !model) return null
  return {
    provider: provider.replace(/^['"]|['"]$/g, ''),
    model: model.replace(/^['"]|['"]$/g, ''),
  }
}

function allowedModelsYaml(routes) {
  return routes.map((row) => `      - provider: ${row.provider}\n        model: ${JSON.stringify(row.model)}`).join('\n')
}

export function fillSubagentAllowedModelsInPatch(text) {
  const blocks = splitPatchBlocks(text)
  const llm = blocks.find((block) => /id: llm-pi-ai/.test(block)) || ''
  const def = blocks.find((block) => /id: agent-default-model/.test(block)) || ''
  const grouped = {}
  for (const row of routesFromLlmPatchBlock(llm)) {
    grouped[row.provider] = grouped[row.provider] || { models: [] }
    grouped[row.provider].models.push({ id: row.model })
  }
  const routes = routesFromProviders(grouped, preferredFromPatchBlock(def))
  let changed = false
  const next = blocks.map((block) => {
    if (!/id: subagent-model-selection-settings/.test(block)) return block
    if (!/enabled:\s*true/.test(block)) return block
    if (/\n\s+allowedModels:\s*\n\s+- /.test(block)) return block
    if (!routes.length) return block
    changed = true
    const stripped = block.replace(/\n\s+allowedModels:\s*\[\s*\][ \t]*/g, '\n')
    return stripped.replace(/(enabled:\s*true)/, `$1\n    allowedModels:\n${allowedModelsYaml(routes)}`)
  })
  return { text: `${next.join('\n').replace(/\n+$/, '')}\n`, changed, routes }
}

export async function ensureSubagentAllowedModelsInProfile(aiRuntime) {
  const file = profileCordisPatchPath(aiRuntime)
  if (!file) return []
  let text = ''
  try {
    text = await readFile(file, 'utf8')
  } catch {
    return []
  }
  const filled = fillSubagentAllowedModelsInPatch(text)
  if (filled.changed) await writeFile(file, filled.text)
  return filled.routes
}

export async function ensureSubagentAllowedModels(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.status !== 'function' || !aiRuntime.status().connected) return []
  const rpc = typeof aiRuntime.rpc === 'function' ? aiRuntime.rpc.bind(aiRuntime) : null
  if (!rpc) return []
  let describe
  try {
    describe = await rpc('settings/describe', {})
  } catch {
    return []
  }
  const rows = Array.isArray(describe?.namespaces) ? describe.namespaces : []
  const sub = rows.find((row) => row?.ns === SUBAGENT_NS)
  if (!sub?.value?.enabled) return []
  if (Array.isArray(sub.value.allowedModels) && sub.value.allowedModels.length) return sub.value.allowedModels
  const pi = rows.find((row) => row?.ns === 'llm-pi-ai')
  const def = rows.find((row) => row?.ns === 'agent-default-model')
  const routes = routesFromProviders(pi?.value?.providers, def?.value)
  if (!routes.length) return []
  await rpc('settings/mutate', {
    ns: SUBAGENT_NS,
    expectedRevision: sub.revision,
    ops: [{ op: 'set', path: ['allowedModels'], value: routes }],
  })
  return routes
}
