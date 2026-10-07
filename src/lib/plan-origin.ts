/** Same origin prefixes as runtime/host-catalog.mjs. Plan UI routes writes by origin. */

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
