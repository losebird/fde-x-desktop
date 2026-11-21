import { join, resolve, sep } from 'node:path'
import {
  safeWorkspaceRel,
} from './files-rel.mjs'

export {
  baseRel,
  isSelfOrDescendant,
  joinRel,
  nextCopyName,
  parentIdOf,
  parentRel,
  remapRel,
  safeWorkspaceRel,
} from './files-rel.mjs'

export function resolveWorkspaceTarget(root, rel) {
  const safe = safeWorkspaceRel(rel)
  if (!safe) return { error: '路径不合法' }
  const base = resolve(root)
  const abs = resolve(join(base, safe))
  if (abs !== base && !abs.startsWith(base + sep)) return { error: '路径越出工作区' }
  return { rel: safe, abs }
}

export function resolveWorkspaceDir(root, dirRel) {
  const text = String(dirRel ?? '').trim()
  if (!text || text === '.') {
    const abs = resolve(root)
    return { rel: '', abs }
  }
  return resolveWorkspaceTarget(root, text)
}
