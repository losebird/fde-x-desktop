function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') as Array<Record<string, unknown>> : []
}

function uniqueIds(list: unknown): string[] {
  const out: string[] = []
  for (const item of Array.isArray(list) ? list : []) {
    const id = String(item || '').trim()
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

function faceCue(row: Record<string, unknown>, fallbackId: string) {
  const then = asRecord(row.then)
  const cue = String(
    row.snippet
    || row.outcome
    || row.scenario
    || row.label
    || row.content
    || then?.label
    || '',
  ).trim()
  if (!cue || cue === fallbackId) return ''
  if (cue.includes(fallbackId)) return ''
  return cue
}

export type DecisionBriefFace = {
  id: string
  cue: string
  kind: string
  citable: boolean
}

export type DecisionBriefOption = {
  id: string
  label: string
}

export type PackedDecisionBrief = {
  faces: DecisionBriefFace[]
  options: DecisionBriefOption[]
  because: string[]
}

export function packDecisionBrief(brief: unknown): PackedDecisionBrief {
  const row = asRecord(brief) || {}
  const because = uniqueIds(row.because)
  const faces: DecisionBriefFace[] = []
  const push = (id: string, cue: string, kind: string, citable: boolean) => {
    if (!id || faces.some((face) => face.id === id)) return
    faces.push({ id, cue, kind, citable })
  }
  for (const evidence of asRows(row.evidence)) {
    const id = String(evidence.id || '').trim()
    push(id, faceCue(evidence, id), 'evidence', because.includes(id))
  }
  for (const precedent of asRows(row.precedents)) {
    const id = String(precedent.id || precedent.decision_id || '').trim()
    push(id, faceCue(precedent, id), 'precedent', because.includes(id))
  }
  for (const draft of asRows(row.drafts)) {
    const id = String(draft.id || draft.decision_id || '').trim()
    push(id, faceCue(draft, id), 'draft', false)
  }
  for (const id of because) {
    push(id, '', 'because', true)
  }
  const options: DecisionBriefOption[] = []
  for (const option of asRows(row.options)) {
    const id = String(option.id || '').trim()
    const label = String(option.label || '').trim()
    if (!id || !label || options.some((row) => row.id === id)) continue
    options.push({ id, label })
  }
  return { faces, options, because }
}

export function citableBecause(faces: DecisionBriefFace[], selected: Iterable<string>) {
  const allow = new Set(faces.filter((face) => face.citable).map((face) => face.id))
  return uniqueIds([...selected].filter((id) => allow.has(id)))
}
