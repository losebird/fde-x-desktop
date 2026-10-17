import { access, cp, mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises'
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

function tempPid(base, name, kind) {
  const prefix = `${base}.${kind}-`
  if (!name.startsWith(prefix)) return null
  const rest = name.slice(prefix.length)
  if (!/^\d+$/u.test(rest)) return null
  return Number(rest)
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

async function siblingNames(vendorDir) {
  try {
    return await readdir(dirname(vendorDir))
  } catch {
    return []
  }
}

async function removePinTemps(vendorDir, pid) {
  const parent = dirname(vendorDir)
  const base = basename(vendorDir)
  const names = await siblingNames(vendorDir)
  await Promise.all(names.map((name) => {
    const stagingPid = tempPid(base, name, 'staging')
    const bakPid = tempPid(base, name, 'bak')
    const own = stagingPid === pid || bakPid === pid
    const deadStaging = stagingPid !== null && stagingPid !== pid && !pidAlive(stagingPid)
    if (!own && !deadStaging) return undefined
    return rm(join(parent, name), { recursive: true, force: true })
  }))
}

async function restoreDeadBak(vendorDir, renameImpl) {
  if (existsSync(vendorDir)) return false
  const parent = dirname(vendorDir)
  const base = basename(vendorDir)
  const names = await siblingNames(vendorDir)
  const baks = names.filter((name) => {
    const bakPid = tempPid(base, name, 'bak')
    return bakPid !== null && !pidAlive(bakPid)
  })
  if (!baks.length) return false
  let chosen = baks[0]
  let newest = -1
  for (const name of baks) {
    const info = await stat(join(parent, name))
    if (info.mtimeMs >= newest) {
      newest = info.mtimeMs
      chosen = name
    }
  }
  await renameImpl(join(parent, chosen), vendorDir)
  return true
}

function failure(action, error) {
  return {
    ok: false,
    action,
    error: error instanceof Error ? error.message : String(error),
  }
}

export async function reconcilePinnedVendor({
  vendorDir,
  pin,
  candidates,
  pid = process.pid,
  renameImpl = rename,
}) {
  const restored = await restoreDeadBak(vendorDir, renameImpl)
  if (existsSync(vendorDir)) {
    const installed = await readInstalledPin(vendorDir)
    if (pinMatches(installed, pin)) {
      await removePinTemps(vendorDir, pid)
      return { ok: true, action: restored ? 'restore' : 'keep' }
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
  try {
    await cp(source, staging, { recursive: true, dereference: true })
    const staged = await readInstalledPin(staging)
    if (!pinMatches(staged, pin)) {
      await rm(staging, { recursive: true, force: true })
      return { ok: false, action: 'source-mismatch' }
    }
    const hadVendor = existsSync(vendorDir)
    if (hadVendor) await renameImpl(vendorDir, backup)
    try {
      await renameImpl(staging, vendorDir)
    } catch (error) {
      if (hadVendor && !existsSync(vendorDir) && existsSync(backup)) {
        await renameImpl(backup, vendorDir)
      }
      await rm(staging, { recursive: true, force: true })
      return failure('rename-failed', error)
    }
    await rm(backup, { recursive: true, force: true })
    await removePinTemps(vendorDir, pid)
    return { ok: true, action: hadVendor ? 'replace' : 'install' }
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    let restoreError = ''
    if (!existsSync(vendorDir) && existsSync(backup)) {
      try {
        await renameImpl(backup, vendorDir)
      } catch (restore) {
        restoreError = restore instanceof Error ? restore.message : String(restore)
      }
    }
    const message = error instanceof Error ? error.message : String(error)
    return failure('copy-failed', restoreError ? `${message}；备份未能放回：${restoreError}` : message)
  }
}
