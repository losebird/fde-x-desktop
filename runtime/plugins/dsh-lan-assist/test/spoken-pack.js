/**
 * Test-only package seed. Production vocab/spoken.js does not load this.
 */
import pack from '../vocab/spoken.json' with { type: 'json' }

export const SPOKEN = {
  id: pack.id,
  kind: pack.label,
  label: pack.label,
  spoken: true,
  fields: ['单号'],
  can: ['现查'],
  clues: pack.clues,
}

export function withSpoken(vocab) {
  return withPackageSpoken(vocab)
}

export function withPackageSpoken(vocab) {
  const rows = Array.isArray(vocab) ? vocab.slice() : []
  const i = rows.findIndex((row) => row && (row.spoken || row.id === 'spoken' || row.kind === '口语' || row.label === '口语'))
  if (i < 0) return [SPOKEN, ...rows]
  const have = rows[i] && typeof rows[i] === 'object' ? rows[i] : {}
  const clues = Array.isArray(have.clues) ? have.clues.map((row) => (row && typeof row === 'object' ? { ...row } : row)) : []
  const peel = new Set(['问句', '助词', '标点', '连接', '交接'])
  function saysOf(clue) {
    return (Array.isArray(clue && clue.say) ? clue.say : []).map((item) => String(item || '').trim()).filter(Boolean)
  }
  function sharesSay(a, b) {
    const left = new Set(saysOf(a))
    return saysOf(b).some((item) => left.has(item))
  }
  for (const seed of Array.isArray(SPOKEN.clues) ? SPOKEN.clues : []) {
    if (!seed || typeof seed !== 'object') continue
    const role = String(seed.role || '').trim()
    const hit = clues.find((row) => {
      if (peel.has(role) && role && String((row && row.role) || '') === role) return true
      return sharesSay(row, seed)
    })
    if (peel.has(role)) {
      if (!hit) {
        clues.push({ ...seed, say: [...(seed.say || [])] })
        continue
      }
      const says = new Set([...saysOf(hit), ...saysOf(seed)])
      hit.say = [...says]
      if (seed.values && !((hit.values || []).length)) hit.values = [...seed.values]
      continue
    }
    if (hit) {
      if (seed.not) hit.not = true
      if (seed.dateBefore && !hit.dateBefore) hit.dateBefore = [...seed.dateBefore]
      if (seed.role && !hit.role) hit.role = seed.role
      continue
    }
    if (seed.not || seed.dateBefore || role === '动作' || role === '改写') {
      clues.push({ ...seed, say: [...(seed.say || [])], values: seed.values ? [...seed.values] : seed.values })
    }
  }
  rows[i] = { ...have, clues, spoken: true, kind: have.kind || '口语', label: have.label || '口语' }
  return rows
}
