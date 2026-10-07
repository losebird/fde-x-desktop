/**
 * One Host capability catalog. Identity is seam + kind; FDE-X pages are views.
 * Unknown kind lands on Settings plugin overflow — never a fourth surface.
 */
import { occupancyAction, landKindFromTab } from './canvas-occupancy.mjs'
import { isPrimarySession } from './session-primary.mjs'

export { occupancyAction, landKindFromTab }

export const SEAM_SESSION = 'session'
export const SEAM_CATALOG = 'catalog'
export const SEAM_WINDOW = 'window'

/** Closed FDE-X module set. Same destinations the palette already jumped to. */
export const PAGE_CATALOG = [
  { id: 'p_ai', title: 'AI 主工作区', href: { panel: 'ai' } },
  { id: 'p_im', title: 'IM 消息面板', href: { panel: 'im' } },
  { id: 'p_brief', title: '早报', href: { panel: 'briefing' } },
  { id: 'p_plan', title: '计划 / 任务 / 日程', href: { panel: 'plan', tab: 'todo' } },
  { id: 'p_files', title: '文件', href: { panel: 'files' } },
  { id: 'p_data', title: '业务应用 / 数据操作', href: { panel: 'data' } },
  { id: 'p_mcp', title: 'MCP 管理', href: { panel: 'mcp' } },
  { id: 'p_skills', title: 'Skills 管理', href: { panel: 'skills' } },
  { id: 'p_mem', title: '记忆系统', href: { panel: 'memory' } },
  { id: 'p_set', title: '设置', href: { panel: 'settings' } },
]

export const KIND_CAP = 8

/** Search sheet display order. Catalog kinds share this list. */
export const KIND_ORDER = [
  'session', 'file', 'contact', 'letter', 'group', 'agent',
  'task', 'workflow', 'memory', 'skill', 'mcp', 'page',
]

const OVERFLOW = {
  seam: SEAM_CATALOG,
  href: { panel: 'settings', section: 'core' },
}

/** kind → seam + existing FDE-X surface. Session-runtime kinds have no catalog row. */
export const SURFACES = {
  session: { seam: SEAM_SESSION, href: { panel: 'ai' } },
  file: { seam: SEAM_CATALOG, href: { panel: 'files' } },
  mcp: { seam: SEAM_CATALOG, href: { panel: 'mcp' } },
  skill: { seam: SEAM_CATALOG, href: { panel: 'skills' } },
  officeToPdf: { seam: SEAM_CATALOG, href: { panel: 'skills' } },
  model: { seam: SEAM_CATALOG, href: { panel: 'settings', section: 'core' } },
  provider: { seam: SEAM_CATALOG, href: { panel: 'settings', section: 'core' } },
  settings: { seam: SEAM_CATALOG, href: { panel: 'settings', section: 'core' } },
  plugin: OVERFLOW,
  shortcut: { seam: SEAM_CATALOG, href: { panel: 'settings', section: 'shortcuts' } },
  goal: { seam: SEAM_CATALOG, href: { panel: 'plan', tab: 'todo' } },
  todo: { seam: SEAM_CATALOG, href: { panel: 'plan', tab: 'todo' } },
  schedule: { seam: SEAM_CATALOG, href: { panel: 'plan', tab: 'schedule' } },
  job: { seam: SEAM_CATALOG, href: { panel: 'plan', tab: 'workflow' } },
  workflow: { seam: SEAM_CATALOG, href: { panel: 'plan', tab: 'workflow' } },
  workspace: { seam: SEAM_CATALOG, href: { panel: 'ai' } },
  contact: { seam: SEAM_CATALOG, href: { panel: 'im' } },
  letter: { seam: SEAM_CATALOG, href: { panel: 'im' } },
  group: { seam: SEAM_CATALOG, href: { panel: 'im' } },
  agent: { seam: SEAM_CATALOG, href: { panel: 'ai' } },
  memory: { seam: SEAM_CATALOG, href: { panel: 'memory' } },
  page: { seam: SEAM_CATALOG, href: { panel: 'settings' } },
  desktop: { seam: SEAM_WINDOW, href: { panel: 'settings', section: 'runtime' } },
  terminal: { seam: SEAM_SESSION, href: { panel: 'ai', accessory: 'terminal' } },
}

export const ORIGIN_FDE_TASK = 'fde-task:'
export const ORIGIN_DSH_GOAL = 'dsh-goal:'
export const ORIGIN_DSH_SCHEDULE = 'dsh-schedule:'
export const ORIGIN_DSH_JOB = 'dsh-job:'

export function surfaceOfKind(kind) {
  const key = String(kind || '').trim()
  if (!key) return OVERFLOW
  return SURFACES[key] || OVERFLOW
}

export function seamOfKind(kind) {
  return surfaceOfKind(kind).seam
}

export function originOfTask(row) {
  const ref = String(row?.sourceRef || row?.source_ref || '').trim()
  if (ref.startsWith(ORIGIN_DSH_GOAL) || ref.startsWith(ORIGIN_FDE_TASK)) return ref
  const id = String(row?.id || '')
  if (id.startsWith(ORIGIN_DSH_GOAL)) return id
  if (id) return `${ORIGIN_FDE_TASK}${id}`
  return ''
}

export function isHostGoalId(id) {
  return String(id || '').startsWith(ORIGIN_DSH_GOAL)
}

export function isHostScheduleId(id) {
  return String(id || '').startsWith(ORIGIN_DSH_SCHEDULE)
}

export function isHostJobId(id) {
  return String(id || '').startsWith(ORIGIN_DSH_JOB)
}

