import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

export function resolvePackagedResources(): string {
  if (process.env.FDE_RESOURCES) return process.env.FDE_RESOURCES
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (resourcesPath) {
    const bundled = join(resourcesPath, 'resources')
    return bundled
  }
  return join(repoRoot, 'resources')
}

export function resolveAppRoot(resources: string): string {
  if (process.env.FDE_APP_ROOT) return process.env.FDE_APP_ROOT
  const staged = join(resources, 'app')
  if (process.env.FDE_DESKTOP_DEV === '1') return repoRoot
  return staged
}

export function userDataRoots() {
  const base = process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'FDE-X')
    : process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'FDE-X')
      : join(homedir(), '.local', 'share', 'fde-x')

  return {
    base,
    dshHome: join(base, 'dsh-home'),
    databasePath: join(base, 'data', 'fde-workstation.sqlite'),
    installState: join(base, 'dsh-home', 'install-state.json'),
  }
}

export function platformRuntimeKey(): string {
  return `${process.platform}-${process.arch}`
}

export { desktopRoot, repoRoot }
