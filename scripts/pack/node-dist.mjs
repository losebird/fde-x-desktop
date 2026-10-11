/** Standalone Node for Host (not Electron). Pin matches Electron 44's Node 24 line. */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'

export const NODE_DIST_VERSION = '24.21.0'

export function nodeDistArchiveName(version, platform = process.platform, arch = process.arch) {
  const ver = String(version || NODE_DIST_VERSION)
  if (platform === 'win32') {
    const winArch = arch === 'ia32' ? 'x86' : arch
    return `node-v${ver}-win-${winArch}.zip`
  }
  const os = platform === 'darwin' ? 'darwin' : 'linux'
  return `node-v${ver}-${os}-${arch}.tar.gz`
}

export function nodeDistUrls(version, archive) {
  const ver = String(version || NODE_DIST_VERSION)
  const name = archive || nodeDistArchiveName(ver)
  return [
    `https://nodejs.org/dist/v${ver}/${name}`,
    `https://npmmirror.com/mirrors/node/v${ver}/${name}`,
  ]
}

export function nodeDistBins(root, platform = process.platform) {
  if (platform === 'win32') {
    return {
      node: [join(root, 'node.exe'), join(root, 'bin', 'node.exe')].find((path) => existsSync(path)) || '',
      npm: [join(root, 'npm.cmd'), join(root, 'bin', 'npm.cmd')].find((path) => existsSync(path)) || '',
      npx: [join(root, 'npx.cmd'), join(root, 'bin', 'npx.cmd')].find((path) => existsSync(path)) || '',
    }
  }
  return {
    node: existsSync(join(root, 'bin', 'node')) ? join(root, 'bin', 'node') : '',
    npm: existsSync(join(root, 'bin', 'npm')) ? join(root, 'bin', 'npm') : '',
    npx: existsSync(join(root, 'bin', 'npx')) ? join(root, 'bin', 'npx') : '',
  }
}

export function probeLauncherVersion(bin, timeoutMs = 4000) {
  const file = String(bin || '')
  if (!file || !existsSync(file)) return false
  const result = spawnSync(file, ['--version'], {
    encoding: 'utf8',
    timeout: timeoutMs,
    env: {
      ...process.env,
      PATH: `${dirname(file)}${delimiter}${process.env.PATH || ''}`,
    },
  })
  if (result.error || result.status !== 0) return false
  return String(result.stdout || '').trim().length > 0
}

export function nodeDistPresent(root, platform = process.platform) {
  const bins = nodeDistBins(root, platform)
  if (!bins.node || !bins.npm || !bins.npx) return false
  return probeLauncherVersion(bins.npm) && probeLauncherVersion(bins.npx)
}
