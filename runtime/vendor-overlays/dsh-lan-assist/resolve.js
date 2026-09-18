/**
 * Shared clue resolution. Dialects only fetch; this layer decides 0 / 1 / many.
 * Names, codes and ticket numbers all count as clues.
 * @module dsh-lan-assist/resolve
 */

import { collectGateActionCodes } from '../../biz/gate-action-codes.mjs'
import { ensureSpoken } from './vocab/spoken.js'

const SPEAK_ONLY = new Set(['问句', '型', '动作', '列举', '助词', '标点', '连接', '改写', '焦点', '口语', '单号列', '关联列', '时间', '交接'])
const ACTION_PRIORITY = ['删除', '新建', '过审', '改行', '现查']

export function parseWriteAction(text, extra) {
  const s = String(text || '')
  if (!s.trim()) return null
  const allowed = collectGateActionCodes(extra)
  const rows = actionClues(extra)
  const hit = []
  for (const row of rows) {
    if (!row.re) continue
    row.re.lastIndex = 0
    if (!row.re.test(s)) continue
    const code = (row.values || []).find((item) => allowed.has(String(item || '').trim()))
    if (code) hit.push(code)
  }
  for (const code of ACTION_PRIORITY) {
    if (hit.includes(code)) return code
  }
  return hit[0] || null
}

export function looksLikeTicket(value) {
  const s = String(value || '').trim()
  if (!/^[A-Za-z0-9][-_A-Za-z0-9]{1,32}$/.test(s)) return false
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return false
  return true
}

export function looksLikeRef(value) {
  const s = String(value || '').trim()
  if (!s) return false
  if (looksLikeTicket(s)) return true
  return /^\d{6,}$/.test(s)
}

export function listRows(body) {
  if (!body || typeof body !== 'object') return []
  if (Array.isArray(body)) return body
  if (Array.isArray(body.data)) return body.data
  if (Array.isArray(body.items)) return body.items
  if (Array.isArray(body.results)) return body.results
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    if (Array.isArray(body.data.data)) return body.data.data
    if (Array.isArray(body.data.items)) return body.data.items
    return [body.data]
  }
  return []
}

function vocabRows(extra) {
  const rows = Array.isArray(extra && extra.vocab) ? extra.vocab
    : (Array.isArray(extra && extra.kinds) ? extra.kinds : (Array.isArray(extra) ? extra : []))
  return ensureSpoken(rows)
}

function isTicketColumn(name) {
  const s = String(name || '').trim()
  if (!s) return false
  return /No$/i.test(s) || /^(id|code|no)$/i.test(s)
}

export function pickNo(row, fields, extra) {
  const fromVocab = (Array.isArray(fields) ? fields : []).map((item) => String(item || '').trim()).filter(Boolean)
  const listed = vocabRoleSays({ vocab: vocabRows(extra) }, '单号列').filter(isTicketColumn)
  const keys = [...new Set([...fromVocab, ...listed])]
  for (const field of keys) {
    const value = fieldText(row, field)
    if (value) return value
  }
  if (row && row.id != null && String(row.id).trim()) return String(row.id).trim()
  return ''
}

export function fieldText(row, field) {
  const raw = row && row[field]
  if (raw == null) return ''
  if (typeof raw === 'object') return String(raw.name || raw.code || raw.id || '').trim()
  return String(raw).trim()
}

const SKIP_KEY = /^(id|createdAt|updatedAt|createdById|updatedById|created_at|updated_at)$|Id$|_id$/

