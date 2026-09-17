#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const resources = join(repoRoot, 'resources')

const required = [
  join(resources, 'versions.json'),
  join(resources, 'app', 'runtime', 'server.mjs'),
  join(resources, 'NOTICE.md'),
]

async function main() {
  const missing = required.filter((path) => !existsSync(path))
  if (missing.length) {
    console.error('verify failed — missing:', missing.join('\n'))
    process.exit(1)
  }
  const versions = JSON.parse(await readFile(join(resources, 'versions.json'), 'utf8'))
  if (!versions.semanticRuntime?.complete) {
    console.warn('verify: semantic runtime is stub/incomplete (expected for POC without local tree)')
  }
  console.log('verify ok', versions.platformKey)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
