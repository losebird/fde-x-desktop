import { createServer } from 'node:net'
import { join } from 'node:path'
import { platformRuntimeKey, type UserDataRoots } from './paths.js'

export type BuildBffEnvInput = {
  resources: string
  appRoot: string
  port: number
  roots: UserDataRoots
  desktopDev?: boolean
}

export async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        if (!port) {
          reject(new Error('loopback port was 0'))
          return
        }
        resolve(port)
      })
    })
  })
}

export function pageOrigin(port: number) {
  return `http://127.0.0.1:${Number(port)}`
}

export function buildBffEnv(input: BuildBffEnvInput) {
  const port = Number(input.port)
  const origin = pageOrigin(port)
  const staticDir = input.desktopDev
    ? join(input.appRoot, 'dist')
    : join(input.resources, 'app', 'dist')
  return {
    FDE_APP_ROOT: input.appRoot,
    FDE_RESOURCES: input.resources,
    FDE_DSH_BIN: join(input.resources, 'dsh', 'bin', process.platform === 'win32' ? 'dsh.cmd' : 'dsh'),
    FDE_VENDOR_DIR: join(input.resources, 'plugins'),
    FDE_SEMANTIC_RUNTIME_SRC: join(input.resources, 'semantic-runtime', platformRuntimeKey()),
    FDE_DSH_HOME: input.roots.dshHome,
    FDE_DATABASE_PATH: input.roots.databasePath,
    FDE_RUNTIME_PORT: String(port),
    FDE_RUNTIME_HOST: '127.0.0.1',
    FDE_ALLOWED_ORIGINS: `app://fde-x,${origin}`,
    FDE_STATIC_DIR: staticDir,
    FDE_AI_WORKSPACE: input.roots.base,
    FDE_RUNTIME_SUPERVISED: '1',
  }
}
