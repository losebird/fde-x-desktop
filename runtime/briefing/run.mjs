import { canonicalWorkspaceCwd } from '../cwd.mjs'
import { emit } from '../events.mjs'
import { invalidateHostSessionList, resolvePrimarySessionForRuntime } from '../session-primary.mjs'
import { stageBriefingSessionAllow } from './session.mjs'
import { collectInternalSection } from './collectors.mjs'
import { runBriefingAgent } from './ask-ai.mjs'
import { isMailMcpServerName } from '../mail-providers.mjs'
import { itemsFromToolResult } from './tool-official.mjs'
import { digestBeats, presentBriefingItem } from './item.mjs'
import {
  briefingInFlight,
  createBriefingRun,
  findBriefingByAgentRequest,
  findInFlightBriefing,
  getBriefing,
  getLatestBriefing,
  getOrCreateDefinition,
  updateBriefingContent,
} from './store.mjs'

const fullRuns = new Map()
const INTERRUPTED = '生成中断'

function interruptedSections(sections) {
  return (Array.isArray(sections) ? sections : []).map((section) => {
    if (!section.pendingAgent) return section
    return { ...section, error: section.error || INTERRUPTED, pendingAgent: false }
  })
}

function closeInterrupted(db, briefingId, workspaceCwd) {
  const row = getBriefing(db, briefingId, workspaceCwd)
  if (!row || !briefingInFlight(row)) return row
  return updateBriefingContent(db, briefingId, {
    status: 'failed',
    agentError: INTERRUPTED,
    sections: interruptedSections(row.sections),
  }, workspaceCwd)
}

function arrivedAiSections(rows) {
  return rows.filter((section) => section.type === 'ai' && section.pendingAgent !== true)
}

function explainMissingSubmit(agentError) {
  if (agentError === 'timeout') return '超时'
  if (agentError.trim()) return agentError.trim()
  return '没有收到早报提交'
}

function presentItems(items) {
  if (!Array.isArray(items)) return items
  return items.map((row) => presentBriefingItem(row)).filter(Boolean)
}

function mcpHitForSection(section, def, toolResults) {
  const tool = String(def?.params?.tool || '').trim()
  if (tool && toolResults[tool]) return toolResults[tool]
  if (toolResults[section.id]) return toolResults[section.id]
  return null
}

function applyMcpSections(sections, enabled, toolResults, blocked, { requireHit = true } = {}) {
  for (const row of blocked || []) {
    const idx = sections.findIndex((section) => section.id === row.id)
    if (idx < 0) continue
    sections[idx] = { ...sections[idx], error: row.error, pendingAgent: false, items: [] }
  }
  for (const section of sections) {
    if (section.type !== 'mcp' || !section.pendingAgent) continue
    const def = enabled.find((row) => row.id === section.id)
    const hit = mcpHitForSection(section, def, toolResults)
    if (!hit) {
      if (!requireHit) continue
      const tool = String(def?.params?.tool || '').trim()
      section.error = tool ? `本轮未调用 ${tool}` : '缺少 tool'
      section.pendingAgent = false
      section.items = []
      continue
    }
    const items = Array.isArray(hit.items)
      ? hit.items.slice(0, Number(def?.params?.limit) || 8)
      : itemsFromToolResult(hit.text, { limit: Number(def?.params?.limit) || 8 })
    if (hit.error && !items.length) {
      section.error = hit.error === true ? '工具执行失败' : String(hit.error)
      section.pendingAgent = false
      section.items = []
      continue
    }
    section.items = items
    section.pendingAgent = false
    section.fetchedAt = new Date().toISOString()
    if (hit.error) section.error = hit.error === true ? '工具执行失败' : String(hit.error)
  }
  const mailIds = enabled
    .filter((row) => row.type === 'mcp' && isMailMcpServerName(row.params?.server))
    .map((row) => row.id)
  if (mailIds.length > 1) {
    const sinkId = mailIds[0]
    for (let index = sections.length - 1; index >= 0; index -= 1) {
      if (mailIds.includes(sections[index].id) && sections[index].id !== sinkId) sections.splice(index, 1)
    }
  }
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
      items: presentItems(patch.items) ?? section.items,
      error: patch.error || undefined,
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
  const { db } = deps
  const workspaceCwd = canonicalWorkspaceCwd(input.workspaceCwd)
  if (!workspaceCwd) {
    throw Object.assign(new Error('需要工作区绝对路径 cwd'), { code: 'validation_error' })
  }
  const mode = input.mode === 'internal-only' ? 'internal-only' : 'full'
  if (mode !== 'full') return runBriefingUnlocked(deps, input, workspaceCwd, mode)
  const live = fullRuns.get(workspaceCwd)
  if (live) {
    const result = await live.promise
    return { ...result, joined: true }
  }
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const run = (async () => {
    await gate
    const orphan = findInFlightBriefing(db, workspaceCwd)
    if (orphan) closeInterrupted(db, orphan.id, workspaceCwd)
    return runBriefingUnlocked(deps, input, workspaceCwd, mode)
  })()
  fullRuns.set(workspaceCwd, { promise: run })
  release()
  try {
    return await run
  } finally {
    if (fullRuns.get(workspaceCwd)?.promise === run) fullRuns.delete(workspaceCwd)
  }
}

