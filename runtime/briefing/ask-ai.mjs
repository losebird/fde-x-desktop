import { randomBytes } from 'node:crypto'
import { buildContextPack } from '../context-pack.mjs'
import { getBriefing } from './store.mjs'

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
  sections,
  internalSections,
  timeoutMs = 180_000,
}) {
  const { db, aiRuntime } = deps
  if (!aiRuntime?.status?.().connected) {
    return { ok: false, error: '核心未连接，仅内部信息', sessionId: '' }
  }

  const agentRequestId = briefingRequestId()
  db.prepare('UPDATE briefings SET agent_request_id = ? WHERE id = ?').run(agentRequestId, briefingId)

  let sessionId = ''
  try {
    const created = await aiRuntime.call('session/create', {
      request: { cwd: workspaceCwd, agentPreset: 'fde-briefing' },
    })
    sessionId = String(created?.sessionId || '')
    if (!sessionId) throw new Error('新建早报会话失败')
    const dateLabel = new Date().toLocaleDateString('zh-CN')
    await aiRuntime.call('session/rename', {
      request: { sessionId, title: `早报 · ${dateLabel}` },
    }).catch((error) => console.warn('briefing_session_rename_failed', error))
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '新建会话失败', sessionId: '' }
  }

  const mcpBlocks = sections.filter((s) => s.enabled && (s.type === 'mcp' || s.type === 'ai'))
  let contextText = ''
  try {
    const packed = await buildContextPack({ db, aiRuntime }, {
      workspaceCwd,
      scopes: ['workspace'],
      query: '早报',
      intentKind: 'lookup',
    })
    contextText = JSON.stringify(packed.pack).slice(0, 4000)
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
    '生成早报：对每个已启用的 mcp 区块调用指定 MCP 工具采集；对 ai 区块写一段中文总览。',
    '不得编造条目；每块最多 5 条；邮件/文章需带可跳转链接。',
    `完成后调用 fde_briefing_submit(requestId="${agentRequestId}", sections=[...])，sections 仅包含 mcp 与 ai 类型区块。`,
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
      agentId: sessionId,
      request: { text: prompt, mode: 'queue' },
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '发送早报 prompt 失败', sessionId }
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const row = getBriefing(db, briefingId)
    if (row?.sections?.length) {
      const agentSections = row.sections.filter((s) => s.type === 'mcp' || s.type === 'ai')
      const hasAgent = agentSections.some((s) => (s.items && s.items.length) || s.error)
      if (hasAgent) return { ok: true, sessionId, agentRequestId }
    }
    await waitMs(1500)
  }

  return { ok: false, error: 'timeout', sessionId, agentRequestId }
}
