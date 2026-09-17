import { emit } from './events.mjs'

const MAX_TEXT_CHARS = 20_000
const MAX_TOOL_RESULT_CHARS = 4_000
const MAX_TRACE_ITEMS = 300

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedText(value, limit = MAX_TEXT_CHARS) {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function textFromBlocks(blocks, options = {}) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (!isRecord(block)) continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    if (options.reasoning && block.type === 'reasoning' && typeof block.text === 'string') parts.push(block.text)
    if (block.type === 'tool-result' && Array.isArray(block.content)) {
      const nested = textFromBlocks(block.content, options)
      if (nested) parts.push(nested)
    }
  }
  return boundedText(parts.join('\n'), options.limit ?? MAX_TEXT_CHARS)
}

function replaceRange(surfaceOp) {
  if (!isRecord(surfaceOp) || surfaceOp.op !== 'replace') return undefined
  if (!Number.isSafeInteger(surfaceOp.startSeq) || !Number.isSafeInteger(surfaceOp.endSeq)) return undefined
  return { startSeq: surfaceOp.startSeq, endSeq: surfaceOp.endSeq }
}

function isoTime(value) {
  const date = new Date(typeof value === 'number' ? value : Date.now())
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function traceLabel(type) {
  const labels = {
    'turn/start': '开始处理',
    'turn/end': '处理完成',
    'step/start': '开始步骤',
    'step/end': '步骤完成',
    'tool/call': '调用工具',
    'tool/result': '工具返回',
    'assistant/attempt': '模型尝试',
    'llm/retry': '准备重试',
    'llm/retry-started': '正在重试',
    'approval/asked': '等待确认',
    'approval/decided': '确认结果',
    'command/run': '执行命令',
    'command/done': '命令完成',
    'deliverables/presented': '交付结果',
    'user/message': '用户消息',
    'assistant/message': '助手回复',
    'model/selection': '切换模型',
  }
  return labels[type] ?? type
}

function readUsage(data) {
  if (!isRecord(data)) return null
  const usage = isRecord(data.usage) ? data.usage : (isRecord(data.message) && isRecord(data.message.usage) ? data.message.usage : null)
  if (!isRecord(usage)) return null
  const prompt = Number(usage.inputTokens ?? usage.promptTokens ?? usage.prompt ?? 0) || 0
  const completion = Number(usage.outputTokens ?? usage.completionTokens ?? usage.completion ?? 0) || 0
  const total = Number(usage.totalTokens ?? usage.total ?? 0) || (prompt + completion)
  if (!prompt && !completion && !total) return null
  return { prompt, completion, total }
}

function summarizeToolArgs(data) {
  if (!isRecord(data)) return ''
  const raw = data.arguments ?? data.args ?? data.input
  if (typeof raw === 'string') return boundedText(raw, 500)
  try {
    return boundedText(JSON.stringify(raw ?? {}), 500)
  } catch {
    return ''
  }
}

function emitToolBusEvents(event, toolNames, meta) {
  if (!isRecord(event) || typeof event.type !== 'string' || !isRecord(event.data)) return
  const workspaceCwd = meta?.workspaceCwd ?? null
  const sessionId = meta?.sessionId
  if (event.type === 'tool/call') {
    const tool = typeof event.data.name === 'string' && event.data.name ? event.data.name : 'tool'
    const callId = typeof event.data.callId === 'string' ? event.data.callId : ''
    if (callId) toolNames.set(callId, tool)
    emit('ai.tool.called', {
      tool,
      argsSummary: summarizeToolArgs(event.data),
      runId: meta?.runId ?? callId ?? String(event.seq ?? ''),
    }, { workspaceCwd, sessionId, source: 'dsh' })
    return
  }
  if (event.type === 'tool/result') {
    const message = isRecord(event.data.message) ? event.data.message : {}
    const source = isRecord(message.source) ? message.source : {}
    const callId = typeof source.callId === 'string' ? source.callId : ''
    const tool = callId ? (toolNames.get(callId) ?? 'tool') : 'tool'
    const resultBlock = Array.isArray(message.content) && isRecord(message.content[0]) ? message.content[0] : {}
    const ok = !event.data.error && !resultBlock.isError
    emit('ai.tool.finished', {
      tool,
      ok,
      runId: meta?.runId ?? callId ?? String(event.seq ?? ''),
    }, { workspaceCwd, sessionId, source: 'dsh' })
  }
}

function traceDetail(type, data, toolNames) {
  if (!isRecord(data)) return ''
  if (type === 'tool/call') {
    const name = typeof data.name === 'string' && data.name ? data.name : ''
    const callId = typeof data.callId === 'string' ? data.callId : ''
    return name || (callId ? (toolNames.get(callId) ?? '工具调用') : '工具调用')
  }
  if (type === 'tool/result') {
    const message = isRecord(data.message) ? data.message : {}
    const source = isRecord(message.source) ? message.source : {}
    const callId = typeof source.callId === 'string' ? source.callId : ''
    return `${callId ? (toolNames.get(callId) ?? '工具') : '工具'}${data.error ? ' · 执行异常' : ' · 已返回'}`
  }
  if (type === 'turn/start' || type === 'turn/end') return Number.isFinite(data.turn) ? `第 ${data.turn} 轮` : ''
  if (type === 'step/start' || type === 'step/end') return Number.isFinite(data.step) ? `步骤 ${data.step}` : ''
  if (type.startsWith('approval/')) return typeof data.reason === 'string' ? boundedText(data.reason, 180) : ''
  return ''
}

function messageFromEvent(event, toolNames) {
  if (!isRecord(event) || !isRecord(event.data)) return null
  let message
  let role
  if (event.type === 'user/message') {
    message = event.data
    role = 'user'
  } else if (event.type === 'assistant/message') {
    message = isRecord(event.data.message) ? event.data.message : null
    role = 'assistant'
  } else if (event.type === 'tool/result') {
    message = isRecord(event.data.message) ? event.data.message : null
    role = 'tool'
  } else {
    return null
  }
  if (!isRecord(message)) return null

  const id = typeof message.id === 'string' && message.id ? message.id : `event-${event.seq}`
  const replacement = replaceRange(event.surfaceOp)
  if (role === 'tool') {
    const source = isRecord(message.source) ? message.source : {}
    const callId = typeof source.callId === 'string' ? source.callId : ''
    const content = textFromBlocks(message.content, { limit: MAX_TOOL_RESULT_CHARS })
    const resultBlock = Array.isArray(message.content) && isRecord(message.content[0]) ? message.content[0] : {}
    return {
      id,
      seq: event.seq,
      role,
      ts: isoTime(event.time),
      toolName: callId ? (toolNames.get(callId) ?? '工具') : '工具',
      toolResult: content || (resultBlock.isError ? '执行失败' : '已完成'),
      status: resultBlock.isError || event.data.error ? 'error' : 'success',
      ...(replacement ? { replace: replacement } : {}),
    }
  }

  const blocks = Array.isArray(message.content) ? message.content : []
  if (role === 'assistant') {
    for (const block of blocks) {
      if (isRecord(block) && block.type === 'tool-call' && typeof block.id === 'string') {
        toolNames.set(block.id, typeof block.name === 'string' && block.name ? block.name : '工具')
      }
    }
  }
  const content = textFromBlocks(blocks)
  if (!content && role === 'assistant') return null
  if (!content && role === 'user') return null
  const usage = role === 'assistant' ? readUsage(event.data) : null
  return {
    id,
    seq: event.seq,
    role,
    content,
    ts: isoTime(event.time),
    ...(usage ? { usage } : {}),
    ...(replacement ? { replace: replacement } : {}),
  }
}

function traceFromEvent(event, toolNames) {
  if (!isRecord(event) || typeof event.type !== 'string') return null
  const visible = new Set([
    'turn/start', 'turn/end', 'step/start', 'step/end', 'tool/call', 'tool/result',
    'assistant/attempt', 'llm/retry', 'llm/retry-started', 'approval/asked',
    'approval/decided', 'command/run', 'command/done', 'deliverables/presented',
    'user/message', 'assistant/message', 'model/selection',
  ])
  if (!visible.has(event.type)) return null
  const data = isRecord(event.data) ? event.data : {}
  const title = event.type === 'tool/call' && typeof data.name === 'string' && data.name
    ? `调用 ${data.name}`
    : traceLabel(event.type)
  return {
    id: `trace-${event.seq}`,
    seq: event.seq,
    type: event.type,
    title,
    detail: traceDetail(event.type, data, toolNames),
    time: isoTime(event.time),
    status: event.type.endsWith('/end') || event.type === 'tool/result' || event.type === 'command/done' || event.type.endsWith('/message') ? 'completed' : 'running',
  }
}

function liveFrame(frame) {
  if (!isRecord(frame) || typeof frame.type !== 'string') return null
  if (frame.type === 'start') {
    return {
      kind: 'start',
      attemptId: typeof frame.attemptId === 'string' ? frame.attemptId : '',
      turn: Number(frame.turn ?? 0),
      step: Number(frame.step ?? 0),
    }
  }
  if (frame.type === 'end') {
    return {
      kind: 'end',
      attemptId: typeof frame.attemptId === 'string' ? frame.attemptId : '',
      outcome: isRecord(frame.outcome) && frame.outcome.kind === 'committed' ? 'committed' : 'abandoned',
    }
  }
  if (frame.type !== 'chunk' || !isRecord(frame.chunk)) return null
  const chunk = frame.chunk
  if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
    return { kind: 'text', attemptId: frame.attemptId, text: boundedText(chunk.text, 8_000), time: isoTime(frame.time) }
  }
  if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') {
    return { kind: 'reasoning', attemptId: frame.attemptId, text: boundedText(chunk.text, 8_000), time: isoTime(frame.time) }
  }
  if (chunk.type === 'tool-call-delta') {
    return {
      kind: 'tool',
      attemptId: frame.attemptId,
      callId: typeof chunk.id === 'string' ? chunk.id : '',
      name: typeof chunk.name === 'string' ? chunk.name : undefined,
      argumentsDelta: typeof chunk.argumentsDelta === 'string' ? boundedText(chunk.argumentsDelta, 4_000) : '',
      time: isoTime(frame.time),
    }
  }
  return {
    kind: 'meta',
    attemptId: typeof frame.attemptId === 'string' ? frame.attemptId : '',
    chunkType: typeof chunk.type === 'string' ? chunk.type : 'unknown',
    time: isoTime(frame.time),
  }
}

