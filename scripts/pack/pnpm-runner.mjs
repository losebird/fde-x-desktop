import { execFile as execFileCb } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)

const STALE_COREPACK_BELOW = [0, 31, 0]
const SHIM_NAMES = ['corepack', 'pnpm', 'pnpx', 'yarn', 'yarnpkg']

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

function corepackPackageVersion(filePath) {
  try {
    const real = realpathSync(filePath)
    const pkgPath = join(dirname(dirname(real)), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    if (pkg.name === 'corepack' && pkg.version) return String(pkg.version)
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return ''
    throw error
  }
  return ''
}

export function isCorepackShim(filePath) {
  let text = ''
  try {
    text = readFileSync(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
  return text.includes('corepack.cjs')
    || text.includes("runMain(['pnpm'")
    || text.includes('runMain(["pnpm"')
}

export function corepackErrorName(text) {
  const source = String(text)
  const code = source.match(/ERR_[A-Z0-9_]+/)
  if (code) return code[0]
  if (source.includes('Cannot find matching keyid')) return 'Cannot find matching keyid'
  return ''
}

export function staleCorepackReason({ corepackVersion = '', probeText = '' }) {
  const parsed = parseSemver(corepackVersion)
  if (parsed && !semverBelow(parsed, STALE_COREPACK_BELOW)) return ''
  if (corepackErrorName(probeText)) return 'probe'
  if (parsed && semverBelow(parsed, STALE_COREPACK_BELOW)) return 'version'
  return ''
}

export function staleCorepackMessage({
  nodeVersion,
  binDir,
  corepackVersion,
  pinnedVersion,
  errorName,
}) {
  const versionText = corepackVersion ? `版本 ${corepackVersion}` : '版本没有读出来'
  const names = SHIM_NAMES.join(' ')
  return [
    `Node ${nodeVersion} 的 PATH 上有旧版 corepack（${versionText}），目录 ${binDir}。`,
    `实际错误是 ${errorName}。`,
    '这次直接停下，不会改用别的工具链，也不会删除这些文件。',
    '',
    '先把这个目录里的 corepack、pnpm、pnpx、yarn、yarnpkg 移开，再安装 pnpm。',
    '先移再装。corepack 和 Node 在同一个全局目录时，反过来会报 EEXIST（bin/pnpm 或 bin/pnpx）。',
    '不要把整个目录从 PATH 删掉，git 还可能在里面。',
    '',
    `bin='${binDir}'`,
    `for name in ${names}; do`,
    '  if [ -e "$bin/$name" ]; then',
    '    mv "$bin/$name" "$bin/$name.old"',
    '  fi',
    'done',
    `npm install -g pnpm@${pinnedVersion}`,
    'hash -r',
    'command -v pnpm',
    'pnpm --version',
    '',
    '如果 mv 提示 Permission denied，在 mv 前加 sudo。移走的是这些 shim，不是整个目录。',
  ].join('\n')
}

async function runProbe(command, args, env) {
  try {
    const result = await execFile(command, args, {
      env,
      cwd: tmpdir(),
      maxBuffer: 1024 * 1024,
    })
    return {
      ok: true,
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
      error,
    }
  }
}

function probeEnvForShim(env, old) {
  if (!old) return env
  return {
    ...env,
    COREPACK_HOME: mkdtempSync(join(tmpdir(), 'corepack-probe-')),
  }
}

function stopForStaleCorepack({ nodeVersion, binDir, corepackVersion, pinnedVersion, errorName, cause }) {
  const error = new Error(staleCorepackMessage({
    nodeVersion,
    binDir,
    corepackVersion,
    pinnedVersion,
    errorName,
  }))
  if (cause) error.cause = cause
  return error
}

async function assertExecutedCorepack(corepackPath, env, pinnedVersion, nodeVersion) {
  const versionProbe = await runProbe(corepackPath, ['--version'], env)
  const versionText = `${versionProbe.stdout}\n${versionProbe.stderr}\n${versionProbe.error?.message ?? ''}`
  if (!versionProbe.ok) {
    const reason = staleCorepackReason({
      corepackVersion: versionProbe.stdout,
      probeText: versionText,
    })
    if (!reason) throw versionProbe.error
    const parsed = parseSemver(versionProbe.stdout)
    throw stopForStaleCorepack({
      nodeVersion,
      binDir: dirname(corepackPath),
      corepackVersion: parsed ? versionProbe.stdout.trim() : '',
      pinnedVersion,
      errorName: corepackErrorName(versionText),
      cause: versionProbe.error,
    })
  }

  const parsed = parseSemver(versionProbe.stdout)
  if (parsed && !semverBelow(parsed, STALE_COREPACK_BELOW)) return
  const launch = await runProbe(corepackPath, [`pnpm@${pinnedVersion}`, '--version'], env)
  const launchText = `${launch.stdout}\n${launch.stderr}\n${launch.error?.message ?? ''}`
  if (launch.ok) return
  const reason = staleCorepackReason({
    corepackVersion: versionProbe.stdout,
    probeText: launchText,
  })
  if (!reason) throw launch.error ?? new Error(launchText)
  throw stopForStaleCorepack({
    nodeVersion,
    binDir: dirname(corepackPath),
    corepackVersion: parsed ? versionProbe.stdout.trim() : '',
    pinnedVersion,
    errorName: corepackErrorName(launchText) || launch.stderr.trim().split('\n').find(Boolean) || `corepack ${versionProbe.stdout.trim()}`,
    cause: launch.error,
  })
}

export async function assertCorepackUsable(env = process.env, pinnedVersion, nodeVersion = process.versions.node) {
  const pnpmPath = commandOnPath('pnpm', env)
  const corepackPath = commandOnPath('corepack', env)
  if (pnpmPath && !isCorepackShim(pnpmPath)) {
    const probe = await runProbe(pnpmPath, ['--version'], env)
    if (!probe.ok) throw probe.error
    const requiredMajor = String(pinnedVersion).split('.')[0]
    if (probe.stdout.trim().split('.')[0] === requiredMajor) return
  }

  if (corepackPath) {
    await assertExecutedCorepack(corepackPath, env, pinnedVersion, nodeVersion)
    return
  }

  if (pnpmPath && isCorepackShim(pnpmPath)) {
    const corepackVersion = corepackPackageVersion(pnpmPath)
    const parsed = parseSemver(corepackVersion)
    const old = Boolean(parsed && semverBelow(parsed, STALE_COREPACK_BELOW))
    const probe = await runProbe(pnpmPath, ['--version'], probeEnvForShim(env, old))
    if (probe.ok) return
    const probeText = `${probe.stdout}\n${probe.stderr}\n${probe.error?.message ?? ''}`
    const errorName = corepackErrorName(probeText)
    if (!errorName) throw probe.error
    throw stopForStaleCorepack({
      nodeVersion,
      binDir: dirname(pnpmPath),
      corepackVersion: parsed ? corepackVersion : '',
      pinnedVersion,
      errorName,
      cause: probe.error,
    })
  }
}

export async function resolvePnpmRunner(env = process.env, pinnedVersion) {
  const pnpmPath = commandOnPath('pnpm', env)
  if (pnpmPath && !isCorepackShim(pnpmPath)) {
    const { stdout } = await execFile(pnpmPath, ['--version'], {
      env,
      maxBuffer: 1024 * 1024,
    })
    const pnpmVersion = String(stdout).trim()
    const requiredMajor = String(pinnedVersion).split('.')[0]
    if (pnpmVersion.split('.')[0] === requiredMajor) {
      return selectPnpmRunner({ corepackAvailable: false, pnpmVersion, pinnedVersion })
    }
  }
  if (commandOnPath('corepack', env) || (pnpmPath && isCorepackShim(pnpmPath))) {
    return selectPnpmRunner({ corepackAvailable: true, pnpmVersion: '', pinnedVersion })
  }
  let pnpmVersion = ''
  if (pnpmPath) {
    const { stdout } = await execFile(pnpmPath, ['--version'], {
      env,
      maxBuffer: 1024 * 1024,
    })
    pnpmVersion = String(stdout).trim()
  }
  return selectPnpmRunner({ corepackAvailable: false, pnpmVersion, pinnedVersion })
}
