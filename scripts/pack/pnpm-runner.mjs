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

const STALE_COREPACK_BELOW = [0, 31, 0]

function nodeMajor(version) {
  return Number(String(version).split('.')[0])
}

function parseSemver(text) {
  const match = String(text).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function semverBelow(version, floor) {
  for (let index = 0; index < 3; index += 1) {
    if (version[index] < floor[index]) return true
    if (version[index] > floor[index]) return false
  }
  return false
}

export function staleCorepackReason({ nodeVersion, corepackVersion = '', probeText = '' }) {
  if (nodeMajor(nodeVersion) < 26) return ''
  const parsed = parseSemver(corepackVersion)
  if (parsed && !semverBelow(parsed, STALE_COREPACK_BELOW)) return ''
  if (String(probeText).includes('ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING')) return 'vm'
  if (parsed && semverBelow(parsed, STALE_COREPACK_BELOW)) return 'version'
  return ''
}

export function staleCorepackMessage({ nodeVersion, corepackPath, corepackVersion, pinnedVersion }) {
  const versionText = corepackVersion ? `版本 ${corepackVersion}` : '版本没有读出来'
  return [
    `Node ${nodeVersion} 的 PATH 上有旧版 corepack：${corepackPath}（${versionText}）。`,
    `build-iui 会优先用它执行 pnpm@${pinnedVersion}，然后报 ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING。`,
    '这次直接停下，不会改用别的工具链。',
    '',
    `先安装 pnpm@${pinnedVersion}，再把这个旧 corepack 文件移开，然后重新运行 build-iui。不要把整个目录从 PATH 删掉，git 还在里面。`,
    '',
    `npm install -g pnpm@${pinnedVersion}`,
    `mv '${corepackPath}' '${corepackPath}.old'`,
    'hash -r',
    'command -v pnpm',
    'pnpm --version',
    '',
    '如果 mv 提示 Permission denied，在 mv 前加 sudo。移走的只是这个 corepack 文件。',
  ].join('\n')
}

export async function assertCorepackUsable(env = process.env, pinnedVersion, nodeVersion = process.versions.node) {
  const corepackPath = commandOnPath('corepack', env)
  if (!corepackPath) return
  if (nodeMajor(nodeVersion) < 26) return
  let stdout = ''
  let stderr = ''
  try {
    const result = await execFile(corepackPath, ['--version'], {
      env,
      maxBuffer: 1024 * 1024,
    })
    stdout = String(result.stdout ?? '')
    stderr = String(result.stderr ?? '')
  } catch (error) {
    stdout = String(error.stdout ?? '')
    stderr = String(error.stderr ?? '')
    const reason = staleCorepackReason({
      nodeVersion,
      corepackVersion: stdout,
      probeText: `${stdout}\n${stderr}\n${error.message ?? ''}`,
    })
    if (!reason) throw error
    const parsed = parseSemver(stdout)
    throw new Error(staleCorepackMessage({
      nodeVersion,
      corepackPath,
      corepackVersion: parsed ? stdout.trim() : '',
      pinnedVersion,
    }), { cause: error })
  }
  const reason = staleCorepackReason({
    nodeVersion,
    corepackVersion: stdout,
    probeText: `${stdout}\n${stderr}`,
  })
  if (!reason) return
  const parsed = parseSemver(stdout)
  throw new Error(staleCorepackMessage({
    nodeVersion,
    corepackPath,
    corepackVersion: parsed ? stdout.trim() : '',
    pinnedVersion,
  }))
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
