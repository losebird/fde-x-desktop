#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { nodeDistPresent } from './node-dist.mjs'
import { IUI_PIN } from './pins.mjs'
import { assertIuiTree } from './iui-artifact.mjs'
import { REQUIRED_PLUGINS, pluginTreeHash, readLock } from '../plugins/lock-check.mjs'
import { natsIntegrityProblem } from '../../runtime/plugin-repo-source.mjs'

const DIST_PAGES = ['admin', 'analyze', 'decisions', 'explore', 'io', 'ontology']

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

export function bundledPluginProblems(resources, versions, repoRoot) {
  const problems = []
  const read = readLock(repoRoot)
  if (read.error) {
    problems.push(read.error)
    return problems
  }
  const lockPlugins = read.lock.plugins || {}
  const listed = versions && versions.plugins
  for (const name of REQUIRED_PLUGINS) {
    const files = lockPlugins[name] && lockPlugins[name].files
    const expectedHash = files ? pluginTreeHash(files) : ''
    const row = listed && listed[name]
    if (!row || row.staged !== true || row.treeHash !== expectedHash) {
      problems.push(`${name} versions.plugins must be {staged:true, treeHash} matching the lock`)
    }
  }
  const semFiles = lockPlugins['dsh-semantic-os'] && lockPlugins['dsh-semantic-os'].files
  for (const page of DIST_PAGES) {
    const rel = `runtime/plugins/dsh-semantic-os/dist/${page}/${page}.js`
    const expected = semFiles && semFiles[rel]
    const disk = join(resources, 'plugins', 'dsh-semantic-os', 'dist', page, `${page}.js`)
    let actual = ''
    if (existsSync(disk)) actual = sha256(readFileSync(disk))
    if (!expected || actual !== expected) problems.push(`dist ${page}.js does not match the lock`)
  }
  const natsRoot = join(resources, 'plugins', 'dsh-lan-assist')
  const natsPkg = join(natsRoot, 'node_modules', 'nats', 'package.json')
  if (!existsSync(natsPkg)) {
    problems.push('missing node_modules/nats')
  } else {
    const version = String(JSON.parse(readFileSync(natsPkg, 'utf8')).version || '')
    const expected = lockPlugins['dsh-lan-assist'] && lockPlugins['dsh-lan-assist'].dependencies
      && lockPlugins['dsh-lan-assist'].dependencies.nats
    if (!expected || version !== expected.version) {
      problems.push(`nats version ${version} != ${expected ? expected.version : ''}`)
    }
    const integrity = natsIntegrityProblem(natsRoot)
    if (integrity) problems.push(`nats ${integrity}`)
  }
  return problems
}

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
  const versionsPath = join(resources, 'versions.json')
  const versions = existsSync(versionsPath)
    ? JSON.parse(await readFile(versionsPath, 'utf8'))
    : null
  const pluginProblems = bundledPluginProblems(resources, versions, repoRoot)
  if (missing.length || pluginProblems.length) {
    const lines = []
    if (missing.length) lines.push(`missing: ${missing.join('\n')}`)
    lines.push(...pluginProblems)
    console.error(`verify failed — ${lines.join('\n')}`)
    process.exit(1)
  }
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
    console.error('verify failed — need a Node dist whose npm and npx launchers print --version')
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

  const iuiVersions = versions.plugins?.iui
  if (!iuiVersions?.staged || iuiVersions.version !== IUI_PIN.version || iuiVersions.commit !== IUI_PIN.commit) {
    console.error('verify failed — versions.plugins.iui does not match the pin')
    process.exit(1)
  }
  try {
    await assertIuiTree(join(resources, 'plugins', 'iui'), IUI_PIN)
  } catch (error) {
    console.error(`verify failed — ${error.message}`)
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

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