async function runBriefingUnlocked(deps, input, workspaceCwd, mode) {
  const { db, aiRuntime } = deps
  let briefingId = ''
  try {
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
    const created = createBriefingRun(db, {
      definitionId: defId,
      workspaceCwd,
      agentRequestId: '',
    })
    briefingId = created.id

    const internalDefs = enabled.filter((s) => s.type !== 'mcp' && s.type !== 'ai')
    const collectSessionId = await resolvePrimarySessionForRuntime(aiRuntime, {
      sessionId: input.sessionId,
      cwd: workspaceCwd,
      preferIdle: true,
    })
    const sections = []
    for (const def of internalDefs) {
      const section = await collectInternalSection({ db, aiRuntime, sessionId: collectSessionId }, def, workspaceCwd)
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
      updateBriefingContent(db, briefingId, { status: 'running', sections }, workspaceCwd)
      sessionId = String(input.sessionId || '').trim()
      if (!sessionId) {
        sessionId = await resolvePrimarySessionForRuntime(aiRuntime, { cwd: workspaceCwd, preferIdle: true })
      }
      let agent = { ok: false, blocked: [], toolResults: {} }
      if (!sessionId) {
        agentError = '当前工作区还没有可用的 AI 会话'
      } else {
        stageBriefingSessionAllow(aiRuntime, sessionId, definition.sections)
        agent = await runBriefingAgent(
          { db, aiRuntime },
          {
            briefingId,
            workspaceCwd,
            sessionId,
            sections: enabled,
            internalSections: sections.filter((s) => s.type !== 'mcp' && s.type !== 'ai'),
            omit: input.omit,
            onMcpCollected: async ({ toolResults, blocked }) => {
              applyMcpSections(sections, enabled, toolResults, blocked, { requireHit: false })
              updateBriefingContent(db, briefingId, { status: 'running', sections }, workspaceCwd)
              emit('briefing.ready', { briefingId, workspaceCwd, status: 'running' }, { workspaceCwd })
            },
          },
        )
        sessionId = agent.sessionId || sessionId
        if (!agent.ok) agentError = agent.error || '发送早报 prompt 失败'
        invalidateHostSessionList()
        if (sessionId) {
          emit('ai.session.changed', { sessionId, kind: 'prompted' }, { workspaceCwd, sessionId })
        }
      }
      const toolResults = agent.toolResults && typeof agent.toolResults === 'object' ? agent.toolResults : {}
      applyMcpSections(sections, enabled, toolResults, agent.blocked, { requireHit: true })
      const latest = getBriefing(db, briefingId, workspaceCwd) || findBriefingByAgentRequest(db, agent.agentRequestId || '') || { sections: [] }
      const merged = mergeAgentSections(
        sections,
        arrivedAiSections(latest.sections),
        explainMissingSubmit(agentError),
      )
      sections.length = 0
      sections.push(...merged)
      if (agent.turnError) {
        for (const section of sections) {
          if (section.type !== 'ai' || (section.items || []).length) continue
          section.error = agent.turnError
          section.pendingAgent = false
        }
      }
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
    const summary = digestBeats(aiSection).join('；')

    const final = updateBriefingContent(db, briefingId, {
      status,
      sections,
      summary,
      sessionId,
      agentError: agentError || undefined,
    }, workspaceCwd)

    emit('briefing.ready', { briefingId, workspaceCwd, status }, { workspaceCwd })
    return { briefingId, briefing: final }
  } catch (error) {
    if (briefingId) closeInterrupted(db, briefingId, workspaceCwd)
    throw error
  }
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
  const summary = digestBeats(aiSection).join('；') || briefing.summary
  updateBriefingContent(db, briefing.id, {
    status,
    sections: merged,
    summary,
  }, briefing.workspaceCwd)
  emit('briefing.ready', { briefingId: briefing.id, workspaceCwd: briefing.workspaceCwd, status }, { workspaceCwd: briefing.workspaceCwd })
  return { ok: true, briefingId: briefing.id }
}
