/** Shell-owned origin block. Independent budget; lookup ids stay out of the title line. */

import { ORIGIN_PREFIXES } from './identity.mjs'

export const ORIGIN_ENTITY_BUDGET = 2400

export function originKindOf(id) {
  const prefix = ORIGIN_PREFIXES.find((item) => String(id || '').startsWith(item))
  return prefix ? prefix.slice(0, -1) : ''
}

export function looksLikeLookupId(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (ORIGIN_PREFIXES.some((item) => raw.startsWith(item))) return true
  if (raw.startsWith('fde://')) return true
  return false
}

/**
 * @param {{
 *   title?: string,
 *   text?: string,
 *   status?: string,
 *   originTitle?: string,
 *   originText?: string,
 *   message?: string,
 *   fields?: Record<string, unknown>,
 * }} input
 */
export function renderOriginEntity(input) {
  const row = input && typeof input === 'object' ? input : {}
  const lines = ['【来源实体】']
  const title = String(row.title || '').trim()
  if (title && !looksLikeLookupId(title)) lines.push(title)
  const status = String(row.status || '').trim()
  if (status) lines.push(`状态：${status}`)
  const text = String(row.text || '').trim()
  if (text) lines.push(text)
  const message = String(row.message || '').trim()
  if (message) lines.push(message)
  const originTitle = String(row.originTitle || '').trim()
  const originText = String(row.originText || '').trim()
  if (originTitle || originText) {
    lines.push('【原文】')
    if (originTitle && !looksLikeLookupId(originTitle)) lines.push(originTitle)
    if (originText) lines.push(originText)
  }
  const fields = row.fields && typeof row.fields === 'object' ? row.fields : null
  if (fields) {
    const skip = new Set(['title', 'text', 'status', 'label', 'content', 'originText', 'originTitle', 'message'])
    let n = 0
    for (const [key, value] of Object.entries(fields)) {
      if (value == null || value === '') continue
      if (skip.has(key)) continue
      lines.push(`${key}：${String(value).slice(0, 200)}`)
      n += 1
      if (n >= 12) break
    }
  }
  let body = lines.join('\n').trim()
  if (body.length > ORIGIN_ENTITY_BUDGET) body = `${body.slice(0, ORIGIN_ENTITY_BUDGET - 1)}…`
  return body
}
