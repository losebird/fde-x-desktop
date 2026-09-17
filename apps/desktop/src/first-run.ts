import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildInstallStatePayload,
  installSemanticRuntimeFromBundled,
  probeInstalledSemanticRuntime,
  readBundledRuntimeManifest,
  shouldRunSemanticInstall,
} from './semantic-runtime.js'
import { readInstallState } from './install-state.js'

export type FirstRunProgress = (step: string, detail?: string) => void

export type EnsureFirstRunOptions = {
  dshHome: string
  installStatePath: string
  semanticRuntimeSrc: string
  vendorDir: string
  platform: string
  skipSemanticCopy: boolean
  onProgress?: FirstRunProgress
}

export async function ensureFirstRun(options: EnsureFirstRunOptions): Promise<{ fresh: boolean }> {
  const {
    dshHome,
    installStatePath,
    semanticRuntimeSrc,
    vendorDir,
    platform,
    skipSemanticCopy,
    onProgress = () => undefined,
  } = options

  await mkdir(dshHome, { recursive: true })
  await mkdir(join(dshHome, 'profiles'), { recursive: true })
  onProgress('create_dirs', dshHome)

  const existing = await readInstallState(installStatePath)
  const bundled = skipSemanticCopy ? null : await readBundledRuntimeManifest(semanticRuntimeSrc)

  let installedRuntimeOk = false
  if (!skipSemanticCopy && bundled) {
    onProgress('semantic_probe')
    installedRuntimeOk = await probeInstalledSemanticRuntime(dshHome, vendorDir)
  }

  const runInstall = bundled
    ? shouldRunSemanticInstall(existing, bundled.treeHash, skipSemanticCopy, installedRuntimeOk)
    : false

  if (runInstall && bundled) {
    onProgress('semantic_verify_source', bundled.treeHash)
    onProgress('semantic_install')
    const installed = await installSemanticRuntimeFromBundled(dshHome, semanticRuntimeSrc, vendorDir)
    onProgress('semantic_tree_hash', installed.treeHash)
    onProgress('write_install_state')
    const payload = buildInstallStatePayload(platform, installed, false)
    await writeFile(installStatePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    onProgress('complete')
    return { fresh: true }
  }

  if (!existing) {
    onProgress('write_install_state')
    const payload = buildInstallStatePayload(platform, bundled, skipSemanticCopy)
    await writeFile(installStatePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    onProgress('complete')
    return { fresh: true }
  }

  onProgress('complete')
  return { fresh: false }
}

export { readInstallState } from './install-state.js'
