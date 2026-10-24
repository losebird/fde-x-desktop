import { PLAN_CARD_MOUTH } from './confirm-mouth.mjs'

export function stampPlanConfirmMouth(db, sheet) {
  if (!db || !sheet || typeof sheet !== 'object') return sheet
  const sessionId = String(sheet.sessionId || '').trim()
  if (!sessionId) return sheet
  const running = db.prepare(`
    SELECT 1 AS ok FROM task_ai_runs
    WHERE session_id = ? AND state = 'running'
    LIMIT 1
  `).get(sessionId)
  const awaitingPlan = db.prepare(`
    SELECT 1 AS ok FROM task_ai_runs r
    WHERE r.session_id = ?
      AND EXISTS (
        SELECT 1 FROM operations o
        WHERE o.state = 'awaiting_approval'
          AND o.action = 'plan.task.propose'
          AND json_extract(o.plan_json, '$.taskId') = r.task_id
      )
    LIMIT 1
  `).get(sessionId)
  if (!running && !awaitingPlan) return sheet
  if (sheet.confirmMouth === PLAN_CARD_MOUTH) return sheet
  return { ...sheet, confirmMouth: PLAN_CARD_MOUTH }
}
