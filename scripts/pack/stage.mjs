#!/usr/bin/env node
/**
 * Assemble resources/ for Electron packaging (spec 09 §6).
 * DSH: npm pack + npm i --omit=dev into resources/dsh (or FDE_DSH_NPM_TREE copy).
 * Semantic: optional GitHub release tar.gz + sha256 when FDE_DOWNLOAD_SEMANTIC_RUNTIME=1 or CI.
 */
import { createHash } from 'node:crypto'
import { execFile as execFileCb } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { DSH_NPM_VERSION, SEMANTIC_RUNTIME } from './pins.mjs'

const execFile = promisify(execFileCb)

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const resourcesRoot = process.env.FDE_PACK_OUT
  ? resolve(process.env.FDE_PACK_OUT)
  : join(repoRoot, 'resources')
const appRoot = join(resourcesRoot, 'app')
const runtimeKey = `${process.platform}-${process.arch}`

const vendorDir = process.env.FDE_VENDOR_DIR || join(homedir(), '.dsh', 'vendor')
const semanticSrc = process.env.FDE_SEMANTIC_RUNTIME_SRC
  || join(homedir(), '.dsh', 'semantic-os', 'runtime')

const shouldDownloadSemantic =
  process.env.FDE_DOWNLOAD_SEMANTIC_RUNTIME === '1'
  || (process.env.FDE_DOWNLOAD_SEMANTIC_RUNTIME !== '0' && process.env.CI === 'true')

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

function dshBinPresent(treeRoot) {
  return (
    existsSync(join(treeRoot, 'bin', 'dsh'))
    || existsSync(join(treeRoot, 'bin', 'dsh.cmd'))
  )
}

function dshModuleEntry(treeRoot) {
  const nested = join(treeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (existsSync(nested)) return nested
  const flat = join(treeRoot, 'lib', 'bin.js')
  if (existsSync(flat)) return flat
  return null
}

async function ensureDshBinShim(treeRoot) {
  if (dshBinPresent(treeRoot)) return true
  const entry = dshModuleEntry(treeRoot)
  if (!entry) return false
  const binDir = join(treeRoot, 'bin')
  await mkdir(binDir, { recursive: true })
  const rel = entry.startsWith(join(treeRoot, 'lib'))
    ? '../lib/bin.js'
    : '../node_modules/@deepseek-ai/dsh/lib/bin.js'
  const shim = join(binDir, 'dsh')
  await writeFile(shim, `#!/usr/bin/env node\nrequire('${rel}');\n`, { mode: 0o755 })
  return true
}

async function stageDshFromNpm(dest, version) {
  const work = join(resourcesRoot, '.pack-work', 'dsh-npm')
  await rm(work, { recursive: true, force: true })
  await mkdir(work, { recursive: true })

  const spec = `@deepseek-ai/dsh@${version}`
  console.log(`[stage] npm pack ${spec}`)
  await execFile('npm', ['pack', spec, '--pack-destination', work], {
    cwd: work,
    maxBuffer: 64 * 1024 * 1024,
  })

  await writeFile(
    join(work, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fde-x-bundled-dsh',
        private: true,
        dependencies: { '@deepseek-ai/dsh': version },
      },
      null,
      2,
    )}\n`,
  )

  console.log(`[stage] npm i --omit=dev in ${work}`)
  await execFile(
    'npm',
    ['i', '--omit=dev', '--no-audit', '--no-fund'],
    { cwd: work, maxBuffer: 128 * 1024 * 1024 },
  )

  await rm(dest, { recursive: true, force: true })
  await cp(work, dest, { recursive: true, dereference: true })
  await rm(join(dest, '.pack-work'), { recursive: true, force: true })

  if (!(await ensureDshBinShim(dest))) {
    throw new Error(`DSH npm tree missing @deepseek-ai/dsh under ${dest}`)
  }
  if (!existsSync(join(dest, 'node_modules', '@deepseek-ai', 'dsh'))) {
    throw new Error(`DSH npm tree missing node_modules/@deepseek-ai/dsh under ${dest}`)
  }
  return true
}

async function stageDsh(dest) {
  const override = process.env.FDE_DSH_NPM_TREE
  if (override && existsSync(override)) {
    await rm(dest, { recursive: true, force: true })
    await copyIfExists(override, dest, 'dsh npm tree (FDE_DSH_NPM_TREE)')
    await ensureDshBinShim(dest)
    return dshBinPresent(dest) && Boolean(dshModuleEntry(dest))
  }

  const fromNpm = process.env.FDE_STAGE_DSH_FROM_NPM !== '0'
  if (fromNpm) {
    try {
      await stageDshFromNpm(dest, DSH_NPM_VERSION)
      return true
    } catch (error) {
      console.warn('[stage] npm dsh staging failed', error)
      if (process.env.CI === 'true') throw error
    }
  }

  const localInstallRoots = [
    join(repoRoot, 'resources', 'dsh'),
    join(homedir(), '.npm-global', 'lib'),
    '/opt/homebrew/lib',
    '/usr/local/lib',
  ]
  for (const root of localInstallRoots) {
    if (!existsSync(root)) continue
    const hasBundle = existsSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
    const hasPackageOnly = existsSync(join(root, 'lib', 'bin.js'))
    if (!hasBundle && !hasPackageOnly) continue

    await rm(dest, { recursive: true, force: true })
    if (hasBundle) {
      await copyIfExists(root, dest, 'dsh npm tree (local)')
    } else {
      await mkdir(dest, { recursive: true })
      await writeFile(
        join(dest, 'package.json'),
        `${JSON.stringify({ name: 'fde-x-dsh-local', private: true }, null, 2)}\n`,
      )
      await mkdir(join(dest, 'node_modules', '@deepseek-ai'), { recursive: true })
      await cp(root, join(dest, 'node_modules', '@deepseek-ai', 'dsh'), {
        recursive: true,
        dereference: true,
      })
    }
    await ensureDshBinShim(dest)
    if (dshBinPresent(dest) && dshModuleEntry(dest)) return true
  }

  await mkdir(dest, { recursive: true })
  await writeFile(
    join(dest, 'README-STUB.txt'),
    '未 stage 完整 @deepseek-ai/dsh。CI 应 npm pack + npm i --omit=dev；或设置 FDE_DSH_NPM_TREE。\n',
  )
  console.warn('[stage] dsh stub — set FDE_DSH_NPM_TREE or allow npm staging')
  return false
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status}`)
  }
  return await response.text()
}

