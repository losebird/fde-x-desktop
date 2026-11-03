import { createRequire } from 'node:module'
import { join } from 'node:path'
import { FDE_DSH_HOME } from '../config.mjs'
import { canonicalWorkspaceCwd } from '../cwd.mjs'
import { listBridgePeers } from '../plugins/dsh-semantic-os/bridge.js'
import { collapseKindsToConnectedTables } from './connected-kind.mjs'

const require = createRequire(import.meta.url)

function kindsFromGraphNodes(nodes) {
  const mod = join(FDE_DSH_HOME, 'vendor', 'dsh-lan-assist', 'write.js')
  return require(mod).kindsFromGraphNodes(nodes)
}

function emptyVocab() {
  return { kinds: [], relations: [], catalogVersion: null, source: 'memory-graph', empty: true, aliases: {} }
}

async function loadVocabAt(aiRuntime, cwd) {
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
  const connectionByKind = new Map()
  for (const node of nodes) {
    if (!node || String(node.type || '') !== 'skos:Concept') continue
    const props = node.properties && typeof node.properties === 'object' ? node.properties : {}
    const kind = String(props.prefLabel || props.label || props.content || '').trim()
    const connection = String(props.connection || '').trim()
    if (kind && connection) connectionByKind.set(kind, connection)
  }
  const mapped = kinds.map((row) => ({
    kind: row.kind,
    label: row.kind,
    fields: Array.isArray(row.fields) ? row.fields : [],
    ...(row.id ? { id: row.id } : {}),
    ...(row.resource ? { resource: row.resource } : {}),
    ...(row.catalogVersion ? { catalogVersion: row.catalogVersion } : {}),
    ...(row.ticketField ? { ticketField: row.ticketField } : {}),
    ...(row.fieldLabels && typeof row.fieldLabels === 'object' && !Array.isArray(row.fieldLabels)
      ? { fieldLabels: row.fieldLabels }
      : {}),
    ...(row.can ? { can: row.can } : {}),
    ...(Array.isArray(row.relations) && row.relations.length ? { relations: row.relations } : {}),
    ...(row.connection || connectionByKind.get(row.kind)
      ? { connection: row.connection || connectionByKind.get(row.kind) }
      : {}),
  }))
  const collapsed = collapseKindsToConnectedTables(mapped)
  return {
    kinds: collapsed.kinds,
    aliases: collapsed.aliases,
    relations,
    catalogVersion: null,
    source: 'memory-graph',
    empty: collapsed.kinds.length === 0,
  }
}

/** Read-time union. Local names win. Peer rows keep bridgeCwd; nothing is written. */
export function mergePeerVocab(local, peerSheets) {
  const byName = new Map()
  for (const row of Array.isArray(local?.kinds) ? local.kinds : []) {
    const kind = String(row?.kind || '').trim()
    if (kind) byName.set(kind, { ...row })
  }
  const relations = []
  const seenRel = new Set()
  const addRel = (rel) => {
    if (!rel || typeof rel !== 'object') return
    const from = String(rel.from || rel.fromKind || '').trim()
    const to = String(rel.to || rel.toKind || '').trim()
    const field = String(rel.field || '').trim()
    if (!from || !to) return
    const key = `${from}\0${to}\0${field}`
    if (seenRel.has(key)) return
    seenRel.add(key)
    relations.push(field ? { from, to, field } : { from, to })
  }
  for (const rel of Array.isArray(local?.relations) ? local.relations : []) addRel(rel)
  for (const sheet of Array.isArray(peerSheets) ? peerSheets : []) {
    const peerCwd = canonicalWorkspaceCwd(sheet?.cwd)
    for (const row of Array.isArray(sheet?.kinds) ? sheet.kinds : []) {
      const kind = String(row?.kind || '').trim()
      if (!kind || byName.has(kind)) continue
      byName.set(kind, { ...row, bridgeCwd: peerCwd || row.bridgeCwd })
    }
    for (const rel of Array.isArray(sheet?.relations) ? sheet.relations : []) addRel(rel)
  }
  const collapsed = collapseKindsToConnectedTables([...byName.values()])
  const bridged = Array.isArray(peerSheets) && peerSheets.length > 0
  return {
    kinds: collapsed.kinds,
    aliases: collapsed.aliases,
    relations,
    catalogVersion: local?.catalogVersion ?? null,
    source: bridged ? 'memory-graph+bridge' : (local?.source || 'memory-graph'),
    empty: collapsed.kinds.length === 0,
  }
}

/**
 * Same skos:Concept slice Memory explore uses (list_graph_nodes), mapped for biz/kinds.
 * Bridged workspaces are read in place. This does not upsert peer concepts into cwd.
 * @param {import('../dsh-core.mjs').AiRemoteRuntime} aiRuntime
 * @param {string} workspaceCwd
 * @param {{ dshHome?: string }} [opts]
 */
export async function loadMemoryWorkspaceVocab(aiRuntime, workspaceCwd, opts = {}) {
  const cwd = canonicalWorkspaceCwd(workspaceCwd)
  if (!cwd) return emptyVocab()
  const local = await loadVocabAt(aiRuntime, cwd)
  let peers = []
  try {
    peers = await listBridgePeers(cwd, opts.dshHome || FDE_DSH_HOME)
  } catch {
    peers = []
  }
  const extras = []
  for (const peer of peers) {
    const peerCwd = canonicalWorkspaceCwd(peer)
    if (!peerCwd || peerCwd === cwd) continue
    try {
      extras.push({ ...(await loadVocabAt(aiRuntime, peerCwd)), cwd: peerCwd })
    } catch { /* one peer down does not hide local kinds */ }
  }
  return extras.length ? mergePeerVocab(local, extras) : local
}

export async function saveMemoryWorkspaceVocab(aiRuntime, workspaceCwd, concept) {
  const cwd = canonicalWorkspaceCwd(workspaceCwd)
  if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能改词表。' }
  const row = concept && typeof concept === 'object' ? concept : {}
  return aiRuntime.semanticOs('/python', {
    op: 'upsert_workspace_vocab',
    cwd,
    args: { concepts: [row] },
  })
}
