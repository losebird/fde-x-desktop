import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const LOCK_REL = 'runtime/plugins/plugins.lock.json'
export const REQUIRED_PLUGINS = ['dsh-lan-assist', 'dsh-semantic-os']

const SHA40 = /^[a-f0-9]{40}$/u
const HEX64 = /^[a-f0-9]{64}$/u
const SKIP_DIR = new Set(['node_modules', '.git', '.tmp-npm', '.nsc-local'])

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

export function readLock(root) {
  const lockAbs = join(root, LOCK_REL)
  if (!existsSync(lockAbs)) return { error: `missing ${LOCK_REL}` }
  const text = readFileSync(lockAbs, 'utf8')
  try {
    return { lock: JSON.parse(text), text }
  } catch (error) {
    if (error instanceof SyntaxError) return { error: `${LOCK_REL}: ${error.message}`, syntax: true }
    throw error
  }
}

export function diskFiles(root, dir) {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  const out = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      if (SKIP_DIR.has(name)) continue
      const path = join(current, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(root, path).split(sep).join('/'))
    }
  }
  walk(abs)
  return out
}

function treesFor(name, files) {
  const roots = new Set()
  for (const rel of Object.keys(files)) {
    if (rel.startsWith(`runtime/plugins/${name}/`)) roots.add(`runtime/plugins/${name}`)
    else if (rel.startsWith(`docs/plugins/${name}/`)) roots.add(`docs/plugins/${name}`)
    else if (rel.startsWith('tools/')) roots.add(`tools/${rel.split('/')[1]}`)
  }
  return [...roots]
}

function checkPlugin(root, name, plugin, errors) {
  const source = plugin && plugin.source
  const overlay = plugin && plugin.overlay
  if (!source || typeof source.repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/u.test(source.repo)) {
    errors.push(`${name} source.repo`)
  }
  if (!source || !SHA40.test(source.commit || '')) errors.push(`${name} source.commit`)
  if (!source || !SHA40.test(source.parent || '')) errors.push(`${name} source.parent`)
  if (!overlay || typeof overlay.repo !== 'string' || !overlay.repo) errors.push(`${name} overlay.repo`)
  if (!overlay || !SHA40.test(overlay.commit || '')) errors.push(`${name} overlay.commit`)
  if (!overlay || typeof overlay.path !== 'string' || !overlay.path) errors.push(`${name} overlay.path`)
  const files = plugin && plugin.files
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    errors.push(`${name} files`)
    return null
  }
  let mismatch = 0
  for (const [rel, hash] of Object.entries(files)) {
    if (typeof hash !== 'string' || !HEX64.test(hash)) {
      errors.push(`${name} bad hash ${rel}`)
      mismatch += 1
      continue
    }
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      errors.push(`${name} missing ${rel}`)
      mismatch += 1
      continue
    }
    const got = sha256(readFileSync(abs))
    if (got !== hash) {
      errors.push(`${name} mismatch ${rel} disk=${got} lock=${hash}`)
      mismatch += 1
    }
  }
  const expected = new Set(Object.keys(files))
  for (const tree of treesFor(name, files)) {
    for (const rel of diskFiles(root, tree)) {
      if (!expected.has(rel)) {
        errors.push(`${name} extra ${rel}`)
        mismatch += 1
      }
    }
  }
  return { name, files: Object.keys(files).length, mismatch }
}

export function verifyLockDocument(root, lock, errors, expectedByName = {}) {
  if (!lock || lock.version !== 1) errors.push('version must be 1')
  const plugins = lock && lock.plugins
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
    errors.push('plugins must be an object')
    return null
  }
  for (const name of REQUIRED_PLUGINS) {
    if (!plugins[name]) errors.push(`missing plugin ${name}`)
  }
  const stats = []
  for (const [name, plugin] of Object.entries(plugins)) {
    const stat = checkPlugin(root, name, plugin, errors)
    if (stat) stats.push(stat)
    const expected = expectedByName[name]
    if (expected !== undefined && JSON.stringify(plugin) !== JSON.stringify(expected)) {
      errors.push(`plugins.lock.json entry ${name} does not match the synthesized tree`)
    }
  }
  return stats
}
