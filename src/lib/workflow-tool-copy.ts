export const workflowToolCopy = {
  pickerLabel: '这一步放行的工具',
  allowedLabel: '放行',
  tier: {
    read: '只读',
    propose: '提案',
    danger: '直接执行',
    wait: '会停住',
  },
  presetLabel: '从预设带入',
  presetNone: '不从预设带入',
  excludedLabel: '这些工具不在可选清单里',
  waitSkipped: '这些工具会让无人值守停住，没有勾上',
  presetFrom: '来自预设',
  dangerConfirm: '自动运行时会直接执行、不可撤回',
  confirmDanger: '确认勾选',
  cancelDanger: '先不勾选',
  emptyList: '工具清单不能为空',
  loading: '正在读取可选工具',
  unavailable: '可选工具还没核对上',
  allowedUnknown: '放行清单还没核对上',
  scheduleWorkflow: '绑定工作流',
  scheduleNone: '不绑定',
  scheduleOnce: '到点一次',
  scheduleDaily: '每天这个时间',
  scheduleRecurrence: '什么时候跑',
} as const

export type WorkflowToolTier = keyof typeof workflowToolCopy.tier

export function workflowToolTier(tier: string): WorkflowToolTier {
  if (tier === 'read' || tier === 'propose' || tier === 'danger' || tier === 'wait') return tier
  return 'danger'
}

export function readStepPreset(step: { kind?: string; config?: { presetId?: unknown } }): string {
  if (!step || step.kind !== 'ai' || !step.config || typeof step.config !== 'object') return ''
  return typeof step.config.presetId === 'string' ? step.config.presetId : ''
}

export function readStepTools(step: { kind?: string; config?: { tools?: unknown } }): string[] | null {
  if (!step || step.kind !== 'ai' || !step.config || typeof step.config !== 'object') return null
  if (!Object.prototype.hasOwnProperty.call(step.config, 'tools')) return null
  const tools = step.config.tools
  if (!Array.isArray(tools) || tools.length === 0) return null
  if (tools.some((name) => typeof name !== 'string' || !name)) return null
  return tools
}
