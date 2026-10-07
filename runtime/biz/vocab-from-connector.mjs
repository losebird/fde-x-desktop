import { createHash } from 'node:crypto'
import {
  buildVocabFromNocoCollections,
  fetchNocoBaseCollections,
} from './adapters/nocobase-vocab.mjs'

const BATCH_SIZE = 16

function catalogVersionFrom(collections) {
  const hash = createHash('sha256')
  for (const row of collections) {
    hash.update(String((row && row.name) || ''))
    hash.update('\0')
  }
  return `schema:${hash.digest('hex').slice(0, 12)}`
}

/**
 * Generic entrypoint: a new connector install or BFF hook calls this after connect.
 *
 * @param {{
 *   workspace: string,
 *   dialect?: string,
 *   baseUrl?: string,
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 *   catalogVersion?: string,
 *   persistBatch: (batch: { name?: string, concepts: Record<string, unknown>[] }) => Promise<{ ok?: boolean, error?: string }>,
 * }} spec
 */
export async function generateWorkspaceVocabFromConnector(spec) {
  const workspace = String(spec.workspace || '').trim()
  if (!workspace.startsWith('/')) {
    return { ok: false, error: 'NO_CWD', hint: '工作区路径无效。' }
  }
  const dialect = String(spec.dialect || 'nocobase').trim() || 'nocobase'
  if (dialect !== 'nocobase' && dialect !== 'rest') {
    return { ok: false, error: 'UNSUPPORTED_DIALECT', hint: '当前仅支持 nocobase 系 schema 适配器。' }
  }
  if (typeof spec.persistBatch !== 'function') {
    return { ok: false, error: 'NO_PERSIST', hint: '缺少词表写入回调。' }
  }

  let collections = []
  if (dialect === 'nocobase') {
    const baseUrl = String(spec.baseUrl || '').trim()
    const token = String(spec.token || '').trim()
    if (!baseUrl || !token) {
      return { ok: false, error: 'NO_CONNECTOR', hint: '需要 baseUrl 与 token 才能从业务系统拉 schema。' }
    }
    const loaded = await fetchNocoBaseCollections({ baseUrl, token, fetchImpl: spec.fetchImpl })
    if (!loaded.ok) return loaded
    collections = loaded.collections
  } else {
    return { ok: false, error: 'UNSUPPORTED_DIALECT' }
  }

  if (!collections.length) {
    return {
      ok: true,
      workspace,
      concepts: 0,
      relations: [],
      batches: 0,
      catalogVersion: spec.catalogVersion || catalogVersionFrom([]),
      emptySchema: true,
    }
  }

  const version = String(spec.catalogVersion || catalogVersionFrom(collections)).trim()
  const built = buildVocabFromNocoCollections(collections, { catalogVersion: version })
  const connection = String(spec.connection || 'lookup').trim() || 'lookup'
  const concepts = built.concepts.map((row) => (row && typeof row === 'object' ? { ...row, connection } : row))
  const schemeName = `业务型 · ${version}`

  const persist = await persistConcepts(spec.persistBatch, schemeName, concepts)
  if (persist.ok === false) {
    return { ok: false, error: persist.error || 'VOCAB_WRITE_FAILED', batches: persist.batches }
  }

  return {
    ok: true,
    workspace,
    concepts: concepts.length,
    relations: built.relations,
    relationCount: built.relations.length,
    catalogVersion: version,
    batches: persist.batches,
    emptySchema: false,
    ...(persist.skipped.length ? { skipped: persist.skipped } : {}),
  }
}

