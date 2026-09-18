export function sheetPreviewIdFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return ''
  return String(raw.preview_id || raw.previewId || '').trim()
}

/** Normalize lan-assist pending sheet for API + SSE (includes diff payload when present). */
export function sheetPayloadFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return null
  const previewId = raw.preview_id ?? raw.previewId ?? null
  const changes = Array.isArray(raw.changes) ? raw.changes : []
  return {
    kind: String(raw.kind || ''),
    action: String(raw.action || ''),
    preview_id: typeof previewId === 'string' ? previewId : null,
    previewId: typeof previewId === 'string' ? previewId : null,
    rows: Array.isArray(raw.rows) ? raw.rows : [],
    columns: Array.isArray(raw.columns) ? raw.columns : [],
    changes,
    canWrite: Boolean(raw.canWrite ?? raw.can_write),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    workspace: typeof raw.workspace === 'string' ? raw.workspace : undefined,
    no: typeof raw.no === 'string' ? raw.no : undefined,
    clue: typeof raw.clue === 'string' ? raw.clue : undefined,
    ...(Array.isArray(raw.where) && raw.where.length ? { where: raw.where } : {}),
    ...(Array.isArray(raw.hopWhere) && raw.hopWhere.length ? { hopWhere: raw.hopWhere } : {}),
  }
}
