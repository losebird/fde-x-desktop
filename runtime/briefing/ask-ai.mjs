import { randomBytes } from 'node:crypto'
import { buildContextPack, renderContextForPrompt } from '../context-pack.mjs'
import { callHostMcp, mcpPublicName } from '../host-mcp-call.mjs'
import { waitUntilSessionIdle } from '../session-primary.mjs'
import { briefingTurnFailureText, harvestTurnToolResults } from './tool-official.mjs'

function briefingRequestId() {
  return `brq_${randomBytes(12).toString('hex')}`
}

function blockParams(block) {
  const params = block && block.params && typeof block.params === 'object' ? block.params : {}
  return params
}

async function callBlock(aiRuntime, block) {
  const params = blockParams(block)
  const named = mcpPublicName(params.server, params.tool)
  if (named.error) return { error: named.error }
  const status = typeof aiRuntime.status === 'function' ? aiRuntime.status() : {}
  try {
    const called = await callHostMcp({
      origin: status.origin || aiRuntime.origin,
      cookie: aiRuntime.cookie || status.cookie || '',
      dshHome: aiRuntime.dshHome || status.dshHome,
      name: named.name,
      args: params.args,
    })
    if (!called.ok) return { error: called.error }
    return { text: called.text }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export async function runBriefingAgent(deps, {
  briefingId,
  workspaceCwd,
  sessionId: givenSessionId,
  sections,
  internalSections,
  timeoutMs = 180_000,
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

  const blocked = []
  const toolResults = {}
  for (const block of sections.filter((row) => row.enabled && row.type === 'mcp')) {
    const called = await callBlock(aiRuntime, block)
    if (called.error) {
      blocked.push({ id: block.id, error: called.error })
      continue
    }
    const key = String(blockParams(block).tool || '').trim()
    if (key) toolResults[key] = { text: called.text }
  }

  const aiBlocks = sections.filter((row) => row.enabled && row.type === 'ai')
  if (!aiBlocks.length) {
    return { ok: true, sessionId, agentRequestId, blocked, toolResults }
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

  const idle = await waitUntilSessionIdle(aiRuntime, sessionId, { timeoutMs })
  if (!idle) {
    return { ok: false, error: '会话仍在处理上一轮', sessionId, agentRequestId, blocked, toolResults }
  }

  const prompt = [
    `[fde-briefing:${agentRequestId}]`,
    '对 ai 区块提交 items，每条一两句中文，不要一整段。不得编造 mcp 条目。',
    `完成后调用 fde_briefing_submit(requestId="${agentRequestId}", sections=[...])，sections 仅包含 ai 类型区块。`,
    '',
    '内部源摘要（只读参考）：',
    JSON.stringify(internalSummary, null, 2),
    '',
    '待处理 ai 区块：',
    JSON.stringify(aiBlocks.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.title,
      params: b.params || {},
    })), null, 2),
    Object.keys(toolResults).length ? `\n已取得的 mcp 结果：\n${JSON.stringify(toolResults, null, 2)}` : '',
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
    return {
      ok: false,
      error: error instanceof Error ? error.message : '发送早报 prompt 失败',
      sessionId,
      blocked,
      toolResults,
    }
  }

  const harvest = await harvestTurnToolResults(aiRuntime, sessionId, { timeoutMs })
  const turnError = briefingTurnFailureText(harvest.turnFailure)
  return {
    ok: harvest.ended && !turnError,
    error: turnError || (harvest.ended ? '' : 'timeout'),
    turnError,
    sessionId,
    agentRequestId,
    blocked,
    toolResults: { ...harvest.byTool, ...toolResults },
  }
}
