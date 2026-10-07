/**
 * Preset labels come from Host: shipped ids via official display.js + locale bundle;
 * named declarations keep their own name/description.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generationInstallRoot } from './generation.mjs'

export function parseBuiltInPresetCopy(source, locale = 'zh') {
  const marker = locale === 'zh' ? 'Simplified Chinese copy' : 'English copy'
  const ident = locale === 'zh' ? 'zh' : 'en'
  const re = new RegExp(`/\\*\\* ${marker}\\. \\*/\\s*const ${ident} = \\{([\\s\\S]*?)\\n\\t\\t\\};`)
  const block = String(source || '').match(re)?.[1] || ''
  const dict = {}
  const pair = /(preset(?:Standard|Ptc|Minimal|Cordis)(?:Name|Description)):\s*"((?:\\.|[^"\\])*)"/g
  let match
  while ((match = pair.exec(block))) {
    dict[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
  return dict
}

let cached = null

export async function loadPresetDisplay() {
  if (cached) return cached
  const root = generationInstallRoot()
  const displayFile = join(root, 'node_modules', '@deepseek-ai', 'dsh-agent-preset-registry', 'lib', 'types', 'display.js')
  const localeFile = join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-agent-preset', 'lib', 'client.js')
  if (!existsSync(displayFile)) {
    cached = (preset) => ({ name: preset.name || preset.id, description: preset.description })
    return cached
  }
  const { presetDisplayText } = await import(pathToFileURL(displayFile).href)
  let dict = {}
  if (existsSync(localeFile)) {
    dict = parseBuiltInPresetCopy(await readFile(localeFile, 'utf8'), 'zh')
  }
  cached = (preset) => presetDisplayText(preset, (key) => dict[key] || key)
  return cached
}

export async function withPresetDisplay(preset) {
  const display = await loadPresetDisplay()
  const copy = display(preset)
  return {
    ...preset,
    name: copy.name,
    ...(copy.description ? { description: copy.description } : {}),
  }
}
