function firstPositiveInt(...values) {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return undefined
}

export function modelCapacityFromDiscoverRow(row) {
  if (!row || typeof row !== 'object') return {}
  const contextWindow = firstPositiveInt(row.contextWindow, row.context_window, row.context_length)
  const maxTokens = firstPositiveInt(row.maxTokens, row.max_tokens, row.max_output_tokens)
  const out = {}
  if (contextWindow) out.contextWindow = contextWindow
  if (maxTokens) out.maxTokens = maxTokens
  return out
}

export function pickModelRowFields(row) {
  const id = String(row?.id || '').trim()
  if (!id) return null
  const name = String(row?.name || row?.id || '').trim() || id
  const out = { id, name }
  if (typeof row?.contextWindow === 'number') out.contextWindow = row.contextWindow
  if (typeof row?.maxTokens === 'number') out.maxTokens = row.maxTokens
  if (row?.reasoningEfforts !== undefined && row?.reasoningEfforts !== null) {
    out.reasoningEfforts = row.reasoningEfforts
  }
  if (Array.isArray(row?.input)) out.input = row.input.map(String)
  return out
}

export function fillModelRowGaps(current, candidate) {
  const next = { ...current }
  if (next.contextWindow === undefined && typeof candidate?.contextWindow === 'number') {
    next.contextWindow = candidate.contextWindow
  }
  if (next.maxTokens === undefined && typeof candidate?.maxTokens === 'number') {
    next.maxTokens = candidate.maxTokens
  }
  if (next.reasoningEfforts === undefined && candidate?.reasoningEfforts !== undefined) {
    next.reasoningEfforts = candidate.reasoningEfforts
  }
  if (!Array.isArray(next.input) && Array.isArray(candidate?.input)) {
    next.input = candidate.input.map(String)
  }
  return next
}

/** Discover fills empty occupancy. Declared window/effort/input stay. */
export function alignModelRowsWithDiscover(models, discovered) {
  const byId = new Map(
    (Array.isArray(discovered) ? discovered : [])
      .map((row) => {
        const id = String(row?.id || '').trim()
        return id ? [id, pickModelRowFields(row) || row] : null
      })
      .filter(Boolean),
  )
  return (Array.isArray(models) ? models : [])
    .map((row) => pickModelRowFields(row))
    .filter(Boolean)
    .map((row) => {
      const disc = byId.get(row.id)
      if (!disc) return row
      const next = fillModelRowGaps(row, disc)
      if (disc.reasoningEfforts !== undefined) next.reasoningEfforts = disc.reasoningEfforts
      return next
    })
}

export function mergeModelRows(existing, pickedCandidates) {
  const byId = new Map()
  for (const row of existing) {
    const packed = pickModelRowFields(row)
    if (packed) byId.set(packed.id, packed)
  }
  for (const candidate of pickedCandidates) {
    const packed = pickModelRowFields(candidate)
    if (!packed) continue
    if (byId.has(packed.id)) byId.set(packed.id, fillModelRowGaps(byId.get(packed.id), packed))
    else byId.set(packed.id, packed)
  }
  return [...byId.values()]
}
