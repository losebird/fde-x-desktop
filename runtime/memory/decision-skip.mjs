import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function decisionSkipPath(cwd) {
  return join(String(cwd || ''), '.dsh', 'semantic-os', 'decision-skips.jsonl')
}

export function noteDecisionSkip(cwd, reason, extra = {}) {
  const root = String(cwd || '').trim()
  if (!root) return
  const dest = decisionSkipPath(root)
  try {
    mkdirSync(dirname(dest), { recursive: true })
    appendFileSync(dest, `${JSON.stringify({
      ts: new Date().toISOString(),
      reason: String(reason || ''),
      ...extra,
    })}\n`)
  } catch {
    /* telemetry is best-effort */
  }
}
