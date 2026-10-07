import { randomBytes } from 'node:crypto'
import { buildContextPack, renderContextForPrompt } from '../context-pack.mjs'
import { listSessionProjectedToolNames } from '../routes/mcp.mjs'
import { harvestTurnToolResults } from './tool-official.mjs'


function briefingRequestId() {
  return `brq_${randomBytes(12).toString('hex')}`
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Server-side briefing agent kickoff (MCP + AI blocks). Waits for fde_briefing_submit via bridge.
 */
export async function runBriefingAgent(deps, {
  briefingId,
  workspaceCwd,
  sessionId: givenSessionId,
  sections,
  internalSections,
  timeoutMs = 180_000,
  projectWaitMs = 8000,
  omit,
}) {
  const { db, aiRuntime } = deps
  if (!aiRuntime?.status?.().connected) {
    return { ok: false, error: '核心未连接，仅内部信息', sessionId: '', blocked: [] }
  }

  const sessionId = String(givenSessionId || '').trim()
  if (!sessionId) {
    return { ok: false, error: '当前工作区还没有可用的 AI 会话', sessionId: '', blocked: [] }
  }

  const agentRequestId = briefingRequestId()
  db.prepare('UPDATE briefings SET agent_request_id = ? WHERE id = ?').run(agentRequestId, briefingId)

  const mcpNeeded = sections.filter((s) => s.enabled && s.type === 'mcp')
  const neededTools = mcpNeeded
    .map((s) => String(s.params?.tool || '').trim())
    .filter(Boolean)
  let projected = []
  if (neededTools.length) {
    const deadline = Date.now() + Number(projectWaitMs)
    while (true) {
      projected = await listSessionProjectedToolNames(aiRuntime, sessionId)
      if (neededTools.every((name) => projected.includes(name))) break
      if (Date.now() >= deadline) break
      await waitMs(400)
    }
  }
  const blocked = []
  const mcpBlocks = []
  for (const block of sections.filter((s) => s.enabled && (s.type === 'mcp' || s.type === 'ai'))) {
    if (block.type === 'mcp') {
      const tool = String(block.params?.tool || '').trim()
      if (!tool || !projected.includes(tool)) {
        blocked.push({ id: block.id, error: tool ? `会话未投影 ${tool}` : '缺少 tool' })
        continue
      }
    }
    mcpBlocks.push(block)
  }

  if (!mcpBlocks.length) {
    return { ok: true, sessionId, agentRequestId, blocked, toolResults: {} }
  }
  let contextText = ''
  try {
    const packed = await buildContextPack({ db, aiRuntime }, {
      workspaceCwd,
      scopes: ['workspace'],
      query: '早报',
      intentKind: 'lookup',
    })
    const omitSet = omit instanceof Set
      ? omit
      : new Set(Array.isArray(omit) ? omit.map((key) => String(key)).filter(Boolean) : [])
    contextText = renderContextForPrompt(packed.pack, omitSet)
  } catch (error) {
    console.warn('briefing_agent_context_failed', error)
  }

  const internalSummary = internalSections.map((s) => ({
    id: s.id,
    title: s.title,
    items: (s.items || []).slice(0, 5).map((i) => i.text),
    error: s.error,
  }))

  const prompt = [
    `[fde-briefing:${agentRequestId}]`,
    '生成早报：每个 mcp 区块必须在本轮调用对应 tool（可带 params.args）；禁止沿用上一场早报条目。',
    '对 ai 区块写一段中文总览。不得编造 mcp 条目。',
    `完成后调用 fde_briefing_submit(requestId="${agentRequestId}", sections=[...])，sections 仅包含 ai 类型区块。`,
    '',
    '内部源摘要（只读参考）：',
    JSON.stringify(internalSummary, null, 2),
    '',
    '待处理区块定义：',
    JSON.stringify(mcpBlocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      params: b.params || {},
    })), null, 2),
    contextText ? `\n工作区上下文：\n${contextText}` : '',
  ].filter(Boolean).join('\n')

  try {
    await aiRuntime.call('session/prompt', {
      request: {
        requestId: agentRequestId,
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: prompt }],
      },
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '发送早报 prompt 失败', sessionId, blocked, toolResults: {} }
  }

  const harvest = await harvestTurnToolResults(aiRuntime, sessionId, { timeoutMs })
  return {
    ok: harvest.ended,
    error: harvest.ended ? '' : 'timeout',
    sessionId,
    agentRequestId,
    blocked,
    toolResults: harvest.byTool,
  }
}
