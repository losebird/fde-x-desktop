/**
 * Product same-origin APIs under /semantic-os (not official explorer mounts).
 * @module dsh-semantic-os/product
 */

import { request as httpRequest } from 'node:http'
import { realpathSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { listBridges, createBridge, deleteBridge, BRIDGE_PROTOCOL, PLUGIN_VERSION } from './bridge.js'
import { postPython } from './ingest.js'
import { loadOverlay, mergeConfig, saveOverlay } from './persist.js'
import { addAnnotation, listAnnotations } from './annotations.js'
import { listPeople, savePeople, listLeftIds } from './people.js'
import { cleanGraphPayload } from './graph-label.js'
import { ensureDeps, probeDeps } from './ensure-deps.js'
import { clockEmptyReason, excerptsFromFind, groupSemanticHits, isSessionTailQuery } from './session-find.js'
import { mergePassageHits } from './session-corpus.js'
import { estimateTokens, readUsage, recordUsage } from './usage-ledger.js'
import { hasCjk } from './extract-llm.js'

const PREFIX = '/semantic-os'
const PROBES = [
  ['analytics', 'GET', '/api/analytics'],
  ['annotations', 'GET', '/api/annotations'],
  ['decisions', 'GET', '/api/decisions'],
  ['enrich', 'POST', '/api/enrich/dedup'],
  ['export_import', 'POST', '/api/export'],
  ['graph', 'GET', '/api/graph/stats'],
  ['ontology', 'GET', '/api/ontology/registry'],
  ['temporal', 'GET', '/api/temporal/bounds'],
  ['vocabulary', 'GET', '/api/vocabulary/schemes'],
  ['provenance', 'GET', '/api/provenance'],
  ['sparql', 'POST', '/api/sparql'],
]

/**
 * @returns {boolean} true if handled
 */
export async function handleProduct(req, res, url, opts) {
  const pathname = url.pathname
  const { sidecar, getConfig, ingest, writes, sessionIngest, extractQueue } = opts
  const authorize = async (cwd) => !cwd || !opts.workspaceAuthority || await opts.workspaceAuthority.allows(cwd)
  const forbidden = () => json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })

  if (pathname === `${PREFIX}/ingest` && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    const sessionId = url.searchParams.get('session') || ''
    return json(res, 200, { ok: true, ...ingest.snapshot(cwd, sessionId) })
  }
  if (pathname === `${PREFIX}/ingest/progress` && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    const sessionId = url.searchParams.get('session') || ''
    if (writes && typeof writes.touch === 'function') writes.touch(cwd, sessionId)
    const snap = ingest.snapshot(cwd, sessionId)
    const writeSnap = writes && typeof writes.snapshot === 'function' ? writes.snapshot(cwd, sessionId) : {}
    return json(res, 200, { ok: true, ...snap, sharedWrite: Boolean(snap.sharedWrite || writeSnap.sharedWrite) })
  }
  if (pathname === `${PREFIX}/ingest/ensure` && req.method === 'POST') {
    const body = await readJson(req)
    if (!(await authorize(body.cwd))) return forbidden()
    return json(res, 200, { ok: true, ...ingest.ensure(body.cwd, body.sessionId, body.paths) })
  }
  if (pathname === `${PREFIX}/ingest/start` && req.method === 'POST') {
    const body = await readJson(req)
    if (!(await authorize(body.cwd))) return forbidden()
    return json(res, 200, { ok: true, ...ingest.start(body.cwd, body.sessionId, body.paths, false) })
  }
  if (pathname === `${PREFIX}/ingest/cancel` && req.method === 'POST') {
    const body = await readJson(req)
    if (!(await authorize(body.cwd))) return forbidden()
    return json(res, 200, { ok: true, ...ingest.cancel(body.cwd) })
  }
  if (pathname === `${PREFIX}/ingest/retry` && req.method === 'POST') {
    const body = await readJson(req)
    if (!(await authorize(body.cwd))) return forbidden()
    return json(res, 200, { ok: true, ...ingest.retry(body.cwd, body.sessionId) })
  }

  if (pathname === `${PREFIX}/session-ingest` && req.method === 'GET') {
    return json(res, 200, { ok: true, ...(sessionIngest ? sessionIngest.snapshot() : { error: 'NO_SESSION_INGEST' }) })
  }
  if (pathname === `${PREFIX}/session-ingest/now` && req.method === 'POST') {
    if (!sessionIngest) return json(res, 500, { ok: false, error: 'NO_SESSION_INGEST' })
    const kick = typeof sessionIngest.kick === 'function' ? sessionIngest.kick : sessionIngest.tick
    const result = kick.call(sessionIngest)
    if (result && typeof result.then === 'function') {
      const waited = await result
      return json(res, waited && waited.ok === false && waited.error === 'NO_PERSISTENCE' ? 503 : 200, { ok: true, ...waited })
    }
    return json(res, 200, { ok: true, started: true, ...result })
  }

  if (pathname === `${PREFIX}/usage` && req.method === 'GET') {
    return json(res, 200, await readUsage())
  }

  if (pathname === `${PREFIX}/nodes` && req.method === 'GET') {
    if (!(await authorize(url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''))) return forbidden()
    return serveNodes(req, res, url, sidecar)
  }

  // Magnifier semantic group. Wraps search_text; does not change it.
  if (pathname === `${PREFIX}/find` && req.method === 'POST') {
    return serveFind(req, res, sidecar, authorize, opts)
  }
  if (pathname === `${PREFIX}/retrieval-score` && req.method === 'POST') {
    const body = await readJson(req)
    const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
    if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
    if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
    if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
    const result = await postPython(sidecar, { op: 'retrieval_score', cwd, args: {} }).catch(() => null)
    if (!result) return json(res, 502, { ok: false, error: 'SCORE_FAILED' })
    return json(res, 200, result)
  }

  // Explore canvas search box hits this. Stay on search_text (this cwd only).
  // Official sidecar /api/graph/search loads ContextGraph and stalls the box.
  if (pathname === `${PREFIX}/api/graph/search` && req.method === 'POST') {
    return serveGraphSearch(req, res, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/graph/nodes` && req.method === 'GET') {
    return serveGraphNodes(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/graph/edges` && req.method === 'GET') {
    return serveGraphEdges(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/graph/stats` && req.method === 'GET') {
    return serveGraphStats(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/analytics` && req.method === 'GET') {
    return serveGraphStats(req, res, url, sidecar, authorize)
  }
  if (pathname.startsWith(`${PREFIX}/api/ontology/shacl`)) {
    return serveShaclSafe(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/export-owl` && req.method === 'POST') {
    return serveOntologyPack(req, res, sidecar, authorize, 'export_owl')
  }
  if (pathname === `${PREFIX}/api/ontology/export-skos` && req.method === 'POST') {
    return serveOntologyPack(req, res, sidecar, authorize, 'export_skos')
  }
  if (pathname === `${PREFIX}/api/ontology/conflicts` && req.method === 'POST') {
    return serveOntologyPack(req, res, sidecar, authorize, 'detect_conflicts')
  }
  if (pathname === `${PREFIX}/api/ontology/versions` && req.method === 'POST') {
    return serveOntologyVersionCreate(req, res, sidecar, authorize)
  }
  if (pathname.startsWith(`${PREFIX}/api/ontology/versions/`) && pathname.endsWith('/compare') && req.method === 'POST') {
    return serveOntologyVersionCompare(req, res, sidecar, authorize, pathname)
  }
  if (pathname.startsWith(`${PREFIX}/api/ontology/versions/`) && req.method === 'GET') {
    return serveOntologyVersionList(req, res, url, pathname, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/health` && req.method === 'GET') {
    return serveOntologyHealth(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/alignments` && req.method === 'GET') {
    return serveAlignmentsList(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/alignments` && req.method === 'POST') {
    return serveAlignmentSave(req, res, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/alignments` && req.method === 'DELETE') {
    return serveAlignmentDelete(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/suggest-alignments` && req.method === 'POST') {
    return serveAlignmentSuggest(req, res, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/search` && req.method === 'GET') {
    return serveOntologySearch(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/coverage` && req.method === 'GET') {
    return serveWorkspaceCoverage(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/decisions` && req.method === 'GET') {
    return serveDecisionsList(req, res, url, sidecar, authorize)
  }
  if (pathname.startsWith(`${PREFIX}/api/decisions/`) && pathname.endsWith('/chain') && req.method === 'GET') {
    return serveDecisionChain(req, res, url, pathname, sidecar, authorize)
  }
  if (pathname.startsWith(`${PREFIX}/api/decisions/`) && pathname.endsWith('/precedents') && req.method === 'GET') {
    return serveDecisionPrecedents(req, res, url, pathname, sidecar, authorize)
  }

  if (pathname === `${PREFIX}/api/temporal/bounds` && req.method === 'GET') {
    return serveTemporalBounds(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/temporal/snapshot` && req.method === 'GET') {
    return serveTemporalSnapshot(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/enrich/dedup` && req.method === 'POST') {
    return serveEnrichDedup(req, res, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/registry` && req.method === 'GET') {
    return serveOntologyRegistry(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/ontology/skos/schemes` && req.method === 'GET') {
    return serveSkosSchemes(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/vocabulary/hierarchy` && req.method === 'GET') {
    return serveSkosHierarchy(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/vocabulary/concepts` && req.method === 'GET') {
    return serveSkosConcepts(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/vocabulary/concepts` && req.method === 'POST') {
    return serveVocabPatch(req, res, sidecar, writes, authorize)
  }
  if (pathname === `${PREFIX}/api/vocabulary/schemes` && req.method === 'GET') {
    return serveSkosSchemes(req, res, url, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/sparql` && req.method === 'POST') {
    return serveSparql(req, res, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/export` && req.method === 'POST') {
    return serveApiExport(req, res, sidecar, authorize)
  }
  if (pathname === `${PREFIX}/api/import` && req.method === 'POST') {
    return serveApiImport(req, res, sidecar, writes, authorize)
  }
  if (pathname.startsWith(`${PREFIX}/api/ontology/skos/concept/`) && req.method === 'GET') {
    return serveSkosConcept(req, res, url, pathname, sidecar, authorize)
  }
  if (req.method === 'DELETE' && pathname.startsWith(`${PREFIX}/api/ontology/`)) {
    const rest = pathname.slice(`${PREFIX}/api/ontology/`.length)
    if (rest && rest !== 'alignments' && !rest.endsWith('/toggle') && !rest.endsWith('/refresh')) {
      return serveDeleteVocab(req, res, url, rest, sidecar, authorize)
    }
  }

  if (pathname === `${PREFIX}/deps` && req.method === 'GET') {
    const status = await probeDeps()
    const cwd = url.searchParams.get('cwd') || asciiHeaderCwd(req) || ''
    if (!(await authorize(cwd))) return forbidden()
    if (sidecar.snapshot().ready) {
      try {
        const live = await postPython(sidecar, { op: 'store_status', cwd, args: {} })
        if (live && live.graph) status.graph = { ...status.graph, ...live.graph }
        if (live && live.vector) status.vector = { ...status.vector, ...live.vector }
        if (live && live.passages) status.vector = { ...status.vector, ...live.passages }
      } catch { /* keep probe */ }
    }
    return json(res, 200, { ok: true, ...status })
  }
  if (pathname === `${PREFIX}/deps` && req.method === 'POST') {
    const probed = await probeDeps()
    if (probed && probed.ok && probed.graph && probed.graph.ok) {
      return json(res, 200, { ok: true, ...probed })
    }
    const status = await ensureDeps()
    return json(res, 200, { ok: true, ...status })
  }

  if (pathname === `${PREFIX}/settings/probe` && req.method === 'GET') {
    return serveProbe(res, sidecar, getConfig)
  }

  if (pathname === `${PREFIX}/settings/cli` && req.method === 'POST') {
    return serveCliHelp(res, sidecar)
  }

  if (pathname === `${PREFIX}/extract-session` && req.method === 'POST') {
    const body = await readJson(req)
    const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    if (!extractQueue || typeof extractQueue.extractFromSession !== 'function') {
      return json(res, 500, { ok: false, error: 'NO_EXTRACT', truncated: false })
    }
    if (body.nodded !== true) return json(res, 400, { ok: false, error: 'NO_NOD', truncated: false })
    const id = String(body.id || body.path || '').trim()
    if (!id.startsWith('session:') && !id.startsWith('file:')) {
      return json(res, 400, { ok: false, error: 'NOT_A_SESSION', truncated: false })
    }
    const snap = sidecar.snapshot()
    if (!snap.ready || !snap.port) return json(res, 503, { ok: false, error: 'NOT_READY', truncated: false })
    const node = await postPython(sidecar, { op: 'session_text', cwd, args: { id } }).catch(() => null)
    if (!node || node.error || typeof node.text !== 'string') {
      return json(res, 404, { ok: false, error: (node && node.error) || 'NOT_FOUND', truncated: false })
    }
    const result = await extractQueue.extractFromSession({
      cwd,
      id,
      nodded: true,
      text: node.text,
      timestamp: node.timestamp,
    })
    if (result && result.error) return json(res, 400, { ok: false, truncated: false, ...result })
    return json(res, 200, { ok: true, truncated: false, ...result })
  }

  if ((pathname === `${PREFIX}/python` || pathname === `${PREFIX}/_dsh/python`) && req.method === 'POST') {
    const body = await readJson(req)
    const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    if (String(body.op || '') === 'upsert_workspace_vocab') {
      return json(res, 403, { ok: false, error: 'USE_HOST_TOOL' })
    }
    const op = String(body.op || '')
    const extractMethod = String((body.args && (body.args.extractMethod || body.args.method)) || '').trim().toLowerCase()
    if ((op === 'extract_entities' || op === 'extract_relations') && extractMethod === 'skip') {
      return json(res, 422, {
        ok: false,
        error: 'EXTRACT_SKIP',
        extractMethod: 'skip',
        entities: [],
        relations: [],
        triplets: [],
      })
    }
    if ((op === 'extract_entities' || op === 'extract_relations') && opts.getExtract) {
      const extract = opts.getExtract()
      const text = String((body.args && body.args.text) || '')
      if (extract && typeof extract.extract === 'function' && hasCjk(text)) {
        const packed = await extract.extract(text)
        if (op === 'extract_entities') {
          return json(res, 200, {
            entities: packed.entities || [],
            relations: packed.relations || [],
            extractMethod: packed.via || 'dsh-llm',
          })
        }
        return json(res, 200, {
          relations: packed.relations || [],
          triplets: [],
          extractMethod: packed.via || 'dsh-llm',
        })
      }
    }
    const result = await postPython(sidecar, { op: body.op, cwd, args: body.args || {} })
    if (result && !result.error && writes && cwd && isWriteOp(body.op)) writes.mark(cwd, body.op)
    if ((op === 'extract_entities' || op === 'extract_relations') && result && result.extractMethod === 'skip') {
      const empty = op === 'extract_entities'
        ? !(result.entities || []).length
        : !(result.relations || []).length
      if (empty) {
        return json(res, 422, { ok: false, error: 'EXTRACT_SKIP', extractMethod: 'skip', ...result })
      }
    }
    const status = result && result.error ? 400 : 200
    return json(res, status, result)
  }

  if (pathname === `${PREFIX}/import` && req.method === 'POST') {
    return serveImport(req, res, sidecar, writes, authorize)
  }

  if (pathname === `${PREFIX}/bridge` && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    const links = await listBridges(cwd)
    return json(res, 200, { ok: true, protocol: BRIDGE_PROTOCOL, pluginVersion: PLUGIN_VERSION, links })
  }
  if (pathname === `${PREFIX}/bridge` && req.method === 'POST') {
    const body = await readJson(req)
    if (!(await authorize(body.sourceCwd)) || !(await authorize(body.targetCwd))) return forbidden()
    const result = await createBridge(body)
    return json(res, result.ok ? 200 : 400, result)
  }
  if (pathname === `${PREFIX}/bridge` && req.method === 'DELETE') {
    const body = await readJson(req)
    if (!(await authorize(body.cwd))) return forbidden()
    const result = await deleteBridge(body.id, body.cwd)
    return json(res, 200, result)
  }

  if (pathname === `${PREFIX}/writes` && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    return json(res, 200, { ok: true, ...(writes ? writes.snapshot(cwd) : { ts: 0, op: '' }) })
  }

  if (pathname === `${PREFIX}/archive-record` && req.method === 'POST') {
    const body = await readJson(req)
    const cfg = mergeConfig(getConfig())
    if (!cfg.sessionEndRecord) return json(res, 200, { ok: true, skipped: true })
    const cwd = body.cwd || ''
    if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
    if (!(await authorize(cwd))) return forbidden()
    const result = await postPython(sidecar, {
      op: 'record_decision',
      cwd,
      args: {
        category: 'session_end',
        scenario: `archived session ${body.sessionId || ''}`,
        reasoning: 'workspace.archiveSession',
        outcome: 'archived',
        confidence: 1,
        decision_maker: 'plugin',
        metadata: { actor: 'plugin', sessionId: body.sessionId || '', cwd, ts: new Date().toISOString() },
      },
    })
    if (writes) writes.mark(cwd, 'record_decision')
    return json(res, result && result.error ? 400 : 200, result)
  }

  if (pathname === `${PREFIX}/lineage` && req.method === 'GET') {
    if (!(await authorize(url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''))) return forbidden()
    return serveLineage(req, res, url, sidecar)
  }

  if (pathname === `${PREFIX}/annotations` && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    const result = await listAnnotations(cwd)
    return json(res, result.ok ? 200 : 400, result)
  }
  if (pathname === `${PREFIX}/annotations` && req.method === 'POST') {
    const body = await readJson(req)
    if (!(await authorize(body.cwd))) return forbidden()
    const result = await addAnnotation(body.cwd, body.note, body.path)
    return json(res, result.ok ? 200 : 400, result)
  }

  if (pathname === `${PREFIX}/export` && req.method === 'POST') {
    return serveExport(req, res, sidecar, writes, authorize)
  }

  if (pathname === `${PREFIX}/api/reason` && req.method === 'POST') {
    return serveReason(req, res, url, sidecar, writes, authorize)
  }

  if (pathname === `${PREFIX}/ask-excerpt` && req.method === 'GET') {
    const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
    if (!(await authorize(cwd))) return forbidden()
    const id = String(url.searchParams.get('id') || '').trim()
    const result = await askExcerpt(cwd, id, sidecar)
    return json(res, 200, result)
  }

  if (pathname === `${PREFIX}/people/left-ids` && req.method === 'GET') {
    const result = await listLeftIds()
    return json(res, 200, result)
  }
  if (pathname === `${PREFIX}/people` && req.method === 'GET') {
    const result = await listPeople()
    return json(res, 200, result)
  }
  if (pathname === `${PREFIX}/people` && req.method === 'POST') {
    const body = await readJson(req)
    const result = await savePeople(body.people || body.items || [])
    const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
    if (result.ok && cwd && sidecar.snapshot().ready && await authorize(cwd)) {
      const roster = (result.people || []).map((row) => ({
        id: row && row.id,
        displayName: row && row.displayName,
        status: row && row.status,
      }))
      await postPython(sidecar, { op: 'sync_roster', cwd, args: { people: roster } }).catch(() => null)
    }
    return json(res, result.ok ? 200 : 400, result)
  }

  if (pathname.startsWith(`${PREFIX}/api/`)) {
    return serveOwnedApi(req, res, url, pathname, sidecar, authorize)
  }

  return false
}


export async function askExcerpt(cwd, id, sidecar) {
  const ident = String(id || '').trim()
  if (!ident) return { ok: false, id: '', excerpt: '', pairedHint: '' }
  let name = ident
  try {
    const listed = await listPeople()
    const rows = (listed && listed.people) || []
    const hit = rows.find((row) => row && (row.id === ident || row.displayName === ident))
    if (hit && hit.displayName) name = String(hit.displayName)
  } catch { /* name-only fallback */ }

  const bits = []
  const snap = sidecar && typeof sidecar.snapshot === 'function' ? sidecar.snapshot() : null
  if (snap && snap.ready && snap.port && cwd) {
    try {
      const walked = await postPython(sidecar, { op: 'lineage', cwd, args: { id: ident } })
      if (walked && !walked.error) {
        const path = String(walked.path || '')
        const detail = String(walked.detail || '')
        if (path) bits.push(path.startsWith('session:') || path.includes('出自') ? path : `出自 ${path}`)
        else if (detail) bits.push(detail)
        if (Array.isArray(walked.hops) && walked.hops.length) {
          const hop = walked.hops[0]
          const label = hop && (hop.source_document || hop.label || hop.id)
          if (label && !bits.includes(String(label))) bits.push(String(label))
        }
      }
    } catch { /* keep going */ }
    try {
      const pre = await postPython(sidecar, { op: 'find_precedents', cwd, args: { scenario: ident, max_results: 3 } })
      const rows = (pre && (pre.results || pre.decisions || pre.precedents)) || []
      for (const row of Array.isArray(rows) ? rows.slice(0, 3) : []) {
        const snippet = row && (row.scenario || row.reasoning || row.summary || row.text)
        if (snippet) bits.push(String(snippet).slice(0, 240))
      }
    } catch { /* keep going */ }
    try {
      const hit = await postPython(sidecar, { op: 'search_text', cwd, args: { q: ident } })
      const rows = (hit && hit.results) || []
      for (const row of Array.isArray(rows) ? rows.slice(0, 2) : []) {
        const text = row && (row.text || (row.node && (row.node.label || row.node.id)))
        if (text) bits.push(String(text).slice(0, 240))
      }
    } catch { /* keep going */ }
  }

  const excerpt = bits.filter(Boolean).join('\n').slice(0, 2000)
  return { ok: true, id: ident, excerpt, pairedHint: name }
}

function isWriteOp(op) {
  return ['record_decision', 'add_entity', 'add_node', 'add_relationship', 'import_graph', 'ingest_directory', 'upsert_workspace_vocab'].includes(String(op || ''))
}


async function serveReason(req, res, url, sidecar, writes, authorize) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const mode = String(body.mode || body.engine || 'forward').trim().toLowerCase() || 'forward'
  let result
  try {
    const applyToGraph = Boolean(body.apply_to_graph)
    result = await postPython(sidecar, {
      op: 'run_reasoning',
      cwd,
      args: {
        facts: body.facts || [],
        rules: body.rules || [],
        mode,
        apply_to_graph: applyToGraph,
      },
    })
  } catch (error) {
    return json(res, 502, {
      ok: false,
      error: 'PYTHON_FAILED',
      engine: mode,
      detail: error instanceof Error ? error.message : String(error),
    })
  }
  if (!result || result.error) {
    return json(res, 400, {
      ok: false,
      error: (result && result.error) || 'REASON_FAILED',
      engine: (result && result.engine) || mode,
      detail: (result && result.detail) || '',
    })
  }
  const conclusions = result.conclusions || result.inferred_facts || result.derived_facts || []
  if (result.mutated && writes && cwd) writes.mark(cwd, 'run_reasoning')
  return json(res, 200, {
    ok: true,
    engine: result.engine || mode,
    inferred_facts: result.inferred_facts || conclusions,
    derived_facts: result.derived_facts || conclusions,
    conclusions,
    matches: result.matches || [],
    network: result.network || null,
    rules_fired: Array.isArray(result.matches) ? result.matches.length : conclusions.length,
    added_edges: Number(result.added_edges || 0),
    mutated: Boolean(result.mutated),
  })
}

async function serveDeleteVocab(req, res, url, encodedUri, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  let uri = ''
  try { uri = decodeURIComponent(encodedUri) } catch { uri = encodedUri }
  const result = await postPython(sidecar, { op: 'delete_vocab', cwd, args: { uri } }).catch(() => null)
  if (!result || result.error) {
    return json(res, 404, { detail: (result && result.error) || 'Ontology not found in registry.' })
  }
  return json(res, 200, { status: 'removed', uri, removed: result.removed || 0 })
}

async function serveOntologyRegistry(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const result = await postPython(sidecar, { op: 'ontology_registry', cwd, args: {} }).catch(() => null)
  if (Array.isArray(result)) return json(res, 200, result)
  return json(res, 200, [])
}

async function serveDecisionsList(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const includeAuto = url.searchParams.get('include_auto') === '1' || url.searchParams.get('auto') === '1'
  const result = await postPython(sidecar, {
    op: 'list_decisions',
    cwd,
    args: { include_auto: includeAuto, limit: 80 },
  }).catch(() => null)
  const rows = result && Array.isArray(result.decisions) ? result.decisions : []
  return json(res, 200, rows)
}

async function serveDecisionChain(req, res, url, pathname, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const raw = pathname.slice(`${PREFIX}/api/decisions/`.length, pathname.length - '/chain'.length)
  let decisionId = ''
  try { decisionId = decodeURIComponent(raw) } catch { decisionId = raw }
  if (!decisionId) return json(res, 400, { detail: 'decision_id is required' })
  const direction = url.searchParams.get('direction') || 'upstream'
  const result = await postPython(sidecar, {
    op: 'get_causal_chain',
    cwd,
    args: { decision_id: decisionId, direction },
  }).catch(() => null)
  if (!result || result.error) return json(res, 404, { detail: (result && result.error) || 'Decision not found' })
  return json(res, 200, { decision_id: decisionId, chain: Array.isArray(result.chain) ? result.chain : [] })
}

async function serveDecisionPrecedents(req, res, url, pathname, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const raw = pathname.slice(`${PREFIX}/api/decisions/`.length, pathname.length - '/precedents'.length)
  let decisionId = ''
  try { decisionId = decodeURIComponent(raw) } catch { decisionId = raw }
  if (!decisionId) return json(res, 400, { detail: 'decision_id is required' })
  const listed = await postPython(sidecar, {
    op: 'list_decisions',
    cwd,
    args: { include_auto: true, limit: 200 },
  }).catch(() => null)
  const rows = listed && Array.isArray(listed.decisions) ? listed.decisions : []
  const seed = rows.find((row) => row && row.decision_id === decisionId) || {}
  const result = await postPython(sidecar, {
    op: 'find_precedents',
    cwd,
    args: {
      scenario: seed.scenario || seed.outcome || decisionId,
      category: seed.category || '',
      exclude_id: decisionId,
      max_results: 10,
    },
  }).catch(() => null)
  const precedents = result && Array.isArray(result.precedents) ? result.precedents : []
  return json(res, 200, precedents)
}

async function serveSkosSchemes(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const result = await postPython(sidecar, { op: 'skos_schemes', cwd, args: {} }).catch(() => null)
  if (Array.isArray(result)) return json(res, 200, result)
  return json(res, 200, [])
}

async function serveVocabPatch(req, res, sidecar, writes, authorize) {
  let body
  try {
    body = await readJson(req)
  } catch {
    return json(res, 413, { ok: false, error: 'BODY_TOO_LARGE' })
  }
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const packed = packVocabPatch(body)
  if (packed.error) return json(res, 400, { ok: false, error: packed.error })
  const snap = sidecar.snapshot()
  if (!snap.ready || !snap.port) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, {
    op: 'upsert_workspace_vocab',
    cwd,
    args: packed.args,
  }).catch(() => null)
  if (!result || result.error) {
    return json(res, 400, { ok: false, error: (result && result.error) || 'VOCAB_WRITE_FAILED' })
  }
  if (writes) writes.mark(cwd, 'upsert_workspace_vocab')
  return json(res, 200, { ok: true, ...result })
}

function packVocabPatch(body) {
  const rows = Array.isArray(body && body.concepts)
    ? body.concepts
    : (body && (body.id || body.label) ? [body] : [])
  if (!rows.length) return { error: 'NO_CONCEPTS' }
  if (rows.length > 16) return { error: 'TOO_MANY' }
  const concepts = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    if (isVocabRow(row)) return { error: 'NOT_A_KIND' }
    const id = conceptIdOf(row)
    const label = String(row.label || row.kind || row['型'] || '').trim()
    if (!id && !label) continue
    const concept = { id: id || label, label: label || id }
    if (Array.isArray(row.fields)) concept.fields = row.fields
    if (Array.isArray(row.can)) concept.can = row.can
    if (row.resource != null) concept.resource = String(row.resource)
    if (row.ticketField != null) concept.ticketField = String(row.ticketField)
    if (Array.isArray(row.clues)) concept.clues = row.clues
    if (row.catalogVersion != null) concept.catalogVersion = String(row.catalogVersion)
    if (Array.isArray(row.relations)) concept.relations = row.relations
    concepts.push(concept)
  }
  if (!concepts.length) return { error: 'NO_CONCEPTS' }
  const args = { concepts, replace_empty: true }
  const name = String((body && body.name) || '').trim()
  if (name) args.name = name
  return { args }
}

function isVocabRow(row) {
  const label = String((row && (row.label || row.kind || row['型'])) || '').trim()
  if (label === '金额' || label === '单号' || /(单行|明细行)$/.test(label)) return true
  if (Array.isArray(row && row.fields) && row.fields.some((item) => String(item || '').trim() === '金额')) return true
  for (const key of ['ticket', '单号', 'amount', '金额']) {
    if (String((row && row[key]) || '').trim()) return true
  }
  return false
}

function conceptIdOf(row) {
  let raw = String((row && (row.id || row.uri)) || '').trim()
  if (raw.includes('#')) raw = raw.slice(raw.lastIndexOf('#') + 1)
  return raw
}

function flattenSkos(nodes, out = []) {
  for (const row of Array.isArray(nodes) ? nodes : []) {
    if (!row || typeof row !== 'object') continue
    out.push({
      uri: String(row.uri || ''),
      pref_label: String(row.pref_label || row.label || ''),
      label: String(row.pref_label || row.label || ''),
      scheme_uri: String(row.scheme_uri || ''),
      fields: Array.isArray(row.fields) ? row.fields : [],
      can: Array.isArray(row.can) ? row.can : [],
    })
    flattenSkos(row.children, out)
  }
  return out
}

async function serveSkosConcepts(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const scheme = url.searchParams.get('scheme') || ''
  const result = await postPython(sidecar, { op: 'skos_hierarchy', cwd, args: { scheme } }).catch(() => null)
  return json(res, 200, flattenSkos(result))
}

async function serveSkosHierarchy(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const scheme = url.searchParams.get('scheme') || ''
  const result = await postPython(sidecar, { op: 'skos_hierarchy', cwd, args: { scheme } }).catch(() => null)
  if (Array.isArray(result)) return json(res, 200, result)
  return json(res, 200, [])
}

async function serveSkosConcept(req, res, url, pathname, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const encoded = pathname.slice(`${PREFIX}/api/ontology/skos/concept/`.length)
  let uri = ''
  try { uri = decodeURIComponent(encoded) } catch { uri = encoded }
  const result = await postPython(sidecar, { op: 'skos_concept', cwd, args: { uri } }).catch(() => null)
  if (!result || result.error) return json(res, 404, { detail: 'Concept not found' })
  return json(res, 200, result)
}

async function serveEnrichDedup(req, res, sidecar, authorize) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const threshold = body.threshold
  const result = await postPython(sidecar, { op: 'enrich_dedup', cwd, args: { threshold } }).catch(() => null)
  if (!result || result.error) {
    return json(res, 200, { duplicates: [], total_flagged: 0, detail: result && result.error ? result.error : 'DEDUP_FAILED' })
  }
  return json(res, 200, {
    duplicates: Array.isArray(result.duplicates) ? result.duplicates : [],
    total_flagged: Number(result.total_flagged || 0),
    scanned: Number(result.scanned || 0),
    compared: Number(result.compared || 0),
    threshold: result.threshold,
  })
}

async function serveTemporalBounds(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const result = await postPython(sidecar, { op: 'temporal_bounds', cwd, args: {} }).catch(() => null)
  if (!result || result.error) return json(res, 200, { min: null, max: null, count: 0, empty: true })
  return json(res, 200, result)
}

async function serveTemporalSnapshot(req, res, url, sidecar, authorize) {
  const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const at = url.searchParams.get('at') || ''
  const result = await postPython(sidecar, { op: 'temporal_snapshot', cwd, args: { at } }).catch(() => null)
  if (!result || result.error) return json(res, 200, { active_node_ids: [], active_node_count: 0, at })
  return json(res, 200, result)
}

async function serveGraphNodes(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, {
    op: 'list_graph_nodes',
    cwd,
    args: {
      type: url.searchParams.get('type') || '',
      search: url.searchParams.get('search') || url.searchParams.get('q') || '',
      skip: url.searchParams.get('skip') || 0,
      limit: url.searchParams.get('limit') || 100,
      cursor: url.searchParams.get('cursor') || '',
    },
  }).catch(() => null)
  if (!result || result.error) return json(res, 502, { ok: false, error: 'NODES_FAILED' })
  return json(res, 200, cleanGraphPayload(result))
}

async function serveGraphEdges(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, {
    op: 'list_graph_edges',
    cwd,
    args: {
      type: url.searchParams.get('type') || '',
      source: url.searchParams.get('source') || '',
      target: url.searchParams.get('target') || '',
      skip: url.searchParams.get('skip') || 0,
      limit: url.searchParams.get('limit') || 100,
      cursor: url.searchParams.get('cursor') || '',
    },
  }).catch(() => null)
  if (!result || result.error) return json(res, 502, { ok: false, error: 'EDGES_FAILED' })
  return json(res, 200, result)
}

async function serveGraphStats(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, { op: 'graph_stats', cwd, args: {} }).catch(() => null)
  if (!result || result.error) return json(res, 502, { ok: false, error: 'STATS_FAILED' })
  return json(res, 200, result)
}

async function serveWorkspaceCoverage(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, { op: 'workspace_coverage', cwd, args: {} }).catch(() => null)
  if (!result || result.error) return json(res, 502, { ok: false, error: 'COVERAGE_FAILED' })
  return json(res, 200, result)
}

function ontologyVersionsFile(cwd) {
  let root = String(cwd || '')
  try { root = realpathSync(root) } catch { /* keep */ }
  return join(root, '.dsh', 'semantic-os', 'ontology-versions.json')
}

async function readOntologyVersions(cwd) {
  try {
    const raw = JSON.parse(await readFile(ontologyVersionsFile(cwd), 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

async function writeOntologyVersions(cwd, packed) {
  const dest = ontologyVersionsFile(cwd)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, JSON.stringify(packed, null, 2), 'utf8')
}

async function serveOntologyVersionList(req, res, url, pathname, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  let rest = pathname.slice(`${PREFIX}/api/ontology/versions/`.length)
  if (rest.endsWith('/compare')) rest = rest.slice(0, -'/compare'.length)
  const uri = decodeURIComponent(String(rest || ''))
  if (!sidecar.snapshot().ready) {
    const packed = await readOntologyVersions(cwd)
    const rows = (uri && packed[uri]) || []
    return json(res, 200, Array.isArray(rows) ? rows : [])
  }
  const result = await postPython(sidecar, { op: 'list_ontology_versions', cwd, args: { uri } }).catch(() => null)
  if (!Array.isArray(result)) return json(res, 502, { error: 'LIST_FAILED' })
  return json(res, 200, result)
}

async function serveOntologyVersionCreate(req, res, sidecar, authorize) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const args = { ...body }
  if (!String(args.uri || args.ontology_uri || '').trim()) {
    const registry = await postPython(sidecar, { op: 'ontology_registry', cwd, args: {} }).catch(() => [])
    const rows = Array.isArray(registry) ? registry : []
    args.uri = String((rows[0] && rows[0].uri) || '').trim()
  }
  const result = await postPython(sidecar, { op: 'create_ontology_version', cwd, args }).catch(() => null)
  if (!result) return json(res, 502, { ok: false, error: 'VERSION_FAILED' })
  if (result.error) return json(res, 200, result)
  return json(res, 200, result)
}

async function serveOntologyVersionCompare(req, res, sidecar, authorize, pathname) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  let rest = String(pathname || '').slice(`${PREFIX}/api/ontology/versions/`.length)
  if (rest.endsWith('/compare')) rest = rest.slice(0, -'/compare'.length)
  const uri = decodeURIComponent(String(rest || body.uri || body.ontology_uri || ''))
  const result = await postPython(sidecar, {
    op: 'compare_ontology_versions',
    cwd,
    args: { ...body, uri },
  }).catch(() => null)
  if (!result) return json(res, 502, { ok: false, error: 'COMPARE_FAILED' })
  return json(res, 200, result)
}

async function serveOntologyPack(req, res, sidecar, authorize, op) {
  let queryCwd = ''
  try {
    queryCwd = new URL(req.url || '/', 'http://dsh.local').searchParams.get('cwd') || ''
  } catch {
    queryCwd = ''
  }
  const cwd = header(req.headers, 'x-dsh-cwd') || queryCwd || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, { op, cwd, args: {} }).catch(() => null)
  if (!result) return json(res, 502, { ok: false, error: 'PACK_FAILED' })
  if (result.error === 'EXTRA_MISSING') return json(res, 200, { ok: false, error: 'EXTRA_MISSING', detail: result.detail || '' })
  if (result.error) return json(res, 400, result)
  return json(res, 200, { ok: true, ...result })
}

async function serveShaclSafe(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const path = String(url.pathname || '')
  if (path.endsWith('/generate') && req.method === 'POST') {
    const body = await readJson(req)
    const result = await postPython(sidecar, {
      op: 'generate_shacl',
      cwd,
      args: { uri: body.uri || url.searchParams.get('uri') || '' },
    }).catch(() => null)
    if (!result) return json(res, 502, { ok: false, error: 'SHACL_FAILED', shapes: [], shape_count: 0 })
    return json(res, 200, result)
  }
  const result = await postPython(sidecar, { op: 'shacl_report', cwd, args: {} }).catch(() => null)
  if (!result) return json(res, 502, { ok: false, error: 'SHACL_FAILED', shapes: [], shape_count: 0 })
  return json(res, 200, result)
}

async function serveOwnedApi(req, res, url, pathname, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const rest = pathname.slice(`${PREFIX}/api/`.length)
  if (rest === 'graph/path' && req.method === 'GET') {
    const result = await postPython(sidecar, {
      op: 'graph_path',
      cwd,
      args: { source: url.searchParams.get('source') || '', target: url.searchParams.get('target') || '' },
    }).catch(() => null)
    return json(res, 200, result || { path: [], edges: [] })
  }
  if ((rest === 'graph/semantic-neighborhood' || rest === 'graph/neighborhood') && req.method === 'GET') {
    const result = await postPython(sidecar, {
      op: 'graph_neighborhood',
      cwd,
      args: { node_id: url.searchParams.get('node_id') || url.searchParams.get('id') || '', hops: url.searchParams.get('hops') || 1 },
    }).catch(() => null)
    return json(res, 200, result || { nodes: [], edges: [] })
  }
  if ((rest === 'provenance' || rest.startsWith('provenance/')) && req.method === 'GET') {
    const id = url.searchParams.get('node_id') || url.searchParams.get('id') || ''
    const result = await postPython(sidecar, { op: 'lineage', cwd, args: { id } }).catch(() => null)
    return json(res, 200, result || { ok: false, id, hops: [] })
  }
  if (rest === 'enrich/links' && (req.method === 'GET' || req.method === 'POST')) {
    return json(res, 200, { links: [], results: [], empty: true, detail: '没有标记对' })
  }
  if (rest === 'enrich/merge' && req.method === 'POST') {
    return json(res, 400, { ok: false, error: 'CONFIRM_REQUIRED' })
  }
  if (req.method === 'GET' && rest.startsWith('ontology/')) {
    if (rest === 'ontology/proposals' || rest.startsWith('ontology/proposals/')) return json(res, 200, [])
    if (rest.startsWith('ontology/versions/')) return json(res, 200, [])
    if (rest.startsWith('ontology/entity/')) {
      const uri = decodeURIComponent(rest.slice('ontology/entity/'.length))
      return json(res, 200, {
        uri,
        label: uri,
        type: '',
        entity_type: '',
        superclasses: [],
        subclasses: [],
        domain: [],
        range: [],
        instance_count: 0,
      })
    }
    return json(res, 200, [])
  }
  return json(res, 501, { ok: false, error: 'NO_EXPLORER', path: rest })
}

async function serveOntologyHealth(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  const uri = url.searchParams.get('uri') || ''
  const report = sidecar.snapshot().ready
    ? await postPython(sidecar, { op: 'shacl_report', cwd, args: { uri } }).catch(() => null)
    : null
  const ok = Boolean(report && report.ok !== false && !report.error)
  return json(res, 200, {
    uri,
    name: uri,
    total_score: ok ? 100 : 60,
    dimensions: [{
      key: 'shacl',
      label: '规则',
      score: ok ? 100 : 60,
      status: ok ? 'ok' : 'warning',
      detail: (report && (report.detail || report.error)) || '工作图规则检查',
    }],
    issues: [],
    generated_at: new Date().toISOString(),
  })
}

async function serveAlignmentsList(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  const result = await postPython(sidecar, {
    op: 'list_alignments',
    cwd,
    args: { uri: url.searchParams.get('uri') || '' },
  }).catch(() => null)
  return json(res, 200, Array.isArray(result) ? result : [])
}

async function serveAlignmentSave(req, res, sidecar, authorize) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  const result = await postPython(sidecar, { op: 'save_alignment', cwd, args: body }).catch(() => null)
  if (!result || result.error) return json(res, 400, { ok: false, error: (result && result.error) || 'SAVE_FAILED' })
  return json(res, 200, result)
}

async function serveAlignmentDelete(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  const result = await postPython(sidecar, {
    op: 'delete_alignment',
    cwd,
    args: { id: url.searchParams.get('id') || '' },
  }).catch(() => null)
  if (!result || result.error) return json(res, 400, { ok: false, error: (result && result.error) || 'NOT_FOUND' })
  return json(res, 200, result)
}

async function serveAlignmentSuggest(req, res, sidecar, authorize) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  const result = await postPython(sidecar, { op: 'suggest_alignments', cwd, args: body }).catch(() => null)
  return json(res, 200, Array.isArray(result) ? result : [])
}

