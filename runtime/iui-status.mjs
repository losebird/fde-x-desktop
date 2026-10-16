import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUILTIN_PLUGINS } from './builtin-plugins.mjs'

export function iuiBuiltin() {
  const plugin = BUILTIN_PLUGINS.find((row) => row.module === '@losebird/iui')
  if (!plugin || plugin.source.kind !== 'pinned') {
    throw new Error('builtin table is missing pinned @losebird/iui')
  }
  return plugin
}

export function iuiProfileDir(dshHome, profileName) {
  return join(dshHome, 'profiles', profileName, 'node_modules', iuiBuiltin().module)
}

export async function readInstalledIui(dir) {
  let text
  try {
    text = await readFile(join(dir, 'package.json'), 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return { present: false, version: '', parseError: false }
    throw error
  }
  try {
    const pkg = JSON.parse(text)
    return {
      present: true,
      version: pkg && typeof pkg.version === 'string' ? pkg.version : '',
      parseError: false,
    }
  } catch (error) {
    if (error instanceof SyntaxError) return { present: true, version: '', parseError: true }
    throw error
  }
}

export function iuiEnabledFromList(listed, moduleName) {
  const rows = Array.isArray(listed)
    ? listed
    : (listed && Array.isArray(listed.plugins) ? listed.plugins : null)
  if (!rows) return null
  const row = rows.find((item) => item && (item.moduleName === moduleName || item.patchId === 'iui'))
  if (!row) return false
  return row.enabled === true
}

export function iuiStatusPhrase({ present, version, parseError, pinVersion, enabled, connected, readError }) {
  if (!present) return 'IUI 未安装'
  if (parseError) return 'IUI 的 package.json 无法解析'
  if (version !== pinVersion) return `IUI 版本不符（安装 ${version || '未知'}，钉 ${pinVersion}）`
  if (readError) return `IUI ${version} 未能读取启用状态：${readError}`
  if (!connected) return `IUI ${version} 尚未连接，未能读取启用状态`
  if (enabled == null) return `IUI ${version} 的插件列表格式无法识别`
  if (enabled !== true) return `IUI ${version} 未启用`
  return `IUI ${version} · 已启用（标准对话）`
}

export async function describeIui(aiRuntime, dshHome, profileName) {
  const plugin = iuiBuiltin()
  const installed = await readInstalledIui(iuiProfileDir(dshHome, profileName))
  const connected = Boolean(aiRuntime && typeof aiRuntime.status === 'function' && aiRuntime.status().connected)
  let enabled = null
  let readError = ''
  if (installed.present && !installed.parseError && connected && typeof aiRuntime.call === 'function') {
    try {
      const listed = await aiRuntime.call('pluginManager/listPlugins', {})
      enabled = iuiEnabledFromList(listed, plugin.module)
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error)
    }
  }
  return iuiStatusPhrase({
    ...installed,
    pinVersion: plugin.source.version,
    enabled,
    connected,
    readError,
  })
}
