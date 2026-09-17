import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { platformRuntimeKey } from './paths.js'

export type FirstRunProgress = (step: string, detail?: string) => void

export async function ensureFirstRun(
  dshHome: string,
  installStatePath: string,
  onProgress: FirstRunProgress = () => undefined,
): Promise<{ fresh: boolean }> {
  await mkdir(dshHome, { recursive: true })
  await mkdir(join(dshHome, 'profiles'), { recursive: true })

  if (existsSync(installStatePath)) {
    return { fresh: false }
  }

  onProgress('create_dirs', dshHome)
  const payload = {
    schemaVersion: 1,
    initializedAt: new Date().toISOString(),
    platform: platformRuntimeKey(),
    semanticRuntimeMode: 'readonly',
    note: 'P1 POC：跳过 1.8GB 拷贝，使用 resources 内只读 semantic runtime（若已 stage）',
  }
  await writeFile(installStatePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  onProgress('complete')
  return { fresh: true }
}

export async function readInstallState(path: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}
