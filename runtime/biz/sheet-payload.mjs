export function sheetPreviewIdFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return ''
  return String(raw.preview_id || raw.previewId || '').trim()
}

function knownHitTotalFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.hitTotal != null && Number.isFinite(Number(raw.hitTotal))) return Number(raw.hitTotal)
  if (raw.querySettled === true) return 0
  return null
}

function peerHitFromRaw(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const kind = String(raw.kind || '').trim()
  if (!kind) return null
  const rows = Array.isArray(raw.rows) ? raw.rows : []
  const columns = Array.isArray(raw.columns) ? raw.columns : []
  const where = Array.isArray(raw.where) ? raw.where : []
  const hitTotalState = raw.hitTotalState === 'known' || raw.hitTotalState === 'incomplete' || raw.hitTotalState === 'unknown'
    ? raw.hitTotalState
    : ''
  return {
    kind,
    action: String(raw.action || '现查'),
    rows,
    columns,
    ...(where.length ? { where } : {}),
    ...(raw.querySettled === true ? { querySettled: true } : {}),
    ...(hitTotalState ? { hitTotalState } : {}),
    ...(hitTotalState === 'known' && knownHitTotalFromRaw(raw) != null
      ? { hitTotal: knownHitTotalFromRaw(raw) }
      : {}),
    ...(Number(raw.page) > 0 ? { page: Math.floor(Number(raw.page)) } : {}),
    ...(Number(raw.pageSize) > 0 ? { pageSize: Math.floor(Number(raw.pageSize)) } : {}),
    ...(raw.pageFull === true ? { pageFull: true } : {}),
  }
}

/** Normalize lan-assist pending sheet for API + SSE (includes diff payload when present). */
export function sheetPayloadFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return null
  const previewId = raw.preview_id ?? raw.previewId ?? null
  const changes = Array.isArray(raw.changes) ? raw.changes : []
  const peers = Array.isArray(raw.peers) ? raw.peers.map(peerHitFromRaw).filter(Boolean) : []
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
    ...(raw.from && typeof raw.from === 'object' && !Array.isArray(raw.from) ? { from: raw.from } : {}),
    ...(Array.isArray(raw.steps) && raw.steps.length ? { steps: raw.steps } : {}),
    ...(typeof raw.speech === 'string' && raw.speech.trim() ? { speech: raw.speech.trim() } : {}),
    ...(raw.listed ? { listed: true } : {}),
    ...(raw.ambiguous ? { ambiguous: true } : {}),
    ...(raw.related && typeof raw.related === 'object' && !Array.isArray(raw.related) ? { related: raw.related } : {}),
    ...(typeof raw.line === 'string' && raw.line ? { line: raw.line } : {}),
    ...(typeof raw.connectionId === 'string' && raw.connectionId ? { connectionId: raw.connectionId } : {}),
    ...(raw.querySettled === true ? { querySettled: true } : {}),
    ...(raw.hitTotalState === 'known' || raw.hitTotalState === 'incomplete' || raw.hitTotalState === 'unknown'
      ? { hitTotalState: raw.hitTotalState }
      : {}),
    ...(raw.hitTotalState === 'known' && knownHitTotalFromRaw(raw) != null
      ? { hitTotal: knownHitTotalFromRaw(raw) }
      : {}),
    ...(Number(raw.page) > 0 ? { page: Math.floor(Number(raw.page)) } : {}),
    ...(Number(raw.pageSize) > 0 ? { pageSize: Math.floor(Number(raw.pageSize)) } : {}),
    ...(raw.pageFull === true ? { pageFull: true } : {}),
    ...(peers.length ? { peers } : {}),
  }
}