async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function parseSha256File(text) {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  const hex = line.split(/\s+/)[0]
  if (!/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error(`invalid sha256 sidecar: ${line.slice(0, 80)}`)
  }
  return hex.toLowerCase()
}

async function extractTarGz(archivePath, destDir) {
  await mkdir(destDir, { recursive: true })
  const staging = join(destDir, '..', `.extract-${runtimeKey}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  await execFile('tar', ['-xzf', archivePath, '-C', staging], { maxBuffer: 64 * 1024 * 1024 })

  async function findManifestRoot(dir) {
    const direct = join(dir, 'runtime-manifest.json')
    if (existsSync(direct)) return dir
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const nested = await findManifestRoot(join(dir, entry.name))
      if (nested) return nested
    }
    return null
  }

  const contentRoot = await findManifestRoot(staging)
  if (!contentRoot) {
    throw new Error('semantic runtime archive missing runtime-manifest.json')
  }

  await rm(destDir, { recursive: true, force: true })
  await mkdir(dirname(destDir), { recursive: true })
  await cp(contentRoot, destDir, { recursive: true, dereference: true })
  await rm(staging, { recursive: true, force: true })
}

async function downloadSemanticRuntime(dest) {
  const { releaseBaseUrl } = SEMANTIC_RUNTIME
  const archiveName = `${runtimeKey}.tar.gz`
  const archiveUrl = `${releaseBaseUrl}/${archiveName}`
  const shaUrl = `${archiveUrl}.sha256`

  console.log(`[stage] download semantic runtime ${archiveUrl}`)
  const shaText = await fetchText(shaUrl)
  const expectedSha = parseSha256File(shaText)
  const body = await fetchBuffer(archiveUrl)
  const actualSha = createHash('sha256').update(body).digest('hex')
  if (actualSha !== expectedSha) {
    throw new Error(`semantic runtime sha256 mismatch: expected ${expectedSha}, got ${actualSha}`)
  }

  const cacheDir = join(resourcesRoot, '.pack-work', 'semantic')
  await mkdir(cacheDir, { recursive: true })
  const archivePath = join(cacheDir, archiveName)
  await writeFile(archivePath, body)
  await extractTarGz(archivePath, dest)

  const current = {
    schemaVersion: 1,
    runtimeVersion: SEMANTIC_RUNTIME.runtimeVersion,
    key: runtimeKey,
    manifestDigest: expectedSha,
    installedAt: new Date().toISOString(),
  }
  await writeFile(join(dest, 'current.json'), `${JSON.stringify(current, null, 2)}\n`)
  console.log(`[stage] semantic-runtime downloaded → ${dest}`)
  return true
}

async function writeStubSemantic() {
  const dest = join(resourcesRoot, 'semantic-runtime', runtimeKey)
  await mkdir(dest, { recursive: true })
  const stub = {
    schemaVersion: 1,
    stub: true,
    message:
      '未 stage 完整 semantic runtime。CI 应下载官方 tar.gz；或设置 FDE_SEMANTIC_RUNTIME_SRC / vendor runtime-dist。',
    runtimeVersion: SEMANTIC_RUNTIME.runtimeVersion,
    key: runtimeKey,
  }
  await writeFile(join(dest, 'runtime-manifest.json'), `${JSON.stringify(stub, null, 2)}\n`)
  await writeFile(join(dest, 'README-STUB.txt'), `${stub.message}\n`)
  console.warn(`[stage] semantic-runtime stub at ${dest}`)
}

async function readSemanticDigest(dest) {
  try {
    const manifest = JSON.parse(await readFile(join(dest, 'runtime-manifest.json'), 'utf8'))
    if (manifest.stub) return 'stub'
    return String(manifest.treeHash || manifest.manifestDigest || 'local-tree')
  } catch {
    return 'stub'
  }
}

async function stageSemantic() {
  const semanticDest = join(resourcesRoot, 'semantic-runtime', runtimeKey)

  if (shouldDownloadSemantic) {
    try {
      await downloadSemanticRuntime(semanticDest)
      const digest = await readSemanticDigest(semanticDest)
      return { complete: digest !== 'stub', digest }
    } catch (error) {
      console.warn('[stage] semantic download failed', error)
    }
  }

  if (existsSync(join(semanticSrc, 'current.json'))) {
    try {
      const current = JSON.parse(await readFile(join(semanticSrc, 'current.json'), 'utf8'))
      const tree = join(
        semanticSrc,
        String(current.runtimeVersion || SEMANTIC_RUNTIME.runtimeVersion),
        String(current.key || runtimeKey),
      )
      if (existsSync(join(tree, 'runtime-manifest.json'))) {
        await rm(semanticDest, { recursive: true, force: true })
        await mkdir(semanticDest, { recursive: true })
        await cp(tree, semanticDest, { recursive: true, dereference: true })
        await writeFile(join(semanticDest, 'current.json'), `${JSON.stringify(current, null, 2)}\n`)
        console.log(`[stage] semantic-runtime from ${tree}`)
        const digest = await readSemanticDigest(semanticDest)
        return { complete: true, digest }
      }
    } catch (error) {
      console.warn('[stage] semantic copy failed', error)
    }
  }

  const vendorDist = join(vendorDir, 'dsh-semantic-os', 'runtime-dist', runtimeKey)
  if (existsSync(join(vendorDist, 'runtime-manifest.json'))) {
    await rm(semanticDest, { recursive: true, force: true })
    await cp(vendorDist, semanticDest, { recursive: true })
    console.log(`[stage] semantic-runtime from vendor dist ${vendorDist}`)
    const digest = await readSemanticDigest(semanticDest)
    return { complete: true, digest }
  }

  if (
    existsSync(join(semanticDest, 'runtime-manifest.json'))
    && !existsSync(join(semanticDest, 'README-STUB.txt'))
  ) {
    const digest = await readSemanticDigest(semanticDest)
    return { complete: digest !== 'stub', digest }
  }

  await writeStubSemantic()
  return { complete: false, digest: 'stub' }
}

async function main() {
  console.log(`[stage] resources root: ${resourcesRoot}`)
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

  const dshDest = join(resourcesRoot, 'dsh')
  const dshStaged = await stageDsh(dshDest)

  const semantic = await stageSemantic()

  const versions = {
    stagedAt: new Date().toISOString(),
    platformKey: runtimeKey,
    dsh: { version: DSH_NPM_VERSION, staged: dshStaged },
    plugins: {
      'dsh-lan-assist': existsSync(join(pluginsRoot, 'dsh-lan-assist')),
      'dsh-semantic-os': existsSync(join(pluginsRoot, 'dsh-semantic-os')),
    },
    semanticRuntime: {
      runtimeVersion: SEMANTIC_RUNTIME.runtimeVersion,
      key: runtimeKey,
      digest: semantic.digest,
      complete: semantic.complete,
    },
  }
  await writeFile(join(resourcesRoot, 'versions.json'), `${JSON.stringify(versions, null, 2)}\n`)
  await mkdir(join(resourcesRoot, 'LICENSES'), { recursive: true })
  await writeFile(
    join(resourcesRoot, 'NOTICE.md'),
    '# FDE-X bundled components\n\nSee LICENSES/ and versions.json. Full NOTICE generation (license-checker) deferred.\n',
  )
  console.log(`[stage] wrote ${join(resourcesRoot, 'versions.json')}`)
  console.log(`[stage] dsh.staged: ${dshStaged}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
