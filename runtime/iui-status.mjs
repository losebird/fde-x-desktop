import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUILTIN_PLUGINS } from './builtin-plugins.mjs'
import { withProbeTimeout } from './live-probe.mjs'

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

const IUI_PHASE_LABEL = {
  stage: '校验归档',
  link: '写入配置',
  boot: '等待核心',
  enable: '确认启用',
}

export function iuiInstallingPhrase(verification) {
  if (!verification || verification.state !== 'installing') {
    throw new Error('IUI installing phrase requires state installing')
  }
  const label = IUI_PHASE_LABEL[verification.phase]
  if (!label) throw new Error(`IUI installing has unknown phase ${verification.phase}`)
  const progress = verification.progress
  if (!progress || !Number.isInteger(progress.completed) || !Number.isInteger(progress.total) || progress.total < 1) {
    throw new Error('IUI installing is missing progress')
  }
  return `正在首次安装… ${label} ${progress.completed}/${progress.total}`
}

export function iuiFailedPhrase(verification) {
  if (!verification || verification.state !== 'failed') {
    throw new Error('IUI failed phrase requires state failed')
  }
  if (typeof verification.reason !== 'string' || verification.reason.length === 0) {
    throw new Error('IUI failed is missing reason')
  }
  return `IUI 安装失败：${verification.reason}。请重试。`
}

export function iuiVerifyFailedPhrase(verification) {
  if (!verification || verification.state !== 'verify_failed') {
    throw new Error('IUI verify_failed phrase requires state verify_failed')
  }
  const fields = ['artifactPath', 'expected', 'actual', 'command']
  for (const key of fields) {
    if (typeof verification[key] !== 'string' || verification[key].length === 0) {
      throw new Error(`IUI verify_failed is missing ${key}`)
    }
  }
  return `IUI 校验失败。归档 ${verification.artifactPath}。期望 ${verification.expected}，实际 ${verification.actual}。用 Node 26.7.0 与 pnpm 11.20.0 重新打包：${verification.command}`
}

export function iuiStatusPhrase({ present, version, parseError, pinVersion, enabled, connected, readError, verification }) {
  if (verification && verification.state === 'verify_failed') return iuiVerifyFailedPhrase(verification)
  if (verification && verification.state === 'failed') return iuiFailedPhrase(verification)
  if (verification && verification.state === 'installing') return iuiInstallingPhrase(verification)
  if (!present) return 'IUI 未安装'
  if (parseError) return 'IUI 的 package.json 无法解析'
  if (version !== pinVersion) return `IUI 版本不符（安装 ${version || '未知'}，钉 ${pinVersion}）`
  if (readError) return `IUI ${version} 未能读取启用状态：${readError}`
  if (!connected) return `IUI ${version} 尚未连接，未能读取启用状态`
  if (enabled == null) return `IUI ${version} 的插件列表格式无法识别`
  if (enabled !== true) return `IUI ${version} 未启用`
  return `IUI ${version} · 已启用（标准对话）`
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

export async function promoteInstalledIui(aiRuntime, dshHome, profileName) {
  const current = aiRuntime && aiRuntime.iui
  if (!current || current.state !== 'installing') {
    return { record: current || { state: 'absent' }, readError: '' }
  }
  const plugin = iuiBuiltin()
  const installed = await readInstalledIui(iuiProfileDir(dshHome, profileName))
  const connected = Boolean(aiRuntime.status && aiRuntime.status().connected)
  if (!installed.present || installed.parseError || installed.version !== plugin.source.version || !connected || typeof aiRuntime.call !== 'function') {
    return { record: current, readError: '' }
  }
  let listed
  try {
    listed = await withProbeTimeout(aiRuntime.call('pluginManager/listPlugins', {}))
  } catch (error) {
    return { record: current, readError: errorText(error) }
  }
  const enabled = iuiEnabledFromList(listed, plugin.module)
  if (enabled === true) {
    aiRuntime.iui = { state: 'enabled', version: installed.version }
    return { record: aiRuntime.iui, readError: '' }
  }
  if (enabled === false) {
    aiRuntime.iui = { state: 'installed', version: installed.version }
    return { record: aiRuntime.iui, readError: '' }
  }
  return { record: current, readError: '' }
}

export async function describeIui(aiRuntime, dshHome, profileName) {
  const plugin = iuiBuiltin()
  const verification = aiRuntime && aiRuntime.iui
  if (verification && verification.state === 'verify_failed') return iuiVerifyFailedPhrase(verification)
  if (verification && verification.state === 'failed') return iuiFailedPhrase(verification)
  if (verification && verification.state === 'installing') {
    await promoteInstalledIui(aiRuntime, dshHome, profileName)
  }
  const now = aiRuntime && aiRuntime.iui
  if (now && now.state === 'installing') return iuiInstallingPhrase(now)
  if (now && now.state === 'failed') return iuiFailedPhrase(now)
  if (now && now.state === 'verify_failed') return iuiVerifyFailedPhrase(now)
  if (now && now.state === 'enabled') {
    return iuiStatusPhrase({
      present: true,
      version: now.version,
      parseError: false,
      pinVersion: plugin.source.version,
      enabled: true,
      connected: true,
      readError: '',
    })
  }
  let installed
  try {
    installed = await readInstalledIui(iuiProfileDir(dshHome, profileName))
  } catch (error) {
    return `IUI 状态读取失败：${errorText(error)}`
  }
  const connected = Boolean(aiRuntime && typeof aiRuntime.status === 'function' && aiRuntime.status().connected)
  let enabled = null
  let readError = ''
  if (installed.present && !installed.parseError && connected && typeof aiRuntime.call === 'function') {
    try {
      const listed = await withProbeTimeout(aiRuntime.call('pluginManager/listPlugins', {}))
      enabled = iuiEnabledFromList(listed, plugin.module)
    } catch (error) {
      readError = errorText(error)
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
