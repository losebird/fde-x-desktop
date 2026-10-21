import { existsSync, symlinkSync } from 'node:fs'
import { lstat, mkdir, readlink, symlink, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/** importPeer specs in dsh-semantic-os 42e228fa. */
export const PACKAGED_PLUGIN_PEERS = [
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-llm',
]

export function packagedNodeModuleRoots(env = process.env) {
  const roots = []
  if (env.FDE_RESOURCES) roots.push(join(env.FDE_RESOURCES, 'dsh', 'node_modules'))
  if (env.FDE_DSH_BIN) roots.push(join(dirname(env.FDE_DSH_BIN), '..', 'node_modules'))
  return roots
}

export function findPackagedPeer(spec, env = process.env) {
  for (const root of packagedNodeModuleRoots(env)) {
    const dir = join(root, spec)
    if (existsSync(join(dir, 'package.json'))) return dir
  }
  return ''
}

async function linkDir(source, dest) {
  await mkdir(dirname(dest), { recursive: true })
  if (process.platform === 'win32') {
    symlinkSync(source, dest, 'junction')
    return
  }
  await symlink(source, dest)
}

async function lstatIfPresent(path) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
}

function linkTarget(linkPath, target) {
  return isAbsolute(target) ? target : resolve(dirname(linkPath), target)
}

async function releaseDanglingLink(dest) {
  const current = await lstatIfPresent(dest)
  if (!current) return true
  if (!current.isSymbolicLink()) return false
  const pointed = linkTarget(dest, await readlink(dest))
  if (await lstatIfPresent(pointed)) return false
  await unlink(dest)
  return true
}

export async function linkPackagedPeers({
  dshHome,
  env = process.env,
  specs = PACKAGED_PLUGIN_PEERS,
}) {
  const linked = []
  for (const spec of specs) {
    const source = findPackagedPeer(spec, env)
    if (!source) continue
    const dest = join(dshHome, 'profiles', 'node_modules', spec)
    if (!(await releaseDanglingLink(dest))) continue
    await linkDir(source, dest)
    linked.push(dest)
  }
  return linked
}
