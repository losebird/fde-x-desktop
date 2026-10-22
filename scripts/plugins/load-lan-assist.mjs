import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const pluginDir = join(repoRoot, 'runtime/plugins/dsh-lan-assist')
const vendorDir = join(homedir(), '.dsh', 'vendor')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

function specifiers(source) {
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

function resolveRelative(fromFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = join(dirname(fromFile), spec)
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, join(base, 'index.js')]
  return candidates.find((candidate) => existsSync(candidate)) || null
}

const files = walk(pluginDir).filter((path) => {
  if (!/\.(js|mjs)$/.test(path)) return false
  const rel = relative(pluginDir, path).split(sep).join('/')
  return !rel.startsWith('vendor/office/')
})
const missing = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const spec of specifiers(text)) {
    if (!spec.startsWith('.')) continue
    if (!resolveRelative(file, spec)) missing.push(`${relative(pluginDir, file)} -> ${spec}`)
  }
}
if (missing.length) {
  for (const line of missing) console.error(`unresolved ${line}`)
  process.exit(1)
}

const natsPkg = join(pluginDir, 'node_modules', 'nats', 'package.json')
if (!existsSync(natsPkg)) {
  const installed = spawnSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: pluginDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_update_notifier: 'false' },
  })
  if (installed.status !== 0) process.exit(installed.status || 1)
}

const require = createRequire(join(pluginDir, 'package.json'))
const natsResolved = require.resolve('nats')
const natsReal = require.resolve('nats/package.json')
if (!natsReal.startsWith(join(pluginDir, 'node_modules'))) {
  console.error(`nats resolved outside the plugin tree: ${natsResolved}`)
  process.exit(1)
}
if (natsResolved.startsWith(vendorDir) || natsResolved.includes(`${sep}.dsh${sep}vendor${sep}`)) {
  console.error(`nats resolved from ~/.dsh/vendor: ${natsResolved}`)
  process.exit(1)
}
const natsVersion = JSON.parse(readFileSync(natsReal, 'utf8')).version
if (natsVersion !== '2.29.3') {
  console.error(`nats version ${natsVersion} != 2.29.3`)
  process.exit(1)
}

const probe = join(pluginDir, '.load-nats-probe.mjs')
writeFileSync(probe, "export const nats = await import('nats')\nexport const version = nats.connect ? 'ok' : 'missing'\n")
let probeMod
try {
  probeMod = await import(pathToFileURL(probe).href)
} finally {
  rmSync(probe, { force: true })
}
if (!probeMod?.nats) {
  console.error('import("nats") from the plugin directory returned nothing')
  process.exit(1)
}

const failures = []
const loaded = []
for (const file of files) {
  const rel = relative(pluginDir, file).split(sep).join('/')
  if (rel === 'client.js' || rel.startsWith('test/')) continue
  try {
    await import(pathToFileURL(file).href)
    loaded.push(rel)
  } catch (error) {
    failures.push(`${rel} ${error.code || ''} ${error.message}`)
  }
}

let clientImportError = ''
try {
  await import(pathToFileURL(join(pluginDir, 'client.js')).href)
} catch (error) {
  clientImportError = `${error.code || ''} ${error.message}`
}

const office = walk(pluginDir).filter((path) => relative(pluginDir, path).split(sep).join('/').startsWith('vendor/office/'))
console.log(`plugin ${pluginDir}`)
console.log(`modules ${files.length}`)
console.log(`office bundles ${office.length}`)
console.log(`loaded ${loaded.length}`)
console.log(`nats ${natsVersion} ${natsResolved}`)
console.log(`client.js ${clientImportError || 'loaded'}`)
if (failures.length) {
  for (const line of failures) console.error(`load failed ${line}`)
  process.exit(1)
}
console.log('lan-assist load ok')
