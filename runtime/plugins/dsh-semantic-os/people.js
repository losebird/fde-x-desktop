/**
 * User-level people.json. Never written into a project graph.json.
 * @module dsh-semantic-os/people
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { loadOverlaySync } from './persist.js'

const VERSION = 1

export function defaultPeoplePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'semantic-os', 'people.json')
}

export function peoplePath() {
  const overlay = loadOverlaySync()
  const custom = overlay && typeof overlay.peoplePath === 'string' ? overlay.peoplePath.trim() : ''
  if (custom && isAbsolute(custom)) return custom
  return defaultPeoplePath()
}

function blank() {
  return { version: VERSION, people: [] }
}

async function readStore() {
  const file = peoplePath()
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank()
    const people = Array.isArray(raw.people) ? raw.people : []
    return { version: VERSION, people }
  } catch {
    return blank()
  }
}

export async function listPeople() {
  const store = await readStore()
  return { ok: true, path: peoplePath(), people: store.people }
}

/** Collaboration-only list: status==left and a non-empty stable id. */
export async function listLeftIds() {
  const store = await readStore()
  const ids = []
  const seen = new Set()
  for (const row of store.people) {
    if (!row || typeof row !== 'object') continue
    if (String(row.status || '').trim() !== 'left') continue
    const id = String(row.id || '').trim()
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return { ids }
}

function cleanPerson(row) {
  if (!row || typeof row !== 'object') return null
  const id = String(row.id || '').trim()
  const displayName = String(row.displayName || row.name || '').trim()
  if (!id && !displayName) return null
  const rawStatus = String(row.status || '').trim()
  const status = rawStatus === 'left' ? 'left' : 'active'
  const updatedAt = String(row.updatedAt || '').trim() || new Date().toISOString()
  return {
    id,
    displayName,
    businessAccount: String(row.businessAccount || '').trim(),
    status,
    updatedAt,
  }
}

export async function savePeople(people) {
  const rows = Array.isArray(people) ? people : []
  const cleaned = []
  for (const row of rows) {
    const person = cleanPerson(row)
    if (person) cleaned.push(person)
  }
  const file = peoplePath()
  await mkdir(dirname(file), { recursive: true })
  const store = { version: VERSION, people: cleaned }
  await writeFile(file, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  return { ok: true, path: file, people: cleaned }
}
