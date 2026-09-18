/** @typedef {'none' | 'rolled_back' | 'blocked'} BizRollbackState */

export const ROLLBACK_STATE_NONE = 'none'
export const ROLLBACK_STATE_ROLLED_BACK = 'rolled_back'
export const ROLLBACK_STATE_BLOCKED = 'blocked'

/**
 * Permanent failures: do not offer「可回退」again.
 * Transient (503 / unreachable) keep rollback available.
 */
export function isPermanentRollbackError(code, status) {
  const normalized = String(code || '').trim()
  const lower = normalized.toLowerCase()
  const http = Number(status || 0)
  if (http === 503 || http === 0) return false
  if (lower === 'lan_assist_unavailable' || lower === 'runtime_unreachable') return false
  if (http >= 500) return false
  if (http === 404) return true
  if (lower === 'rollback_unsupported') return true
  if (lower === 'not_found' || normalized === 'NOT_FOUND') return true
  return false
}

export function rollbackBadgeFromAudit(action, changes, rollbackState) {
  const state = String(rollbackState || ROLLBACK_STATE_NONE)
  if (state === ROLLBACK_STATE_ROLLED_BACK) return 'rolled_back'
  if (state === ROLLBACK_STATE_BLOCKED) return 'blocked'
  return canRollbackAudit(action, changes) ? 'can' : 'none'
}

function canRollbackAudit(action, changes) {
  const normalized = String(action || '').trim()
  if (normalized === '回退') return false
  return normalized === '改行' && Array.isArray(changes) && changes.length > 0
}
