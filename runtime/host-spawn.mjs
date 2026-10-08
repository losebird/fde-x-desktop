import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function isElectronRuntime(env = process.env, versions = process.versions) {
  return Boolean(versions?.electron || env.ELECTRON_RUN_AS_NODE)
}

export function bundledHostNode(resources) {
  const root = String(resources || '')
  if (!root) return ''
  const candidates = process.platform === 'win32'
    ? [join(root, 'node', 'node.exe'), join(root, 'node', 'bin', 'node.exe')]
    : [join(root, 'node', 'bin', 'node'), join(root, 'node', 'node')]
  return candidates.find((path) => existsSync(path)) || ''
}

export function resolveHostSpawn(bin, env = process.env, versions = process.versions) {
  const header = '--max-http-header-size=131072'
  const entry = String(bin || '')
  if (!isElectronRuntime(env, versions)) {
    return { command: process.execPath, args: [header, entry] }
  }
  const explicit = String(env.FDE_HOST_NODE || '')
  const node = (explicit && existsSync(explicit) ? explicit : '') || bundledHostNode(env.FDE_RESOURCES)
  if (!node) {
    throw new Error('桌面包内缺少独立 Node（resources/node）。Host 不能用 Electron 运行时启动。')
  }
  return { command: node, args: [header, entry] }
}

export function hostChildEnv(extra = {}, env = process.env) {
  const merged = { ...env, ...extra }
  delete merged.ELECTRON_RUN_AS_NODE
  delete merged.ALL_PROXY
  delete merged.all_proxy
  delete merged.SOCKS_PROXY
  delete merged.socks_proxy
  return merged
}
