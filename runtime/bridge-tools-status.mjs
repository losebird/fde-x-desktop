import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fdeRunDirectory } from './config.mjs'

export const BRIDGE_TOOLS_FILE = 'bridge-tools.json'

export function bridgeToolsStatusPath(dshHome) {
  return join(fdeRunDirectory(dshHome), BRIDGE_TOOLS_FILE)
}

export function readBridgeToolsStatus(dshHome) {
  const file = bridgeToolsStatusPath(dshHome)
  if (!existsSync(file)) return { ok: false, error: 'bridge_tools_missing' }
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    if (!json || typeof json !== 'object') return { ok: false, error: 'bridge_tools_invalid' }
    return {
      ok: json.ok === true,
      error: typeof json.error === 'string' ? json.error : '',
      tools: Array.isArray(json.tools) ? json.tools.filter((name) => typeof name === 'string') : [],
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
