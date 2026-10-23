import { planTaskSource } from '../app-source.mjs'
import { isHostGoalId } from './origin.mjs'

export function planTaskMenu(task) {
  const source = planTaskSource(task?.sourceRef || '')
  const host = isHostGoalId(task?.id)
  return {
    handoff: {
      enabled: !host,
      reason: host ? 'Host 待办不能交给 AI' : '',
    },
    openSource: {
      enabled: Boolean(source?.href),
      reason: source?.href ? '' : '手建待办无来源，可在编辑里关联',
      href: source?.href || null,
      label: source?.label || '',
    },
  }
}
