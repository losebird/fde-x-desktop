import { buildContextPack, renderContextForPrompt, type ContextPack, type ContextScope } from '@/lib/context-pack'
import { submitCurrentTurn } from '@/lib/current-turn'
import { classifyHitId, originOfCard } from '@/lib/memory-identity'
import { originKindOf, renderOriginEntity, type OriginEntityInput } from '@/lib/origin-entity'
import { runtimeApi } from '@/lib/runtime-api'

export type AskWithEntityResult =
  | { ok: true; sessionId: string; pack?: ContextPack; warnings?: string[] }
  | { ok: false; error: string }

export function scopesForOrigin(origin: string): ContextScope[] {
  const kind = originKindOf(origin)
  if (kind === 'task') return ['workspace', 'tasks', 'memory']
  if (kind === 'im') return ['workspace', 'im', 'memory']
  if (kind === 'biz') return ['workspace', 'biz', 'memory']
  if (kind === 'app') return ['workspace', 'apps', 'memory']
  return ['workspace', 'memory']
}

export async function askWithEntity(opts: OriginEntityInput & {
  entity?: ContextPack['entity']
  tail?: string
  scopes?: ContextScope[]
  omit?: Set<string>
  pack?: ContextPack
  warnings?: string[]
  revealAi?: boolean
}): Promise<AskWithEntityResult> {
  const originBlock = renderOriginEntity(opts)
  let pack: ContextPack | undefined = opts.pack
  let warnings: string[] = opts.warnings || []
  let packText = ''
  const scopes = opts.scopes
  try {
    if (!pack && scopes?.length) {
      const packed = await buildContextPack({
        scopes,
        query: String(opts.title || opts.text || '').slice(0, 80),
        entity: opts.entity,
        intentKind: 'lookup',
      })
      pack = packed.pack
      warnings = packed.warnings || []
    }
    if (pack) {
      const omit = new Set(opts.omit || [])
      if (originBlock) omit.add('entity')
      packText = renderContextForPrompt(pack, omit)
    }
  } catch (cause) {
    console.warn('ask_origin_context_pack_failed', cause)
  }
  const text = [originBlock, packText, opts.tail].filter(Boolean).join('\n')
  const sent = await submitCurrentTurn({
    text,
    reveal: opts.revealAi !== false,
  })
  if (!sent.ok) return { ok: false, error: sent.error }
  return { ok: true, sessionId: sent.sessionId, pack, warnings }
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
  return String(row.cue || row.label || row.content || row.body || row.snippet || row.excerpt || row.text || row.title || '').trim()
}

export async function askOrigin(origin: string, extra: OriginEntityInput & {
  entity?: ContextPack['entity']
  tail?: string
  scopes?: ContextScope[]
  omit?: Set<string>
  pack?: ContextPack
  warnings?: string[]
  revealAi?: boolean
} = {}): Promise<AskWithEntityResult> {
  const raw = String(origin || '').trim()
  const originDoc = await loadOriginDoc(raw)
  const kind = originKindOf(raw) || 'memory'
  const title = String(extra.title || originDoc.title || '').trim()
  const text = String(extra.text || extra.title || originDoc.text || '').trim()
  return askWithEntity({
    title,
    text,
    status: extra.status,
    originTitle: originDoc.title,
    originText: originDoc.text,
    message: extra.message || originDoc.message,
    fields: extra.fields,
    entity: extra.entity || {
      kind,
      ref: (title || raw).slice(0, 80) || kind,
      fields: extra.fields && typeof extra.fields === 'object' ? extra.fields : {},
    },
    tail: extra.tail,
    scopes: extra.scopes || scopesForOrigin(raw),
    omit: extra.omit,
    pack: extra.pack,
    warnings: extra.warnings,
    revealAi: extra.revealAi,
  })
}

export async function askOriginFromCard(row: Record<string, unknown>) {
  const cue = cueText(row)
  const status = String(row.status || '')
  const origin = originOfCard(row) || String(row.id || '')
  return askOrigin(origin, {
    title: cue,
    text: cue,
    status,
    fields: status ? { status } : {},
    revealAi: true,
  })
}

export async function askOriginFromHit(row: Record<string, unknown>) {
  const hitId = String(row.id || '')
  const cue = cueText(row)
  const origin = originOfCard(row)
  const classified = classifyHitId(hitId)
  const fetchId = originFetchId(origin)
    || (classified.class === 'origin' || classified.class === 'session' ? hitId : '')
    || hitId
  const status = String(row.status || '')
  return askOrigin(fetchId, {
    title: cue,
    text: cue,
    status,
    fields: status ? { status } : {},
    revealAi: true,
  })
}
