import { loadCurrentAiTarget } from '@/lib/ai-target'
import { buildContextPack, renderContextForPrompt, type ContextPack, type ContextScope } from '@/lib/context-pack'
import { classifyHitId, originOfCard } from '@/lib/memory-identity'
import { revealAi } from '@/lib/open-ref'
import { originKindOf, renderOriginEntity, type OriginEntityInput } from '@/lib/origin-entity'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

export type AskWithEntityResult =
  | { ok: true; sessionId: string; pack?: ContextPack; warnings?: string[] }
  | { ok: false; error: string }

export async function askWithEntity(opts: OriginEntityInput & {
  entity?: ContextPack['entity']
  tail?: string
  scopes?: ContextScope[]
  revealAi?: boolean
}): Promise<AskWithEntityResult> {
  const target = await loadCurrentAiTarget()
  if (!target.ok) return { ok: false, error: target.error }
  const originBlock = renderOriginEntity(opts)
  let pack: ContextPack | undefined
  let warnings: string[] = []
  let packText = ''
  const scopes = opts.scopes
  if (scopes?.length) {
    try {
      const packed = await buildContextPack({
        scopes,
        query: String(opts.title || opts.text || '').slice(0, 80),
        entity: opts.entity,
        intentKind: 'lookup',
      })
      pack = packed.pack
      warnings = packed.warnings
      packText = renderContextForPrompt(packed.pack, new Set(['entity']))
    } catch (cause) {
      console.warn('ask_origin_context_pack_failed', cause)
    }
  }
  const text = [originBlock, packText, opts.tail].filter(Boolean).join('\n')
  try {
    await runtimeApi.promptAi(target.sessionId, { text })
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : '没问出去' }
  }
  useApp.getState().setActiveAiSessionId(target.sessionId)
  if (opts.revealAi !== false) revealAi(target.sessionId)
  return { ok: true, sessionId: target.sessionId, pack, warnings }
}

function originFetchId(id: string) {
  const origin = String(id || '').trim()
  if (!origin) return ''
  if (originKindOf(origin) === 'memory') return ''
  return origin
}

async function loadOriginDoc(id: string) {
  const origin = originFetchId(id)
  if (!origin) return { title: '', text: '', message: '' }
  try {
    const doc = await runtimeApi.fetchCorpus(origin)
    return {
      title: String(doc.title || ''),
      text: String(doc.text || ''),
      message: doc.ok ? '' : String(doc.message || ''),
    }
  } catch (cause) {
    return {
      title: '',
      text: '',
      message: cause instanceof Error ? cause.message : '读不出来源',
    }
  }
}

function cueText(row: Record<string, unknown>) {
  return String(row.label || row.content || row.body || row.snippet || row.excerpt || row.text || row.title || '').trim()
}

export async function askOriginFromCard(row: Record<string, unknown>) {
  const cue = cueText(row)
  const status = String(row.status || '')
  const origin = originOfCard(row)
  const originDoc = await loadOriginDoc(origin)
  const kind = originKindOf(origin) || 'memory'
  return askWithEntity({
    title: cue,
    text: cue,
    status,
    originTitle: originDoc.title,
    originText: originDoc.text,
    message: originDoc.message,
    entity: {
      kind,
      ref: cue.slice(0, 80) || '记忆卡片',
      fields: { status },
    },
    scopes: ['workspace', 'memory'],
    revealAi: true,
  })
}

export async function askOriginFromHit(row: Record<string, unknown>) {
  const hitId = String(row.id || '')
  const cue = cueText(row)
  const origin = originOfCard(row)
  const classified = classifyHitId(hitId)
  const hitClass = classified.class
  const fetchId = originFetchId(origin)
    || (hitClass === 'origin' || hitClass === 'session' ? hitId : '')
  const originDoc = await loadOriginDoc(fetchId)
  const status = String(row.status || '')
  const kind = originKindOf(origin || hitId) || hitClass
  return askWithEntity({
    title: cue,
    text: cue,
    status,
    originTitle: originDoc.title,
    originText: originDoc.text,
    message: originDoc.message,
    entity: {
      kind,
      ref: cue.slice(0, 80) || hitClass,
      fields: status ? { status } : {},
    },
    scopes: ['workspace', 'memory'],
    revealAi: true,
  })
}
