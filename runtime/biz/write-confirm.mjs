/**
 * Project the write-token authority onto sheets.
 * An unused token is the only confirm. Used / expired / absent tokens keep the picture and drop canWrite.
 */

export function previewIdOf(sheet) {
  if (!sheet || typeof sheet !== 'object') return ''
  return String(sheet.preview_id || sheet.previewId || '').trim()
}

export function writeTokenStatus(token, nowMs) {
  if (!token) return 'absent'
  if (token.used) return 'used'
  if (Number(nowMs) > Number(token.expiresAt || 0)) return 'expired'
  return 'open'
}

export function previewTokenIndex(tokens, nowMs) {
  const index = {}
  if (!tokens || typeof tokens.entries !== 'function') return index
  for (const [id, token] of tokens.entries()) {
    const key = String(id || '').trim()
    if (!key) continue
    index[key] = writeTokenStatus(token, nowMs)
  }
  return index
}

/**
 * @param {Record<string, unknown> | null | undefined} sheet
 * @param {Record<string, string> | null | undefined} index preview_id → open | used | expired
 */
export function projectWriteConfirm(sheet, index) {
  if (!sheet || typeof sheet !== 'object') return sheet
  if (!index || typeof index !== 'object') return sheet
  const id = previewIdOf(sheet)
  if (!id) return sheet
  if (String(sheet.action || '').trim() === '现查') return sheet
  const known = Object.prototype.hasOwnProperty.call(index, id)
  const status = known ? String(index[id] || '') : 'absent'
  if (status === 'open') return { ...sheet, writeToken: 'open' }
  const closed = status === 'expired' ? 'expired' : (status === 'used' ? 'used' : 'absent')
  return {
    ...sheet,
    writeToken: closed,
    canWrite: false,
    can_write: false,
  }
}

/** Picture cache after a successful post. Rows stay. Write authority does not. */
export function releaseEmittedConfirm(sheet) {
  if (!sheet || typeof sheet !== 'object') return sheet
  return {
    ...sheet,
    canWrite: false,
    can_write: false,
    writeToken: 'used',
  }
}