export function hostGoalId(goalId) {
  const raw = String(goalId || '').trim()
  if (!raw) return ''
  return raw.startsWith(ORIGIN_DSH_GOAL) ? raw : `${ORIGIN_DSH_GOAL}${raw}`
}

export function hostGoalBareId(id) {
  const raw = String(id || '')
  return raw.startsWith(ORIGIN_DSH_GOAL) ? raw.slice(ORIGIN_DSH_GOAL.length) : raw
}

function goalStatus(phase) {
  if (phase === 'complete') return 'done'
  if (phase === 'paused') return 'archived'
  if (phase === 'active') return 'doing'
  return 'todo'
}

export function taskFromGoalView(view, workspaceId) {
  if (!view || typeof view !== 'object') return null
  const bare = String(view.id || '').trim()
  if (!bare) return null
  const id = hostGoalId(bare)
  const phase = String(view.phase || '')
  return {
    id,
    workspaceId,
    title: String(view.objective || id),
    notes: view.blockedReason && typeof view.blockedReason === 'object'
      ? String(view.blockedReason.message || '')
      : '',
    status: goalStatus(phase),
    priority: 'med',
    dueAt: null,
    completedAt: phase === 'complete' && view.updatedAt ? new Date(Number(view.updatedAt)).toISOString() : null,
    tags: ['dsh-goal'],
    sourceRef: id,
    createdAt: view.createdAt ? new Date(Number(view.createdAt)).toISOString() : new Date().toISOString(),
    updatedAt: view.updatedAt ? new Date(Number(view.updatedAt)).toISOString() : new Date().toISOString(),
    revision: view.revision,
  }
}

async function listPrimarySessions(aiRuntime, cwd) {
  if (!aiRuntime || typeof aiRuntime.call !== 'function') return []
  try {
    const listed = await aiRuntime.call('session/list', { _request: { includeBlank: true } })
    const items = Array.isArray(listed) ? listed : (listed && Array.isArray(listed.items) ? listed.items : [])
    const root = String(cwd || '').trim()
    const rows = items.filter((row) => {
      if (!isPrimarySession(row)) return false
      if (!root) return true
      return String(row.cwd || '') === root
    })
    rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    return rows.slice(0, 1)
  } catch {
    return []
  }
}

export async function collectKind(aiRuntime, kind, input = {}) {
  const { collectBag } = await import('./catalog-collect.mjs')
  const bag = await collectBag(aiRuntime, kind, input)
  return Array.isArray(bag.items) ? bag.items : []
}

export async function collectGoals(aiRuntime, input = {}) {
  const workspaceId = String(input.workspaceId || '')
  const cwd = String(input.cwd || '')
  const hinted = String(input.sessionId || '')
  if (!hinted && !cwd) return []
  const sessions = hinted ? [{ sessionId: hinted }] : await listPrimarySessions(aiRuntime, cwd)
  const out = []
  const seen = new Set()
  for (const row of sessions) {
    const sessionId = String(row.sessionId || row.id || '')
    if (!sessionId || !aiRuntime || typeof aiRuntime.call !== 'function') continue
    try {
      const view = await aiRuntime.call('goals/get', { agentId: sessionId })
      const task = taskFromGoalView(view, workspaceId)
      if (!task || seen.has(task.id)) continue
      seen.add(task.id)
      out.push(task)
    } catch {
      /* Host without a live goal for this agent stays empty for that row. */
    }
  }
  return out
}

export function mergeTaskRows(localRows, hostRows) {
  const bag = new Map()
  for (const row of Array.isArray(localRows) ? localRows : []) {
    if (!row || !row.id) continue
    bag.set(String(row.id), { ...row, sourceRef: row.sourceRef || originOfTask(row) })
  }
  for (const row of Array.isArray(hostRows) ? hostRows : []) {
    if (!row || !row.id) continue
    bag.set(String(row.id), row)
  }
  return [...bag.values()]
}

export async function sessionIdForGoal(aiRuntime, { cwd, sessionId, id }) {
  const hinted = String(sessionId || '')
  if (hinted) return hinted
  const bare = hostGoalBareId(id)
  const sessions = await listPrimarySessions(aiRuntime, cwd)
  for (const row of sessions) {
    const sid = String(row.sessionId || row.id || '')
    if (!sid) continue
    try {
      const view = await aiRuntime.call('goals/get', { agentId: sid })
      if (view && String(view.id) === bare) return sid
    } catch {
      /* try the next primary session */
    }
  }
  return ''
}

export async function mutateHostGoal(aiRuntime, { id, status, sessionId, cwd }) {
  const bare = hostGoalBareId(id)
  if (!bare || !aiRuntime || typeof aiRuntime.call !== 'function') {
    throw new Error('没有 Host goal')
  }
  const liveSession = await sessionIdForGoal(aiRuntime, { cwd, sessionId, id })
  if (!liveSession) throw new Error('当前工作区没有这条 goal')
  const view = await aiRuntime.call('goals/get', { agentId: liveSession })
  if (!view || String(view.id) !== bare) throw new Error('当前会话没有这条 goal')
  const ref = { id: bare, revision: view.revision }
  if (status === 'done' || status === 'archived') {
    const method = status === 'done' ? 'goals/complete' : 'goals/clear'
    await aiRuntime.call(method, { agentId: liveSession, ref })
    return collectGoals(aiRuntime, { sessionId: liveSession, cwd })
  }
  if (status === 'doing') {
    await aiRuntime.call('goals/resume', { agentId: liveSession, ref })
    return collectGoals(aiRuntime, { sessionId: liveSession, cwd })
  }
  await aiRuntime.call('goals/pause', { agentId: liveSession, ref })
  return collectGoals(aiRuntime, { sessionId: liveSession, cwd })
}