/** Spoken roles live in workspace vocab. Plugin matches by role, not by a Chinese table. */

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (/^[\[{]/.test(trimmed)) {
      try {
        return stringList(JSON.parse(trimmed))
      } catch { /* keep split */ }
    }
    return trimmed.split(/[,，、]+/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function escapeRe(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clueRole(clue) {
  const named = String((clue && (clue.role || clue.slot)) || '').trim()
  if (named) return named
  const keys = stringList(clue && (clue.keys || clue.field || clue.fields))
  const values = stringList(clue && (clue.values || clue.value))
  if (keys.length === 1 && keys[0] === 'role') return String(values[0] || '').trim() || '口语'
  if (keys.length === 1 && keys[0] === 'action') return '动作'
  if (keys.length === 1 && keys[0] === 'join') return '连接'
  return ''
}

function normalizeClue(clue) {
  if (!clue || typeof clue === 'string') return null
  const role = clueRole(clue)
  const say = stringList(clue.say || clue.says || clue.label || clue.word || clue.words)
  const keys = stringList(clue.keys || clue.field || clue.fields)
  const values = stringList(clue.values || clue.value)
  const words = say.length ? say : values
  if (!words.length) return null
  const speakOnly = SPEAK_ONLY.has(role)
  if (!speakOnly && !keys.length) return null
  const re = new RegExp(words.map(escapeRe).sort((a, b) => b.length - a.length).join('|'), 'gi')
  const dateBefore = stringList(clue.dateBefore || clue.date_before)
  return {
    role: role || undefined,
    say: words,
    re,
    keys,
    values: values.length ? values : words,
    dateBefore: dateBefore.length ? dateBefore : undefined,
    not: clue.not ? true : undefined,
  }
}

function cluesOfRow(row) {
  if (!row) return []
  const raw = row.clues
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([say, spec]) => (
      spec && typeof spec === 'object' ? { say, ...spec } : { say, value: spec }
    ))
  }
  return []
}

export function saysOf(extra, role) {
  return vocabRoleSays(extra, role)
}

export function peelSpoken(text, extra) {
  return stripFillers(text, extra).replace(/\s+/g, ' ').trim()
}

function vocabRoleSays(extra, role) {
  const want = String(role || '').trim()
  if (!want) return []
  const rows = Array.isArray(extra && extra.vocab) ? extra.vocab
    : (Array.isArray(extra && extra.kinds) ? extra.kinds : (Array.isArray(extra) ? extra : []))
  const out = []
  for (const row of rows) {
    for (const clue of cluesOfRow(row)) {
      if (clueRole(clue) !== want) continue
      out.push(...stringList(clue.say || clue.says || clue.label || clue.word || clue.words))
    }
  }
  return [...new Set(out.filter((item) => item != null && String(item).length >= 1))]
}



export function enumMap(field) {
  const out = {}
  if (!field || typeof field !== 'object') return out
  if (field.enums && typeof field.enums === 'object' && !Array.isArray(field.enums)) {
    for (const [value, label] of Object.entries(field.enums)) {
      if (value) out[value] = String(label || value)
    }
    if (Object.keys(out).length) return out
  }
  const raw = field.enum || field.options || field.choices
    || (field.uiSchema && (field.uiSchema.enum || field.uiSchema.options))
    || []
  const listed = Array.isArray(raw) ? raw : []
  for (const item of listed) {
    if (item == null) continue
    if (typeof item === 'string' || typeof item === 'number') {
      out[String(item)] = String(item)
      continue
    }
    const value = String(item.value || item.name || item.key || item.id || '').trim()
    const label = String(item.label || item.title || item.say || value).trim()
    if (value) out[value] = label || value
  }
  return out
}

export function mergeAskClue(clues, rest) {
  const bits = [...new Set([String(rest || '').trim(), ...String(rest || '').trim().split(/\s+/)].filter((item) => item.length >= 2))]
  if (!bits.length) return Array.isArray(clues) ? clues.slice() : []
  const out = Array.isArray(clues) ? clues.map((row) => (row && typeof row === 'object' ? { ...row } : row)) : []
  const existing = out.find((row) => clueRole(row) === '问句')
  if (existing) {
    existing.say = [...new Set(stringList(existing.say).concat(bits))]
    existing.keys = ['role']
    existing.values = ['问句']
    return out
  }
  out.push({ say: bits, keys: ['role'], values: ['问句'] })
  return out
}

function dateBeforeToday(row, keys) {
  const now = Date.now()
  return (Array.isArray(keys) ? keys : []).some((key) => {
    const raw = row && row[key]
    const text = raw == null ? '' : typeof raw === 'object' ? String(raw.date || raw.value || '') : String(raw)
    const t = Date.parse(text)
    return Number.isFinite(t) && t < now
  })
}

function dateOnOrAfter(row, keys, bound) {
  const floor = Date.parse(String(bound || ''))
  if (!Number.isFinite(floor)) return false
  return (Array.isArray(keys) ? keys : []).some((key) => {
    const raw = row && row[key]
    const text = raw == null ? '' : typeof raw === 'object' ? String(raw.date || raw.value || '') : String(raw)
    const t = Date.parse(text)
    return Number.isFinite(t) && t >= floor
  })
}

function dateBeforeBound(row, keys, bound) {
  const ceiling = Date.parse(String(bound || ''))
  if (!Number.isFinite(ceiling)) return false
  return (Array.isArray(keys) ? keys : []).some((key) => {
    const raw = row && row[key]
    const text = raw == null ? '' : typeof raw === 'object' ? String(raw.date || raw.value || '') : String(raw)
    const t = Date.parse(text)
    return Number.isFinite(t) && t < ceiling
  })
}

function stripSays(text, says) {
  let s = String(text || '')
  for (const say of [...new Set(says || [])].filter(Boolean).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(escapeRe(say), 'g'), ' ')
  }
  return s
}

function actionClues(extra) {
  const rows = vocabRows(extra)
  const out = []
  for (const row of rows) {
    for (const clue of cluesOfRow(row)) {
      if (clueRole(clue) !== '动作') continue
      const term = normalizeClue(clue)
      if (term) out.push(term)
    }
  }
  return out
}

function stripFillers(text, extra) {
  let s = String(text || '')
  const rewrite = new Set(vocabRoleSays(extra, '改写'))
  for (const role of ['动作', '列举', '问句', '口语', '焦点', '连接', '助词', '标点', '时间']) {
    if (role === '动作') {
      s = stripSays(s, vocabRoleSays(extra, role).filter((say) => !rewrite.has(say)))
      continue
    }
    if (role === '连接' || role === '助词') {
      for (const say of vocabRoleSays(extra, role).sort((a, b) => b.length - a.length)) {
        if (!say) continue
        s = say.length === 1
          ? s.replace(new RegExp(`(?:^|\\s)${escapeRe(say)}(?=\\s|$)`, 'g'), ' ')
          : s.replace(new RegExp(escapeRe(say), 'g'), ' ')
      }
      continue
    }
    s = stripSays(s, vocabRoleSays(extra, role))
  }
  return s.replace(/\s+/g, ' ')
}

function resolveRowKeys(row, keys) {
  const listed = Array.isArray(keys) && keys.length
    ? keys
    : Object.keys(row).filter((key) => !SKIP_KEY.test(key))
  const out = []
  for (const key of listed) {
    const name = String(key || '').trim()
    if (!name) continue
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      out.push(name)
      continue
    }
    if (row[name] != null && String(row[name]) !== '') {
      out.push(name)
      continue
    }
    for (const alias of ['status', 'state', 'stage']) {
      if (row[alias] != null && String(row[alias]) !== '') out.push(alias)
    }
  }
  return out.length ? [...new Set(out)] : listed
}

