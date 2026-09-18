import { RuntimeApiError } from '@/lib/runtime-api'

export type BizRollbackBadge = 'can' | 'rolled_back' | 'blocked' | 'none'

export function normalizeRollbackBadge(
  canRollback: boolean | undefined,
  rollbackBadge?: string,
  rollbackState?: string,
): BizRollbackBadge {
  const badge = String(rollbackBadge || '').trim()
  if (badge === 'can' || badge === 'rolled_back' || badge === 'blocked' || badge === 'none') {
    return badge
  }
  const state = String(rollbackState || 'none')
  if (state === 'rolled_back') return 'rolled_back'
  if (state === 'blocked') return 'blocked'
  return canRollback ? 'can' : 'none'
}

export function isPermanentRollbackFailure(cause: unknown): boolean {
  if (!(cause instanceof RuntimeApiError)) return false
  if (cause.status === 503 || cause.status === 0) return false
  if (cause.status >= 500) return false
  const code = cause.code.toLowerCase()
  if (code === 'lan_assist_unavailable' || code === 'runtime_unreachable') return false
  if (cause.status === 404) return true
  if (code === 'rollback_unsupported') return true
  if (code === 'not_found') return true
  return false
}