function applySurface(messages, message) {
  if (message.replace) {
    for (const [seq] of messages) {
      if (seq >= message.replace.startSeq && seq <= message.replace.endSeq) messages.delete(seq)
    }
  }
  messages.set(message.seq, message)
}

function normalizeFollowFrameWithState(frame, toolNames, meta) {
  if (!isRecord(frame) || typeof frame.type !== 'string') return null
  if (frame.type === 'snapshot') {
    toolNames.clear()
    const messages = new Map()
    const trace = []
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    const seenTools = new Set()
    for (const record of Array.isArray(frame.records) ? frame.records : []) {
      const event = isRecord(record) && record.type === 'event' ? record.event : null
      if (!isRecord(event)) continue
      const message = messageFromEvent(event, toolNames)
      if (message) applySurface(messages, message)
      const traceItem = traceFromEvent(event, toolNames)
      if (traceItem) trace.push(traceItem)
      if (event.type === 'tool/call' && isRecord(event.data) && typeof event.data.name === 'string' && event.data.name) {
        seenTools.add(event.data.name)
      }
      const usage = readUsage(event.data)
      if (usage) {
        promptTokens += usage.prompt
        completionTokens += usage.completion
        totalTokens += usage.total || (usage.prompt + usage.completion)
      }
    }
    const values = isRecord(frame.projections) && isRecord(frame.projections.values) ? frame.projections.values : {}
    const selection = isRecord(values.modelSelection) ? values.modelSelection : {}
    const activeAttempt = isRecord(frame.assistantStream) && isRecord(frame.assistantStream.activeAttempt)
      ? frame.assistantStream.activeAttempt
      : null
    const live = activeAttempt
      ? (Array.isArray(activeAttempt.stream) ? activeAttempt.stream.map((chunk, index) => liveFrame({
          type: 'chunk',
          attemptId: activeAttempt.attemptId,
          index,
          time: Date.now(),
          chunk,
        })).filter(Boolean) : [])
      : []
    const headerTools = isRecord(frame.header) && Array.isArray(frame.header.tools) ? frame.header.tools : []
    const toolNamesList = headerTools.map((item) => {
      if (typeof item === 'string') return item
      if (isRecord(item) && typeof item.name === 'string') return item.name
      return ''
    }).filter(Boolean)
    const permissions = isRecord(values.permissions) ? values.permissions : undefined
    const turnOutline = values.turnOutline
    const usage = totalTokens || promptTokens || completionTokens
      ? { prompt: promptTokens, completion: completionTokens, total: totalTokens || (promptTokens + completionTokens) }
      : (isRecord(values.usage) ? values.usage : undefined)
    return {
      type: 'snapshot',
      session: {
        id: isRecord(frame.header) && typeof frame.header.id === 'string' ? frame.header.id : '',
        title: typeof values.title === 'string' && values.title ? values.title : '未命名会话',
        createdAt: isRecord(frame.header) ? isoTime(frame.header.createdAt) : new Date().toISOString(),
        cwd: isRecord(frame.header) && typeof frame.header.cwd === 'string' ? frame.header.cwd : undefined,
        agentPreset: isRecord(frame.header) && typeof frame.header.agentPreset === 'string' ? frame.header.agentPreset : undefined,
        model: isRecord(selection.lastUsed) ? selection.lastUsed : (isRecord(selection.next) ? selection.next : undefined),
      },
      cursor: Number.isSafeInteger(frame.cursor) ? frame.cursor : -1,
      hasMore: Boolean(frame.hasMore),
      messages: [...messages.values()].sort((a, b) => a.seq - b.seq),
      trace: trace.slice(-MAX_TRACE_ITEMS),
      live,
      ...(permissions ? { permissions } : {}),
      ...(turnOutline !== undefined ? { turnOutline } : {}),
      ...(usage ? { usage } : {}),
      tools: [...new Set([...toolNamesList, ...seenTools])],
    }
  }
  if (frame.type === 'event' && isRecord(frame.event)) {
    emitToolBusEvents(frame.event, toolNames, meta)
    return {
      type: 'event',
      cursor: Number.isSafeInteger(frame.event.seq) ? frame.event.seq : -1,
      message: messageFromEvent(frame.event, toolNames),
      trace: traceFromEvent(frame.event, toolNames),
    }
  }
  if (frame.type === 'assistant-stream') {
    const live = liveFrame(frame.frame)
    return live ? { type: 'live', frame: live } : null
  }
  return null
}

export function createFollowNormalizer(options = {}) {
  const toolNames = new Map()
  const meta = {
    workspaceCwd: options.workspaceCwd ?? null,
    sessionId: options.sessionId,
    runId: options.runId,
  }
  return (frame) => normalizeFollowFrameWithState(frame, toolNames, meta)
}
