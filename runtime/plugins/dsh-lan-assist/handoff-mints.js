export const PLAN_PAGE_HINT = '请到计划页确认并过账'

const RIGHT_CONFIRM = '请在右侧确认过账'
const RIGHT_CONFIRM_SHORT = '请在右侧确认'

export function markHandoffToken(token, event) {
  if (!token || typeof token !== 'object' || !event) return
  token.planHandoff = true
  const sid = String(event.sessionId || token.sessionId || '').trim()
  if (sid) token.sessionId = sid
  if (typeof event.action === 'string') token.action = event.action
  if (Array.isArray(event.changes)) token.changes = event.changes
}

export function openHandoffMints(tokens, now = Date.now()) {
  const mints = []
  if (!tokens || typeof tokens.entries !== 'function') return mints
  for (const [previewId, token] of tokens.entries()) {
    const id = String(previewId || '').trim()
    if (!id || !token || typeof token !== 'object') continue
    if (token.planHandoff !== true) continue
    if (token.used === true) continue
    const sessionId = String(token.sessionId || '').trim()
    if (!sessionId) continue
    if (now > Number(token.expiresAt || 0)) continue
    mints.push({
      previewId: id,
      sessionId,
      workstation: false,
      action: typeof token.action === 'string' ? token.action : '',
      changes: Array.isArray(token.changes) ? token.changes : [],
    })
  }
  return mints
}

export function planPageSpeech(speak) {
  let text = String(speak || '')
  text = text.split(RIGHT_CONFIRM).join('')
  text = text.split(RIGHT_CONFIRM_SHORT).join('')
  text = text.trim()
  if (!text) return PLAN_PAGE_HINT
  if (text.includes(PLAN_PAGE_HINT)) return text
  return `${text}\n${PLAN_PAGE_HINT}`
}
