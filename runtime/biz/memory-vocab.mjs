import { createRequire } from 'node:module'
import { join } from 'node:path'
import { FDE_DSH_HOME } from '../config.mjs'

const require = createRequire(import.meta.url)

function kindsFromGraphNodes(nodes) {
  const mod = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist', 'write.js')
  return require(mod).kindsFromGraphNodes(nodes)
}

/**
 * Same skos:Concept slice Memory explore uses (list_graph_nodes), mapped for biz/kinds.
 * @param {import('../dsh-core.mjs').AiRemoteRuntime} aiRuntime
 * @param {string} workspaceCwd
 */
export async function loadMemoryWorkspaceVocab(aiRuntime, workspaceCwd) {
  const cwd = String(workspaceCwd || '').trim()
  if (!cwd.startsWith('/')) {
    return { kinds: [], relations: [], catalogVersion: null, source: 'memory-graph', empty: true }
  }
  const found = await aiRuntime.semanticOs('/python', {
    op: 'list_graph_nodes',
    cwd,
    args: { type: 'skos:Concept', limit: 5000 },
  })
  const nodes = Array.isArray(found?.nodes) ? found.nodes : []
  const kinds = kindsFromGraphNodes(nodes)
  const relations = []
  const seen = new Set()
  for (const row of kinds) {
    for (const rel of Array.isArray(row.relations) ? row.relations : []) {
      if (!rel || typeof rel !== 'object') continue
      const from = String(rel.from || rel.fromKind || '').trim()
      const to = String(rel.to || rel.toKind || '').trim()
      const field = String(rel.field || '').trim()
      if (!from || !to) continue
      const key = `${from}\0${to}\0${field}`
      if (seen.has(key)) continue
      seen.add(key)
      relations.push(field ? { from, to, field } : { from, to })
    }
  }
  return {
    kinds: kinds.map((row) => ({
      kind: row.kind,
      label: row.kind,
      fields: Array.isArray(row.fields) ? row.fields : [],
      ...(row.id ? { id: row.id } : {}),
      ...(row.resource ? { resource: row.resource } : {}),
      ...(row.ticketField ? { ticketField: row.ticketField } : {}),
      ...(row.fieldLabels && typeof row.fieldLabels === 'object' && !Array.isArray(row.fieldLabels)
        ? { fieldLabels: row.fieldLabels }
        : {}),
      ...(row.can ? { can: row.can } : {}),
      ...(Array.isArray(row.relations) && row.relations.length ? { relations: row.relations } : {}),
    })),
    relations,
    catalogVersion: null,
    source: 'memory-graph',
    empty: kinds.length === 0,
  }
}
