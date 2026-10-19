/**
 * Gate action tokens from workspace vocab `can` + spoken 动作槽 (Decision 15).
 * @module dsh-lan-assist/gate-action-codes
 */

import spokenSeed from './vocab/spoken.json' with { type: 'json' }

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  return []
}

function clueRole(clue) {
  const named = String((clue && (clue.role || clue.slot)) || '').trim()
  if (named) return named
  const keys = stringList(clue && (clue.keys || clue.field || clue.fields))
  const values = stringList(clue && (clue.values || clue.value))
  if (keys.length === 1 && keys[0] === 'role') return String(values[0] || '').trim() || '口语'
  if (keys.length === 1 && keys[0] === 'action') return '动作'
  return ''
}

function cluesOfRow(row) {
  return Array.isArray(row?.clues) ? row.clues : []
}

function vocabRows(extra) {
  const rows = Array.isArray(extra?.vocab) ? extra.vocab.slice()
    : (Array.isArray(extra?.kinds) ? extra.kinds.slice() : (Array.isArray(extra) ? extra.slice() : []))
  const hasSpoken = rows.some((row) => row && (row.spoken || row.kind === '口语' || row.id === 'spoken'))
  if (!hasSpoken && spokenSeed && typeof spokenSeed === 'object') {
    rows.push({ ...spokenSeed, spoken: true })
  }
  return rows
}

/**
 * Union of every kind `can` entry and spoken 动作 clue values (same contract as gate resolve).
 * @param {Record<string, unknown> | unknown[] | undefined} extra
 * @returns {Set<string>}
 */
export function collectGateActionCodes(extra) {
  const codes = new Set()
  const rows = vocabRows(extra)
  for (const row of rows) {
    for (const item of Array.isArray(row.can) ? row.can : []) {
      const s = String(item || '').trim()
      if (s) codes.add(s)
    }
  }
  for (const row of rows) {
    for (const clue of cluesOfRow(row)) {
      if (clueRole(clue) !== '动作') continue
      for (const item of stringList(clue.values ?? clue.value)) {
        if (item) codes.add(item)
      }
    }
  }
  return codes
}

export function isGateActionCode(action, extra) {
  const s = String(action || '').trim()
  if (!s) return false
  return collectGateActionCodes(extra).has(s)
}
