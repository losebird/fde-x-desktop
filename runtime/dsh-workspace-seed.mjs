import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { credentialSourceHomes } from './dsh-credentials.mjs'

export const WORKSPACE_STORE_REL = join('storages', 'workspace.json')

export function workspaceStoreHasRows(raw) {
  try {
    const json = JSON.parse(String(raw || ''))
    const ids = json?.global?.workspaceIds
    if (Array.isArray(ids) && ids.length) return true
    const tables = json?.tables?.workspaces
    return Boolean(tables && typeof tables === 'object' && Object.keys(tables).length)
  } catch {
    return false
  }
}

export function workspaceSourceHomes(dshHome, options = {}) {
  return credentialSourceHomes(dshHome, options).slice().reverse()
}

function destStorePath(dshHome) {
  return join(String(dshHome || ''), WORKSPACE_STORE_REL)
}

function destAlreadyFilled(dest) {
  if (!existsSync(dest)) return false
  try {
    return workspaceStoreHasRows(readFileSync(dest, 'utf8'))
  } catch {
    return false
  }
}

export function seedDshWorkspaceStoreSync(dshHome, options = {}) {
  const dest = destStorePath(dshHome)
  if (destAlreadyFilled(dest)) return { copied: false, dest, reason: 'already' }
  mkdirSync(join(String(dshHome || ''), 'storages'), { recursive: true })
  for (const home of workspaceSourceHomes(dshHome, options)) {
    const source = join(home, WORKSPACE_STORE_REL)
    if (!existsSync(source)) continue
    try {
      if (!workspaceStoreHasRows(readFileSync(source, 'utf8'))) continue
    } catch {
      continue
    }
    copyFileSync(source, dest)
    return { copied: true, dest, source }
  }
  return { copied: false, dest, reason: 'no_source' }
}

export async function seedDshWorkspaceStore(dshHome, options = {}) {
  const dest = destStorePath(dshHome)
  if (destAlreadyFilled(dest)) return { copied: false, dest, reason: 'already' }
  await mkdir(join(String(dshHome || ''), 'storages'), { recursive: true })
  for (const home of workspaceSourceHomes(dshHome, options)) {
    const source = join(home, WORKSPACE_STORE_REL)
    if (!existsSync(source)) continue
    try {
      if (!workspaceStoreHasRows(await readFile(source, 'utf8'))) continue
    } catch {
      continue
    }
    await copyFile(source, dest)
    return { copied: true, dest, source }
  }
  return { copied: false, dest, reason: 'no_source' }
}
