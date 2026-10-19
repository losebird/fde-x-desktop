/** Drawer opens only while the write token is still unused. Closed tokens are a picture. */

export type WriteTokenStatus = 'none' | 'live' | 'used' | 'expired' | 'absent'

const CLOSED_TOKEN = new Set(['used', 'expired', 'absent'])

/** Legal status of the write token: sheet first, then the preview_id index cache. */
export function writeTokenStatus(
  sheet: Record<string, unknown> | null | undefined,
  index?: Record<string, string> | null,
): WriteTokenStatus {
  if (!sheet || typeof sheet !== 'object') return 'none'
  const id = String(sheet.preview_id ?? sheet.previewId ?? '').trim()
  if (!id) return 'none'
  const onSheet = String(sheet.writeToken || sheet.write_token || '').trim()
  if (CLOSED_TOKEN.has(onSheet)) return onSheet as WriteTokenStatus
  if (index && Object.prototype.hasOwnProperty.call(index, id)) {
    const fromIndex = String(index[id] || '').trim()
    if (CLOSED_TOKEN.has(fromIndex)) return fromIndex as WriteTokenStatus
  }
  return 'live'
}

export function writeTokenLive(
  sheet: Record<string, unknown> | null | undefined,
  index?: Record<string, string> | null,
): boolean {
  return writeTokenStatus(sheet, index) === 'live'
}

export function confirmTokenClosed(
  sheet: Record<string, unknown> | null | undefined,
  index?: Record<string, string> | null,
): boolean {
  const status = writeTokenStatus(sheet, index)
  return status === 'used' || status === 'expired' || status === 'absent'
}

export function incomingSheetClosesOpenDrawer(
  openPreviewId: string | null | undefined,
  sheet: Record<string, unknown> | null | undefined,
  opts?: {
    dismissed?: boolean
    tokenIndex?: Record<string, string> | null
  },
): boolean {
  const openId = String(openPreviewId ?? '').trim()
  if (!openId || !sheet || typeof sheet !== 'object') return false
  if (String(sheet.action || '').trim() === '现查') return false
  const incomingId = String(sheet.preview_id ?? sheet.previewId ?? '').trim()
  if (!incomingId || incomingId !== openId) return false
  if (opts?.dismissed) return true
  return confirmTokenClosed(sheet, opts?.tokenIndex)
}

export function stampWriteTokenUsed(sheet: Record<string, unknown>): Record<string, unknown> {
  return { ...sheet, writeToken: 'used', write_token: 'used' }
}

export type WriteDrawerFace = 'confirm' | 'posted' | 'closed' | 'keep'

const POSTED_GATE = '已过账'

export type WriteDrawerSnap = {
  previewId?: string
  gateReason?: string
  canWrite?: boolean
  action?: string
} | null

function previewIdOf(sheet: Record<string, unknown> | null | undefined): string {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.preview_id || sheet.previewId || '').trim()
}

export function mergeWriteTokenIndex(
  incoming: Record<string, string> | null | undefined,
  local: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!incoming && !local) return null
  const out: Record<string, string> = {}
  for (const [id, status] of Object.entries(incoming || {})) {
    const next = String(status || '').trim()
    if (id && next) out[id] = next
  }
  for (const [id, status] of Object.entries(local || {})) {
    const next = String(status || '').trim()
    if (!id || !next) continue
    if (CLOSED_TOKEN.has(next) || !CLOSED_TOKEN.has(String(out[id] || ''))) out[id] = next
  }
  for (const [id, status] of Object.entries(incoming || {})) {
    const next = String(status || '').trim()
    if (id && CLOSED_TOKEN.has(next)) out[id] = next
  }
  return out
}

