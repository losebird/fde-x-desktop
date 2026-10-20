import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'

const MARKER = '.fde-plugin-installed.json'
const SKIP_WALK = new Set(['node_modules', '.git', 'runtime-dist', '__pycache__', '.nsc-local', '.tmp-npm'])
const PY_EXTERNAL = new Set([
  '__future__', 'abc', 'argparse', 'array', 'ast', 'asyncio', 'base64', 'bisect', 'bz2',
  'calendar', 'codecs', 'collections', 'concurrent', 'configparser', 'contextlib', 'copy',
  'csv', 'ctypes', 'dataclasses', 'datetime', 'decimal', 'dis', 'email', 'enum', 'fnmatch',
  'fractions', 'functools', 'getpass', 'gettext', 'glob', 'gzip', 'hashlib', 'heapq', 'hmac',
  'html', 'http', 'importlib', 'inspect', 'io', 'itertools', 'json', 'locale', 'logging',
  'lzma', 'math', 'multiprocessing', 'netrc', 'numbers', 'operator', 'os', 'pathlib',
  'platform', 'plistlib', 'pprint', 'queue', 'random', 're', 'secrets', 'select', 'selectors',
  'shutil', 'signal', 'socket', 'sqlite3', 'ssl', 'stat', 'statistics', 'string', 'struct',
  'subprocess', 'sys', 'tarfile', 'tempfile', 'textwrap', 'threading', 'time', 'token',
  'tokenize', 'tomllib', 'traceback', 'types', 'typing', 'unittest', 'urllib', 'uuid',
  'warnings', 'weakref', 'xml', 'zipfile', 'zlib', 'zoneinfo',
  'semantica', 'PIL', 'rdflib', 'fastapi', 'pytesseract', 'uvicorn', 'faiss', 'numpy',
  'falkordblite', 'falkordb', 'atexit', 'pickle',
])

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function ancestorIsSymlink(path) {
  let cur = path
  while (cur && cur !== dirname(cur)) {
    try {
      if (lstatSync(cur).isSymbolicLink()) return true
    } catch {
      /* a missing segment is not a link */
    }
    cur = dirname(cur)
  }
  return false
}

async function unlinkIfSymlink(path) {
  try {
    const st = await lstat(path)
    if (!st.isSymbolicLink()) return false
    await unlink(path)
    return true
  } catch {
    return false
  }
}

async function walk(dir) {
  const out = []
  let names
  try {
    names = await readdir(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIP_WALK.has(name)) continue
    const path = join(dir, name)
    let st
    try {
      st = await lstat(path)
    } catch {
      continue
    }
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) out.push(...await walk(path))
    else if (!name.endsWith('.min.js')) out.push(path)
  }
  return out
}

function jsSpecifiers(source) {
  const found = []
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1])
  }
  return found
}

function resolveJs(fromFile, spec) {
  if (!spec.startsWith('.')) return 'bare'
  const base = join(dirname(fromFile), spec)
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, join(base, 'index.js'), join(base, 'index.mjs')]
  return candidates.find((candidate) => existsSync(candidate)) || null
}

function pySpecs(source) {
  const found = []
  const fromRe = /^\s*from\s+(\.+)?([\w.]*)\s+import\b/gm
  const importRe = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm
  for (const match of source.matchAll(fromRe)) {
    found.push(`${match[1] || ''}${match[2] || ''}`)
  }
  for (const match of source.matchAll(importRe)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+/)[0]
      if (name) found.push(name)
    }
  }
  return found
}

function resolvePy(fromFile, spec) {
  if (!spec) return 'external'
  if (spec.startsWith('.')) {
    let dots = 0
    while (spec[dots] === '.') dots += 1
    const rest = spec.slice(dots)
    let dir = dirname(fromFile)
    for (let i = 1; i < dots; i += 1) dir = dirname(dir)
    const rel = rest.replaceAll('.', sep)
    const base = rel ? join(dir, rel) : dir
    const candidates = rel
      ? [`${base}.py`, join(base, '__init__.py')]
      : [join(base, '__init__.py')]
    return candidates.find((candidate) => existsSync(candidate)) || null
  }
  if (spec.includes('.')) return 'external'
  if (PY_EXTERNAL.has(spec)) return 'external'
  const local = join(dirname(fromFile), `${spec}.py`)
  if (existsSync(local)) return local
  const pkg = join(dirname(fromFile), spec, '__init__.py')
  if (existsSync(pkg)) return pkg
  return null
}

