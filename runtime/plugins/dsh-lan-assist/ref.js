/**
 * Envelope pointer: type + ticket, plus whatever this seat can already see.
 * Not a ledger row. ACL stays on the live lookup, not on the wire scrubber.
 * @module dsh-lan-assist/ref
 */

import { registeredKinds } from './lookup.js'
import { parseWriteAction, peelSpoken, saysOf } from './resolve.js'

const TICKET = /\b([A-Z]{2,8}(?:[-_]?\d{1,12}){1,3})\b/
const NO_LABEL = /单号\s*[:：#]?\s*([A-Z]{2,8}(?:[-_]?\d{1,12}){1,3})\b/
const KIND_TICKET = /[:：#号]?\s*([A-Z]{2,8}(?:[-_]?\d{1,12}){1,3})\b/
const TRAILING_PUNCT = /[。．.！!？?，,、；;：:]+$/
const LEADING_PUNCT = /^[:：#号\s]+/

/**
 * @param {unknown} text
 * @returns {{ kind: string, no: string } | null}
 */
export function parseBusinessRef(text, extra) {
  const s = String(text || '').trim()
  if (!s) return null
  const hit = firstKindIn(s, extra)
  if (hit) {
    const kind = hit.kind
    const after = s.slice(hit.at + kind.length)
    const labeled = after.match(KIND_TICKET)
    if (labeled) return { kind, no: labeled[1].toUpperCase() }
    const looking = parseWriteAction(s, extra) === '现查'
      || saysOf(extra, '列举').some((say) => say && s.includes(say))
    if (firstKindIn(after, extra)) return { kind, no: '', list: true }
    const clue = nameClue(after, extra)
    if (clue) return { kind, no: clue }
    if (looking) return { kind, no: '', list: true }
  }
  const ticket = s.match(TICKET)
  if (ticket) return { kind: '单据', no: ticket[1].toUpperCase() }
  const numbered = s.match(NO_LABEL)
  if (numbered) return { kind: '单据', no: numbered[1] }
  return null
}

function firstKindIn(text, extra) {
  const s = String(text || '')
  let best = null
  for (const kind of registeredKinds(extra)) {
    if (!kind || kind === '单据') continue
    const at = s.indexOf(kind)
    if (at < 0) continue
    if (!best || at < best.at || (at === best.at && kind.length > best.kind.length)) {
      best = { kind, at }
    }
  }
  return best
}

function nameClue(after, extra) {
  let s = peelSpoken(after, extra)
  if (!s || s.length > 40) return ''
  if (saysOf(extra, '改写').some((say) => say && s.includes(say))) return ''
  if (/^\d{3,}$/.test(s.split(/\s/)[0] || '')) return ''
  if (saysOf(extra, '问句').some((say) => say && s.includes(say))) return ''
  if (saysOf(extra, '列举').some((say) => say && s.includes(say))) return ''
  return s
}

/**
 * @param {unknown} text
 */
export function redactEnvelopeText(text) {
  return String(text || '')
}

/**
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 */
export function refLabel(ref) {
  if (!ref || !ref.no) return ''
  return ref.kind && ref.kind !== '单据' ? `${ref.kind} ${ref.no}` : String(ref.no)
}

/**
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 * @param {string} who
 */
export function speakNamedRef(ref, who) {
  const label = refLabel(ref)
  if (!label) return ''
  const name = String(who || '你').trim() || '你'
  return `这封像请${name}过${label}`
}

/**
 * Wire payload: pointer + intent + this-seat fields.
 * Attachment bytes ride inside the encrypted box when present; snapshot still strips them.
 * @param {Record<string, unknown>} req
 */
export function envelopePointer(req) {
  const excerpt = redactEnvelopeText(req && req.excerpt)
  const body = redactEnvelopeText(req && req.body)
  return {
    requestId: req && req.id,
    excerpt,
    body,
    workspace: (req && req.workspace) || '',
    ref: req && req.ref && req.ref.no ? { kind: req.ref.kind || '单据', no: req.ref.no } : null,
    signed: (req && req.signed) || '',
    sessionHint: (req && req.sessionId) || '',
    visible: (req && req.visible) || [],
    groupId: (req && req.groupId) || '',
    groupName: (req && req.groupName) || '',
    topic: !!(req && req.topic),
    threadId: (req && req.threadId) || '',
    roster: !!(req && req.roster),
    attachments: Array.isArray(req && req.attachments)
      ? req.attachments.map((item) => ({
        name: String((item && item.name) || 'file'),
        size: Number((item && item.size) || 0),
        mime: String((item && item.mime) || ''),
        data: String((item && (item.data || item.bytes)) || ''),
      })).filter((item) => item.data)
      : [],
  }
}

/**
 * @param {unknown} kind
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 */
export function speakBusinessEvent(kind, ref) {
  const label = refLabel(ref) || '一笔业务'
  if (kind === 'rejected') return `被驳回了：${label}。不自动再寄，也不调度。`
  if (kind === 'sla') return `SLA 到了：${label}。转办仍在业务系统。`
  return `到我审了：${label}。点了才动，不自动寄信。`
}
