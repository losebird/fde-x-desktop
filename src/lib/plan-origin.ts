/** Same origin prefixes as runtime/host-catalog.mjs. Plan UI routes writes by origin. */

import type { ScheduleEvent, Task, Workflow } from '@/lib/types'

export const ORIGIN_FDE_TASK = 'fde-task:'
export const ORIGIN_DSH_GOAL = 'dsh-goal:'
export const ORIGIN_DSH_SCHEDULE = 'dsh-schedule:'
export const ORIGIN_DSH_JOB = 'dsh-job:'

export function isHostGoalId(id: string) {
  return String(id || '').startsWith(ORIGIN_DSH_GOAL)
}

export function isHostScheduleId(id: string) {
  return String(id || '').startsWith(ORIGIN_DSH_SCHEDULE)
}

export function isHostJobId(id: string) {
  return String(id || '').startsWith(ORIGIN_DSH_JOB)
}

export function hostGoalStatusOnly(patch: Record<string, unknown> | null | undefined) {
  if (!patch || typeof patch !== 'object') return {}
  if (patch.status === undefined) return {}
  return { status: patch.status }
}

export function mergePlanRows<T extends { id: string }>(
  localRows: T[] | null | undefined,
  hostRows: T[] | null | undefined,
): T[] {
  const bag = new Map<string, T>()
  for (const row of localRows || []) {
    if (!row?.id) continue
    bag.set(String(row.id), row)
  }
  for (const row of hostRows || []) {
    if (!row?.id) continue
    bag.set(String(row.id), row)
  }
  return [...bag.values()]
}

function hostBagFields(item: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!item || typeof item !== 'object') return {}
  if (item.fields && typeof item.fields === 'object') return item.fields as Record<string, unknown>
  return item
}

const TASK_STATUSES = new Set(['todo', 'doing', 'done', 'archived'])
const TASK_PRIORITIES = new Set(['low', 'med', 'high', 'urgent'])
const EVENT_KINDS = new Set(['meeting', 'focus', 'reminder', 'external'])
const WORKFLOW_CATEGORIES = new Set(['data', 'im', 'file', 'memory', 'system'])

function workflowTriggerOf(value: unknown): Workflow['trigger'] {
  if (!value || typeof value !== 'object') return { kind: 'manual' }
  const kind = (value as { kind?: string }).kind
  if (kind === 'cron' || kind === 'keyword' || kind === 'event' || kind === 'manual') {
    return value as Workflow['trigger']
  }
  return { kind: 'manual' }
}

export function taskFromHostBagItem(
  item: Record<string, unknown> | null | undefined,
  workspaceId: string,
): Task | null {
  const row = hostBagFields(item)
  const id = String(row.id || item?.id || '')
  if (!id) return null
  const statusRaw = String(row.status || 'todo')
  const priorityRaw = String(row.priority || 'med')
  return {
    id,
    title: String(row.title || item?.title || id),
    notes: typeof row.notes === 'string' ? row.notes : '',
    status: TASK_STATUSES.has(statusRaw) ? statusRaw as Task['status'] : 'todo',
    priority: TASK_PRIORITIES.has(priorityRaw) ? priorityRaw as Task['priority'] : 'med',
    due: typeof row.due === 'string' ? row.due : (typeof row.dueAt === 'string' ? row.dueAt : undefined),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    createdAt: String(row.createdAt || new Date().toISOString()),
    workspaceId: typeof row.workspaceId === 'string' ? row.workspaceId : workspaceId,
    sourceRef: typeof row.sourceRef === 'string' ? row.sourceRef : id,
    completedAt: typeof row.completedAt === 'string' ? row.completedAt : undefined,
  }
}

export function eventFromHostBagItem(
  item: Record<string, unknown> | null | undefined,
): ScheduleEvent | null {
  const row = hostBagFields(item)
  const id = String(row.id || item?.id || '')
  if (!id) return null
  const start = String(row.start || row.startAt || '')
  if (!start) return null
  const kindRaw = String(row.kind || 'reminder')
  return {
    id,
    title: String(row.title || item?.title || id),
    start,
    end: String(row.end || row.endAt || start),
    location: typeof row.location === 'string' ? row.location : undefined,
    kind: EVENT_KINDS.has(kindRaw) ? kindRaw as ScheduleEvent['kind'] : 'reminder',
  }
}

export function workflowFromHostBagItem(
  item: Record<string, unknown> | null | undefined,
  workspaceId: string,
): Workflow | null {
  const row = hostBagFields(item)
  const id = String(row.id || item?.id || '')
  if (!id) return null
  const categoryRaw = String(row.category || 'system')
  return {
    id,
    name: String(row.name || item?.title || id),
    description: String(row.description || ''),
    status: row.status === 'active' ? 'active' : 'paused',
    trigger: workflowTriggerOf(row.trigger),
    steps: Array.isArray(row.steps) ? row.steps as Workflow['steps'] : [],
    category: WORKFLOW_CATEGORIES.has(categoryRaw) ? categoryRaw as Workflow['category'] : 'system',
    emoji: typeof row.emoji === 'string' ? row.emoji : '🤖',
    createdAt: String(row.createdAt || new Date().toISOString()),
    workspaceId: typeof row.workspaceId === 'string' ? row.workspaceId : workspaceId,
  }
}
