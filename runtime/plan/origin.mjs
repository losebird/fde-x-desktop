export const ORIGIN_FDE_TASK = 'fde-task:'
export const ORIGIN_DSH_GOAL = 'dsh-goal:'
export const ORIGIN_DSH_SCHEDULE = 'dsh-schedule:'
export const ORIGIN_DSH_JOB = 'dsh-job:'

export function isHostGoalId(id) {
  return String(id || '').startsWith(ORIGIN_DSH_GOAL)
}

export function isHostScheduleId(id) {
  return String(id || '').startsWith(ORIGIN_DSH_SCHEDULE)
}

export function isHostJobId(id) {
  return String(id || '').startsWith(ORIGIN_DSH_JOB)
}
