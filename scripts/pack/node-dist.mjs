/** Standalone Node for Host (not Electron). Pin matches Electron 44's Node 24 line. */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

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

export function nodeDistPresent(root) {
  return existsSync(join(root, 'bin', 'node')) || existsSync(join(root, 'node.exe'))
}
