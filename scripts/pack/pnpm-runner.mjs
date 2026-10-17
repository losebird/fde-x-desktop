import { execFile as execFileCb } from 'node:child_process'
import { statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)

export function commandOnPath(command, env = process.env) {
  const pathValue = env.PATH ?? env.Path ?? ''
  for (const dir of String(pathValue).split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, command)
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
  }
  return ''
}

export function selectPnpmRunner({ corepackAvailable, pnpmVersion, pinnedVersion }) {
  if (corepackAvailable) {
    return { command: 'corepack', argsPrefix: [`pnpm@${pinnedVersion}`] }
  }
  const requiredMajor = String(pinnedVersion).split('.')[0]
  if (pnpmVersion) {
    const gotMajor = String(pnpmVersion).split('.')[0]
    if (gotMajor !== requiredMajor) {
      throw new Error(
        `IUI build needs pnpm ${requiredMajor}.x (pinned ${pinnedVersion}). PATH pnpm is ${pnpmVersion}. Install with \`npm install -g pnpm@${pinnedVersion}\`.`,
      )
    }
    return { command: 'pnpm', argsPrefix: [] }
  }
  throw new Error(
    `IUI build needs pnpm ${pinnedVersion}. corepack is not on PATH (Node 25+ no longer ships corepack) and pnpm is not on PATH. Install pnpm with \`npm install -g pnpm@${pinnedVersion}\`, or install corepack with \`npm install -g corepack\`.`,
  )
}

export async function resolvePnpmRunner(env = process.env, pinnedVersion) {
  const corepackAvailable = commandOnPath('corepack', env) !== ''
  let pnpmVersion = ''
  if (!corepackAvailable && commandOnPath('pnpm', env)) {
    const { stdout } = await execFile('pnpm', ['--version'], {
      env,
      maxBuffer: 1024 * 1024,
    })
    pnpmVersion = String(stdout).trim()
  }
  return selectPnpmRunner({ corepackAvailable, pnpmVersion, pinnedVersion })
}
