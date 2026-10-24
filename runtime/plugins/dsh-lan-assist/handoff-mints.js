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

export function handoffRoundAsksPlanPage(...parts) {
  return parts.some((part) => String(part || '').includes(PLAN_PAGE_HINT))
}

export function rewritePlanHandoffSpeech(result, wanted) {
  if (!wanted || !result || typeof result !== 'object') return result
  const next = { ...result }
  if (typeof next.speak === 'string') next.speak = planPageSpeech(next.speak)
  if (typeof next.hint === 'string') next.hint = planPageSpeech(next.hint)
  if (next.sheet && typeof next.sheet === 'object') {
    const sheet = { ...next.sheet }
    if (typeof sheet.speak === 'string') sheet.speak = planPageSpeech(sheet.speak)
    if (typeof sheet.hint === 'string') sheet.hint = planPageSpeech(sheet.hint)
    next.sheet = sheet
  }
  return next
}

export function speechForPlanHandoffMint(result, event) {
  if (!event || !result || typeof result !== 'object') return result
  return rewritePlanHandoffSpeech(result, true)
}

const armedConfirmSessions = new Set()
const HANDOFF_CONFIRM_ALLOW = new Set(['fde_plan_task_propose', 'fde_submit_result'])

export const HANDOFF_CONFIRM_DENY = '预览已出，请到计划页确认并过账；不要代点。'

export function armHandoffConfirmWindow(sessionId) {
  const sid = String(sessionId || '').trim()
  if (sid) armedConfirmSessions.add(sid)
}

export function clearHandoffConfirmWindow(sessionId) {
  armedConfirmSessions.delete(String(sessionId || '').trim())
}

export function handoffConfirmWindowActive(sessionId) {
  return armedConfirmSessions.has(String(sessionId || '').trim())
}

export function handoffConfirmToolDeny(state, toolName) {
  const handoff = Boolean(state && (state.runningRun || state.mintMarked))
  const armed = Boolean(state && (state.nextConfirm || state.mintMarked))
  if (!handoff || !armed) return ''
  if (HANDOFF_CONFIRM_ALLOW.has(String(toolName || ''))) return ''
  return HANDOFF_CONFIRM_DENY
}
