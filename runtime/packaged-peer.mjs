import { existsSync, symlinkSync } from 'node:fs'
import { mkdir, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'

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
    if (existsSync(dest)) continue
    await linkDir(source, dest)
    linked.push(dest)
  }
  return linked
}
