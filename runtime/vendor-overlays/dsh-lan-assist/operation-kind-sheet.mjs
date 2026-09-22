/** Materialize one bound kind from an operation sheet (main, from/steps, or peers). */

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

export function materializeOperationKindSheet(sheet, kind) {
  const wanted = String(kind || '').trim()
  if (!sheet || typeof sheet !== 'object' || !wanted) return null
  const hit = operationKindHitSheets(sheet).find((row) => String(row.kind || '').trim() === wanted)
  if (!hit) return null
  const basePeers = Array.isArray(sheet.peers) ? sheet.peers : []
  const stamped = {
    ...hit,
    ...(typeof sheet.speech === 'string' && sheet.speech ? { speech: sheet.speech } : {}),
    ...(sheet.sessionId ? { sessionId: sheet.sessionId } : {}),
    ...(typeof sheet.workspace === 'string' && sheet.workspace ? { workspace: sheet.workspace } : {}),
    ...(basePeers.length ? { peers: basePeers } : {}),
  }
  if (stamped.querySettled !== true && stamped.hitTotalState === 'known') {
    stamped.querySettled = true
  }
  return stamped
}

export { operationKindHitSheets }
