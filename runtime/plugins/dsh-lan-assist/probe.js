/**
 * Read-only speak for a live lookup. Not a ledger, not MCP write.
 * @module dsh-lan-assist/probe
 */

import { looksLikeTicket, parseWriteAction as parseSpokenAction } from './resolve.js'
import { refLabel } from './ref.js'

/** Gate codes. Synonyms live in workspace vocab role=动作. */
export const WRITE_ACTIONS = ['现查', '改行', '删除', '新建', '过审']

export function looksLikeBusiness(text) {
  const s = String(text || '')
  if (!s.trim()) return false
  return /过账|待审|待办|审批|SLA|催一下|催办|转给|不在你名下|已过|先调\s*MCP|过一下/.test(s)
}

export function parseWriteAction(text, extra) {
  return parseSpokenAction(text, extra)
}

export function looksLikeChase(text) {
  return /催一下|催办|还没看|还没回|再催/.test(String(text || ''))
}

const NUDGE_WHEN = '明天|后天|待会|等下|到点|半[个]?小时之后?|半[个]?小时后|\\d+\\s*(?:分钟|分|小时)之后?|\\d+\\s*(?:分钟|分|小时)后|一小时之后?|一小时后'
const NUDGE_ASK = '提醒我|记得提我|帮我记一下|到点提我?'

export function looksLikeNudge(text) {
  const s = String(text || '')
  if (!s.trim()) return false
  if (isNudgeComplaint(s)) return false
  return new RegExp(`${NUDGE_ASK}|明天提醒|后天提醒|待会提醒`).test(s)
}

function isNudgeComplaint(s) {
  if (!/没(有)?提醒|未提醒/.test(s)) return false
  return !new RegExp(`(?:${NUDGE_WHEN}).{0,16}提醒`).test(s)
}

export function nudgeQuote(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  const whenAsk = new RegExp(`^(?:${NUDGE_WHEN})?(?:${NUDGE_ASK})\\s*`)
  const whenOnly = new RegExp(`^(?:${NUDGE_WHEN})\\s*`)
  return s.replace(whenAsk, '').replace(whenOnly, '').trim() || s
}

export function nextMorning(t, days = 1) {
  const d = new Date(t)
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.getTime()
}

export function nudgeDueAt(text, t) {
  const s = String(text || '')
  const now = Number(t) || 0
  if (/半[个]?小时/.test(s)) return now + 30 * 60 * 1000
  const minutes = s.match(/(\d+)\s*分钟/) || s.match(/(\d+)\s*分(?!钟)/)
  if (minutes) return now + Number(minutes[1]) * 60 * 1000
  const hours = s.match(/(\d+)\s*小时/)
  if (hours) return now + Number(hours[1]) * 60 * 60 * 1000
  if (/一小时/.test(s)) return now + 60 * 60 * 1000
  if (/后天/.test(s)) return nextMorning(now, 2)
  if (/明天/.test(s)) return nextMorning(now, 1)
  if (/待会|等下/.test(s)) return now + 15 * 60 * 1000
  return nextMorning(now, 1)
}

/**
 * Object-set footer for a settled 现查 page. N is hitTotal, not page row count.
 * @param {{ hitTotalState?: string, hitTotal?: number | null }} found
 * @param {number} pageCount
 */
export function speakObjectSetTotal(found, pageCount) {
  const m = Number.isFinite(Number(pageCount)) ? Math.max(0, Math.floor(Number(pageCount))) : 0
  const state = String((found && found.hitTotalState) || '').trim()
  if (state === 'known' && Number.isFinite(Number(found && found.hitTotal))) {
    return `共 ${Number(found.hitTotal)} 条，本页 ${m} 条。`
  }
  if (state === 'incomplete') return `对象集总数未算全，本页 ${m} 条。`
  if (state === 'unknown' || state === '') return `对象集总数未知，本页 ${m} 条。`
  return `本页 ${m} 条。`
}

/**
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 * @param {{ ok?: boolean, status?: string, mine?: boolean, error?: string } | null | undefined} found
 */
