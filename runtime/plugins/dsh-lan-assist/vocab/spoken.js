/**
 * Workspace vocab is the live catalog. Package seed is the spoken clue table
 * used by enrich/bind — not a second catalog of kinds.
 * @module dsh-lan-assist/vocab/spoken
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const spokenSeed = require('./spoken.json')

export function ensureSpoken(vocab) {
  return Array.isArray(vocab) ? vocab.slice() : []
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

export function spokenSeedClues() {
  return Array.isArray(spokenSeed && spokenSeed.clues) ? spokenSeed.clues.slice() : []
}

/** Same spoken clue table enrich already uses. Bind reads this, not a third copy. */
export function vocabWithSpoken(vocab) {
  const rows = Array.isArray(vocab) ? vocab.map((row) => (row && typeof row === 'object' ? { ...row } : row)) : []
  const seed = spokenSeedClues()
  const idx = rows.findIndex((row) => row && (row.spoken || row.kind === '口语' || row.id === 'spoken'))
  if (idx < 0) {
    rows.push({
      kind: '口语',
      spoken: true,
      clues: seed,
    })
    return rows
  }
  const have = cluesOfRow(rows[idx])
  rows[idx] = { ...rows[idx], clues: [...have, ...seed] }
  return rows
}
