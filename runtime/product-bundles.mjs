import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { generationInstallRoot } from './generation.mjs'

export const PRODUCT_BUNDLE_IDS = [
  '@deepseek-ai/dsh-experimental-voice-input-bundle',
  '@deepseek-ai/dsh-experimental-auto-review',
  '@deepseek-ai/dsh-experimental-agent-team-profile',
  '@deepseek-ai/dsh-experimental-schedule-bundle',
]

export function availableProductBundles(root = generationInstallRoot()) {
  const modules = join(String(root || ''), 'node_modules')
  return PRODUCT_BUNDLE_IDS.filter((name) => existsSync(join(modules, name)))
}
