#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const resources = process.env.FDE_PACK_OUT
  ? resolve(process.env.FDE_PACK_OUT)
  : join(repoRoot, 'resources')

const required = [
  join(resources, 'versions.json'),
  join(resources, 'app', 'runtime', 'server.mjs'),
  join(resources, 'NOTICE.md'),
]

function dshTreeReal(dshRoot) {
  return (
    existsSync(join(dshRoot, 'bin', 'dsh'))
    || existsSync(join(dshRoot, 'bin', 'dsh.cmd'))
  )
}

async function main() {
  const missing = required.filter((path) => !existsSync(path))
  if (missing.length) {
    console.error('verify failed — missing:', missing.join('\n'))
    process.exit(1)
  }

  const versions = JSON.parse(await readFile(join(resources, 'versions.json'), 'utf8'))
  const dshRoot = join(resources, 'dsh')
  const dshReal = dshTreeReal(dshRoot) && versions.dsh?.staged === true

  if (!versions.semanticRuntime?.complete) {
    console.warn('verify: semantic runtime is stub/incomplete')
  }

  if (!dshReal) {
    console.error('verify failed — need resources/dsh/bin/dsh and versions.dsh.staged === true')
    console.log(`dsh.staged: ${versions.dsh?.staged === true}`)
    process.exit(1)
  }

  console.log(`dsh.staged: true (version ${versions.dsh?.version})`)
  console.log('verify ok', versions.platformKey, {
    dsh: versions.dsh,
    semanticComplete: versions.semanticRuntime?.complete,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
