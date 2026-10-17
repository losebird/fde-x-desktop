import { presentBriefingItem } from './item.mjs'

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

function hrefOf(value) {
  if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) return value.trim()
  if (isRecord(value) && value.panel) return value
  return ''
}

function firstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s)>\]]+/i)
  return match ? match[0] : ''
}

function dropFiller(block) {
  const lines = String(block || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return true
  if (lines.every((line) => /^[-*_=]{3,}$/.test(line))) return true
  if (lines.length === 1 && /^https?:\/\/\S+$/i.test(lines[0])) return true
  return false
}

function itemFromBlock(block) {
  if (dropFiller(block)) return null
  const lines = String(block || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const head = lines[0].replace(/^(?:#{1,6}|[-*+]|\d+[.)])\s+/, '').trim()
  if (!head) return null
  const rest = lines.slice(1).join(' ').trim()
  const href = firstUrl(block)
  const sub = rest.replace(href, '').replace(/\s+/g, ' ').trim()
  return presentBriefingItem({
    text: head,
    ...(sub ? { sub } : {}),
    ...(href ? { href } : {}),
  })
}

function markdownListBlocks(text) {
  const lines = String(text || '').split('\n')
  const blocks = []
  let current = null
  for (const line of lines) {
    const marked = line.match(/^(?:#{1,3}\s+|[-*+]\s+|\d+[.)]\s+)(.*)$/)
    if (marked) {
      if (current) blocks.push(current.join('\n'))
      current = [line]
      continue
    }
    if (current) current.push(line)
  }
  if (current) blocks.push(current.join('\n'))
  return blocks
}

function foldBlob(text) {
  const md = markdownListBlocks(text)
  if (md.length >= 2) return md.map(itemFromBlock).filter(Boolean)
  return String(text || '').split(/\n\s*\n/).map(itemFromBlock).filter(Boolean)
}

function rowToItem(row) {
  if (typeof row === 'string') return itemFromBlock(row)
  if (!isRecord(row)) return null
  const text = String(row.text || row.title || row.subject || row.summary || row.headline || row.body || row.cue || row.name || '').trim()
  const sub = String(row.sub || row.from || row.source || row.author || '').trim()
  const href = hrefOf(row.href) || hrefOf(row.url) || hrefOf(row.link) || firstUrl(text)
  if (!text) return null
  return presentBriefingItem({
    text,
    ...(sub ? { sub } : {}),
    ...(href ? { href } : {}),
  })
}

export function itemsFromToolResult(raw, opts = {}) {
  const limit = Number(opts.limit)
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 8
  const text = String(raw || '').trim()
  if (!text) return []
  const parsed = tryJson(text)
  let items = []
  const rows = collectionRows(parsed)
  if (rows) items = rows.map(rowToItem).filter(Boolean)
  else if (parsed && Array.isArray(parsed.content)) {
    const nested = textFromBlocks(parsed.content)
    if (nested && nested !== text) return itemsFromToolResult(nested, opts)
    items = foldBlob(text)
  } else if (isRecord(parsed)) {
    const one = rowToItem(parsed)
    items = one ? [one] : foldBlob(text)
  } else {
    items = foldBlob(text)
  }
  return items.slice(0, cap)
}

function structuredFailure(node, depth) {
  if (!isRecord(node) || depth > 6) return null
  const code = typeof node.code === 'string' ? node.code.trim() : ''
  const message = typeof node.message === 'string' ? node.message.trim() : ''
  if (code || message) return { code, message }
  for (const value of Object.values(node)) {
    const found = structuredFailure(value, depth + 1)
    if (found) return found
  }
  return null
}

export function briefingTurnFailure(event) {
  const data = isRecord(event?.data) ? event.data : {}
  const reason = data.reason
  if (!isRecord(reason)) return null
  if (typeof reason.kind === 'string' && reason.kind !== 'error') return null
  return structuredFailure(reason, 0)
}

export function briefingTurnFailureText(failure) {
  if (!failure || (!failure.code && !failure.message)) return ''
  const code = failure.code || ''
  if (code === 'MISSING_CREDENTIAL') {
    return '没有配置模型密钥（MISSING_CREDENTIAL）。请到设置里配置 key。'
  }
  if (code) return `早报这一轮失败（${code}）。`
  return '早报这一轮失败。'
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
  let turnFailure = null
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
        turnFailure = briefingTurnFailure(event)
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
  return { byTool, ended, turnFailure }
}
