import { isBuiltin } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcRoot = fileURLToPath(new URL('../../src/', import.meta.url))

export function resolve(specifier, context, nextResolve) {
  if (isBuiltin(specifier) || !specifier.startsWith('@/')) return nextResolve(specifier, context)
  const rel = specifier.slice(2)
  const file = rel.endsWith('.ts') || rel.endsWith('.mjs') || rel.endsWith('.js')
    ? join(srcRoot, rel)
    : join(srcRoot, `${rel}.ts`)
  return nextResolve(pathToFileURL(file).href, context)
}
