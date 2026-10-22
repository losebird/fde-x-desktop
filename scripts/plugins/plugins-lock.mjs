import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalLanShape } from './lan-assist-tree.mjs'
import { LOCK_REL, readLock, verifyLockDocument } from './lock-check.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function fail(errors) {
  for (const error of errors) console.error(error)
  console.error(`plugins.lock verify failed (${errors.length})`)
  process.exit(1)
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

const SHA40 = /^[a-f0-9]{40}$/u

function upstreamSha() {
  const index = process.argv.indexOf('--upstream-sha')
  if (index === -1) return ''
  const value = process.argv[index + 1] || ''
  if (!SHA40.test(value)) fail([`--upstream-sha wants 40 hex, got ${value}`])
  return value
}

const root = arg('--root', repoRoot)
const read = readLock(root)
if (read.error) fail([read.error])
const upstream = upstreamSha()

const expected = {}
const plugins = read.lock && read.lock.plugins
const lan = plugins && typeof plugins === 'object' && !Array.isArray(plugins) ? plugins['dsh-lan-assist'] : undefined
if (lan && typeof lan === 'object' && !Array.isArray(lan)) expected['dsh-lan-assist'] = canonicalLanShape(lan)

const errors = []
if (upstream && plugins && typeof plugins === 'object' && !Array.isArray(plugins)) {
  for (const name of ['dsh-lan-assist', 'dsh-semantic-os']) {
    const source = plugins[name] && plugins[name].source
    const commit = source && typeof source.commit === 'string' ? source.commit : ''
    if (commit !== upstream) errors.push(`stale ${name} lock=${commit} upstream=${upstream}`)
  }
}
const stats = verifyLockDocument(root, read.lock, errors, expected)
if (!stats) fail(errors)
for (const stat of stats) console.log(`${stat.name} files ${stat.files} mismatch ${stat.mismatch}`)
const mismatch = stats.reduce((sum, stat) => sum + stat.mismatch, 0)
console.log(`mismatch ${mismatch}`)
if (errors.length) fail(errors)
console.log('plugins.lock verify ok')
