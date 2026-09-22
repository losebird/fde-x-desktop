/** Materialize one bound kind from an operation sheet (main, from/steps, or peers). */

function kindAliasBucket(name, kindIndex) {
  const spoken = String(name || '').trim()
  if (!spoken) return ''
  const rows = Array.isArray(kindIndex) ? kindIndex : []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const canonical = String(row.kind || '').trim()
    if (!canonical) continue
    const aliases = new Set([canonical, ...(Array.isArray(row.aliases) ? row.aliases : [])].map((item) => String(item || '').trim()).filter(Boolean))
    if (aliases.has(spoken)) return canonical
  }
  return spoken
}

function kindNamesEqual(wanted, candidate, kindIndex) {
  const a = String(wanted || '').trim()
  const b = String(candidate || '').trim()
  if (!a || !b) return false
  if (a === b) return true
  if (!kindIndex) return false
  return kindAliasBucket(a, kindIndex) === kindAliasBucket(b, kindIndex)
}

function stampPagination(hit, base) {
  if (!hit || typeof hit !== 'object') return hit
  const basePageSize = Number(base.pageSize)
  const hitPageSize = Number(hit.pageSize)
  const pageSize = Number.isFinite(hitPageSize) && hitPageSize > 0
    ? Math.floor(hitPageSize)
    : (Number.isFinite(basePageSize) && basePageSize > 0 ? Math.floor(basePageSize) : undefined)
  const sameKind = String(hit.kind || '').trim() === String(base.kind || '').trim()
  const basePage = Number(base.page)
  const hitPage = Number(hit.page)
  const page = Number.isFinite(hitPage) && hitPage > 0
    ? Math.floor(hitPage)
    : (sameKind && Number.isFinite(basePage) && basePage > 0 ? Math.floor(basePage) : 1)
  return {
    ...hit,
    ...(pageSize ? { pageSize } : {}),
    page,
    ...(pageSize && Array.isArray(hit.rows) && hit.rows.length >= pageSize ? { pageFull: hit.pageFull === true } : {}),
  }
}

function operationKindHitSheets(sheet) {
  if (!sheet || typeof sheet !== 'object') return []
  const out = []
  const seen = new Set()
  const push = (kind, rows, columns, extra) => {
    const name = String(kind || '').trim()
    if (!name || seen.has(name)) return
    seen.add(name)
    const same = name === String(sheet.kind || '').trim()
    out.push({
      ...sheet,
      kind: name,
      rows: Array.isArray(rows) ? rows : [],
      columns: Array.isArray(columns) ? columns : [],
      action: same ? sheet.action : '现查',
      preview_id: same ? sheet.preview_id : undefined,
      previewId: same ? sheet.previewId : undefined,
      canWrite: same ? sheet.canWrite : false,
      ...(extra || {}),
    })
  }
  push(String(sheet.kind || ''), sheet.rows, sheet.columns)
  const walk = (raw, depth = 0) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > 8) return
    const row = raw
    if (Object.prototype.hasOwnProperty.call(row, 'rows')) {
      push(String(row.kind || ''), row.rows, row.columns)
    }
    walk(row.from, depth + 1)
  }
  walk(sheet.from)
  walk(sheet.related)
  if (Array.isArray(sheet.steps)) {
    for (const step of sheet.steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) continue
      if (Object.prototype.hasOwnProperty.call(step, 'rows')) {
        push(String(step.kind || ''), step.rows, step.columns)
      }
    }
  }
  if (Array.isArray(sheet.peers)) {
    for (const peer of sheet.peers) {
      if (!peer || typeof peer !== 'object' || Array.isArray(peer)) continue
      if (!Object.prototype.hasOwnProperty.call(peer, 'rows')) continue
      push(String(peer.kind || ''), peer.rows, peer.columns, {
        where: peer.where,
        from: undefined,
        steps: undefined,
        peers: undefined,
        hopWhere: undefined,
        hitTotal: peer.hitTotal,
        hitTotalState: peer.hitTotalState,
        querySettled: peer.querySettled,
        page: peer.page,
        pageSize: peer.pageSize,
        pageFull: peer.pageFull,
        speech: sheet.speech,
      })
    }
  }
  return out
}

export function materializeOperationKindSheet(sheet, kind, kindIndex = null) {
  const wanted = String(kind || '').trim()
  if (!sheet || typeof sheet !== 'object' || !wanted) return null
  const hits = operationKindHitSheets(sheet)
  let hit = hits.find((row) => String(row.kind || '').trim() === wanted)
  if (!hit) hit = hits.find((row) => kindNamesEqual(wanted, row.kind, kindIndex))
  if (!hit) return null
  const basePeers = Array.isArray(sheet.peers) ? sheet.peers : []
  const stamped = stampPagination({
    ...hit,
    ...(typeof sheet.speech === 'string' && sheet.speech ? { speech: sheet.speech } : {}),
    ...(sheet.sessionId ? { sessionId: sheet.sessionId } : {}),
    ...(typeof sheet.workspace === 'string' && sheet.workspace ? { workspace: sheet.workspace } : {}),
    ...(basePeers.length ? { peers: basePeers } : {}),
  }, sheet)
  if (stamped.querySettled !== true && stamped.hitTotalState === 'known') {
    stamped.querySettled = true
  }
  return stamped
}

export { operationKindHitSheets }
