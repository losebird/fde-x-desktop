import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diskFiles, readLock, verifyLockDocument } from './lock-check.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const SOURCE_COMMIT = 'a13e45390a860162042ddbcdd5b6eee3b92651d8'
export const SOURCE_PARENT = '42e228fa25ad757b933bf5ffe1e3fe83640b4ae7'

const PLUGIN_DIR = 'runtime/plugins/dsh-semantic-os'

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function gitFiles(source) {
  const out = execFileSync('git', ['-C', source, 'ls-files', '-z'], { encoding: 'buffer' })
  return out.toString('utf8').split('\0').filter(Boolean)
}

function gitHead(source) {
  return execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

function excluded(rel) {
  if (rel === 'node_modules' || rel.startsWith('node_modules/')) return true
  if (rel === 'runtime-dist' || rel.startsWith('runtime-dist/')) return true
  if (rel === 'release-dist' || rel.startsWith('release-dist/')) return true
  if (rel.endsWith('.pyc') || rel.includes('/__pycache__/')) return true
  return false
}

function walkOverlay(dir, prefix = '') {
  const out = []
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) out.push(...walkOverlay(abs, rel))
    else out.push(rel)
  }
  return out
}

export function buildTree(source, overlayDir) {
  const files = new Map()
  for (const rel of gitFiles(source)) {
    if (excluded(rel)) continue
    files.set(`${PLUGIN_DIR}/${rel}`, readFileSync(join(source, rel)))
  }
  for (const rel of walkOverlay(overlayDir)) {
    files.set(`${PLUGIN_DIR}/${rel}`, readFileSync(join(overlayDir, rel)))
  }
  return files
}

function synthesizedEntry(files, overlay) {
  const listed = {}
  for (const rel of [...files.keys()].sort()) listed[rel] = sha256(files.get(rel))
  return {
    source: {
      repo: 'losebird/dsh-semantic-os',
      commit: SOURCE_COMMIT,
      parent: SOURCE_PARENT,
    },
    overlay: {
      repo: overlay.repo,
      commit: overlay.commit,
      path: overlay.path,
    },
    files: listed,
  }
}

function fail(errors) {
  for (const error of errors) console.error(error)
  console.error(`semantic-os tree verify failed (${errors.length})`)
  process.exit(1)
}

function verify(root, source, overlayDir) {
  const errors = []
  const head = gitHead(source)
  if (head !== SOURCE_COMMIT) errors.push(`source HEAD ${head} != ${SOURCE_COMMIT}`)
  const expected = buildTree(source, overlayDir)
  const expectedRels = new Set(expected.keys())
  for (const rel of diskFiles(root, PLUGIN_DIR)) {
    if (!expectedRels.has(rel)) errors.push(`extra ${rel}`)
  }
  for (const [rel, bytes] of expected) {
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      errors.push(`missing ${rel}`)
      continue
    }
    const disk = readFileSync(abs)
    if (!disk.equals(bytes)) errors.push(`bytes differ ${rel} disk=${sha256(disk)} expected=${sha256(bytes)}`)
  }
  const read = readLock(root)
  if (read.error) errors.push(read.error)
  else {
    const plugin = read.lock.plugins && read.lock.plugins['dsh-semantic-os']
    const overlay = plugin && plugin.overlay && typeof plugin.overlay === 'object' ? plugin.overlay : {}
    verifyLockDocument(root, read.lock, errors, {
      'dsh-semantic-os': synthesizedEntry(expected, overlay),
    })
  }
  if (errors.length) fail(errors)
  console.log(`source ${SOURCE_COMMIT}`)
  console.log(`files ${expected.size}`)
  console.log('semantic-os tree verify ok')
}

function usage() {
  console.error('usage: node scripts/plugins/semantic-os-tree.mjs verify --source <checkout> [--overlay <dir>] [--root <repo>]')
  process.exit(2)
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1]
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const command = process.argv[2]
  if (command !== 'verify') usage()
  const source = arg('--source', '')
  if (!source) usage()
  const root = arg('--root', repoRoot)
  const overlayDir = arg('--overlay', join(root, 'runtime/vendor-overlays/dsh-semantic-os'))
  if (!existsSync(overlayDir)) {
    console.error(`missing overlay ${overlayDir}`)
    process.exit(1)
  }
  verify(root, source, overlayDir)
}