export async function generateWorkspaceVocabFromKinds(spec) {
  const workspace = String(spec.workspace || '').trim()
  if (!workspace.startsWith('/')) {
    return { ok: false, error: 'NO_CWD', hint: '工作区路径无效。' }
  }
  if (typeof spec.persistBatch !== 'function') {
    return { ok: false, error: 'NO_PERSIST', hint: '缺少词表写入回调。' }
  }
  const connection = String(spec.connection || '').trim()
  if (!connection) return { ok: false, error: 'NO_CONNECTION', hint: '词表需要 connection' }
  const kinds = Array.isArray(spec.kinds) ? spec.kinds : []
  const concepts = kinds.map((row, index) => {
    if (typeof row === 'string') {
      const kind = row.trim()
      return kind ? { id: kind, kind, resource: kind, fields: [], can: ['现查'], connection } : null
    }
    if (!row || typeof row !== 'object') return null
    const kind = String(row.kind || row.name || '').trim()
    if (!kind) return null
    const resource = String(row.resource || kind).trim() || kind
    return {
      id: String(row.id || resource || `kind-${index}`),
      kind,
      resource,
      fields: Array.isArray(row.fields) ? row.fields : [],
      can: Array.isArray(row.can) ? row.can : ['现查'],
      connection,
      ...(row.ticketField ? { ticketField: row.ticketField } : {}),
      ...(row.fieldLabels ? { fieldLabels: row.fieldLabels } : {}),
      ...(row.relations ? { relations: row.relations } : {}),
    }
  }).filter(Boolean)
  if (!concepts.length) {
    return { ok: true, workspace, concepts: 0, batches: 0, emptySchema: true }
  }
  const persist = await persistConcepts(spec.persistBatch, `业务型 · ${connection}`, concepts)
  if (persist.ok === false) {
    return { ok: false, error: persist.error || 'VOCAB_WRITE_FAILED', batches: persist.batches }
  }
  return {
    ok: true,
    workspace,
    concepts: concepts.length,
    batches: persist.batches,
    emptySchema: false,
    ...(persist.skipped.length ? { skipped: persist.skipped } : {}),
  }
}

function isNotAKind(written) {
  const error = String((written && (written.error || written.code || written.hint)) || '')
  return /NOT_A_KIND/i.test(error)
}

function conceptSafeForKindGate(concept) {
  if (!concept || typeof concept !== 'object') return null
  const resource = String(concept.resource || '').trim()
  if (!resource) return null
  const fields = Array.isArray(concept.fields) ? concept.fields : []
  const keep = new Set()
  const ticketField = String(concept.ticketField || '').trim()
  if (ticketField) keep.add(ticketField)
  for (const rel of Array.isArray(concept.relations) ? concept.relations : []) {
    const field = String((rel && rel.field) || '').trim()
    if (field) keep.add(field)
  }
  if (!keep.size) return null
  const nextFields = fields.filter((item) => keep.has(String(item || '').trim()))
  if (nextFields.length === fields.length) return null
  return { ...concept, fields: nextFields }
}

async function writeBatch(persistBatch, schemeName, concepts) {
  try {
    const written = await persistBatch({
      name: schemeName,
      concepts,
    })
    if (written && written.ok === false) return written
    return { ok: true }
  } catch (error) {
    const hint = error instanceof Error ? error.message : String(error || 'VOCAB_WRITE_FAILED')
    const code = error && typeof error === 'object' ? String(error.code || error.error || '') : ''
    return { ok: false, error: code || 'VOCAB_WRITE_FAILED', hint }
  }
}

async function persistOne(persistBatch, schemeName, concept) {
  let written = await writeBatch(persistBatch, schemeName, [concept])
  if (written.ok !== false) return written
  if (!isNotAKind(written)) return written
  const safe = conceptSafeForKindGate(concept)
  if (!safe) return written
  return writeBatch(persistBatch, schemeName, [safe])
}

async function persistConcepts(persistBatch, schemeName, concepts) {
  const rows = Array.isArray(concepts) ? concepts : []
  let batches = 0
  const skipped = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE)
    const written = await writeBatch(persistBatch, schemeName, slice)
    batches += 1
    if (written.ok !== false) continue

    for (const concept of slice) {
      const one = await persistOne(persistBatch, schemeName, concept)
      batches += 1
      if (one.ok !== false) continue
      skipped.push({
        id: String((concept && concept.id) || ''),
        resource: String((concept && concept.resource) || ''),
        error: String(one.error || 'VOCAB_WRITE_FAILED'),
      })
    }
  }

  if (skipped.length && skipped.length === rows.length) {
    return { ok: false, error: skipped[0].error || 'VOCAB_WRITE_FAILED', batches, skipped }
  }
  return { ok: true, batches, skipped }
}

export { buildVocabFromNocoCollections, fetchNocoBaseCollections }
