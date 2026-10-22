import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diskFiles, readLock, verifyLockDocument } from './lock-check.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const SOURCE_COMMIT = '31d75468e0ffd58bb5bb214325c7517c7c42a8ab'
export const SOURCE_PARENT = 'ab6a03af83c65eb6238a254aa1ddf999f1be7515'
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
const OVERLAY_SKIP = new Set(['node_modules', '.git', 'runtime-dist', '__pycache__', '.nsc-local', '.tmp-npm'])

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

function gitParent(source) {
  return execFileSync('git', ['-C', source, 'rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim()
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
    if (OVERLAY_SKIP.has(name)) continue
    const abs = join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) out.push(...walkOverlay(abs, rel))
    else out.push(rel)
  }
  return out
}

function materializeOverlay(overlayDir, root) {
  if (resolve(overlayDir) !== resolve(root, PLUGIN_DIR)) return overlayDir
  const snap = mkdtempSync(join(tmpdir(), 'lan-overlay-'))
  cpSync(overlayDir, snap, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(overlayDir.length).replace(/^[/\\]/, '')
      if (!rel) return true
      return !rel.split(/[/\\]/).some((part) => OVERLAY_SKIP.has(part))
    },
  })
  return snap
}

export function buildTree(source, overlayDir) {
  const head = gitHead(source)
  if (head !== SOURCE_COMMIT) throw new Error(`source HEAD ${head} != ${SOURCE_COMMIT}`)
  const parent = gitParent(source)
  if (parent !== SOURCE_PARENT) throw new Error(`source parent ${parent} != ${SOURCE_PARENT}`)
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

export function canonicalLanShape(plugin) {
  const source = plugin.source && typeof plugin.source === 'object' ? plugin.source : {}
  const overlay = plugin.overlay && typeof plugin.overlay === 'object' ? plugin.overlay : {}
  const rawBlobs = plugin.blobs && typeof plugin.blobs === 'object' && !Array.isArray(plugin.blobs) ? plugin.blobs : {}
  const blobs = {}
  for (const name of Object.keys(VENDOR_BLOBS)) {
    if (Object.hasOwn(rawBlobs, name)) blobs[name] = rawBlobs[name]
  }
  const natsIn = plugin.dependencies && typeof plugin.dependencies === 'object' ? plugin.dependencies.nats : undefined
  const nats = natsIn && typeof natsIn === 'object' ? natsIn : {}
  const rawFiles = plugin.files && typeof plugin.files === 'object' && !Array.isArray(plugin.files) ? plugin.files : {}
  const files = {}
  for (const rel of Object.keys(rawFiles).sort()) files[rel] = rawFiles[rel]
  return {
    source: { repo: source.repo, commit: source.commit, parent: source.parent },
    overlay: { repo: overlay.repo, commit: overlay.commit, path: overlay.path },
    blobs,
    excluded: Array.isArray(plugin.excluded) ? plugin.excluded.slice() : plugin.excluded,
    dependencies: { nats: { version: nats.version, integrity: nats.integrity } },
    files,
  }
}

function lockDocument(files) {
  const listed = {}
  for (const rel of [...files.keys()].sort()) listed[rel] = sha256(files.get(rel))
  return {
    version: 1,
    plugins: {
      'dsh-lan-assist': {
        source: { repo: 'losebird/dsh-lan-assist', commit: SOURCE_COMMIT, parent: SOURCE_PARENT },
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function lockStyle(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const indented = text.split(/\r?\n/u).find((line) => /^[ \t]+\S/u.test(line))
  const indent = indented ? indented.match(/^[ \t]+/u)[0] : '  '
  return { indent, newline, trailing: text.endsWith('\n') }
}

function endOfJsonValue(text, start) {
  const open = text[start]
  if (open !== '{' && open !== '[') {
    if (open === '"') {
      for (let i = start + 1; i < text.length; i += 1) {
        if (text[i] === '\\') {
          i += 1
          continue
        }
        if (text[i] === '"') return i + 1
      }
      throw new Error('unterminated string')
    }
    const matched = text.slice(start).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|^true|^false|^null/u)
    if (!matched) throw new Error(`bad json value at ${start}`)
    return start + matched[0].length
  }
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i += 1) {
    const c = text[i]
    if (inString) {
      if (c === '\\') {
        i += 1
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
  }
  throw new Error('unterminated json value')
}

function formatDocument(doc, style) {
  let text = JSON.stringify(doc, null, style.indent)
  if (style.newline === '\r\n') text = text.replace(/\n/g, '\r\n')
  if (style.trailing) text += style.newline
  return text
}

function replacePluginEntry(text, name, entry) {
  const key = `"${name}"`
  const start = text.indexOf(key)
  if (start < 0) {
    const doc = JSON.parse(text)
    doc.plugins[name] = entry
    return formatDocument(doc, lockStyle(text))
  }
  let i = start + key.length
  while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i += 1
  if (text[i] !== ':') throw new Error(`missing entry ${name}`)
  i += 1
  while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i += 1
  const valueEnd = endOfJsonValue(text, i)
  const old = JSON.parse(text.slice(i, valueEnd))
  if (stableJson(old) === stableJson(entry)) return text
  const style = lockStyle(text)
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const keyIndent = text.slice(lineStart, start).match(/^[ \t]*/u)[0]
  let rendered = JSON.stringify(entry, null, style.indent).replace(/\n/g, `\n${keyIndent}`)
  if (style.newline === '\r\n') rendered = rendered.replace(/\n/g, '\r\n')
  return text.slice(0, i) + rendered + text.slice(valueEnd)
}

function isLockDocument(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.plugins
    && typeof value.plugins === 'object'
    && !Array.isArray(value.plugins)
}

function loadLock(root) {
  const lockAbs = join(root, LOCK_PATH)
  if (!existsSync(lockAbs)) throw new Error(`missing ${LOCK_PATH}`)
  const text = readFileSync(lockAbs, 'utf8')
  let existing
  try {
    existing = JSON.parse(text)
  } catch (error) {
    throw new Error(`unreadable ${LOCK_PATH}: ${error.message}`, { cause: error })
  }
  if (!isLockDocument(existing)) throw new Error(`unreadable ${LOCK_PATH}`)
  return { lockAbs, text, existing }
}

function writeTree(root, files) {
  const loaded = loadLock(root)
  const nextEntry = lockDocument(files).plugins['dsh-lan-assist']
  const nextText = replacePluginEntry(loaded.text, 'dsh-lan-assist', nextEntry)
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
  if (nextText !== loaded.text) writeFileSync(loaded.lockAbs, nextText)
  loaded.existing.plugins['dsh-lan-assist'] = nextEntry
  return loaded.existing
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
  const read = readLock(root)
  if (read.syntax) {
    errors.push(read.error)
    fail(errors)
  }
  if (read.error) errors.push(read.error)
  else {
    verifyLockDocument(root, read.lock, errors, {
      'dsh-lan-assist': lock.plugins['dsh-lan-assist'],
    })
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
  const overlayDir = materializeOverlay(arg('--overlay', join(repoRoot, PLUGIN_DIR)), arg('--root', repoRoot))
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
