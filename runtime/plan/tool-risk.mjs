import { WORKFLOW_TOOLS } from '../fde-x-dsh-bridge/lib/workflow-limit.js'

export { WORKFLOW_TOOLS }

// One table. A name that is not here is danger.
// An mcp__ tool is danger unless the host definition carries an explicit read-only mark.
const TOOL_RISK = {
  fde_app_records_query: 'read',
  fde_context_get: 'read',
  read: 'read',
  glob: 'read',
  grep: 'read',
  read_image: 'read',
  job_list: 'read',
  job_output: 'read',
  get_goal: 'read',
  list_agents: 'read',
  team_task_list: 'read',
  team_task_get: 'read',
  schedule_list: 'read',
  skill: 'read',

  fde_app_records_propose: 'propose',
  fde_plan_task_propose: 'propose',

  bash: 'danger',
  write: 'danger',
  edit: 'danger',
  fde_app_spec_submit: 'danger',
  biz_write: 'danger',
  send_message: 'danger',
  web_fetch: 'danger',
  web_search: 'danger',
  fde_briefing_submit: 'danger',
  fde_memory_draft: 'danger',
  fde_submit_result: 'danger',
  create_goal: 'danger',
  update_goal: 'danger',
  todo_write: 'danger',
  job_kill: 'danger',
  ask_user_question: 'danger',
  exit_plan_mode: 'danger',
  present: 'danger',
  interrupt_agent: 'danger',
  subagent: 'danger',
  subagent_fork: 'danger',
  workflow: 'danger',
  spawn_teammate: 'danger',
  wait_agent: 'danger',
  team_task_create: 'danger',
  team_task_update: 'danger',
  schedule_create: 'danger',
  schedule_delete: 'danger',
  schedule_update: 'danger',
}

const WAITS_FOR_PERSON = new Set(['ask_user_question', 'exit_plan_mode', 'wait_agent'])

export function toolTier(name, marks) {
  const readOnly = Boolean(marks && marks.readOnly === true)
  if (typeof name === 'string' && name.startsWith('mcp__')) return readOnly ? 'read' : 'danger'
  if (typeof name === 'string' && Object.hasOwn(TOOL_RISK, name)) return TOOL_RISK[name]
  return 'danger'
}

export function waitsForPerson(name) {
  return WAITS_FOR_PERSON.has(name)
}

export function dangerNames(names) {
  if (!Array.isArray(names)) return []
  return [...new Set(names.filter((name) => toolTier(name) === 'danger'))].sort()
}

function resolvedTools(step) {
  const config = step && step.config && typeof step.config === 'object' ? step.config : null
  if (!config || !Object.hasOwn(config, 'tools')) return [...WORKFLOW_TOOLS]
  if (!Array.isArray(config.tools)) return []
  return config.tools.filter((name) => typeof name === 'string')
}

export function toolAuditRows(steps) {
  if (!Array.isArray(steps)) return []
  return steps.filter((step) => step && step.kind === 'ai').map((step) => {
    const tools = resolvedTools(step)
    const presetId = step.config && typeof step.config.presetId === 'string' ? step.config.presetId : ''
    return {
      id: typeof step.id === 'string' ? step.id : '',
      tools,
      danger: dangerNames(tools),
      presetId,
    }
  })
}

function hasExplicitTools(steps) {
  return Array.isArray(steps) && steps.some((step) => {
    return step && step.kind === 'ai' && step.config && typeof step.config === 'object' && Object.hasOwn(step.config, 'tools')
  })
}

export function explicitToolSteps(steps) {
  if (!Array.isArray(steps)) return []
  const rows = []
  for (const step of steps) {
    if (!step || step.kind !== 'ai' || !step.config || typeof step.config !== 'object') continue
    if (!Object.hasOwn(step.config, 'tools')) continue
    rows.push(step)
  }
  return rows
}

export function rejectToolList(steps, confirmDanger, catalog) {
  const explicit = explicitToolSteps(steps)
  if (explicit.length === 0) return null
  const known = new Map((catalog.tools || []).map((row) => [row.name, row.tier]))
  const selectedDanger = []
  for (const step of explicit) {
    const tools = step.config.tools
    if (!Array.isArray(tools) || tools.length === 0) return '工具清单不能为空'
    if (tools.some((name) => typeof name !== 'string' || !name)) return '工具清单不能为空'
    if (new Set(tools).size !== tools.length) return '工具清单不能为空'
    for (const name of tools) {
      if (!known.has(name)) return '工具不在可选清单里'
      if (known.get(name) === 'danger') selectedDanger.push(name)
    }
  }
  const danger = [...new Set(selectedDanger)].sort()
  if (confirmDanger !== undefined && !Array.isArray(confirmDanger)) return '直接执行的工具需要逐项确认'
  const confirmed = Array.isArray(confirmDanger) ? [...confirmDanger].sort() : []
  if (confirmed.length !== danger.length || confirmed.some((name, index) => name !== danger[index])) {
    return '直接执行的工具需要逐项确认'
  }
  return null
}

export function rejectPreset(steps, presets) {
  const known = new Map((Array.isArray(presets) ? presets : []).map((row) => [row.id, row]))
  for (const step of Array.isArray(steps) ? steps : []) {
    if (!step || step.kind !== 'ai' || !step.config || typeof step.config !== 'object') continue
    if (!Object.hasOwn(step.config, 'presetId')) continue
    const id = step.config.presetId
    if (typeof id !== 'string' || !id || !known.has(id)) return '预设不在可选清单里'
    const persona = known.get(id).persona
    if (!persona || typeof persona.text !== 'string' || !persona.text) return '这个预设没有可带上的人设'
  }
  return null
}

export function toolChangeAudit(previousSteps, nextSteps) {
  if (!hasExplicitTools(previousSteps) && !hasExplicitTools(nextSteps)) return null
  const before = hasExplicitTools(previousSteps) ? toolAuditRows(previousSteps) : []
  const after = toolAuditRows(nextSteps)
  if (JSON.stringify(before) === JSON.stringify(after)) return null
  return {
    before,
    after,
    danger: [...new Set(after.flatMap((row) => row.danger))].sort(),
  }
}
