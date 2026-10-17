function positiveInt(value, fallback) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return parsed
}

export function parseEfforts(value) {
  if (value == null || String(value).trim() === '') return ['low', 'high']
  const efforts = String(value).split(',').map((part) => part.trim()).filter(Boolean)
  return efforts.length ? efforts : ['low', 'high']
}

export function planArms({ env = process.env, staticMode = false } = {}) {
  const runs = staticMode ? 1 : positiveInt(env.IUI_PERF_RUNS, 3)
  const efforts = parseEfforts(env.IUI_PERF_EFFORTS)
  const arms = []
  for (let index = 1; index <= runs; index += 1) {
    for (const effort of efforts) {
      arms.push({ id: `A-${effort}`, api: 'openai-completions', effort, kind: 'dsh', index })
      arms.push({ id: `B-${effort}`, api: 'openai-responses', effort, kind: 'fde', index })
    }
    arms.push({ id: 'B-default', api: 'openai-responses', effort: null, kind: 'fde', index })
  }
  return arms
}
