import { createHash, randomUUID } from 'node:crypto'

function compactText(label) {
  return String(label || '').replace(/\s+/g, ' ').trim()
}

export function validateMemoryCardLabel(label) {
  return compactText(label).length >= 8
}

function displayLabel(label) {
  const text = String(label || '').trim()
  const firstLine = text.split(/\n/u)[0]?.trim() || ''
  const candidate = firstLine.length >= 8 ? firstLine : compactText(text)
  return candidate.slice(0, 160)
}

export function draftMemoryCardInsert(label, cause) {
  const body = String(label || '').trim()
  const causeValue = cause === 'choice' ? 'choice' : 'correction'
  const unique = `${Date.now()}:${randomUUID()}`
  const hash = createHash('sha1').update(`${causeValue}:${body}:${unique}`).digest('hex').slice(0, 8)
  const id = `memory:${hash}`
  return {
    op: 'add_node',
    args: {
      id,
      type: '记忆卡片',
      label: displayLabel(body),
      metadata: {
        status: '起草',
        kind: '记忆卡片',
        cause: causeValue,
        auto: false,
      },
    },
  }
}

export function asDraftCard(result, label) {
  const body = String(label || '').trim()
  const row = result && typeof result === 'object' ? result : {}
  const id = String(row.id || row.node_id || row.card_id || '')
  return {
    id,
    status: '起草',
    label: displayLabel(body),
    body,
  }
}