export async function firstMissingClosure(root) {
  if (!existsSync(join(root, 'index.js'))) {
    const files = await walk(root)
    if (files.some((file) => /\.(js|mjs)$/.test(file))) return 'index.js'
  }
  const files = await walk(root)
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    if (/\.(js|mjs)$/.test(file)) {
      for (const spec of jsSpecifiers(text)) {
        const hit = resolveJs(file, spec)
        if (hit === 'bare' || hit) continue
        const name = spec.split('/').filter(Boolean).pop() || spec
        return name
      }
    } else if (file.endsWith('.py')) {
      for (const spec of pySpecs(text)) {
        const hit = resolvePy(file, spec)
        if (hit === 'external' || hit) continue
        const bare = spec.replace(/^\.+/, '').split('.').filter(Boolean).pop() || spec
        return `${bare}.py`
      }
    }
  }
  return null
}

async function digestTree(dir) {
  const files = (await walk(dir)).filter((file) => !file.endsWith(MARKER)).sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(dir, file).split(sep).join('/'))
    hash.update('\0')
    hash.update(await readFile(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function lockMap(lockText, pluginDir) {
  const doc = JSON.parse(lockText)
  const plugin = doc.plugins && doc.plugins[pluginDir]
  const files = plugin && plugin.files
  if (!files) return null
  const prefix = `runtime/plugins/${pluginDir}/`
  const map = new Map()
  for (const [rel, hash] of Object.entries(files)) {
    if (rel.startsWith(prefix) && typeof hash === 'string') map.set(rel.slice(prefix.length), hash)
  }
  return map
}

async function readMarker(dest) {
  try {
    return JSON.parse(await readFile(join(dest, MARKER), 'utf8'))
  } catch {
    return null
  }
}

function copyFilter(source) {
  return (src) => {
    const rel = relative(source, src)
    if (!rel) return true
    const parts = rel.split(sep)
    if (parts.includes('.git') || parts.includes('runtime-dist') || parts.includes('__pycache__')) return false
    return true
  }
}

const parkedFromLink = new Map()

async function prepareVendorRoot(dshHome) {
  const vendor = join(dshHome, 'vendor')
  let isLink = false
  try {
    isLink = (await lstat(vendor)).isSymbolicLink()
  } catch {
    return
  }
  if (!isLink) return
  for (const dir of ['dsh-lan-assist', 'dsh-semantic-os']) {
    const dist = join(vendor, dir, 'runtime-dist')
    if (!existsSync(dist)) continue
    const tmp = await mkdtemp(join(tmpdir(), 'fde-runtime-dist-'))
    await cp(dist, join(tmp, 'runtime-dist'), { recursive: true, dereference: true })
    parkedFromLink.set(`${dshHome}\0${dir}`, tmp)
  }
  await unlink(vendor)
  await mkdir(vendor, { recursive: true })
}

function takeLinkedRuntimeDist(dshHome, pluginDir) {
  const key = `${dshHome}\0${pluginDir}`
  const parked = parkedFromLink.get(key) || null
  parkedFromLink.delete(key)
  return parked
}

async function parkRuntimeDist(dest) {
  const dist = join(dest, 'runtime-dist')
  try {
    const st = await lstat(dist)
    if (!st.isDirectory() && !st.isSymbolicLink()) return null
  } catch {
    return null
  }
  const parked = await mkdtemp(join(tmpdir(), 'fde-runtime-dist-'))
  if (ancestorIsSymlink(dist)) {
    await cp(dist, join(parked, 'runtime-dist'), { recursive: true, dereference: true })
    return parked
  }
  await rename(dist, join(parked, 'runtime-dist'))
  return parked
}

async function restoreRuntimeDist(dest, parked) {
  if (!parked) return
  const target = join(dest, 'runtime-dist')
  await rm(target, { recursive: true, force: true })
  await rename(join(parked, 'runtime-dist'), target)
  await rm(parked, { recursive: true, force: true })
}

export async function detachVendorLink(dshHome, pluginDir) {
  await prepareVendorRoot(dshHome)
  const dest = join(dshHome, 'vendor', pluginDir)
  const parked = takeLinkedRuntimeDist(dshHome, pluginDir) || await parkRuntimeDist(dest)
  await unlinkIfSymlink(dest)
  return parked
}

async function vendorIsSymlink(dshHome) {
  try {
    return (await lstat(join(dshHome, 'vendor'))).isSymbolicLink()
  } catch {
    return false
  }
}

export async function syncRepoCache({ dshHome, pluginDir, source, refresh, lockText }) {
  let locked = null
  if (lockText) {
    locked = lockMap(lockText, pluginDir)
    if (!locked) return { ok: false, error: `missing lock files ${pluginDir}` }
    for (const [rel] of locked) {
      if (!existsSync(join(source, rel))) return { ok: false, error: `missing ${rel.split('/').pop()}` }
    }
  }
  const injected = !lockText
  const linkedVendor = injected && await vendorIsSymlink(dshHome)
  const dest = linkedVendor
    ? join(dshHome, 'plugin-cache', pluginDir)
    : join(dshHome, 'vendor', pluginDir)
  const parked = linkedVendor ? null : await detachVendorLink(dshHome, pluginDir)
  const digest = await digestTree(source)
  const marker = await readMarker(dest)
  const destReady = existsSync(dest) && !lstatSync(dest).isSymbolicLink()
  const same = marker && marker.digest === digest && (!locked || marker.lock === 'match')
  if (destReady && same && !refresh) {
    await restoreRuntimeDist(dest, parked)
    return { ok: true, copied: false, linkDir: dest }
  }
  const tempParent = await mkdtemp(join(tmpdir(), 'fde-plugin-stage-'))
  const temp = join(tempParent, pluginDir)
  await cp(source, temp, { recursive: true, dereference: true, filter: copyFilter(source) })
  if (locked) {
    for (const [rel, hash] of locked) {
      const file = join(temp, rel)
      if (!existsSync(file)) {
        await rm(tempParent, { recursive: true, force: true })
        return { ok: false, error: `missing ${rel.split('/').pop()}` }
      }
      const got = sha256(await readFile(file))
      if (got !== hash) {
        await rm(tempParent, { recursive: true, force: true })
        return { ok: false, error: `mismatch ${rel.split('/').pop()}` }
      }
    }
  }
  await mkdir(dirname(dest), { recursive: true })
  await rm(dest, { recursive: true, force: true })
  await rename(temp, dest)
  await rm(tempParent, { recursive: true, force: true })
  await restoreRuntimeDist(dest, parked)
  await writeFile(join(dest, MARKER), `${JSON.stringify({ digest, lock: locked ? 'match' : 'injected' })}\n`)
  return { ok: true, copied: true, linkDir: dest }
}

export async function natsDependencyError(pluginDir) {
  let pkg
  try {
    pkg = JSON.parse(await readFile(join(pluginDir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  if (!pkg.dependencies || !pkg.dependencies.nats) return null
  const probe = join(pluginDir, `.nats-preflight-${process.pid}.mjs`)
  await writeFile(probe, "try { await import('nats') } catch { process.stdout.write(JSON.stringify({ error: 'NATS_DEPENDENCY_MISSING' })); process.exit(1) }\n")
  try {
    const ran = spawnSync(process.execPath, [probe], { cwd: pluginDir, encoding: 'utf8' })
    if (ran.status !== 0) return 'NATS_DEPENDENCY_MISSING'
    return null
  } finally {
    await rm(probe, { force: true })
  }
}
