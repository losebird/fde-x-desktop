function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function textFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (!isRecord(block)) continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    if (block.type === 'tool-result' && Array.isArray(block.content)) {
      const nested = textFromBlocks(block.content)
      if (nested) parts.push(nested)
    }
  }
  return parts.join('\n')
}

export function eventFromFollowFrame(frame) {
  if (!isRecord(frame)) return null
  if (frame.type === 'snapshot') return null
  if (frame.type === 'event' && isRecord(frame.event)) return frame.event
  if (typeof frame.type === 'string' && frame.type.includes('/')) return frame
  const record = frame.record
  if (isRecord(record) && record.type === 'event' && isRecord(record.event)) return record.event
  return null
}

function tryJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function collectionRows(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (!isRecord(parsed)) return null
  for (const key of ['items', 'results']) {
    if (Array.isArray(parsed[key])) return parsed[key]
  }
  const arrays = Object.values(parsed).filter((value) => (
    Array.isArray(value)
    && value.length
    && value.every((row) => row && typeof row === 'object')
  ))
  if (arrays.length === 1) return arrays[0]
  return null
}

function rowToItem(row) {
  if (typeof row === 'string') {
    const text = row.trim()
    return text ? { text } : null
  }
  if (!isRecord(row)) return null
  const text = String(row.text || row.title || row.subject || row.summary || row.headline || '').trim()
  const sub = String(row.sub || row.from || row.source || '').trim()
  const href = row.href || row.url || row.link
  if (text) {
    return {
      text,
      ...(sub ? { sub } : {}),
      ...(typeof href === 'string' && href ? { href } : {}),
    }
  }
  const serialized = JSON.stringify(row)
  return serialized && serialized !== '{}' ? { text: serialized } : null
}

export function itemsFromToolResult(raw) {
  const text = String(raw || '').trim()
  if (!text) return []
  const parsed = tryJson(text)
  const rows = collectionRows(parsed)
  if (rows) return rows.map(rowToItem).filter(Boolean)
  if (parsed && Array.isArray(parsed.content)) {
    const nested = textFromBlocks(parsed.content)
    if (nested && nested !== text) return itemsFromToolResult(nested)
  }
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => ({ text: line }))
}

function toolResultPayload(event) {
  const data = isRecord(event.data) ? event.data : {}
  const message = isRecord(data.message) ? data.message : {}
  const source = isRecord(message.source) ? message.source : {}
  const callId = typeof source.callId === 'string' ? source.callId : (typeof data.callId === 'string' ? data.callId : '')
  const block = Array.isArray(message.content) && isRecord(message.content[0]) ? message.content[0] : {}
  const error = Boolean(data.error || block.isError)
  const text = textFromBlocks(message.content) || (typeof data.text === 'string' ? data.text : '')
  return { callId, error, text }
}

export async function harvestTurnToolResults(aiRuntime, sessionId, { timeoutMs = 180_000 } = {}) {
  const byTool = {}
  if (!aiRuntime || typeof aiRuntime.stream !== 'function' || !sessionId) {
    return { byTool, ended: false }
  }
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)
  const names = new Map()
  let inTurn = false
  let ended = false
  try {
    for await (const frame of aiRuntime.stream('session/follow', {
      request: {
        address: { kind: 'session', sessionId },
        maxMessages: 80,
      },
    }, abort.signal)) {
      const event = eventFromFollowFrame(frame)
      if (!event || typeof event.type !== 'string') continue
      if (event.type === 'turn/start') {
        inTurn = true
        names.clear()
        for (const key of Object.keys(byTool)) delete byTool[key]
        continue
      }
      if (!inTurn) inTurn = true
      if (event.type === 'tool/call') {
        const data = isRecord(event.data) ? event.data : {}
        const name = typeof data.name === 'string' ? data.name : ''
        const callId = typeof data.callId === 'string' ? data.callId : ''
        if (callId && name) names.set(callId, name)
        continue
      }
      if (event.type === 'tool/result') {
        const payload = toolResultPayload(event)
        const name = payload.callId ? (names.get(payload.callId) || '') : ''
        if (!name) continue
        byTool[name] = { text: payload.text, error: payload.error }
        continue
      }
      if (event.type === 'turn/end') {
        ended = true
        break
      }
    }
  } catch (error) {
    if (!(error && error.name === 'AbortError')) {
      console.warn('briefing harvest session/follow failed', error)
    }
  } finally {
    clearTimeout(timer)
    abort.abort()
  }
  return { byTool, ended }
}