function termHits(row, term) {
  const keys = resolveRowKeys(row, Array.isArray(term.keys) && term.keys.length ? term.keys : null)
  const values = Array.isArray(term.values) ? term.values.map((item) => String(item || '').toLowerCase()).filter(Boolean) : []
  const readable = keys.filter((key) => fieldText(row, key) !== '')
  const hitValue = values.length && readable.some((key) => {
    const text = fieldText(row, key).toLowerCase()
    return values.some((item) => text === item || text.includes(item))
  })
  if (term.not) {
    if (!values.length || !readable.length) return false
    return !hitValue
  }
  if (hitValue) return true
  if (Array.isArray(term.dateAfter) && term.dateAfter.length) {
    const bound = String((term.values || [])[0] || '').trim()
    if (bound) return dateOnOrAfter(row, term.dateAfter, bound)
  }
  if (Array.isArray(term.dateBefore) && term.dateBefore.length) {
    const bound = String((term.values || [])[0] || '').trim()
    if (bound) return dateBeforeBound(row, term.dateBefore, bound)
    return dateBeforeToday(row, term.dateBefore)
  }
  return false
}

export function groupClueTerms(terms, join = 'and') {
  const list = Array.isArray(terms) ? terms.filter(Boolean) : []
  const groups = []
  const index = new Map()
  for (const term of list) {
    const key = String((term.keys && term.keys[0]) || '')
    if (!index.has(key)) {
      index.set(key, groups.length)
      groups.push([])
    }
    groups[index.get(key)].push(term)
  }
  if (join === 'or' && groups.some((group) => group.length > 1)) return { join: 'and', groups }
  if (join === 'or') return { join: 'or', groups: [list] }
  return { join: 'and', groups: list.map((term) => [term]) }
}

