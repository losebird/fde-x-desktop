export const SCHEDULE_MISSED_MESSAGE = '错过'
export const SCHEDULE_PAUSED_MESSAGE = '工作流已暂停，未运行'
export const SCHEDULE_BUSY_MESSAGE = '上一次运行还没结束，未运行'

const RUNNING_LABEL = {
  queued: '运行中',
  running: '运行中',
  waiting: '运行中',
  succeeded: '已运行',
}

export function scheduleTriggerLabel(run) {
  if (!run || typeof run !== 'object') return ''
  const state = typeof run.state === 'string' ? run.state : ''
  const message = typeof run.message === 'string' ? run.message : ''
  if (state === 'cancelled' && message === SCHEDULE_MISSED_MESSAGE) return '错过'
  if (state === 'cancelled' && message === SCHEDULE_PAUSED_MESSAGE) return '跳过：工作流已暂停'
  if (state === 'cancelled' && message === SCHEDULE_BUSY_MESSAGE) return '跳过：上一次运行还没结束'
  if (state === 'failed') return `失败：${message}`
  if (state === 'cancelled') return message ? `跳过：${message}` : '跳过'
  return RUNNING_LABEL[state] || ''
}
