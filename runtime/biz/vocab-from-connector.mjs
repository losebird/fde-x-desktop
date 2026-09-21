import { createHash } from 'node:crypto'
import {
  buildVocabFromNocoCollections,
  fetchNocoBaseCollections,
} from './adapters/nocobase-vocab.mjs'

const BATCH_SIZE = 16

/**
 * semantic-os `accept_kind` / `isVocabRow` treat these exact field tokens as a
 * data row, not a 型. A Noco collection with `resource` is still a kind; only
 * the persist payload drops those tokens so one amount column cannot abort the
 * rest of the catalog. Built concepts keep the schema titles.
 */
const KIND_GATE_ROW_FIELD_TOKENS = new Set(['金额', 'amount'])

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
  const concepts = built.concepts
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

function isNotAKind(written) {
  const error = String((written && (written.error || written.code || written.hint)) || '')
  return /NOT_A_KIND/i.test(error)
}

function conceptSafeForKindGate(concept) {
  if (!concept || typeof concept !== 'object') return null
  const resource = String(concept.resource || '').trim()
  if (!resource) return null
  const fields = Array.isArray(concept.fields) ? concept.fields : []
  const nextFields = fields.filter((item) => !KIND_GATE_ROW_FIELD_TOKENS.has(String(item || '').trim()))
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
