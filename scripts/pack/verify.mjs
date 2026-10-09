#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodeDistPresent } from './node-dist.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const resources = process.env.FDE_PACK_OUT
  ? resolve(process.env.FDE_PACK_OUT)
  : join(repoRoot, 'resources')

const required = [
  join(resources, 'versions.json'),
  join(resources, 'app', 'runtime', 'server.mjs'),
  join(resources, 'app', 'runtime', 'workspace-file-document.mjs'),
  join(resources, 'app', 'runtime', 'desktop-process-path.mjs'),
  join(resources, 'app', 'runtime', 'migrations', '016_workspace_file_revisions.sql'),
  join(resources, 'app', 'dist', 'index.html'),
  join(resources, 'NOTICE.md'),
]

const requireSemanticRuntimeComplete =
  process.env.CI === 'true' || process.env.FDE_DOWNLOAD_SEMANTIC_RUNTIME === '1'

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
    if (requireSemanticRuntimeComplete) {
      console.error(
        'verify failed — semantic runtime incomplete (required when CI=true or FDE_DOWNLOAD_SEMANTIC_RUNTIME=1)',
      )
      process.exit(1)
    }
    console.warn('verify: semantic runtime is stub/incomplete')
  }

  if (!dshReal) {
    console.error('verify failed — need resources/dsh/bin/dsh and versions.dsh.staged === true')
    console.log(`dsh.staged: ${versions.dsh?.staged === true}`)
    process.exit(1)
  }

  const nodeRoot = join(resources, 'node')
  const nodeReal = nodeDistPresent(nodeRoot) && versions.node?.staged === true
  if (!nodeReal) {
    console.error('verify failed — need resources/node/bin/node and versions.node.staged === true')
    console.log(`node.staged: ${versions.node?.staged === true}`)
    process.exit(1)
  }

  const dataDir = join(resources, 'app', 'runtime', 'data')
  if (existsSync(dataDir)) {
    const names = await readdir(dataDir)
    const sqlite = names.filter((name) => /\.sqlite/u.test(name) || name === 'semantic-os')
    if (sqlite.length) {
      console.error('verify failed — user data staged under runtime/data:', sqlite.join(', '))
      process.exit(1)
    }
  }

  const distDir = join(resources, 'app', 'dist', 'assets')
  const assets = existsSync(distDir) ? await readdir(distDir) : []
  let distText = ''
  for (const name of assets) {
    if (!name.endsWith('.js')) continue
    distText += await readFile(join(distDir, name), 'utf8')
  }
  for (const needle of ['创建草稿', '发给当前 AI 会话']) {
    if (!distText.includes(needle)) {
      console.error(`verify failed — dist missing ${needle}`)
      process.exit(1)
    }
  }

  if (!existsSync(join(resources, 'app', 'node_modules', 'html-to-docx'))) {
    console.error('verify failed — BFF html-to-docx missing under resources/app/node_modules')
    process.exit(1)
  }

  console.log(`dsh.staged: true (version ${versions.dsh?.version})`)
  console.log(`node.staged: true (version ${versions.node?.version})`)
  console.log('verify ok', versions.platformKey, {
    dsh: versions.dsh,
    node: versions.node,
    semanticComplete: versions.semanticRuntime?.complete,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
