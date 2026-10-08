/**
 * Canvas occupancy: slot name + id/key → allow | empty | deny.
 * Applied on the slots service after ui-renderer provides it.
 * Blank-session hero chrome is not a slot; it uses data-phase=hero on the conversation root.
 */

export const CONVERSATION_VIEWS = ['chat', 'trajectory']

export function occupancyAction(options = {}) {
  const name = String(options.name || '')
  const id = String(options.id || options.key || '')
  if (name === 'conversation.view') {
    return CONVERSATION_VIEWS.includes(id) ? 'allow' : 'deny'
  }
  if (name === 'conversation.hero.agentPreset') return 'allow'
  if (name === 'conversation.hero' || name.startsWith('conversation.hero.')) return 'empty'
  if (name === 'conversation.session.header.actions') return 'allow'
  if (name === 'conversation.session.header.corner') return 'deny'
  if (name === 'rightbar' || name === 'rightbar.session' || name.startsWith('sidebar.right')) return 'deny'
  if (name === 'sidebar' || name.startsWith('sidebar.')) return 'deny'
  return 'allow'
}

export function landKindFromTab(kind) {
  const key = String(kind || '')
  if (!key) return ''
  if (key === 'file' || key.includes('sidebar-files') || key.includes('documentpreview') || key.includes('deliverable')) return 'file'
  if (key === 'goal' || key.includes('goal') || key.includes('ui-plan') || key.includes('ui-goal')) return 'goal'
  if (key === 'officeToPdf' || key.includes('office-to-pdf') || key.includes('officeToPdf')) return 'skill'
  if (key === 'workflow' || key.includes('workflow')) return 'workflow'
  if (key === 'terminal' || key.includes('terminal')) return 'terminal'
  if (key === 'memory' || key.includes('semantic') || key.includes('memory')) return 'memory'
  if (key === 'session' || key.includes('subagent') || key.includes('agent-team')) return 'session'
  return key
}
