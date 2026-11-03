/**
 * Preset labels come from Host: shipped ids via official display.js + locale bundle;
 * named declarations keep their own name/description.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FDE_RESOURCES, FDE_RUNTIME_DIR } from './config.mjs'
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

function presetPackageRoots() {
  return [
    generationInstallRoot(),
    join(FDE_RESOURCES, 'dsh'),
    join(FDE_RUNTIME_DIR, 'host-pin'),
  ]
}

function findPresetPackageFile(rel) {
  for (const root of presetPackageRoots()) {
    const file = join(root, 'node_modules', '@deepseek-ai', rel)
    if (existsSync(file)) return file
  }
  return ''
}

export async function loadPresetDisplay() {
  if (cached) return cached
  const displayFile = findPresetPackageFile('dsh-agent-preset-registry/lib/types/display.js')
  const localeFile = findPresetPackageFile('dsh-client-ui-agent-preset/lib/client.js')
  if (!displayFile) {
    cached = (preset) => ({ name: preset.name || preset.id, description: preset.description })
    return cached
  }
  const { presetDisplayText } = await import(pathToFileURL(displayFile).href)
  let dict = {}
  if (localeFile) {
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
