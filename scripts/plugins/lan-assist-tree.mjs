import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const SOURCE_COMMIT = '31d75468e0ffd58bb5bb214325c7517c7c42a8ab'
export const OVERLAY_COMMIT = '6a79f383b951c7e13f424c4577dc06b85f64304e'
export const NATS_VERSION = '2.29.3'
export const NATS_INTEGRITY = 'sha512-tOQCRCwC74DgBTk4pWZ9V45sk4d7peoE2njVprMRCBXrhJ5q5cYM7i6W+Uvw2qUrcfOSnuisrX7bEx3b3Wx4QA=='

export const VENDOR_BLOBS = {
  'pair.js': 'aa0b2cbc016aa57d02bf568b78667e48ef9b1c97',
  'seat.js': '3af9fcd2bf207332763158b02005fc22425106b8',
  'shout.js': '6288c12a4b966b128d8e4483cd6152f272aaf5af',
  'plan.js': '1da395d53730337fb81d7e90c7b97eeb2de51db7',
}

const KEEP_SOURCE = new Set(['pair.js', 'seat.js', 'shout.js'])

const PLUGIN_DIR = 'runtime/plugins/dsh-lan-assist'
const DOCS_DIR = 'docs/plugins/dsh-lan-assist'
const TOOLS_DIR = 'tools/lan-assist-nats'
const LOCK_PATH = 'runtime/plugins/plugins.lock.json'

const EXCLUDE_FILES = new Set(['leftover-cancel.mjs'])
const EXCLUDE_PREFIXES = ['demo/', 'dist/']

const DOC_ROOT_FILES = new Set([
  'CONTEXT.md',
  'research-feasibility-review.md',
  'dsh-lan-assist-feasibility.md',
  '推广.md',
])

const MOVED = new Map([
  ['scripts/nsc-creds.mjs', `${TOOLS_DIR}/nsc-creds.mjs`],
  ['scripts/nats-probe.mjs', `${TOOLS_DIR}/nats-probe.mjs`],
  ['scripts/nats-accept.mjs', `${TOOLS_DIR}/nats-accept.mjs`],
  ['scripts/nats-accept-mail.mjs', `${TOOLS_DIR}/nats-accept-mail.mjs`],
  ['docker/nats.yml', `${TOOLS_DIR}/docker/nats.yml`],
  ['docker/nats.jwt.yml', `${TOOLS_DIR}/docker/nats.jwt.yml`],
])

const DROP_SCRIPTS = ['nsc-creds', 'nsc-issue', 'nats-probe', 'nats-accept', 'nats-accept-mail']
const OPTIONAL_LOCK_PACKAGES = ['node_modules/nats', 'node_modules/nkeys.js', 'node_modules/tweetnacl']

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

function gitBlob(source, rel) {
  return execFileSync('git', ['-C', source, 'rev-parse', `HEAD:${rel}`], { encoding: 'utf8' }).trim()
}

function excluded(rel) {
  if (EXCLUDE_FILES.has(rel)) return true
  return EXCLUDE_PREFIXES.some((prefix) => rel.startsWith(prefix))
}

function destFor(rel) {
  if (excluded(rel)) return null
  if (MOVED.has(rel)) return MOVED.get(rel)
  if (rel.startsWith('docs/') || DOC_ROOT_FILES.has(rel)) return `${DOCS_DIR}/${rel}`
  return `${PLUGIN_DIR}/${rel}`
}

export function transformPackage(pkg) {
  const next = {}
  for (const [key, value] of Object.entries(pkg)) {
    if (key === 'optionalDependencies') {
      next.dependencies = { nats: NATS_VERSION }
      continue
    }
    if (key === 'files') {
      next.files = value.filter((entry) => !MOVED.has(entry))
      continue
    }
    if (key === 'scripts') {
      const scripts = { ...value }
      for (const name of DROP_SCRIPTS) delete scripts[name]
      next.scripts = scripts
      continue
    }
    next[key] = value
  }
  if (!next.dependencies?.nats) next.dependencies = { ...(next.dependencies || {}), nats: NATS_VERSION }
  return next
}

export function transformLock(lock) {
  const next = structuredClone(lock)
  const root = next.packages['']
  root.dependencies = { ...(root.dependencies || {}), nats: NATS_VERSION }
  delete root.optionalDependencies
  for (const name of OPTIONAL_LOCK_PACKAGES) {
    if (next.packages[name]) delete next.packages[name].optional
  }
  const nats = next.packages['node_modules/nats']
  if (!nats || nats.version !== NATS_VERSION || nats.integrity !== NATS_INTEGRITY) {
    throw new Error(`package-lock nats pin is not ${NATS_VERSION}`)
  }
  return next
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
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
  const head = gitHead(source)
  if (head !== SOURCE_COMMIT) throw new Error(`source HEAD ${head} != ${SOURCE_COMMIT}`)
  const files = new Map()
  for (const rel of gitFiles(source)) {
    const dest = destFor(rel)
    if (!dest) continue
    let bytes = readFileSync(join(source, rel))
    if (rel === 'package.json') bytes = jsonBytes(transformPackage(JSON.parse(bytes.toString('utf8'))))
    if (rel === 'package-lock.json') bytes = jsonBytes(transformLock(JSON.parse(bytes.toString('utf8'))))
    files.set(dest, bytes)
  }
  for (const rel of walkOverlay(overlayDir)) {
    if (KEEP_SOURCE.has(rel)) continue
    const dest = `${PLUGIN_DIR}/${rel}`
    files.set(dest, readFileSync(join(overlayDir, rel)))
  }
  for (const [name, blob] of Object.entries(VENDOR_BLOBS)) {
    const fromSource = gitBlob(source, name)
    if (fromSource !== blob) throw new Error(`${name} blob ${fromSource} != ${blob}`)
  }
  return files
}