export function speakLookup(ref, found) {
  const label = refLabel(ref) || '这张单'
  if (!found || found.ok === false) {
    if (found && found.error === 'EXPIRED') return '业务账号过期了，要重新登。秘书不自己重登。'
    if (found && found.error === 'NOT_FOUND') {
      const kind = String((ref && ref.kind) || '').trim()
      const rest = String((found && found.rest) || '').trim()
        || (!looksLikeTicket((ref && ref.no) || '') ? String((ref && ref.no) || '').trim() : '')
      const missState = String((found && found.hitTotalState) || '').trim()
      const missPage = Number.isFinite(Number(found && found.pageRows))
        ? Math.max(0, Math.floor(Number(found.pageRows)))
        : 0
      const totalLine = missState ? speakObjectSetTotal(found, missPage) : ''
      if (rest) {
        const who = kind || '这张单'
        const tail = totalLine || '0 条，不是没去查。'
        return `${who}这边对不上「${rest}」，${tail}`
      }
      if (totalLine) return `${label}${totalLine}不是没去查。`
      return `${label}业务系统里没有。不是没去查。`
    }
    if (found && found.error === 'FORBIDDEN') return `${label}不在你名下。这台号看不见明细。`
    if (found && found.error === 'NO_CONNECTOR') return `${label}：没连业务，不能装成已查。`
    const hint = String((found && found.hint) || '').trim()
    if (hint) return hint
    if (found && found.error === 'WHERE_UNBOUND') {
      return `${label}筛选条件没对上词表列名，不能整表现查。`
    }
    return `${label}现在查不到。`
  }
  if (found.listed && !found.rest && Array.isArray(found.matches) && found.matches.length) {
    const first = found.matches[0] || {}
    const n = found.matches.length
    const totalLine = String((found && found.hitTotalState) || '').trim()
      ? speakObjectSetTotal(found, n)
      : `最近一页 ${n} 条。`
    return withMineFootnote(`${label}${totalLine}第一张 ${first.no || ''}，状态 ${first.status || '未知'}。`, found)
  }
  if (found.ambiguous) {
    const nos = ((found.matches || []).map((item) => item.no).filter(Boolean)).slice(0, 5)
    const body = nos.length
      ? `${label}对上${found.matches.length}条：${nos.join('、')}。回一张单号再查。`
      : `${label}对上多条。回一张单号再查。`
    return withMineFootnote(body, found)
  }
  const status = String(found.status || '').trim()
  const via = speakVia(found)
  const detail = speakFields(found.fields)
  const pageRows = Array.isArray(found.matches) ? found.matches.length : (found.pageRows != null ? Number(found.pageRows) : 1)
  const totalPrefix = String((found && found.hitTotalState) || '').trim()
    ? speakObjectSetTotal(found, pageRows)
    : ''
  let speak
  if (/已过|已过账|已审|done|posted/i.test(status)) speak = `${label}${totalPrefix}已经过了。${detail}${via}`
  else if (/待审|待办|pending|open/i.test(status)) speak = `${label}${totalPrefix}待审。${detail}${via}`
  else if (totalPrefix) speak = `${label}${totalPrefix}${detail}${via}`
  else speak = `${label}现在是${status || '未知'}。${detail}${via}`
  return withMineFootnote(speak, found)
}

function withMineFootnote(speak, found) {
  if (!found || found.mine !== false) return speak
  const base = String(speak || '').trim()
  if (base.includes('负责人不是这台号')) return base
  return `${base}${/。$/.test(base) ? '' : '。'}负责人不是这台号。`
}

function speakFields(fields) {
  if (!fields || typeof fields !== 'object') return ''
  const skip = new Set(['status', 'state', 'stage'])
  const parts = Object.entries(fields)
    .filter(([key, value]) => key && value && !skip.has(key))
    .slice(0, 12)
    .map(([key, value]) => `${key} ${value}`)
  return parts.length ? `${parts.join('，')}。` : ''
}

function speakVia(found) {
  const system = String((found && found.system) || '').trim()
  const env = String((found && found.env) || '').trim()
  if (!system && !env) return ''
  if (/prod|生产/i.test(env)) return `用的是生产${system || '业务'}，不是测试库。`
  if (/test|staging|uat|测试/i.test(env)) return `用的是测试${system || '业务'}，不是生产库。`
  return system ? `用的是${system}。` : ''
}

/**
 * @param {{ kind?: string, no?: string } | null | undefined} ref
 * @param {{ who?: string, overtime?: boolean } | null | undefined} sla
 */
export function speakSla(ref, sla) {
  const label = refLabel(ref) || '这单'
  const who = String((sla && sla.who) || '').trim()
  return who
    ? `读到${label}已超时转给${who}。转办仍在业务系统，秘书不做超时转办引擎。`
    : `读到${label}已超时转办。转办仍在业务系统，秘书不做超时转办引擎。`
}

export function speakDelegate(selfStaff, borrowed) {
  const mine = String(selfStaff || '').trim()
  const other = String(borrowed || '').trim()
  if (other && other !== mine) {
    return `委托只能用被委托人自己的号。不能把 ${other} 的登录借给现在这个号。`
  }
  return '委托只能用被委托人自己的号。不能把别人的登录借给现在这个号。'
}

export function speakNods(which) {
  if (which === 'tool') return '这颗键只跑本机工具审批，不是业务过审。'
  if (which === 'schedule') return '这颗键只把活领进会话，不是过账。'
  if (which === 'post') return '这颗键才改业务。会签齐了也不算过账。'
  return '这颗键只表示你同意开口，不是过账。'
}

export function speakSeeMissing() {
  return '没眼睛，附件还是附件。不能装成合同已读。'
}

export function speakSeeFailed() {
  return '未看见。不能装成合同已读。'
}

export function speakCostStop() {
  return '超预算停写，只许只读开口。'
}

export function remindKey(kind, id, day) {
  return `${day}:${kind}:${id}`
}
