export const PLAN_CARD_MOUTH = 'plan'

const LIVE_PREVIEW_ID = /^pv_[0-9a-f]{16}$/

export function parseLivePreviewId(raw) {
  const id = typeof raw === 'string' ? raw.trim() : ''
  return LIVE_PREVIEW_ID.test(id) ? id : null
}

export function sheetConfirmsOnPlanCard(sheet) {
  return Boolean(sheet && typeof sheet === 'object' && sheet.confirmMouth === PLAN_CARD_MOUTH)
}
