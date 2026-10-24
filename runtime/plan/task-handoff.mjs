import { planTaskSource } from '../app-source.mjs'
import { PLAN_PAGE_HINT } from '../plugins/dsh-lan-assist/handoff-mints.js'

export function taskHandoffPrompt(task, note = '') {
  const title = String(task?.title || '').trim() || '待办'
  const id = String(task?.id || '').trim()
  const sourceRef = String(task?.sourceRef || '').trim()
  const source = planTaskSource(sourceRef)
  const lines = [
    '只处理这一条待办。',
    `任务 ${id}：${title}`,
    sourceRef ? `来源：${sourceRef}` : '这条待办没有来源引用。',
  ]
  if (source && source.kind !== 'im') {
    if (source.kind === 'biz-record' || source.kind === 'biz-trace') {
      lines.push(
        '用 biz_preview 改业务。',
        PLAN_PAGE_HINT,
        'biz_preview 回执 next=confirm 之后，先说「请到计划页确认并过账」，再调 fde_plan_task_propose 收口这条待办，再调 fde_submit_result，然后停止。',
        '禁止再调任何工具。禁止 playwright、chrome-devtools、cua-driver、浏览器和 GUI 代点计划页。不要代点。确认只由人点计划卡「确认并过账」。',
      )
    } else {
      lines.push(
        '用 fde_app_records_query 查来源。',
        '要改业务记录用 fde_app_records_propose。',
      )
    }
  }
  lines.push(
    `要改这条待办用 fde_plan_task_propose，taskId=${id}。`,
    '完成后用 fde_submit_result 交一句结论。',
  )
  const extra = String(note || '').trim()
  if (extra) lines.push(`补充：${extra}`)
  return {
    preset: 'standard',
    sessionTitle: `待办 · ${title}`,
    prompt: lines.join('\n'),
  }
}
