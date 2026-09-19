import type { BizRollbackBadge } from '@/lib/biz-rollback-outcome'

export const HISTORY_PAGE_SIZE = 20

export const ACTION_TONES = ['blue', 'purple', 'green', 'red', 'amber', 'teal'] as const

export type HistoryTone = 'default' | 'red' | 'amber' | 'blue' | 'purple' | 'teal' | 'green'

export function collectActionTokens(items: Iterable<string>): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const token = String(item || '').trim()
    if (token) set.add(token)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function actionTone(action: string, tokens: string[]): (typeof ACTION_TONES)[number] {
  const label = String(action || '').trim() || '写入'
  const listed = tokens.indexOf(label)
  let index = listed
  if (index < 0) {
    let hash = 0
    for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
    index = hash
  }
  return ACTION_TONES[index % ACTION_TONES.length]
}

export type HistoryRecordStatus = { label: string; kind: HistoryTone }

export function historyRecordStatus(action: string, badge?: BizRollbackBadge): HistoryRecordStatus | null {
  if (String(action || '').trim() === '回退') return { label: '已完成', kind: 'green' }
  if (badge === 'can') return { label: '可回退', kind: 'amber' }
  if (badge === 'rolled_back') return { label: '已回退', kind: 'teal' }
  if (badge === 'blocked') return { label: '无法回退', kind: 'default' }
  return null
}

export function historySearchHaystack(parts: Array<string | undefined | null>): string {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' ').toLowerCase()
}

export function historyRowMatches(haystack: string, query: string): boolean {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  return haystack.includes(q)
}

export function paginateHistory<T>(rows: T[], page: number, pageSize = HISTORY_PAGE_SIZE): {
  page: number
  totalPages: number
  rows: T[]
} {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (safePage - 1) * pageSize
  return { page: safePage, totalPages, rows: rows.slice(start, start + pageSize) }
}
