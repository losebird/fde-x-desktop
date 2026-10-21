import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RUNTIME_VERSION } from './version.js'

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))

const require = createRequire(import.meta.url)
const SUPPORTED = new Set([
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
  'win32-x64',
])

export function runtimeKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`
}

export function runtimePackageName(platform = process.platform, arch = process.arch) {
  return `dsh-semantic-os-runtime-${runtimeKey(platform, arch)}`
}

export async function resolveBundledRuntime(options = {}) {
  const platform = options.platform || process.platform
  const arch = options.arch || process.arch
  const key = runtimeKey(platform, arch)
  if (!SUPPORTED.has(key)) return { ok: false, error: 'UNSUPPORTED_PLATFORM', key }
  const packageName = runtimePackageName(platform, arch)
  let root = options.runtimeRoot || ''
  if (!root) {
    const local = join(PLUGIN_DIR, 'runtime-dist', key)
    if (existsSync(join(local, 'runtime-manifest.json'))) {
      root = local
    } else {
      let packageJson
      try {
        packageJson = require.resolve(`${packageName}/package.json`)
      } catch {
        return { ok: false, error: 'RUNTIME_PACKAGE_MISSING', key, packageName }
      }
      root = dirname(packageJson)
    }
  }
  let manifest
  let manifestDigest = ''
  try {
    const raw = await readFile(join(root, 'runtime-manifest.json'))
    manifestDigest = createHash('sha256').update(raw).digest('hex')
    manifest = JSON.parse(raw.toString('utf8'))
  } catch (error) {
    return { ok: false, error: 'RUNTIME_MANIFEST_INVALID', key, packageName, detail: error instanceof Error ? error.message : String(error) }
  }
  if (![1, 2].includes(manifest.schemaVersion) || manifest.platform !== platform || manifest.arch !== arch || manifest.runtimeVersion !== RUNTIME_VERSION) {
    return { ok: false, error: 'RUNTIME_MANIFEST_MISMATCH', key, packageName }
  }
  const pythonRel = safeRelative(manifest.python)
  if (!pythonRel) return { ok: false, error: 'RUNTIME_MANIFEST_INVALID', key, packageName }
  const python = join(root, pythonRel)
  if (options.verifyFiles !== false) {
    const checksum = manifest.schemaVersion === 2
      ? await verifyTree(root, manifest)
      : await verifyManifestFiles(root, manifest.files)
    if (!checksum.ok) return { ...checksum, key, packageName }
  }
  return { ok: true, key, packageName, root, python, manifest, manifestDigest, verified: options.verifyFiles !== false }
}

export function treeRelativePath(root, filePath) {
  const rel = relative(root, filePath).replaceAll('\\', '/')
  return process.platform === 'win32' ? rel.toLowerCase() : rel
}

export function computeRuntimeTreeSync(root) {
  const files = []
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (dir === root && (name === 'runtime-manifest.json' || name === 'package.json')) continue
      const path = join(dir, name)
      const info = statSync(path)
      if (info.isDirectory()) walk(path)
      else if (info.isFile()) {
        files.push({
          path: treeRelativePath(root, path),
          sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
        })
      }
    }
  }
  walk(root)
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const tree = createHash('sha256')
  for (const file of files) tree.update(file.path).update('\0').update(file.sha256).update('\n')
  return { fileCount: files.length, treeHash: tree.digest('hex') }
}

function safeRelative(value) {
  if (typeof value !== 'string' || !value) return ''
  const clean = normalize(value)
  if (isAbsolute(clean) || clean === '..' || clean.startsWith(`..${sep}`)) return ''
  return clean
}

async function verifyTree(root, manifest) {
  if (!/^[a-f0-9]{64}$/.test(String(manifest.treeHash || '')) || !Number.isInteger(manifest.fileCount) || manifest.fileCount < 1) {
    return { ok: false, error: 'RUNTIME_MANIFEST_INVALID' }
  }
  const actual = computeRuntimeTreeSync(root)
  if (actual.fileCount !== manifest.fileCount || actual.treeHash !== manifest.treeHash) {
    return {
      ok: false,
      error: 'RUNTIME_CHECKSUM_MISMATCH',
      expectedFileCount: manifest.fileCount,
      actualFileCount: actual.fileCount,
      expectedTreeHash: manifest.treeHash,
      actualTreeHash: actual.treeHash,
    }
  }
  return { ok: true }
}

async function verifyManifestFiles(root, files) {
  if (!Array.isArray(files) || !files.length) return { ok: false, error: 'RUNTIME_FILES_MISSING' }
  for (const row of files) {
    if (!row || typeof row.path !== 'string' || !/^[a-f0-9]{64}$/.test(String(row.sha256 || ''))) {
      return { ok: false, error: 'RUNTIME_MANIFEST_INVALID' }
    }
    const clean = safeRelative(row.path)
    if (!clean) return { ok: false, error: 'RUNTIME_MANIFEST_INVALID' }
    try {
      const data = await readFile(join(root, clean))
      const actual = createHash('sha256').update(data).digest('hex')
      if (actual !== row.sha256) return { ok: false, error: 'RUNTIME_CHECKSUM_MISMATCH', path: row.path }
    } catch (error) {
      return { ok: false, error: 'RUNTIME_FILE_MISSING', path: row.path, detail: error instanceof Error ? error.message : String(error) }
    }
  }
  return { ok: true }
}