export function rowMatchesAll(row, terms, join = 'and') {
  if (!row || typeof row !== 'object') return false
  const packed = groupClueTerms(terms, join)
  if (!packed.groups.length) return true
  if (packed.join === 'or') return packed.groups.flat().some((term) => termHits(row, term))
  return packed.groups.every((group) => group.some((term) => termHits(row, term)))
}

export function rowMatches(row, look, fields) {
  const needle = String(look || '').trim().toLowerCase()
  if (!needle || !row || typeof row !== 'object') return false
  const keys = Object.keys(row)
  const preferred = Array.isArray(fields) ? fields.map((item) => String(item || '').trim()).filter(Boolean) : []
  const visible = keys.filter((key) => !SKIP_KEY.test(key))
  const scan = [...new Set([...preferred, ...visible])]
  if (looksLikeRef(look)) {
    if (row.id != null && String(row.id) === String(look)) return true
    const ticketKeys = keys.filter((key) => (
      /^(code|no|id)$/i.test(key)
      || /(No|Code|Number)$/.test(key)
      || /^(ticketNo|orderNo|contractNo|paymentNo)$/.test(key)
    ))
    const numbered = [...new Set([...preferred, ...ticketKeys])]
    const scan = numbered.length ? numbered : keys
    return scan.some((field) => fieldText(row, field).toLowerCase() === needle)
  }
  const needles = [needle]
  if (/[类型]$/.test(needle) && needle.length > 1) needles.push(needle.slice(0, -1))
  return scan.some((field) => {
    const text = fieldText(row, field).toLowerCase()
    return needles.some((item) => text.includes(item))
  })
}

export function filterRows(rows, look, fields) {
  return (Array.isArray(rows) ? rows : []).filter((row) => rowMatches(row, look, fields))
}

export function packMatch(row, fields, statusField, ownerField, extra) {
  return {
    no: pickNo(row, fields, extra),
    status: String((statusField && row[statusField]) || row.status || row.stage || row.state || '').trim(),
    owner: pickOwnerValue(row, ownerField),
    updatedAt: row.updatedAt || row.updated_at || '',
    row,
  }
}

function pickOwnerValue(row, field) {
  const owner = (field && row[field]) || row.owner || row.assignee || row.staffId || row.employeeId || row.ownerId || row.assigneeId
  if (!owner) return ''
  if (typeof owner === 'object') return String(owner.id || owner.staffId || owner.nickname || '')
  return String(owner)
}

/**
 * @param {unknown[]} rows
 * @param {string} look
 * @param {string[]} fields
 */
export function resolveRows(rows, look, fields, extras = {}) {
  const hit = filterRows(rows, look, fields)
  const matches = hit.slice(0, 8).map((row) => packMatch(row, fields, extras.statusField, extras.ownerField, extras))
  if (!matches.length) return { ok: false, error: 'NOT_FOUND', matches: [] }
  if (matches.length > 1) {
    return { ok: true, ambiguous: true, matches, row: hit[0] }
  }
  return { ok: true, ambiguous: false, matches, row: hit[0], no: matches[0].no }
}
