import { loadCurrentWorkspaceCwd } from '@/lib/ai-target'
import { runtimeApi } from '@/lib/runtime-api'

export type ContextScope = 'workspace' | 'tasks' | 'im' | 'biz' | 'apps' | 'memory'

export type ContextPack = {
  workspace: { cwd: string; name: string; activeSessionId?: string; activeSessionTitle?: string }
  tasks?: { today: { id: string; title: string; status: string; dueAt?: string }[]; overdue: number }
  im?: { unread: number; recent: { peer: string; excerpt: string; requestId: string }[] }
  biz?: { connections: { id: string; name: string; online: boolean }[]; recentOps: { kind: string; action: string; at: string }[] }
  apps?: { slug: string; name: string; entities: string[] }[]
  memory?: {
    hits: { id: string; score?: number; excerpt: string; sourceRef: string; at?: string }[]
    precedents: { id: string; title: string; excerpt: string; at?: string }[]
    decisionBrief?: string
  }
  entity?: { kind: 'task' | 'im' | 'biz-row' | 'app-record' | 'memory-card' | 'file'; ref: string; fields: Record<string, unknown> }
  generatedAt: number
}

export type ContextPackEntity = ContextPack['entity']

export async function buildContextPack(opts: {
  scopes: ContextScope[]
  query?: string
  entity?: ContextPackEntity
  intentKind?: 'decision' | 'draft' | 'lookup'
}): Promise<{ pack: ContextPack; warnings: string[] }> {
  const workspace = loadCurrentWorkspaceCwd()
  if (!workspace.ok) {
    throw new Error(workspace.error)
  }
  const result = await runtimeApi.fetchContextPack({
    workspaceCwd: workspace.cwd,
    scopes: opts.scopes,
    query: opts.query,
    entity: opts.entity,
    intentKind: opts.intentKind,
  })
  return { pack: result.pack as ContextPack, warnings: result.warnings }
}

export function renderContextForPrompt(pack: ContextPack, omit: Set<string> = new Set()): string {
  const lines: string[] = []
  const w = pack.workspace
  if (w && !omit.has('workspace')) {
    lines.push('【工作区】', `${w.name || '工作区'}（${w.cwd || ''}）`)
    if (w.activeSessionTitle) lines.push(`当前会话：${w.activeSessionTitle}`)
  }
  if (pack.tasks && !omit.has('tasks')) {
    const today = pack.tasks.today ?? []
    lines.push('【今日待办】', today.length ? today.map((row) => `- ${row.title}（${row.status}）`).join('\n') : '（无）')
    if (pack.tasks.overdue > 0) lines.push(`逾期 ${pack.tasks.overdue} 条`)
  }
  if (pack.im && !omit.has('im')) {
    lines.push('【IM】', `未读 ${pack.im.unread ?? 0}`)
    for (const row of pack.im.recent ?? []) lines.push(`- ${row.peer}：${row.excerpt}`)
  }
  if (pack.biz && !omit.has('biz')) {
    const conns = pack.biz.connections ?? []
    lines.push('【业务连接】', conns.map((c) => `${c.name}${c.online ? '' : '（离线）'}`).join('、') || '（无）')
    for (const op of pack.biz.recentOps ?? []) lines.push(`- ${op.kind} ${op.action}`)
  }
  if (pack.apps && !omit.has('apps')) {
    lines.push('【应用】', (pack.apps ?? []).map((a) => `${a.name}（${(a.entities || []).join(',')}）`).join('\n'))
  }
  if (pack.memory && !omit.has('memory')) {
    const hits = pack.memory.hits ?? []
    if (hits.length) {
      lines.push('【相关记忆】')
      for (const h of hits) lines.push(`- ${h.excerpt}（${h.id}）`)
    }
    const prec = pack.memory.precedents ?? []
    if (prec.length) {
      lines.push('【先例】')
      for (const p of prec) lines.push(`- ${p.title}：${p.excerpt}`)
    }
    if (pack.memory.decisionBrief) lines.push('【决策简报】', pack.memory.decisionBrief)
  }
  if (pack.entity && !omit.has('entity')) {
    lines.push('【来源实体】', `${pack.entity.kind || ''} ${pack.entity.ref || ''}`)
    for (const [key, value] of Object.entries(pack.entity.fields || {}).slice(0, 12)) {
      lines.push(`${key}：${String(value).slice(0, 200)}`)
    }
  }
  let text = lines.join('\n').trim()
  if (text.length > 1500) text = `${text.slice(0, 1497)}…`
  return text
}

export function contextChipSummary(pack: ContextPack | null, warnings: string[]): string {
  if (warnings.includes('memory_engine_not_ready')) return '记忆引擎未就绪'
  if (warnings.some((w) => w.endsWith('_timeout'))) return '记忆检索超时'
  if (!pack) return ''
  const parts: string[] = []
  const mem = pack.memory
  if (mem?.hits?.length) parts.push(`${mem.hits.length} 条相关记忆`)
  if (mem?.precedents?.length) parts.push(`${mem.precedents.length} 条先例`)
  if (pack.tasks?.today?.length) parts.push(`今日 ${pack.tasks.today.length} 待办`)
  if (!parts.length) return '附带工作区上下文'
  return `附带：${parts.join(' · ')}`
}