async function serveOntologySearch(req, res, url, sidecar, authorize) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  const result = await postPython(sidecar, {
    op: 'ontology_search',
    cwd,
    args: { q: url.searchParams.get('q') || url.searchParams.get('query') || '' },
  }).catch(() => null)
  return json(res, 200, Array.isArray(result) ? result : [])
}

async function serveSparql(req, res, sidecar, authorize) {
  const body = await readJson(req, 256 * 1024)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  const result = await postPython(sidecar, {
    op: 'sparql',
    cwd,
    args: { query: body.query || body.q || '' },
  }).catch(() => null)
  return json(res, 200, packSparqlTable(result || { error: 'SPARQL_FAILED', head: { vars: [] }, results: { bindings: [] } }))
}

function packSparqlTable(result) {
  if (!result || typeof result !== 'object') return result
  if (Array.isArray(result.columns) && Array.isArray(result.rows)) return result
  const vars = result.head && Array.isArray(result.head.vars) ? result.head.vars : []
  const bindings = result.results && Array.isArray(result.results.bindings) ? result.results.bindings : []
  const rows = bindings.map((row) => {
    const out = {}
    for (const key of vars) {
      const cell = row && row[key]
      out[key] = cell && cell.value != null ? String(cell.value) : ''
    }
    return out
  })
  return { ...result, columns: vars, rows }
}

