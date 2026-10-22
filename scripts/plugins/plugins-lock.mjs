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

const root = arg('--root', repoRoot)
const read = readLock(root)
if (read.error) fail([read.error])

const expected = {}
const plugins = read.lock && read.lock.plugins
const lan = plugins && typeof plugins === 'object' && !Array.isArray(plugins) ? plugins['dsh-lan-assist'] : undefined
if (lan && typeof lan === 'object' && !Array.isArray(lan)) expected['dsh-lan-assist'] = canonicalLanShape(lan)

const errors = []
const stats = verifyLockDocument(root, read.lock, errors, expected)
if (!stats) fail(errors)
for (const stat of stats) console.log(`${stat.name} files ${stat.files} mismatch ${stat.mismatch}`)
const mismatch = stats.reduce((sum, stat) => sum + stat.mismatch, 0)
console.log(`mismatch ${mismatch}`)
if (errors.length) fail(errors)
console.log('plugins.lock verify ok')
