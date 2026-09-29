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

export function stampWriteTokenUsed(sheet: Record<string, unknown>): Record<string, unknown> {
  return { ...sheet, writeToken: 'used', write_token: 'used' }
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
