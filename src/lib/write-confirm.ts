/** Drawer opens only while the write token is still unused. Closed tokens are a picture. */

export function confirmTokenClosed(sheet: Record<string, unknown> | null | undefined): boolean {
  if (!sheet || typeof sheet !== 'object') return false
  const token = String(sheet.writeToken || sheet.write_token || '').trim()
  return token === 'used' || token === 'expired' || token === 'absent'
}

export function shouldOpenWriteConfirm(
  sheet: Record<string, unknown>,
  opts: { dismissed: boolean; hasChanges: boolean; alreadyAtTarget: boolean },
): boolean {
  const id = String(sheet.preview_id || sheet.previewId || '').trim()
  const action = String(sheet.action || '').trim()
  if (!id || action === '现查') return false
  if (opts.dismissed) return false
  if (confirmTokenClosed(sheet)) return false
  if (opts.alreadyAtTarget) return true
  if (sheet.canWrite !== true && sheet.can_write !== true) return false
  return opts.hasChanges
}
