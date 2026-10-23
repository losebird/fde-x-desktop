import { planTaskSource } from '../app-source.mjs'

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
    lines.push(
      '用 fde_app_records_query 查来源。',
      '要改业务记录用 fde_app_records_propose。',
    )
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
