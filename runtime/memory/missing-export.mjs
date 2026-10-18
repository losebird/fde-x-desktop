import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const NAMED_EXPORT = /does not provide an export named ['"]([^'"]+)['"]/

export function missingExportName(text) {
  const match = String(text || '').match(NAMED_EXPORT)
  return match ? match[1] : ''
}

export function pluginImportDetail(name) {
  return `插件导入失败，缺少导出 ${name}`
}

function logText(aiRuntime) {
  if (!aiRuntime || typeof aiRuntime.status !== 'function') return ''
  const status = aiRuntime.status()
  const logs = status && status.recentLogs
  return Array.isArray(logs) ? logs.join('\n') : String(logs || '')
}

export async function missingPluginExport(aiRuntime) {
  const text = logText(aiRuntime)
  const fromLogs = missingExportName(text)
  if (fromLogs) return { missingExport: fromLogs, detail: pluginImportDetail(fromLogs) }
  if (!text.includes('failed to import')) return null
  const home = aiRuntime.dshHome || (aiRuntime.status() && aiRuntime.status().dshHome) || ''
  if (!home) return null
  const entry = join(home, 'vendor', 'dsh-semantic-os', 'index.js')
  if (!existsSync(entry)) return null
  let caught = null
  try {
    await import(pathToFileURL(entry).href)
  } catch (error) {
    caught = error
  }
  if (!caught) return null
  const name = missingExportName(caught instanceof Error ? caught.message : String(caught))
  if (!name) return null
  return { missingExport: name, detail: pluginImportDetail(name) }
}

export async function probeFailedReady(aiRuntime) {
  const named = await missingPluginExport(aiRuntime)
  if (!named) return { probe: 'failed' }
  return { probe: 'failed', missingExport: named.missingExport, detail: named.detail }
}
