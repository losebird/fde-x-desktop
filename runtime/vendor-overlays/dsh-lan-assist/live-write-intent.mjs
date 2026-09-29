/**
 * Connector write speech: action clues from the spoken seed, excluding 现查.
 * Used by intent routing so live writes do not start as graph search.
 * @module dsh-lan-assist/live-write-intent
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function writeActionSaysFromSpoken(spoken) {
  const clues = spoken && Array.isArray(spoken.clues) ? spoken.clues : []
  const says = []
  for (const clue of clues) {
    if (!clue || typeof clue !== 'object') continue
    const keys = Array.isArray(clue.keys) ? clue.keys.map((item) => String(item || '').trim()) : []
    if (!keys.includes('action')) continue
    const values = Array.isArray(clue.values) ? clue.values.map((item) => String(item || '').trim()).filter(Boolean) : []
    if (!values.some((item) => item !== '现查')) continue
    for (const say of Array.isArray(clue.say) ? clue.say : []) {
      const token = String(say || '').trim()
      if (token) says.push(token)
    }
  }
  says.sort((a, b) => b.length - a.length)
  return says
}

export function speechHasConnectorWrite(speech, spoken) {
  const text = String(speech || '')
  if (!text.trim()) return false
  return writeActionSaysFromSpoken(spoken).some((say) => text.includes(say))
}

export function speechHasConnectorLookup(speech, spoken) {
  return speechHasSpokenRole(speech, spoken, '现查路由')
}

export function roleSaysFromSpoken(spoken, role) {
  const want = String(role || '').trim()
  const clues = spoken && Array.isArray(spoken.clues) ? spoken.clues : []
  const says = []
  for (const clue of clues) {
    if (!clue || typeof clue !== 'object') continue
    if (String(clue.role || '').trim() !== want) continue
    for (const say of Array.isArray(clue.say) ? clue.say : []) {
      const token = String(say || '').trim()
      if (token) says.push(token)
    }
  }
  says.sort((a, b) => b.length - a.length)
  return says
}

export function speechHasSpokenRole(speech, spoken, role) {
  const text = String(speech || '')
  if (!text.trim()) return false
  return roleSaysFromSpoken(spoken, role).some((say) => text.includes(say))
}

export function loadSpokenSeed() {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'vocab', 'spoken.json')
  return JSON.parse(readFileSync(path, 'utf8'))
}
