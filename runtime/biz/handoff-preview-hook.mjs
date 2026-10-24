let offerMint = null
let tokenIndex = {}

export function registerHandoffPreviewOffer(offer) {
  offerMint = typeof offer === 'function' ? offer : null
}

export function noteHandoffTokenIndex(index) {
  tokenIndex = index && typeof index === 'object' ? index : {}
}

export function handoffTokenStatus(id) {
  try {
    const value = tokenIndex[id]
    if (value === 'open' || value === 'used' || value === 'expired') return value
    return 'absent'
  } catch {
    return 'absent'
  }
}

export function handoffPreviewCtx(aiRuntime) {
  return {
    now: Date.now(),
    tokenStatus(id) {
      return handoffTokenStatus(id)
    },
    voidPreview(id) {
      const previewId = String(id || '').trim()
      if (!previewId || !aiRuntime || typeof aiRuntime.lanAssist !== 'function') return
      void aiRuntime.lanAssist('/write/cancel', {
        method: 'POST',
        body: { preview_id: previewId },
      }).catch(() => undefined)
    },
  }
}

export function notifyHandoffPreviewMint(event) {
  if (typeof offerMint !== 'function') return null
  try {
    return offerMint(event)
  } catch {
    return null
  }
}
