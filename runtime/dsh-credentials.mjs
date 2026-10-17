import { copyFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { chmod, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const EMPTY_CREDENTIALS_DOCUMENT = 'version: 1\nrefs:\n'

export function defaultOfficialDshHome() {
  return join(homedir(), '.dsh')
}

export function defaultFdeDshHome() {
  return join(homedir(), '.dsh-fde-x')
}

export function credentialSourceHomes(dshHome, options = {}) {
  const dest = String(dshHome || '').replace(/\/+$/u, '')
  const official = String(options.officialHome || defaultOfficialDshHome()).replace(/\/+$/u, '')
  const fde = String(options.fdeHome || defaultFdeDshHome()).replace(/\/+$/u, '')
  const homes = []
  for (const home of [official, fde]) {
    if (!home || home === dest || homes.includes(home)) continue
    homes.push(home)
  }
  return homes
}

export function seedDshCredentialsSync(dshHome, options = {}) {
  const destDir = String(dshHome || '')
  const dest = join(destDir, '.credentials.yaml')
  if (existsSync(dest)) return { copied: false, dest, reason: 'already' }
  mkdirSync(destDir, { recursive: true })
  for (const home of credentialSourceHomes(destDir, options)) {
    const source = join(home, '.credentials.yaml')
    if (!existsSync(source)) continue
    copyFileSync(source, dest)
    chmodSync(dest, 0o600)
    return { copied: true, dest, source }
  }
  return { copied: false, dest, reason: 'no_source' }
}

export async function seedDshCredentials(dshHome, options = {}) {
  const destDir = String(dshHome || '')
  const dest = join(destDir, '.credentials.yaml')
  if (existsSync(dest)) return { copied: false, dest, reason: 'already' }
  await mkdir(destDir, { recursive: true })
  for (const home of credentialSourceHomes(destDir, options)) {
    const source = join(home, '.credentials.yaml')
    if (!existsSync(source)) continue
    await copyFile(source, dest, constants.COPYFILE_EXCL)
    await chmod(dest, 0o600)
    return { copied: true, dest, source }
  }
  return { copied: false, dest, reason: 'no_source' }
}

export async function ensureCredentialsDocument(dshHome) {
  const destDir = String(dshHome || '').replace(/\/+$/u, '')
  const dest = join(destDir, '.credentials.yaml')
  if (existsSync(dest)) return { created: false, dest }
  await mkdir(destDir, { recursive: true })
  try {
    await writeFile(dest, EMPTY_CREDENTIALS_DOCUMENT, { mode: 0o600, flag: 'wx' })
  } catch (error) {
    if (error && error.code === 'EEXIST') return { created: false, dest }
    throw error
  }
  await chmod(dest, 0o600)
  return { created: true, dest }
}
