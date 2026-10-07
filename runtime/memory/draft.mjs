import { emit } from '../events.mjs'
import { upsertMemoryWriteLog } from '../db.mjs'
import { looksLikeJsonDump } from '../biz/session-origin-text.mjs'
import { loadOrigin } from '../routes/corpus.mjs'
import { asDraftCard, draftMemoryCardInsert } from './cards.mjs'
import { hostSourceOf, instanceOriginOf, originOfCard } from './identity.mjs'

let skipCount = 0

export function memoryWriterSkipCount() {
  return skipCount
}

function clip(text, max = 500) {
  const s = String(text || '').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

async function semanticPython(aiRuntime, op, args, cwd) {
  return aiRuntime.semanticOs('/python', { op, args, ...(cwd ? { cwd } : {}) })
}

async function indexPassage(deps, { cwd, id, text }) {
  if (!id || !deps.aiRuntime?.status?.().connected) return
  try {
    await semanticPython(deps.aiRuntime, 'index_passages', {
      rows: [{ id, text: clip(text, 500) }],
    }, cwd)
  } catch (error) {
    console.warn('memory_writer_index_failed', error)
  }
}

export function attachCardOrigin(card, originMap) {
  const id = String(card?.id || '')
  const fromMap = originMap instanceof Map ? originMap.get(id) : ''
  const origin = String(fromMap || originOfCard(card) || hostSourceOf(card?.source) || '')
  return origin ? { ...card, origin } : { ...card }
}

/**
 * FDE-X one write mouth. add_node 起草. Same cue same id.
 * Auto writers need an instance origin and readable cue text.
 */
export async function draftCard(deps, input = {}) {
  const cwd = String(input.cwd || input.workspaceCwd || '')
  const givenOrigin = String(input.origin || '').trim()
  const origin = instanceOriginOf(givenOrigin)
  const cause = input.cause === 'choice' ? 'choice' : 'correction'
  const auto = input.auto === true
  const given = String(input.label || [input.title, input.body].filter(Boolean).join('\n')).trim()
  if (auto && !origin) return { skipped: true, reason: 'not_an_instance' }
  if (!deps.aiRuntime?.status?.().connected) {
    skipCount += 1
    return { skipped: true, reason: 'semantic_down' }
  }

  let label = given
  let indexText = given
  if (origin) {
    try {
      const loaded = await loadOrigin({ db: deps.db, aiRuntime: deps.aiRuntime, cwd }, origin)
      const text = String(loaded.text || '').trim()
      const dump = looksLikeJsonDump(text)
      if (text && !dump) indexText = text
      if (!label) {
        if (!loaded.ok || !text || dump) return { skipped: true, reason: 'origin_unreadable' }
        const title = String(loaded.title || '').trim()
        label = title && !text.startsWith(title) ? `${title}\n${text}` : text
      } else if (auto && dump) {
        return { skipped: true, reason: 'origin_unreadable' }
      }
    } catch (error) {
      if (!label || auto) {
        console.warn('memory_origin_load_failed', origin, error)
        return { skipped: true, reason: 'origin_unreadable' }
      }
    }
  }
  if (!label) return { skipped: true, reason: 'empty' }
  if (auto && looksLikeJsonDump(label)) return { skipped: true, reason: 'origin_unreadable' }

  try {
    const insert = draftMemoryCardInsert(label, cause, {
      origin,
      auto,
      ...(input.sessionId ? { sessionId: String(input.sessionId) } : {}),
    })
    const drafted = await semanticPython(deps.aiRuntime, insert.op, insert.args, cwd)
    if (drafted && typeof drafted === 'object' && drafted.error) {
      return { ok: false, error: drafted }
    }
    const cardId = insert.args.id
    const duplicate = Boolean(drafted && drafted.status === 'exists')
    emit('memory.card.drafted', { origin, cardId }, { workspaceCwd: cwd || null, source: 'memory-writer' })
    if (origin && cardId && deps.db) {
      try {
        upsertMemoryWriteLog(deps.db, { origin, cardId })
      } catch (error) {
        console.warn('memory_write_log_failed', origin, cardId, error)
      }
    }
    if (origin && !duplicate) {
      await indexPassage(deps, { cwd, id: origin, text: indexText || label })
    }
    return {
      ok: true,
      cardId,
      drafted,
      duplicate,
      card: asDraftCard({ ...(drafted && typeof drafted === 'object' ? drafted : {}), id: cardId }, label),
    }
  } catch (error) {
    console.warn('memory_writer_draft_failed', error)
    return { ok: false, error }
  }
}
