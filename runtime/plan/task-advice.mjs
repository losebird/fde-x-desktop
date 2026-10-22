const STATUSES = new Set(['todo', 'doing', 'done', 'archived'])
const PRIORITIES = new Set(['urgent', 'high', 'med', 'low'])
const PRIORITY_LABEL = { urgent: '紧急', high: '高', med: '中', low: '低' }
const STATUS_LABEL = { todo: '待办', doing: '进行中', done: '已完成', archived: '已归档' }
const HOST_GOAL_PREFIX = 'dsh-goal:'

export const taskAdviceSchema = {
  type: 'object',
  required: ['suggestions'],
  properties: {
    summary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['op', 'taskId', 'reason'],
        properties: {
          op: { enum: ['update', 'archive', 'merge'] },
          taskId: { type: 'string' },
          mergeInto: { type: 'string' },
          reason: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              notes: { type: 'string' },
              status: { enum: ['todo', 'doing', 'done', 'archived'] },
              priority: { enum: ['urgent', 'high', 'med', 'low'] },
              dueAt: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

export function organizeAdvicePrompt() {
  return [
    '根据下面列出的待办给建议。',
    '每条建议的 op 只能是 update、archive 或 merge。',
    'taskId 必须是列表里方括号中的 id。',
    'update 的 patch 用 dueAt，不要写 due。priority 只能是 urgent、high、med、low。',
    'merge 必须同时给出 taskId 和 mergeInto，两者都是列表里的 id，且不能相同。',
    'archive 表示归档这一条。',
    '用 fde_submit_result 提交 JSON。',
  ].join('\n')
}

function formatDue(value) {
  if (value == null || value === '') return '—'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return '—'
  return `${Number(match[2])}/${Number(match[3])}`
}

export function formatTaskLine(task) {
  const priority = PRIORITY_LABEL[task.priority] || '—'
  const due = formatDue(task.dueAt || task.due)
  return `- [${task.id}] ${task.title}（${task.status} · ${priority} · ${due}）`
}

function knownTasks(tasks) {
  const known = new Map()
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task && typeof task.id === 'string' && task.id) known.set(task.id, task)
  }
  return known
}

function fail(reason) {
  return { ok: false, reason }
}

function parseUpdate(item, taskId) {
  if (!item.patch || typeof item.patch !== 'object' || Array.isArray(item.patch)) {
    return fail('update 缺少 patch')
  }
  if (Object.prototype.hasOwnProperty.call(item.patch, 'due')) {
    return fail('patch 应使用 dueAt，不要使用 due')
  }
  const patch = {}
  const src = item.patch
  if (src.title !== undefined) {
    if (typeof src.title !== 'string') return fail('patch.title 无效')
    patch.title = src.title
  }
  if (src.notes !== undefined) {
    if (typeof src.notes !== 'string') return fail('patch.notes 无效')
    patch.notes = src.notes
  }
  if (src.status !== undefined) {
    if (!STATUSES.has(src.status)) return fail('patch.status 无效')
    patch.status = src.status
  }
  if (src.priority !== undefined) {
    if (!PRIORITIES.has(src.priority)) return fail('patch.priority 不是 urgent、high、med、low')
    patch.priority = src.priority
  }
  if (src.dueAt !== undefined) {
    if (src.dueAt !== null && typeof src.dueAt !== 'string') return fail('patch.dueAt 无效')
    patch.dueAt = src.dueAt
  }
  if (src.tags !== undefined) {
    if (!Array.isArray(src.tags) || src.tags.some((tag) => typeof tag !== 'string')) {
      return fail('patch.tags 必须是字符串数组')
    }
    patch.tags = src.tags
  }
  if (Object.keys(patch).length === 0) return fail('update 没有可应用的字段')
  if (taskId.startsWith(HOST_GOAL_PREFIX)) {
    const keys = Object.keys(patch)
    if (keys.length !== 1 || keys[0] !== 'status') return fail('Host goal 只能改状态')
  }
  return { ok: true, patch }
}

function parseOne(item, known) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return fail('建议不是对象')
  const taskId = typeof item.taskId === 'string' ? item.taskId.trim() : ''
  if (!taskId) return fail('缺少 taskId')
  if (!known.has(taskId)) return fail('taskId 对不上当前待办')
  const op = item.op
  if (op !== 'update' && op !== 'archive' && op !== 'merge') {
    return fail('op 必须是 update、archive 或 merge')
  }
  const reason = typeof item.reason === 'string' ? item.reason : ''
  if (op === 'archive') return { ok: true, value: { op, taskId, reason } }
  if (op === 'merge') {
    const mergeInto = typeof item.mergeInto === 'string' ? item.mergeInto.trim() : ''
    if (!mergeInto) return fail('merge 缺少 mergeInto')
    if (mergeInto === taskId) return fail('不能合并进自己')
    if (!known.has(mergeInto)) return fail('mergeInto 对不上当前待办')
    return { ok: true, value: { op, taskId, mergeInto, reason } }
  }
  const updated = parseUpdate(item, taskId)
  if (!updated.ok) return updated
  return { ok: true, value: { op, taskId, reason, patch: updated.patch } }
}

export function parseTaskAdvice(raw, tasks) {
  const known = knownTasks(tasks)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { accepted: [], rejected: [{ index: -1, reason: '结果不是对象' }], summary: '' }
  }
  const summary = typeof raw.summary === 'string' ? raw.summary : ''
  if (!Array.isArray(raw.suggestions)) {
    return { accepted: [], rejected: [{ index: -1, reason: 'suggestions 不是数组' }], summary }
  }
  const accepted = []
  const rejected = []
  raw.suggestions.forEach((item, index) => {
    const parsed = parseOne(item, known)
    if (parsed.ok) accepted.push(parsed.value)
    else rejected.push({ index, reason: parsed.reason })
  })
  return { accepted, rejected, summary }
}

function describePatch(patch) {
  const parts = []
  if (patch.title !== undefined) parts.push(`标题 → ${patch.title}`)
  if (patch.notes !== undefined) parts.push(`备注 → ${patch.notes}`)
  if (patch.status !== undefined) parts.push(`状态 → ${STATUS_LABEL[patch.status] || patch.status}`)
  if (patch.priority !== undefined) parts.push(`优先级 → ${PRIORITY_LABEL[patch.priority] || patch.priority}`)
  if (patch.dueAt !== undefined) parts.push(`截止 → ${patch.dueAt ? formatDue(patch.dueAt) : '—'}`)
  if (patch.tags !== undefined) parts.push(`标签 → ${patch.tags.join(', ') || '—'}`)
  return parts.length ? parts.join('；') : '（无字段变更）'
}

export function describeAdvice(suggestion) {
  if (suggestion.op === 'archive') return '归档'
  if (suggestion.op === 'merge') return `合并进 ${suggestion.mergeInto}`
  if (!suggestion.patch || typeof suggestion.patch !== 'object') {
    throw new Error('update 缺少 patch')
  }
  return describePatch(suggestion.patch)
}
