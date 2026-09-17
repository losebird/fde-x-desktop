#!/usr/bin/env node
/**
 * Assemble resources/ for Electron packaging from local checkout.
 * Does not download the ~1.8GB semantic runtime tarball unless already present under
 * FDE_SEMANTIC_RUNTIME_SRC or vendor runtime-dist.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const resourcesRoot = join(repoRoot, 'resources')
const appRoot = join(resourcesRoot, 'app')
const runtimeKey = `${process.platform}-${process.arch}`

const vendorDir = process.env.FDE_VENDOR_DIR || join(homedir(), '.dsh', 'vendor')
const semanticSrc = process.env.FDE_SEMANTIC_RUNTIME_SRC
  || join(homedir(), '.dsh', 'semantic-os', 'runtime')

async function copyIfExists(from, to, label) {
  if (!existsSync(from)) {
    console.warn(`[stage] skip ${label}: missing ${from}`)
    return false
  }
  await mkdir(dirname(to), { recursive: true })
  await cp(from, to, { recursive: true, dereference: true })
  console.log(`[stage] copied ${label} → ${to}`)
  return true
}

async function writeStubSemantic() {
  const dest = join(resourcesRoot, 'semantic-runtime', runtimeKey)
  await mkdir(dest, { recursive: true })
  const stub = {
    schemaVersion: 1,
    stub: true,
    message: 'P1 POC：未 stage 完整 semantic runtime。请把官方 runtime-dist 解包到此目录，或设置 FDE_SEMANTIC_RUNTIME_SRC 后重跑 stage。',
    runtimeVersion: '0.1.1',
    key: runtimeKey,
  }
  await writeFile(join(dest, 'runtime-manifest.json'), `${JSON.stringify(stub, null, 2)}\n`)
  await writeFile(join(dest, 'README-STUB.txt'), `${stub.message}\n`)
  console.warn(`[stage] semantic-runtime stub at ${dest}`)
}

async function detectDshVersion() {
  try {
    const pkg = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'))
    return pkg.dshVersion || '0.1.5-rc.1'
  } catch {
    return '0.1.5-rc.1'
  }
}

async function main() {
  await mkdir(appRoot, { recursive: true })

  const runtimeDest = join(appRoot, 'runtime')
  await cp(join(repoRoot, 'runtime'), runtimeDest, { recursive: true })
  console.log(`[stage] runtime → ${runtimeDest}`)

  if (existsSync(join(repoRoot, 'dist'))) {
    await cp(join(repoRoot, 'dist'), join(appRoot, 'dist'), { recursive: true })
    console.log(`[stage] dist → ${join(appRoot, 'dist')}`)
  } else {
    console.warn('[stage] dist/ missing — run pnpm build first for a full UI bundle')
  }

  const pluginsRoot = join(resourcesRoot, 'plugins')
  for (const name of ['dsh-lan-assist', 'dsh-semantic-os']) {
    await copyIfExists(join(vendorDir, name), join(pluginsRoot, name), name)
  }

  const dshGlobal = process.env.FDE_DSH_NPM_TREE || join(homedir(), '.npm', '_npx')
  const dshCandidates = [
    join(repoRoot, 'resources', 'dsh'),
    join(homedir(), '.npm-global', 'lib', 'node_modules', '@deepseek-ai', 'dsh'),
  ]
  let dshStaged = false
  for (const candidate of dshCandidates) {
    if (existsSync(join(candidate, 'bin', 'dsh')) || existsSync(join(candidate, 'package.json'))) {
      await copyIfExists(candidate, join(resourcesRoot, 'dsh'), 'dsh npm tree')
      dshStaged = true
      break
    }
  }
  if (!dshStaged) {
    await mkdir(join(resourcesRoot, 'dsh'), { recursive: true })
    await writeFile(join(resourcesRoot, 'dsh', 'README-STUB.txt'), 'P1 POC：未找到本地 @deepseek-ai/dsh npm 树。CI 应 npm pack + npm i --omit=dev 到此目录。\n')
    console.warn('[stage] dsh stub — install global dsh or set FDE_DSH_NPM_TREE')
  }

  const semanticDest = join(resourcesRoot, 'semantic-runtime', runtimeKey)
  let semanticOk = false
  if (existsSync(join(semanticSrc, 'current.json'))) {
    try {
      const current = JSON.parse(await readFile(join(semanticSrc, 'current.json'), 'utf8'))
      const tree = join(semanticSrc, String(current.runtimeVersion || ''), String(current.key || runtimeKey))
      if (existsSync(join(tree, 'runtime-manifest.json'))) {
        await mkdir(semanticDest, { recursive: true })
        await cp(tree, semanticDest, { recursive: true, dereference: true })
        await writeFile(join(semanticDest, 'current.json'), `${JSON.stringify(current, null, 2)}\n`)
        semanticOk = true
        console.log(`[stage] semantic-runtime from ${tree}`)
      }
    } catch (error) {
      console.warn('[stage] semantic copy failed', error)
    }
  }
  if (!semanticOk) {
    const vendorDist = join(vendorDir, 'dsh-semantic-os', 'runtime-dist', runtimeKey)
    if (existsSync(join(vendorDist, 'runtime-manifest.json'))) {
      await cp(vendorDist, semanticDest, { recursive: true })
      semanticOk = true
      console.log(`[stage] semantic-runtime from vendor dist ${vendorDist}`)
    }
  }
  if (!semanticOk) await writeStubSemantic()

  const versions = {
    stagedAt: new Date().toISOString(),
    platformKey: runtimeKey,
    dsh: { version: await detectDshVersion(), staged: dshStaged },
    plugins: {
      'dsh-lan-assist': existsSync(join(pluginsRoot, 'dsh-lan-assist')),
      'dsh-semantic-os': existsSync(join(pluginsRoot, 'dsh-semantic-os')),
    },
    semanticRuntime: {
      runtimeVersion: '0.1.1',
      key: runtimeKey,
      digest: semanticOk ? 'local-tree' : 'stub',
      complete: semanticOk,
    },
  }
  await writeFile(join(resourcesRoot, 'versions.json'), `${JSON.stringify(versions, null, 2)}\n`)
  await mkdir(join(resourcesRoot, 'LICENSES'), { recursive: true })
  await writeFile(join(resourcesRoot, 'NOTICE.md'), '# FDE-X bundled components (P1 POC)\n\nSee LICENSES/ and versions.json. Full NOTICE generation deferred to CI.\n')
  console.log(`[stage] wrote ${join(resourcesRoot, 'versions.json')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
