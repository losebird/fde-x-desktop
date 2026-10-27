export const BIZ_PRESET = 'fde-biz'
export const SCHEDULER_PRESET = 'standard'
export const RETIRED_WORKFLOW_PRESET = 'fde-workflow'

export function isDutyPickerPreset(id) {
  const value = String(id || '').trim()
  return Boolean(value) && value !== RETIRED_WORKFLOW_PRESET
}

function isBizTool(name) {
  return String(name || '').startsWith('biz_')
}

export function dutyPresetForWorkflowSteps(steps) {
  const list = Array.isArray(steps) ? steps : []
  for (const step of list) {
    const config = step && typeof step === 'object' && step.config && typeof step.config === 'object' && !Array.isArray(step.config)
      ? step.config
      : {}
    const sourceRef = String(config.sourceRef || '').trim()
    if (sourceRef.startsWith('biz:')) return BIZ_PRESET
    const tools = Array.isArray(config.tools) ? config.tools : []
    if (tools.some(isBizTool)) return BIZ_PRESET
  }
  return SCHEDULER_PRESET
}
