import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LOCK_PATH = 'runtime/plugins/plugins.lock.json'
const SHA = /^[a-f0-9]{40}$/u
const HEX64 = /^[a-f0-9]{64}$/u
const SKIP_DIR = new Set(['node_modules', '.git', '.tmp-npm', '.nsc-local'])

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function fail(errors) {
  for (const error of errors) console.error(error)
  console.error(`plugins.lock verify failed (${errors.length})`)
  process.exit(1)
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

function diskFiles(root, dir) {
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

function verifyPlugin(name, plugin, errors) {
  const source = plugin && plugin.source
  const overlay = plugin && plugin.overlay
  if (!source || typeof source.repo !== 'string' || !/^[^/\s]+\/[^/\s]+$/u.test(source.repo)) {
    errors.push(`${name} source.repo`)
  }
  if (!source || !SHA.test(source.commit || '')) errors.push(`${name} source.commit`)
  if (!source || !SHA.test(source.parent || '')) errors.push(`${name} source.parent`)
  if (!overlay || typeof overlay.repo !== 'string' || !overlay.repo) errors.push(`${name} overlay.repo`)
  if (!overlay || !SHA.test(overlay.commit || '')) errors.push(`${name} overlay.commit`)
  if (!overlay || typeof overlay.path !== 'string' || !overlay.path) errors.push(`${name} overlay.path`)
  else if (!existsSync(join(repoRoot, overlay.path))) errors.push(`${name} missing overlay ${overlay.path}`)
  const files = plugin && plugin.files
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    errors.push(`${name} files`)
    return 0
  }
  let mismatch = 0
  for (const [rel, hash] of Object.entries(files)) {
    if (typeof hash !== 'string' || !HEX64.test(hash)) {
      errors.push(`${name} bad hash ${rel}`)
      mismatch += 1
      continue
    }
    const abs = join(repoRoot, rel)
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
    for (const rel of diskFiles(repoRoot, tree)) {
      if (!expected.has(rel)) {
        errors.push(`${name} extra ${rel}`)
        mismatch += 1
      }
    }
  }
  console.log(`${name} files ${Object.keys(files).length} mismatch ${mismatch}`)
  return mismatch
}

const lockAbs = join(repoRoot, LOCK_PATH)
if (!existsSync(lockAbs)) fail([`missing ${LOCK_PATH}`])
const lock = JSON.parse(readFileSync(lockAbs, 'utf8'))
const errors = []
if (!lock || lock.version !== 1) errors.push('version must be 1')
const plugins = lock && lock.plugins
if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) {
  fail([...errors, 'plugins must be an object'])
}
for (const name of ['dsh-lan-assist', 'dsh-semantic-os']) {
  if (!plugins[name]) errors.push(`missing plugin ${name}`)
}
let mismatch = 0
for (const [name, plugin] of Object.entries(plugins)) {
  mismatch += verifyPlugin(name, plugin, errors)
}
console.log(`mismatch ${mismatch}`)
if (errors.length) fail(errors)
console.log('plugins.lock verify ok')
