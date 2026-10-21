import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const SHA = /^[a-f0-9]{40}$/u
const RESERVED = new Set(['nats', 'iui'])

function requiredString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

export function sourceEnvName(dir) {
  return `FDE_PLUGIN_SOURCE_${String(dir).replace(/[^A-Za-z0-9]/gu, '_').toUpperCase()}`
}

export function loadPins(pinsPath) {
  let raw
  try {
    raw = JSON.parse(readFileSync(pinsPath, 'utf8'))
  } catch (error) {
    throw new Error(`cannot read ${pinsPath}: ${error instanceof Error ? error.message : error}`)
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${pinsPath} must be an object`)
  }
  const plugins = []
  for (const [dir, pin] of Object.entries(raw)) {
    if (RESERVED.has(dir)) continue
    if (!pin || typeof pin !== 'object' || Array.isArray(pin)) {
      throw new Error(`${pinsPath} ${dir} must be an object`)
    }
    const repo = requiredString(pin.repo, `${dir}.repo`)
    if (!/^[^/\s]+\/[^/\s]+$/u.test(repo)) {
      throw new Error(`${dir}.repo must be owner/name, got ${repo}`)
    }
    const commit = requiredString(pin.commit, `${dir}.commit`)
    if (!SHA.test(commit)) throw new Error(`${dir}.commit must be a 40-character sha, got ${commit}`)
    if (!Array.isArray(pin.requiredFiles) || pin.requiredFiles.some((file) => typeof file !== 'string' || !file)) {
      throw new Error(`${dir}.requiredFiles must be a list of paths`)
    }
    plugins.push({
      dir,
      repo,
      commit,
      note: typeof pin.note === 'string' ? pin.note : '',
      requiredFiles: pin.requiredFiles,
    })
  }
  if (plugins.length === 0) throw new Error(`${pinsPath} has no plugin pins`)
  const nats = raw.nats
  if (!nats || typeof nats !== 'object') throw new Error(`${pinsPath} missing nats`)
  const natsVersion = requiredString(nats.version, 'nats.version')
  const natsIntegrity = requiredString(nats.integrity, 'nats.integrity')
  if (!natsIntegrity.startsWith('sha512-')) throw new Error('nats.integrity must be an sha512 integrity')
  const natsPlugin = requiredString(nats.plugin, 'nats.plugin')
  if (!plugins.some((plugin) => plugin.dir === natsPlugin)) {
    throw new Error(`nats.plugin ${natsPlugin} is not a pinned plugin`)
  }
  return {
    plugins,
    nats: { version: natsVersion, integrity: natsIntegrity, plugin: natsPlugin },
  }
}

export function readEnvFile(path) {
  if (!existsSync(path)) return null
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    out[trimmed.slice(0, eq)] = value
  }
  return out
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '__pycache__') continue
    const path = join(dir, name)
    const info = statSync(path)
    if (info.isDirectory()) walkFiles(path, out)
    else out.push(path)
  }
  return out
}

function relativeSpecs(source) {
  const specs = []
  const patterns = [
    /from\s+['"](\.[^'"]+)['"]/gu,
    /import\s+['"](\.[^'"]+)['"]/gu,
    /import\(\s*['"](\.[^'"]+)['"]\s*\)/gu,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.push(match[1])
  }
  return specs
}

function resolveSpec(fromFile, spec) {
  const base = join(dirname(fromFile), spec)
  const candidates = [base]
  if (!/\.(?:mjs|cjs|js|json|node)$/u.test(spec)) {
    candidates.push(`${base}.js`, `${base}.mjs`, `${base}.cjs`, join(base, 'index.js'))
  }
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

export function overlayGaps({ overlayDir, mergedDir }) {
  const gaps = []
  if (!existsSync(overlayDir)) return [`overlay directory missing: ${overlayDir}`]
  for (const file of walkFiles(overlayDir)) {
    if (!/\.(?:mjs|cjs|js)$/u.test(file)) continue
    const rel = relative(overlayDir, file)
    const mergedFile = join(mergedDir, rel)
    if (!existsSync(mergedFile)) {
      gaps.push(`${rel} is missing from the merged plugin`)
      continue
    }
    let text = ''
    try {
      text = readFileSync(mergedFile, 'utf8')
    } catch (error) {
      gaps.push(`${rel} cannot be read: ${error instanceof Error ? error.message : error}`)
      continue
    }
    for (const spec of relativeSpecs(text)) {
      if (!resolveSpec(mergedFile, spec)) gaps.push(`${rel} imports ${spec}, which is missing`)
    }
  }
  return gaps
}

export function missingRequired(dir, files) {
  return files.filter((file) => !existsSync(join(dir, file)))
}

export function assertMergedPlugins({ repoRoot, dshHome, plugins }) {
  const problems = []
  for (const plugin of plugins) {
    const mergedDir = join(dshHome, 'vendor', plugin.dir)
    const missing = missingRequired(mergedDir, plugin.requiredFiles)
    for (const file of missing) problems.push(`${plugin.dir}/${file} is missing from ${mergedDir}`)
    const gaps = overlayGaps({
      overlayDir: join(repoRoot, 'runtime', 'vendor-overlays', plugin.dir),
      mergedDir,
    })
    for (const gap of gaps) problems.push(`${plugin.dir}: ${gap}`)
  }
  if (problems.length === 0) return
  throw new Error(`plugin tree is incomplete (${problems.length}):\n${problems.map((line) => `- ${line}`).join('\n')}`)
}
