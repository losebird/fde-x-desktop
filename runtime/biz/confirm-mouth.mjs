export const PLAN_CARD_MOUTH = 'plan'

const LIVE_PREVIEW_ID = /^pv_[0-9a-f]{16}$/

export function parseLivePreviewId(raw) {
  const id = typeof raw === 'string' ? raw.trim() : ''
  return LIVE_PREVIEW_ID.test(id) ? id : null
}

export function sheetConfirmsOnPlanCard(sheet) {
  return Boolean(sheet && typeof sheet === 'object' && sheet.confirmMouth === PLAN_CARD_MOUTH)
}

const SESSION_CARD_WRITE_ACTIONS = new Set(['改行', '过审', '新建'])

export function sheetConfirmsOnSessionCard(sheet) {
  if (!sheet || typeof sheet !== 'object') return false
  if (sheetConfirmsOnPlanCard(sheet)) return false
  const action = String(sheet.action || '').trim()
  if (!SESSION_CARD_WRITE_ACTIONS.has(action)) return false
  return Boolean(parseLivePreviewId(sheet.preview_id || sheet.previewId))
}