async function serveApiExport(req, res, sidecar, authorize) {
  const body = await readJson(req, 8 * 1024 * 1024)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!sidecar.snapshot().ready) return json(res, 503, { ok: false, error: 'NOT_READY' })
  let format = String(body.format || 'json').toLowerCase()
  if (format === 'ttl' || format === 'turtle') format = 'rdf'
  const result = await postPython(sidecar, { op: 'export_graph', cwd, args: { format } }).catch(() => null)
  if (!result || result.error) return json(res, 400, { ok: false, error: (result && result.error) || 'EXPORT_FAILED', detail: result && result.detail })
  const data = Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result
  const text = typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`
  const ext = format === 'rdf' ? 'ttl' : format
  const types = { json: 'application/json; charset=utf-8', csv: 'text/csv; charset=utf-8', ttl: 'text/turtle; charset=utf-8' }
  res.writeHead(200, {
    'content-type': types[ext] || 'application/octet-stream',
    'content-disposition': `attachment; filename="graph.${ext}"`,
  })
  res.end(text)
}

async function serveApiImport(req, res, sidecar, writes, authorize) {
  const packed = await readUpload(req)
  if (packed.error) return json(res, packed.status || 400, { ok: false, error: packed.error, detail: packed.detail })
  const cwd = packed.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const name = String(packed.filename || '')
  const ext = name.toLowerCase().split('.').pop()
  if (ext !== 'json' && ext !== 'csv') return json(res, 400, { ok: false, error: 'REJECT_FORMAT' })
  const result = await postPython(sidecar, {
    op: 'import_graph',
    cwd,
    args: { format: ext, data: packed.data, confirm: true },
  }).catch(() => null)
  if (!result || result.error) {
    return json(res, 400, { ok: false, error: (result && result.error) || 'IMPORT_FAILED', detail: result && result.detail })
  }
  if (writes) writes.mark(cwd, 'import')
  return json(res, 200, {
    ok: true,
    nodes_imported: result.nodes_added || result.node_count || 0,
    edges_imported: result.edges_added || result.edge_count || 0,
  })
}

async function serveFind(req, res, sidecar, authorize, opts) {
  const body = await readJson(req)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const q = String(body.query || body.q || '').trim()
  if (!q) return json(res, 200, { ok: true, query: q, items: [], semanticStatus: 'idle' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD', query: q, items: [], semanticStatus: 'unavailable' })
  const snap = sidecar.snapshot()
  if (!snap.ready) {
    return json(res, 200, { ok: true, query: q, items: [], semanticStatus: 'unavailable', error: 'NOT_READY' })
  }
  const across = body.across_bridges === undefined ? true : Boolean(body.across_bridges)
  const date = String(body.date || body.at || '').trim()
  if (isSessionTailQuery(q)) {
    const clock = clockEmptyReason(date)
    return json(res, 200, {
      ok: true,
      query: q,
      items: [],
      semanticStatus: 'empty',
      excerpts: [],
      excerptStatus: 'empty',
      excerptEmptyReason: clock || '这一场没有摘录',
      semanticEmptyReason: clock || '图里没有',
      date,
      via: 'local',
      bridge_hits: 0,
    })
  }
  const searchArgs = { q, query: q, across_bridges: across, limit: 20, date }
  const own = await postPython(sidecar, { op: 'search_text', cwd, args: searchArgs }).catch(() => null)
  if (!own || own.error) {
    return json(res, 200, {
      ok: true,
      query: q,
      items: [],
      semanticStatus: 'unavailable',
      error: (own && own.error) || 'SEARCH_FAILED',
    })
  }
  let merged = own
  let grouped = groupSemanticHits(merged, { query: q, limit: 20 })
  if (opts && typeof opts.getPersistence === 'function') {
    try {
      const vec = await postPython(sidecar, { op: 'search_passages', cwd, args: { query: q, limit: 8 } }).catch(() => null)
      merged = await mergePassageHits(merged, {
        rows: (vec && vec.results) || [],
        query: q,
        cwd,
        args: searchArgs,
        getPersistence: opts.getPersistence,
      })
      grouped = groupSemanticHits(merged, { query: q, limit: 20 })
    } catch { /* ranked python hits still stand */ }
  }
  const excerpts = excerptsFromFind(grouped, merged, q)
  const clock = clockEmptyReason(date)
  const packed = {
    ok: true,
    ...grouped,
    excerpts,
    excerptStatus: excerpts.length ? 'ready' : 'empty',
    excerptEmptyReason: excerpts.length ? '' : (clock || '正文没搜到'),
    semanticEmptyReason: grouped.semanticStatus === 'empty' || grouped.semanticStatus === 'unavailable' ? (clock || '图里没有') : '',
    date,
    via: merged.via || 'local',
    bridge_hits: merged.bridge_hits || 0,
  }
  const bytes = Buffer.byteLength(JSON.stringify(packed), 'utf8')
  void recordUsage({
    kind: 'search',
    bytes,
    context: estimateTokens(JSON.stringify((packed.items || []).map((row) => row && row.snippet))),
    via: packed.via,
  }).catch(() => undefined)
  return json(res, 200, packed)
}

async function serveGraphSearch(req, res, sidecar, authorize) {
  const body = await readJson(req)
  let queryCwd = ''
  try {
    queryCwd = new URL(req.url || '/', 'http://dsh.local').searchParams.get('cwd') || ''
  } catch {
    queryCwd = ''
  }
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || queryCwd || ''
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const q = String(body.query || '').trim()
  const limit = Number.isFinite(Number(body.limit)) && Number(body.limit) > 0 ? Number(body.limit) : 8
  if (!q) return json(res, 200, { results: [], total: 0, query: q })
  const own = await postPython(sidecar, {
    op: 'graph_label_search',
    cwd,
    args: { q, query: q, limit },
  }).catch(() => null)
  const ownHits = own && Array.isArray(own.results) ? own.results : []
  const seen = new Set()
  const merged = []
  for (const row of ownHits) {
    const id = String((row && row.node && row.node.id) || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(row)
  }
  const sliced = merged.slice(0, limit)
  return json(res, 200, {
    results: sliced,
    total: sliced.length,
    query: q,
    empty: sliced.length === 0,
    detail: sliced.length ? '' : '图上没有这个点。',
  })
}

async function serveNodes(req, res, url, sidecar) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
  const snap = sidecar.snapshot()
  if (!snap.ready || !snap.port) return json(res, 503, { ok: false, error: 'NOT_READY' })
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  try {
    if (q) {
      const own = await postPython(sidecar, {
        op: 'search_text',
        cwd,
        args: { q, limit: 20, across_bridges: false },
      }).catch(() => null)
      const ownHits = own && Array.isArray(own.results) ? own.results : []
      const seen = new Set()
      const merged = []
      for (const row of ownHits) {
        const id = row && row.node && row.node.id
        if (!id || seen.has(id)) continue
        seen.add(id)
        merged.push(row)
      }
      return json(res, 200, { results: merged, total: Number(own && own.total) || merged.length, query: q })
    }
    const listed = await sidecarJson(sidecar, {
      method: 'GET',
      path: '/api/graph/nodes',
      cwd,
    })
    if (!listed.ok) return json(res, listed.status || 502, { ok: false, error: 'NODES_FAILED' })
    return json(res, 200, cleanGraphPayload(listed.body))
  } catch (error) {
    return json(res, 502, { ok: false, error: 'NODES_FAILED', detail: error instanceof Error ? error.message : String(error) })
  }
}

async function serveProbe(res, sidecar, getConfig) {
  await loadOverlay()
  const snap = sidecar.snapshot()
  const cfg = mergeConfig(getConfig())
  const probes = []
  if (!snap.ready || !snap.port) {
    for (const [name, method, path] of PROBES) {
      void method
      probes.push({ name, path, status: 'not-ready' })
    }
  } else {
    const settled = await Promise.all(PROBES.map(async ([name, method, path]) => {
      try {
        const body = method === 'POST' ? (name === 'sparql' ? { query: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1' } : {}) : undefined
        const result = await sidecarJson(sidecar, { method, path, cwd: process.cwd(), body, timeoutMs: 2500 })
        return { name, path, status: result.status || 0 }
      } catch {
        return { name, path, status: 0 }
      }
    }))
    probes.push(...settled)
  }
  let kgPath = ''
  return json(res, 200, {
    ok: true,
    ready: Boolean(snap.ready),
    reason: snap.reason || null,
    version: snap.version || '',
    python: snap.python || '',
    host: '127.0.0.1',
    port: snap.port || null,
    kgPath,
    extraExplorer: snap.reason !== 'extra_missing',
    extraShacl: true,
    ingestStrategy: cfg.ingestStrategy || 'mtime',
    sessionEndRecord: Boolean(cfg.sessionEndRecord),
    hardGates: ['not-ready', 'no-cwd', 'decisions-rest-write', 'export-outside-cwd'],
    bridgeProtocol: BRIDGE_PROTOCOL,
    pluginVersion: PLUGIN_VERSION,
    probes,
    config: cfg,
    doctor: String(snap.doctor || '').replace(/sk-[A-Za-z0-9_\-]*[….]?/g, '[key]'),
  })
}

function serveCliHelp(res, sidecar) {
  const snap = sidecar.snapshot()
  const python = snap.python || process.env.DSH_SEMANTICA_PYTHON || ''
  const argv = python ? [python, '-c', "import shutil,sys; p=shutil.which('semantica'); sys.exit(0 if p else 2)"] : []
  return new Promise((resolve) => {
    const cmd = python || (process.platform === 'win32' ? 'py' : 'python3')
    const extra = python ? [] : (process.platform === 'win32' ? ['-3'] : [])
    const proc = spawn(cmd, [...extra, '-c', "import shutil; print(shutil.which('semantica') or '')"], {
      windowsHide: true,
    })
    let out = ''
    proc.stdout?.on('data', (c) => { out += String(c) })
    proc.on('error', () => {
      json(res, 200, { ok: false, help: '', error: 'cli_missing' })
      resolve(undefined)
    })
    proc.on('exit', () => {
      const bin = out.trim()
      if (!bin) {
        json(res, 200, { ok: false, help: '', error: 'cli_missing' })
        resolve(undefined)
        return
      }
      const help = spawn(bin, ['--help'], { windowsHide: true })
      let text = ''
      help.stdout?.on('data', (c) => { text += String(c) })
      help.stderr?.on('data', (c) => { text += String(c) })
      help.on('exit', (code) => {
        json(res, 200, { ok: code === 0, help: text.slice(0, 4000), exit: code })
        resolve(undefined)
      })
    })
  })
}

async function serveImport(req, res, sidecar, writes, authorize) {
  const body = await readJson(req, 8 * 1024 * 1024)
  const cwd = body.cwd || ''
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const name = String(body.filename || body.name || '')
  const ext = name.toLowerCase().split('.').pop()
  if (ext !== 'json' && ext !== 'csv') {
    return json(res, 400, { ok: false, error: 'REJECT_FORMAT' })
  }
  const confirm = Boolean(body.confirm)
  const result = await postPython(sidecar, {
    op: 'import_graph',
    cwd,
    args: { format: ext, data: body.data, confirm },
  })
  if (result && result.error === 'REJECT_FORMAT') return json(res, 400, { ok: false, error: 'REJECT_FORMAT' })
  if (result && result.error === 'PREVIEW_EMPTY') {
    return json(res, 400, { ok: false, error: 'PREVIEW_EMPTY', preview: true, node_count: 0, edge_count: 0, labels: [] })
  }
  if (result && result.restored) return json(res, 400, { ok: false, error: 'RESTORED', restored: true })
  if (result && result.error) return json(res, 400, { ok: false, error: result.error, detail: result.detail })
  if (result && result.preview && !confirm) {
    return json(res, 200, {
      ok: true,
      preview: true,
      node_count: result.node_count || 0,
      edge_count: result.edge_count || 0,
      labels: result.labels || [],
    })
  }
  if (writes && cwd && confirm) writes.mark(cwd, 'import')
  return json(res, 200, {
    ok: true,
    preview: false,
    nodes_added: result && result.nodes_added || 0,
    edges_added: result && result.edges_added || 0,
    labels: result && result.labels || [],
  })
}


async function serveLineage(req, res, url, sidecar) {
  const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
  const id = String(
    url.searchParams.get('id')
    || url.searchParams.get('entity')
    || url.searchParams.get('node')
    || '',
  ).trim()
  if (!id) return json(res, 400, { ok: false, error: 'NO_PATH', id: '', hops: [], detail: '没有编号。' })
  try {
    const snap = sidecar.snapshot()
    if (!snap.ready || !snap.port) return json(res, 503, { ok: false, error: 'NOT_READY', id, hops: [] })
    if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD', id, hops: [] })

    try {
      const walked = await postPython(sidecar, { op: 'lineage', cwd, args: { id } })
      if (walked && walked.ok && (walked.path || (walked.hops && walked.hops.length))) {
        const rawPath = String(walked.path || '')
        const path = rawPath.startsWith('session:') ? rawPath : (rawPath ? toRealStyle(cwd, rawPath) : '')
        return json(res, 200, {
          ok: true,
          id,
          path,
          source: walked.source || (path ? 'file' : 'graph'),
          hops: Array.isArray(walked.hops) ? walked.hops : [],
          detail: walked.detail || path || '这条是图里导入的点，没有文件出处。',
        })
      }
    } catch {
      /* fall through to official provenance */
    }

    let extracted = ''
    let hops = []
    try {
      const qs = new URLSearchParams({ node_id: id, id, entity: id, node: id })
      const prov = await sidecarJson(sidecar, {
        method: 'GET',
        path: `/api/provenance?${qs.toString()}`,
        cwd,
      })
      const body = prov && prov.body
      hops = hopsFromProvenance(body)
      extracted = pathFromHops(hops) || extractPathField(body, id)
    } catch {
      extracted = ''
    }

    if (!extracted) {
      try {
        const node = await sidecarJson(sidecar, {
          method: 'GET',
          path: `/api/graph/node/${encodeURIComponent(id)}`,
          cwd,
        })
        extracted = extractPathField(node && node.body, id)
      } catch {
        extracted = ''
      }
    }

    if (!extracted) {
      try {
        const listed = await sidecarJson(sidecar, {
          method: 'GET',
          path: `/api/graph/nodes?search=${encodeURIComponent(id)}`,
          cwd,
        })
        const nodes = listed && listed.body && (listed.body.nodes || listed.body)
        const rows = Array.isArray(nodes) ? nodes : []
        const hit = rows.find((row) => row && (row.id === id || row.node_id === id)) || rows[0]
        extracted = extractPathField(hit, id)
      } catch {
        extracted = ''
      }
    }

    const path = extracted ? toRealStyle(cwd, extracted) : ''
    if (path) {
      return json(res, 200, { ok: true, id, path, source: 'file', hops, detail: path })
    }
    if (hops.length) {
      const detail = '这条是图里导入的点，没有文件出处。'
      return json(res, 200, { ok: true, id, path: '', source: 'graph', hops, detail })
    }
    return json(res, 200, { ok: false, error: 'NO_PATH', id, hops: [], detail: '没有血缘。' })
  } catch {
    return json(res, 200, { ok: false, error: 'NO_PATH', id, hops: [], detail: '没有血缘。' })
  }
}

function hopsFromProvenance(body) {
  const nodes = body && Array.isArray(body.nodes) ? body.nodes : []
  return nodes.map((node) => ({
    id: node && node.id != null ? String(node.id) : '',
    label: node && node.label != null ? String(node.label) : '',
    type: node && node.prov_type != null ? String(node.prov_type) : '',
    source_document: node && node.source_document ? String(node.source_document) : '',
  })).filter((row) => row.id)
}

function pathFromHops(hops) {
  for (const row of hops) {
    if (row.source_document && looksLikePath(row.source_document)) return row.source_document
  }
  return ''
}

const PATH_KEYS = ['path', 'realpath', 'file', 'uri', 'source_document', 'source_location', 'source']

function looksLikePath(value) {
  const s = String(value || '').trim()
  if (!s) return false
  if (s.startsWith('session:')) return true
  if (s.startsWith('file:')) return true
  if (s.includes('/') || s.includes('\\')) return true
  if (/^[A-Za-z]:[\\/]/.test(s)) return true
  return false
}

function extractFromObj(obj) {
  if (!obj || typeof obj !== 'object') return ''
  const bags = [obj, obj.metadata, obj.properties]
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue
    for (const key of PATH_KEYS) {
      const v = bag[key]
      if (typeof v !== 'string' || !v.trim()) continue
      if (key === 'source' && !looksLikePath(v)) continue
      if (key === 'uri' && !looksLikePath(v) && !v.startsWith('file:')) continue
      return v.trim()
    }
  }
  return ''
}

function extractPathField(body, id) {
  if (!body) return ''
  const nodes = Array.isArray(body.nodes) ? body.nodes : []
  const self = nodes.find((n) => n && (n.id === id || n.node_id === id))
  if (self) {
    const p = extractFromObj(self)
    if (p) return p
  }
  for (const n of nodes) {
    const p = extractFromObj(n)
    if (p) return p
  }
  const direct = extractFromObj(body)
  if (direct) return direct
  if (body.lineage) {
    const nested = extractPathField(body.lineage, id)
    if (nested) return nested
  }
  return ''
}

function toRealStyle(cwd, raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  if (s.startsWith('session:')) return s
  if (s.startsWith('file://')) s = s.slice(7)
  else if (s.startsWith('file:')) s = s.slice(5)
  const abs = isAbsolute(s) ? resolve(s) : resolve(cwd || '.', s)
  try { return realpathSync(abs) } catch { return abs }
}

function destOutsideCwd(cwd, dest) {
  let root
  try { root = realpathSync(cwd) } catch { root = resolve(cwd) }
  const abs = resolve(cwd, dest)
  let destReal = abs
  try {
    destReal = realpathSync(abs)
  } catch {
    try {
      destReal = resolve(realpathSync(dirname(abs)), basename(abs))
    } catch {
      destReal = abs
    }
  }
  const rel = relative(root, destReal)
  return rel.startsWith('..') || isAbsolute(rel)
}

async function serveExport(req, res, sidecar, writes, authorize) {
  const body = await readJson(req, 8 * 1024 * 1024)
  const cwd = body.cwd || header(req.headers, 'x-dsh-cwd') || ''
  const format = String(body.format || '').toLowerCase()
  if (format !== 'json' && format !== 'csv') {
    return json(res, 400, { ok: false, error: 'REJECT_FORMAT' })
  }
  if (!cwd) return json(res, 400, { ok: false, error: 'NO_CWD' })
  if (!(await authorize(cwd))) return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
  const dest = body.dest == null ? '' : String(body.dest).trim()
  if (dest && destOutsideCwd(cwd, dest) && body.confirm !== true) {
    return json(res, 400, { ok: false, error: 'OUTSIDE_CWD' })
  }
  const result = await postPython(sidecar, {
    op: 'export_graph',
    cwd,
    args: { format },
  })
  if (result && result.error === 'REJECT_FORMAT') return json(res, 400, { ok: false, error: 'REJECT_FORMAT' })
  if (result && result.error) return json(res, 400, { ok: false, error: result.error })
  const data = result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result
  if (!dest) {
    return json(res, 200, { ok: true, format, data })
  }
  const abs = resolve(cwd, dest)
  await mkdir(dirname(abs), { recursive: true })
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  await writeFile(abs, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
  if (writes) writes.mark(cwd, 'export')
  return json(res, 200, { ok: true, format, dest: abs })
}

function sidecarJson(sidecar, { method, path, cwd, body, timeoutMs }) {
  const snap = sidecar.snapshot()
  const payload = body == null ? '' : JSON.stringify(body)
  const latin1 = isLatin1Header(cwd)
  let targetPath = path
  if (cwd && !latin1) {
    const joiner = String(path || '').includes('?') ? '&' : '?'
    targetPath = `${path}${joiner}cwd=${encodeURIComponent(cwd)}`
  }
  const wait = Number(timeoutMs)
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1',
      port: snap.port,
      path: targetPath,
      method,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(sidecar.getApiKey() ? { 'x-api-key': sidecar.getApiKey() } : {}),
        ...(cwd && latin1 ? { 'x-dsh-cwd': cwd } : {}),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let parsed = text
        try { parsed = JSON.parse(text) } catch { /* raw */ }
        resolve({ ok: (res.statusCode || 500) < 400, status: res.statusCode || 0, body: parsed })
      })
    })
    req.on('error', reject)
    if (Number.isFinite(wait) && wait > 0) {
      req.setTimeout(wait, () => {
        req.destroy()
        reject(new Error('SIDECAR_TIMEOUT'))
      })
    }
    if (payload) req.end(payload)
    else req.end()
  })
}

function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(buf.length),
  })
  res.end(buf)
}

function isLatin1Header(value) {
  const text = String(value || '')
  return Boolean(text) && !/[\r\n\t\x80-\uFFFF]/.test(text)
}

function asciiHeaderCwd(req) {
  const text = String(header(req && req.headers, 'x-dsh-cwd') || '').trim()
  return isLatin1Header(text) ? text : ''
}

function header(headers, name) {
  const key = String(name).toLowerCase()
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === key) return Array.isArray(v) ? v[0] : v
  }
  return undefined
}

function readRaw(req, max = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > max) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readUpload(req) {
  const type = String(header(req.headers, 'content-type') || '')
  const cwdHeader = header(req.headers, 'x-dsh-cwd') || ''
  if (type.includes('application/json')) {
    const body = await readJson(req, 8 * 1024 * 1024)
    return {
      cwd: body.cwd || cwdHeader,
      filename: body.filename || body.name || 'graph.json',
      data: body.data,
      confirm: body.confirm !== false,
    }
  }
  if (!type.includes('multipart/form-data')) return { error: 'REJECT_FORMAT', status: 400 }
  const boundHit = /boundary=([^;]+)/i.exec(type)
  if (!boundHit) return { error: 'REJECT_FORMAT', status: 400 }
  const boundary = boundHit[1].trim().replace(/^"|"$/g, '')
  let raw
  try {
    raw = await readRaw(req, 8 * 1024 * 1024)
  } catch {
    return { error: 'BODY_TOO_LARGE', status: 413 }
  }
  const text = raw.toString('utf8')
  const parts = text.split(`--${boundary}`)
  let filename = 'graph.json'
  let data = ''
  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue
    const nameHit = /name="([^"]+)"/i.exec(part)
    const fileHit = /filename="([^"]+)"/i.exec(part)
    const cut = part.indexOf('\r\n\r\n')
    if (cut < 0) continue
    let body = part.slice(cut + 4)
    if (body.endsWith('\r\n')) body = body.slice(0, -2)
    if (fileHit && (!nameHit || nameHit[1] === 'file')) {
      filename = fileHit[1]
      data = body
    }
  }
  if (!data) return { error: 'PREVIEW_EMPTY', status: 400 }
  return { cwd: cwdHeader, filename, data, confirm: true }
}

function readJson(req, max = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > max) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8') || '{}'
      try { resolve(JSON.parse(text)) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

export function createWriteLog() {
  /** @type {Map<string, { ts: number, op: string }>} */
  const map = new Map()
  /** @type {Map<string, Map<string, number>>} */
  const viewers = new Map()
  function keyOf(cwd) {
    let key = String(cwd || '')
    try { key = realpathSync(key) } catch { /* keep */ }
    return key
  }
  return {
    mark(cwd, op) {
      const key = keyOf(cwd)
      if (!key) return
      map.set(key, { ts: Date.now(), op: String(op || '') })
    },
    touch(cwd, sessionId) {
      const key = keyOf(cwd)
      const sid = String(sessionId || '')
      if (!key || !sid) return
      const bag = viewers.get(key) || new Map()
      bag.set(sid, Date.now())
      viewers.set(key, bag)
    },
    snapshot(cwd, sessionId) {
      const key = keyOf(cwd)
      const row = map.get(key) || { ts: 0, op: '' }
      const bag = viewers.get(key) || new Map()
      const now = Date.now()
      let live = 0
      for (const [id, ts] of bag) {
        if (now - ts > 12000) bag.delete(id)
        else live += 1
      }
      if (sessionId) {
        const sid = String(sessionId)
        if (sid && !bag.has(sid)) live += 1
      }
      return { ...row, sharedWrite: live > 1, viewers: live }
    },
  }
}
