import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export type BundledRuntimeManifest = {
  treeHash: string
  runtimeVersion: string
  manifestDigest: string
}

export type DesktopInstallState = {
  schemaVersion: number
  initializedAt: string
  platform: string
  semanticRuntime?: {
    treeHash: string
    runtimeVersion: string
    manifestDigest: string
  }
  semanticCopySkipped?: boolean
}

export function runtimeInstallerModulePath(vendorDir: string): string {
  return join(vendorDir, 'dsh-semantic-os', 'runtime-install.js')
}

export async function readBundledRuntimeManifest(
  semanticRuntimeSrc: string,
): Promise<BundledRuntimeManifest | null> {
  const manifestPath = join(semanticRuntimeSrc, 'runtime-manifest.json')
  if (!existsSync(manifestPath)) return null
  const raw = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(raw) as { treeHash?: string; runtimeVersion?: string }
  const treeHash = String(manifest.treeHash || '')
  if (!/^[a-f0-9]{64}$/u.test(treeHash)) return null
  return {
    treeHash,
    runtimeVersion: String(manifest.runtimeVersion || ''),
    manifestDigest: createHash('sha256').update(raw).digest('hex'),
  }
}

export function shouldRunSemanticInstall(
  installState: Record<string, unknown> | null,
  bundledTreeHash: string,
  skipSemanticCopy: boolean,
  installedRuntimeOk: boolean,
): boolean {
  if (skipSemanticCopy) return false
  if (!installState) return true
  const semantic = installState.semanticRuntime as { treeHash?: string } | undefined
  if (!semantic?.treeHash || semantic.treeHash !== bundledTreeHash) return true
  return !installedRuntimeOk
}

type RuntimeInstallModule = {
  installRuntimeFromDirectory: (
    source: string,
    options?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>
  resolveInstalledRuntime: (
    options?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>
}

async function loadRuntimeInstaller(vendorDir: string): Promise<RuntimeInstallModule> {
  const installerPath = runtimeInstallerModulePath(vendorDir)
  if (!existsSync(installerPath)) {
    throw new Error(`语义引擎安装器缺失：${installerPath}`)
  }
  return import(pathToFileURL(installerPath).href) as Promise<RuntimeInstallModule>
}

export async function probeInstalledSemanticRuntime(
  dshHome: string,
  vendorDir: string,
): Promise<boolean> {
  const mod = await loadRuntimeInstaller(vendorDir)
  const prevDshHome = process.env.DSH_HOME
  process.env.DSH_HOME = dshHome
  try {
    const resolved = await mod.resolveInstalledRuntime({ verifyFiles: true })
    return resolved.ok
  } finally {
    if (prevDshHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevDshHome
  }
}

export async function installSemanticRuntimeFromBundled(
  dshHome: string,
  semanticRuntimeSrc: string,
  vendorDir: string,
): Promise<BundledRuntimeManifest> {
  const bundled = await readBundledRuntimeManifest(semanticRuntimeSrc)
  if (!bundled) {
    throw new Error(`语义引擎资源包无效或缺失：${semanticRuntimeSrc}`)
  }

  const mod = await loadRuntimeInstaller(vendorDir)
  const prevDshHome = process.env.DSH_HOME
  process.env.DSH_HOME = dshHome
  try {
    const result = await mod.installRuntimeFromDirectory(semanticRuntimeSrc)
    if (!result.ok) {
      throw new Error(`语义引擎安装失败：${result.error || 'unknown'}`)
    }
    const verified = await mod.resolveInstalledRuntime({ verifyFiles: true })
    if (!verified.ok) {
      throw new Error(`语义引擎安装后校验失败：${verified.error || 'unknown'}`)
    }
    return bundled
  } finally {
    if (prevDshHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevDshHome
  }
}

export function buildInstallStatePayload(
  platform: string,
  bundled: BundledRuntimeManifest | null,
  skipSemanticCopy: boolean,
): DesktopInstallState {
  const base: DesktopInstallState = {
    schemaVersion: 1,
    initializedAt: new Date().toISOString(),
    platform,
  }
  if (skipSemanticCopy) {
    return { ...base, semanticCopySkipped: true }
  }
  if (!bundled) return base
  return {
    ...base,
    semanticRuntime: {
      treeHash: bundled.treeHash,
      runtimeVersion: bundled.runtimeVersion,
      manifestDigest: bundled.manifestDigest,
    },
  }
}
