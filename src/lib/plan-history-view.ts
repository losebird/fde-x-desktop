export type PlanHistoryChange = {
  field: string
  before: unknown
  after: unknown
}

export type PlanHistoryEntry = {
  at: string
  kind: 'change' | 'run'
  action: string
  actor: 'you' | 'ai' | 'system'
  legacy: boolean
  changes: PlanHistoryChange[] | null
  label: string
  via?: string
  run?: {
    id: string
    state: string
    message: string
    trigger: 'manual' | 'schedule'
    sessionId?: string
  }
}

const FIELD_LABEL: Record<string, string> = {
  title: '标题',
  notes: '备注',
  status: '状态',
  priority: '优先级',
  dueAt: '截止',
  tags: '标签',
  name: '名称',
  description: '描述',
  steps: '步骤',
  trigger: '触发',
  tools: '工具',
  location: '地点',
  kind: '类型',
  startAt: '开始',
  endAt: '结束',
  workflowId: '工作流',
  recurrence: '重复',
  category: '分类',
  emoji: '图标',
  sourceRef: '来源',
  timezone: '时区',
  allDay: '全天',
}

const VALUE_LABEL: Record<string, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
  archived: '已归档',
  low: '低',
  med: '中',
  high: '高',
  urgent: '紧急',
  active: '已启用',
  paused: '已暂停',
  once: '到点一次',
  daily: '每天这个时间',
  meeting: '会议',
  focus: '深聊 / 专注',
  reminder: '提醒',
  external: '外部',
  manual: '手动',
  cron: '定时',
  keyword: '关键字',
  event: '事件',
  system: '系统',
  data: '数据',
  im: 'IM',
  file: '文件',
  memory: '记忆',
  true: '是',
  false: '否',
}

const NOISE_FIELDS = new Set(['timezone'])

export function isBlankPlanValue(value: unknown): boolean {
  if (value == null || value === '') return true
  if (typeof value === 'boolean') return false
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

export function formatPlanStamp(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso || '')
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `今天 ${time}`
  const sameYear = date.getFullYear() === now.getFullYear()
  const day = date.toLocaleDateString('zh-CN', sameYear
    ? { month: 'numeric', day: 'numeric' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' })
  return `${day} ${time}`
}

function looksIsoStamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})/.test(value)
}

export function formatPlanSourceRef(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^fde-task:task_/u.test(raw)) return '本条待办'
  if (/^fde:\/\/plan\/tasks\//u.test(raw)) return '待办'
  if (/^fde:\/\/plan\/events\//u.test(raw)) return '日程'
  if (/^fde:\/\/plan\/workflows\//u.test(raw)) return '工作流'
  if (raw.startsWith('im:')) return '即时消息'
  if (raw.startsWith('biz:')) return raw.slice(4) || '业务记录'
  if (raw.startsWith('app:')) return '应用'
  return raw
}

function formatTrigger(value: Record<string, unknown>): string {
  const kind = VALUE_LABEL[String(value.kind || '')] || String(value.kind || '手动')
  if (typeof value.expr === 'string' && value.expr.trim()) return `${kind} · ${value.expr.trim()}`
  return kind
}

function formatSteps(value: unknown[]): string {
  if (!value.length) return '空'
  const kinds = value.map((step) => {
    if (!step || typeof step !== 'object') return '步骤'
    const kind = String((step as { kind?: string }).kind || '')
    if (kind === 'ai') return 'AI'
    if (kind === 'delay') return '等待'
    return kind || '步骤'
  })
  return `${value.length} 步 · ${kinds.join('、')}`
}

export function formatPlanValue(value: unknown): string {
  if (isBlankPlanValue(value)) return '空'
  if (typeof value === 'boolean') return VALUE_LABEL[String(value)] || (value ? '是' : '否')
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (VALUE_LABEL[value]) return VALUE_LABEL[value]
    if (looksIsoStamp(value)) return formatPlanStamp(value)
    const source = formatPlanSourceRef(value)
    if (source !== value || !value.includes('task_')) return source
    return source
  }
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === 'object' && 'kind' in item)) return formatSteps(value)
    return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('、')
  }
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>
    if (typeof row.kind === 'string' && ('expr' in row || 'patterns' in row || 'on' in row || Object.keys(row).length <= 3)) {
      return formatTrigger(row)
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] || field
}

export function actorLabel(actor: string): string {
  if (actor === 'ai') return 'AI'
  if (actor === 'system') return '系统'
  return '你'
}

export function isNoiseChange(change: PlanHistoryChange): boolean {
  if (NOISE_FIELDS.has(change.field) && isBlankPlanValue(change.before) && isBlankPlanValue(change.after)) return true
  if (isBlankPlanValue(change.before) && isBlankPlanValue(change.after)) return true
  if (change.field === 'sourceRef') {
    const after = typeof change.after === 'string' ? change.after : ''
    if (isBlankPlanValue(change.before) && /^fde-task:task_/u.test(after)) return true
  }
  if (change.field === 'timezone' && isBlankPlanValue(change.before)) return true
  if (change.field === 'allDay' && isBlankPlanValue(change.before) && (change.after === false || change.after === 0)) return true
  return false
}

export type VisiblePlanChange = {
  field: string
  label: string
  before: string
  after: string
  created: boolean
}

export function visiblePlanChanges(entry: PlanHistoryEntry): VisiblePlanChange[] {
  const rows = Array.isArray(entry.changes) ? entry.changes : []
  return rows
    .filter((change) => !isNoiseChange(change))
    .map((change) => {
      const created = isBlankPlanValue(change.before) && !isBlankPlanValue(change.after)
      return {
        field: change.field,
        label: fieldLabel(change.field),
        before: formatPlanValue(change.before),
        after: formatPlanValue(change.after),
        created,
      }
    })
}

export function entryKindBadge(entry: PlanHistoryEntry): string {
  if (entry.kind === 'run') return '运行'
  if (entry.via === 'organize') return '整理'
  if (entry.action === 'create' || entry.label === '新建') return '新建'
  if (entry.action === 'delete' || entry.label === '删除') return '删除'
  return entry.label || '编辑'
}

const RUN_STATE: Record<string, string> = {
  failed: '失败',
  error: '失败',
  succeeded: '完成',
  success: '完成',
  completed: '完成',
  running: '运行中',
  waiting: '等待中',
  cancelled: '已取消',
  canceled: '已取消',
}

export function runOutcomeLabel(entry: PlanHistoryEntry): string {
  const state = String(entry.run?.state || entry.label || '').trim()
  return RUN_STATE[state] || (VALUE_LABEL[state] ? VALUE_LABEL[state] : '')
}
