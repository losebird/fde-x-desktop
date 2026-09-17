import { emit } from '../events.mjs'
import { collectInternalSection } from './collectors.mjs'
import { runBriefingAgent } from './ask-ai.mjs'
import {
  createBriefingRun,
  findBriefingByAgentRequest,
  getBriefing,
  getOrCreateDefinition,
  updateBriefingContent,
} from './store.mjs'

function mergeAgentSections(existing, submitted) {
  const byId = new Map((submitted || []).map((s) => [s.id, s]))
  return existing.map((section) => {
    if (section.type !== 'mcp' && section.type !== 'ai') return section
    const patch = byId.get(section.id)
    if (!patch) {
      if (section.pendingAgent) {
        return { ...section, error: '超时', pendingAgent: false }
      }
      return section
    }
    return {
      ...section,
      ...patch,
      type: section.type || patch.type,
      pendingAgent: false,
      fetchedAt: patch.fetchedAt || new Date().toISOString(),
    }
  })
}

function computeRunStatus(sections) {
  const errors = sections.filter((s) => s.error)
  const internals = sections.filter((s) => s.type !== 'mcp' && s.type !== 'ai')
  const internalAllFailed = internals.length > 0 && internals.every((s) => s.error)
  if (internalAllFailed && errors.length === sections.length) return 'failed'
  if (errors.length) return 'partial'
  return 'ready'
}

/**
 * @param {object} deps
 * @param {{ workspaceCwd: string, mode: 'full'|'internal-only', definitionId?: string }} input
 */
export async function runBriefing(deps, input) {
  const { db, aiRuntime } = deps
  const workspaceCwd = String(input.workspaceCwd || '').trim()
  if (!workspaceCwd.startsWith('/')) {
    throw Object.assign(new Error('需要工作区绝对路径 cwd'), { code: 'validation_error' })
  }
  const definition = getOrCreateDefinition(db, workspaceCwd)
  const defId = input.definitionId || definition.id
  const enabled = definition.sections.filter((s) => s.enabled)
  const { id: briefingId } = createBriefingRun(db, {
    definitionId: defId,
    workspaceCwd,
    agentRequestId: '',
  })

  const internalDefs = enabled.filter((s) => s.type !== 'mcp' && s.type !== 'ai')
  const sections = []
  for (const def of internalDefs) {
    const section = await collectInternalSection({ db, aiRuntime }, def, workspaceCwd)
    sections.push({ ...section, type: def.type })
  }

  let sessionId = ''
  let agentError = ''

  const needAgent = input.mode === 'full'
    && enabled.some((s) => (s.type === 'mcp' || s.type === 'ai'))
    && aiRuntime?.status?.().connected

  if (needAgent) {
    for (const def of enabled.filter((s) => s.type === 'mcp' || s.type === 'ai')) {
      sections.push({
        id: def.id,
        title: def.title,
        render: def.render,
        type: def.type,
        items: [],
        pendingAgent: true,
      })
    }
    updateBriefingContent(db, briefingId, { status: 'running', sections })
    const agent = await runBriefingAgent(
      { db, aiRuntime },
      {
        briefingId,
        workspaceCwd,
        sections: enabled,
        internalSections: sections.filter((s) => s.type !== 'mcp' && s.type !== 'ai'),
      },
    )
    sessionId = agent.sessionId || ''
    if (!agent.ok) agentError = agent.error || 'timeout'
    const latest = getBriefing(db, briefingId) || findBriefingByAgentRequest(db, agent.agentRequestId || '') || { sections: [] }
    const merged = mergeAgentSections(sections, latest.sections)
    sections.length = 0
    sections.push(...merged)
  } else if (enabled.some((s) => (s.type === 'mcp' || s.type === 'ai') && s.enabled)) {
    for (const def of enabled.filter((s) => s.type === 'mcp' || s.type === 'ai')) {
      sections.push({
        id: def.id,
        title: def.title,
        render: def.render,
        type: def.type,
        items: [],
        error: aiRuntime?.status?.().connected ? undefined : '核心未连接，仅内部信息',
      })
    }
  }

  const status = agentError === 'timeout' ? 'partial' : computeRunStatus(sections)
  const aiSection = sections.find((s) => s.type === 'ai')
  const summary = aiSection?.items?.[0]?.text || aiSection?.body || ''

  const final = updateBriefingContent(db, briefingId, {
    status,
    sections,
    summary,
    sessionId,
    agentError: agentError || undefined,
  })

  emit('briefing.ready', { briefingId, workspaceCwd, status }, { workspaceCwd })
  return { briefingId, briefing: final }
}

export function mergeBriefingSubmit(db, requestId, submittedSections) {
  const briefing = findBriefingByAgentRequest(db, requestId)
  if (!briefing) return { ok: false, error: 'briefing_not_found' }
  const contentSections = briefing.sections || []
  const merged = mergeAgentSections(contentSections, submittedSections)
  const status = computeRunStatus(merged)
  const aiSection = merged.find((s) => s.type === 'ai')
  const summary = aiSection?.items?.[0]?.text || aiSection?.body || briefing.summary
  updateBriefingContent(db, briefing.id, {
    status,
    sections: merged,
    summary,
  })
  emit('briefing.ready', { briefingId: briefing.id, workspaceCwd: briefing.workspaceCwd, status }, { workspaceCwd: briefing.workspaceCwd })
  return { ok: true, briefingId: briefing.id }
}