export function resolveWriteDrawerFace(input: {
  open: WriteDrawerSnap
  sheet?: Record<string, unknown> | null
  tokenIndex?: Record<string, string> | null
  dismissed?: boolean
  hasChanges?: boolean
  alreadyAtTarget?: boolean
  leaving?: boolean
  holdPreviewId?: string | null
}): WriteDrawerFace {
  if (input.leaving || input.dismissed) return 'closed'
  const openId = String(input.open?.previewId || '').trim()
  const openPosted = input.open?.gateReason === POSTED_GATE && Boolean(openId)
  const sheet = input.sheet && typeof input.sheet === 'object' ? input.sheet : null
  if (!sheet) return openPosted ? 'posted' : 'closed'
  const incomingId = previewIdOf(sheet)
  const action = String(sheet.action || '').trim()
  const opens = shouldOpenWriteConfirm(sheet, {
    dismissed: false,
    hasChanges: input.hasChanges === true,
    alreadyAtTarget: input.alreadyAtTarget === true,
    tokenIndex: input.tokenIndex,
  })
  const hold = String(input.holdPreviewId || '').trim()
  if (hold && opens && incomingId && incomingId !== hold) return 'confirm'
  if (hold && openId === hold && (!incomingId || incomingId === hold || action === '现查')) return 'posted'
  if (opens) {
    if (openPosted && incomingId === openId) return 'posted'
    if (
      input.open
      && incomingId
      && incomingId === openId
      && action
      && action === String(input.open.action || '')
    ) return 'keep'
    return 'confirm'
  }
  if (openPosted && (!incomingId || incomingId === openId || action === '现查')) return 'posted'
  if (
    input.open
    && incomingSheetClosesOpenDrawer(openId, sheet, {
      dismissed: false,
      tokenIndex: input.tokenIndex,
    })
  ) {
    return 'closed'
  }
  if (openPosted) return 'posted'
  if (input.open) return 'keep'
  return 'closed'
}

export function commitPostedWrite(input: {
  openPreviewId: string
  previewId: string
  writeSheet: Record<string, unknown>
  listed: Record<string, unknown> | null
  tokenIndex?: Record<string, string> | null
  dismissed?: boolean
  hasChanges?: boolean
  alreadyAtTarget?: boolean
}): {
  tokenIndex: Record<string, string>
  face: WriteDrawerFace
  sheet: Record<string, unknown>
} {
  const usedId = String(input.previewId || input.openPreviewId || '').trim()
  const tokenIndex = mergeWriteTokenIndex(
    usedId ? { [usedId]: 'used' } : null,
    input.tokenIndex,
  ) || {}
  const sheet = stampWriteTokenUsed(input.writeSheet)
  const face = input.listed
    ? resolveWriteDrawerFace({
      open: {
        previewId: usedId,
        gateReason: POSTED_GATE,
        canWrite: false,
        action: String(sheet.action || ''),
      },
      sheet: input.listed,
      tokenIndex,
      dismissed: Boolean(input.dismissed),
      hasChanges: input.hasChanges === true,
      alreadyAtTarget: input.alreadyAtTarget === true,
      holdPreviewId: usedId,
    })
    : 'posted'
  if (face === 'confirm') {
    const listedId = input.listed ? previewIdOf(input.listed) : ''
    if (!listedId || listedId === usedId) return { tokenIndex, face: 'posted', sheet }
  }
  if (face === 'keep' || face === 'closed') return { tokenIndex, face: 'posted', sheet }
  return { tokenIndex, face, sheet }
}

export function shouldOpenWriteConfirm(
  sheet: Record<string, unknown>,
  opts: {
    dismissed: boolean
    hasChanges: boolean
    alreadyAtTarget: boolean
    tokenIndex?: Record<string, string> | null
  },
): boolean {
  const id = String(sheet.preview_id || sheet.previewId || '').trim()
  const action = String(sheet.action || '').trim()
  if (!id || action === '现查') return false
  if (opts.dismissed) return false
  if (!writeTokenLive(sheet, opts.tokenIndex)) return false
  if (opts.alreadyAtTarget) return true
  return opts.hasChanges === true
}
