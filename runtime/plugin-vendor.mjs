import { access, cp, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises'
import { constants, existsSync, realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export const PLUGIN_PIN_FILE = 'fde-plugin-pin.json'

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

export async function readInstalledPin(vendorDir) {
  const pkg = await readJson(join(vendorDir, 'package.json'))
  const pin = await readJson(join(vendorDir, PLUGIN_PIN_FILE))
  return {
    version: pkg && typeof pkg.version === 'string' ? pkg.version : null,
    commit: pin && typeof pin.commit === 'string' ? pin.commit : null,
  }
}

function pinMatches(installed, pin) {
  return installed.version === pin.version && installed.commit === pin.commit
}

async function firstReadable(candidates) {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.R_OK)
      await access(join(candidate, 'package.json'), constants.R_OK)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

function sameRealPath(left, right) {
  try {
    return realpathSync(left) === realpathSync(right)
  } catch {
    return false
  }
}

async function removePinTemps(vendorDir) {
  const parent = dirname(vendorDir)
  const base = basename(vendorDir)
  let names
  try {
    names = await readdir(parent)
  } catch {
    return
  }
  await Promise.all(names.map((name) => {
    if (name.startsWith(`${base}.staging-`) || name.startsWith(`${base}.bak-`)) {
      return rm(join(parent, name), { recursive: true, force: true })
    }
    return undefined
  }))
}

export async function reconcilePinnedVendor({ vendorDir, pin, candidates, pid = process.pid }) {
  if (existsSync(vendorDir)) {
    const installed = await readInstalledPin(vendorDir)
    if (pinMatches(installed, pin)) {
      await removePinTemps(vendorDir)
      return { ok: true, action: 'keep' }
    }
  }

  const source = await firstReadable(candidates)
  if (!source) return { ok: false, action: 'missing-source' }
  if (existsSync(vendorDir) && sameRealPath(source, vendorDir)) {
    return { ok: false, action: 'source-is-vendor' }
  }

  const staging = `${vendorDir}.staging-${pid}`
  const backup = `${vendorDir}.bak-${pid}`
  await rm(staging, { recursive: true, force: true })
  await mkdir(dirname(vendorDir), { recursive: true })
  let replaced = false
  try {
    await cp(source, staging, { recursive: true, dereference: true })
    const staged = await readInstalledPin(staging)
    if (!pinMatches(staged, pin)) {
      await rm(staging, { recursive: true, force: true })
      return { ok: false, action: 'source-mismatch' }
    }
    const hadVendor = existsSync(vendorDir)
    if (hadVendor) await rename(vendorDir, backup)
    try {
      await rename(staging, vendorDir)
      replaced = true
    } catch (error) {
      if (hadVendor && !existsSync(vendorDir) && existsSync(backup)) await rename(backup, vendorDir)
      throw error
    }
    await rm(backup, { recursive: true, force: true })
    await removePinTemps(vendorDir)
    return { ok: true, action: hadVendor ? 'replace' : 'install' }
  } catch (error) {
    if (!replaced) await rm(staging, { recursive: true, force: true })
    throw error
  }
}
