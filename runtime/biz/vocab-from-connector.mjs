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
  const concepts = built.concepts
  const schemeName = `业务型 · ${version}`

  let batches = 0
  for (let i = 0; i < concepts.length; i += BATCH_SIZE) {
    const slice = concepts.slice(i, i + BATCH_SIZE)
    const written = await spec.persistBatch({
      name: schemeName,
      concepts: slice,
    })
    if (written && written.ok === false) {
      return { ok: false, error: written.error || 'VOCAB_WRITE_FAILED', batches }
    }
    batches += 1
  }

  return {
    ok: true,
    workspace,
    concepts: concepts.length,
    relations: built.relations,
    relationCount: built.relations.length,
    catalogVersion: version,
    batches,
    emptySchema: false,
  }
}

export { buildVocabFromNocoCollections, fetchNocoBaseCollections }
