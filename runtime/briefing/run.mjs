import { emit } from '../events.mjs'
import { resolvePrimarySessionForRuntime } from '../session-primary.mjs'
import { collectInternalSection } from './collectors.mjs'
import { runBriefingAgent } from './ask-ai.mjs'
import { itemsFromToolResult } from './tool-official.mjs'
import {
  createBriefingRun,
  findBriefingByAgentRequest,
  findInFlightBriefing,
  getBriefing,
  getLatestBriefing,
  getOrCreateDefinition,
  updateBriefingContent,
} from './store.mjs'

const fullLocks = new Set()

function beginFullLock(cwd) {
  const key = String(cwd || '')
  if (!key || fullLocks.has(key)) return false
  fullLocks.add(key)
  return true
}

function endFullLock(cwd) {
  fullLocks.delete(String(cwd || ''))
}

function mergeAgentSections(existing, submitted, pendingError = '超时') {
  const byId = new Map((submitted || []).map((s) => [s.id, s]))
  return existing.map((section) => {
    if (section.type === 'mcp') return section
    if (section.type !== 'ai') return section
    const patch = byId.get(section.id)
    if (!patch) {
      if (section.pendingAgent) {
        return { ...section, error: pendingError, pendingAgent: false }
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
 * @param {{ workspaceCwd: string, mode: 'full'|'internal-only', definitionId?: string, sessionId?: string, omit?: string[] }} input
 */
export async function runBriefing(deps, input) {
  const { db, aiRuntime } = deps
  const workspaceCwd = String(input.workspaceCwd || '').trim()
  if (!workspaceCwd.startsWith('/')) {
    throw Object.assign(new Error('需要工作区绝对路径 cwd'), { code: 'validation_error' })
  }
  const mode = input.mode === 'internal-only' ? 'internal-only' : 'full'
  if (mode === 'full') {
    const inflight = findInFlightBriefing(db, workspaceCwd)
    if (inflight) return { briefingId: inflight.id, briefing: inflight, joined: true }
    if (!beginFullLock(workspaceCwd)) {
      for (let i = 0; i < 25; i += 1) {
        const latest = findInFlightBriefing(db, workspaceCwd) || getLatestBriefing(db, workspaceCwd)
        if (latest) return { briefingId: latest.id, briefing: latest, joined: true }
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      const latest = getLatestBriefing(db, workspaceCwd)
      return { briefingId: latest?.id || '', briefing: latest, joined: true }
    }
  }
  try {
    return await runBriefingUnlocked(deps, input, workspaceCwd, mode)
  } finally {
    if (mode === 'full') endFullLock(workspaceCwd)
  }
}

async function runBriefingUnlocked(deps, input, workspaceCwd, mode) {
  const { db, aiRuntime } = deps
  const definition = getOrCreateDefinition(db, workspaceCwd)
  const defId = input.definitionId || definition.id
  const enabled = definition.sections.filter((s) => s.enabled)
  if (mode === 'full' && input.skipIfCanvas) {
    const canvasId = String(input.canvasSessionId || '').trim()
    if (canvasId) {
      const primary = await resolvePrimarySessionForRuntime(aiRuntime, {
        cwd: workspaceCwd,
        sessionId: String(input.sessionId || '').trim(),
      })
      if (primary && primary === canvasId) {
        const latest = getLatestBriefing(db, workspaceCwd)
        return { briefingId: latest?.id || '', briefing: latest, skippedCanvas: true }
      }
    }
  }
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

  const needAgent = mode === 'full'
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
    sessionId = await resolvePrimarySessionForRuntime(aiRuntime, {
      cwd: workspaceCwd,
      sessionId: String(input.sessionId || '').trim(),
    })
    const agent = await runBriefingAgent(
      { db, aiRuntime },
      {
        briefingId,
        workspaceCwd,
        sessionId,
        sections: enabled,
        internalSections: sections.filter((s) => s.type !== 'mcp' && s.type !== 'ai'),
        omit: input.omit,
      },
    )
    sessionId = agent.sessionId || sessionId
    if (!agent.ok) agentError = agent.error || 'timeout'
    for (const row of agent.blocked || []) {
      const idx = sections.findIndex((section) => section.id === row.id)
      if (idx < 0) continue
      sections[idx] = { ...sections[idx], error: row.error, pendingAgent: false, items: [] }
    }
    const toolResults = agent.toolResults && typeof agent.toolResults === 'object' ? agent.toolResults : {}
    for (const section of sections) {
      if (section.type !== 'mcp' || !section.pendingAgent) continue
      const def = enabled.find((row) => row.id === section.id)
      const tool = String(def?.params?.tool || '').trim()
      const hit = tool ? toolResults[tool] : null
      if (!hit) {
        section.error = tool ? `本轮未调用 ${tool}` : '缺少 tool'
        section.pendingAgent = false
        section.items = []
        continue
      }
      if (hit.error) {
        section.error = '工具执行失败'
        section.pendingAgent = false
        section.items = []
        continue
      }
      section.items = itemsFromToolResult(hit.text)
      section.pendingAgent = false
      section.fetchedAt = new Date().toISOString()
    }
    const latest = getBriefing(db, briefingId) || findBriefingByAgentRequest(db, agent.agentRequestId || '') || { sections: [] }
    const pendingError = agentError === 'timeout' ? '超时' : (agentError || '超时')
    const merged = mergeAgentSections(sections, latest.sections, pendingError)
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
        error: aiRuntime?.status?.().connected ? '当前工作区还没有可用的 AI 会话' : '核心未连接，仅内部信息',
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
  const aiIds = new Set(contentSections.filter((section) => section.type === 'ai').map((section) => section.id))
  const submitted = (submittedSections || []).filter((section) => (
    section && (section.type === 'ai' || aiIds.has(section.id))
  ))
  const merged = mergeAgentSections(contentSections, submitted)
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