function lockDocument(files) {
  const listed = {}
  for (const rel of [...files.keys()].sort()) listed[rel] = sha256(files.get(rel))
  return {
    version: 1,
    plugins: {
      'dsh-lan-assist': {
        source: { repo: 'losebird/dsh-lan-assist', commit: SOURCE_COMMIT },
        overlay: {
          repo: 'losebird/fde-x-desktop',
          commit: OVERLAY_COMMIT,
          path: 'runtime/vendor-overlays/dsh-lan-assist',
        },
        blobs: VENDOR_BLOBS,
        excluded: ['leftover-cancel.mjs', 'demo/', 'dist/'],
        dependencies: { nats: { version: NATS_VERSION, integrity: NATS_INTEGRITY } },
        files: listed,
      },
    },
  }
}

function writeTree(root, files) {
  const dirs = [PLUGIN_DIR, DOCS_DIR, TOOLS_DIR]
  for (const dir of dirs) {
    const abs = join(root, dir)
    if (existsSync(abs)) rmSync(abs, { recursive: true, force: true })
  }
  for (const [rel, bytes] of files) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, bytes)
  }
  const lock = lockDocument(files)
  mkdirSync(dirname(join(root, LOCK_PATH)), { recursive: true })
  writeFileSync(join(root, LOCK_PATH), jsonBytes(lock))
  return lock
}

function diskFiles(root, dir) {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  const out = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      if (name === 'node_modules' || name === '.tmp-npm' || name === '.nsc-local' || name === '.git') continue
      const path = join(current, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(root, path).split(sep).join('/'))
    }
  }
  walk(abs)
  return out
}

function fail(errors) {
  for (const error of errors) console.error(error)
  console.error(`lan-assist tree verify failed (${errors.length})`)
  process.exit(1)
}

function verify(root, source, overlayDir) {
  const errors = []
  const expected = buildTree(source, overlayDir)
  const lock = lockDocument(expected)
  const onDisk = [
    ...diskFiles(root, PLUGIN_DIR),
    ...diskFiles(root, DOCS_DIR),
    ...diskFiles(root, TOOLS_DIR),
  ]
  const expectedRels = new Set(expected.keys())
  for (const rel of onDisk) {
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
  const lockAbs = join(root, LOCK_PATH)
  if (!existsSync(lockAbs)) errors.push(`missing ${LOCK_PATH}`)
  else {
    const parsed = JSON.parse(readFileSync(lockAbs, 'utf8'))
    const want = lock.plugins['dsh-lan-assist']
    const got = parsed.plugins?.['dsh-lan-assist']
    if (JSON.stringify(got) !== JSON.stringify(want)) errors.push('plugins.lock.json does not match the synthesized tree')
  }
  const pluginPkg = JSON.parse(readFileSync(join(root, PLUGIN_DIR, 'package.json'), 'utf8'))
  if (pluginPkg.dependencies?.nats !== NATS_VERSION) errors.push('package.json dependencies.nats is not 2.29.3')
  if (pluginPkg.optionalDependencies) errors.push('package.json still has optionalDependencies')
  for (const [name, blob] of Object.entries(VENDOR_BLOBS)) {
    const hashed = execFileSync('git', ['hash-object', join(root, PLUGIN_DIR, name)], { encoding: 'utf8' }).trim()
    if (hashed !== blob) errors.push(`${name} blob ${hashed} != ${blob}`)
  }
  if (existsSync(join(root, PLUGIN_DIR, 'leftover-cancel.mjs'))) errors.push('leftover-cancel.mjs was included')
  if (errors.length) fail(errors)
  const plugin = lock.plugins['dsh-lan-assist']
  console.log(`source ${plugin.source.commit}`)
  console.log(`overlay ${plugin.overlay.commit} ${plugin.overlay.path}`)
  console.log(`files ${Object.keys(plugin.files).length}`)
  console.log(`nats ${plugin.dependencies.nats.version} ${plugin.dependencies.nats.integrity}`)
  for (const [name, blob] of Object.entries(plugin.blobs)) console.log(`blob ${name} ${blob}`)
  console.log('lan-assist tree verify ok')
}

function usage() {
  console.error('usage: node scripts/plugins/lan-assist-tree.mjs <sync|verify> --source <checkout> [--overlay <dir>] [--root <repo>]')
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
  if (command !== 'sync' && command !== 'verify') usage()
  const source = arg('--source', '')
  if (!source) usage()
  const overlayDir = arg('--overlay', join(repoRoot, 'runtime/vendor-overlays/dsh-lan-assist'))
  const root = arg('--root', repoRoot)
  const files = buildTree(source, overlayDir)
  if (command === 'sync') {
    const lock = writeTree(root, files)
    console.log(`wrote ${files.size} files`)
    console.log(`lock ${Object.keys(lock.plugins['dsh-lan-assist'].files).length}`)
  } else {
    verify(root, source, overlayDir)
  }
}
