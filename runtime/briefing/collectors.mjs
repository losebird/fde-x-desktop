import { computeStat } from '../apps/records.mjs'
import { findActiveAppBySlug } from '../apps/repository.mjs'
import { workspaceIdForCwd } from './workspace.mjs'

function dayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString(), now: new Date().toISOString() }
}

function baseSection(def, extra = {}) {
  return {
    id: def.id,
    title: def.title,
    render: def.render,
    items: [],
    fetchedAt: new Date().toISOString(),
    ...extra,
  }
}

export async function collectInternalSection(deps, def, workspaceCwd) {
  const { db, aiRuntime } = deps
  const workspaceId = workspaceIdForCwd(db, workspaceCwd)
  const params = def.params && typeof def.params === 'object' ? def.params : {}
  try {
    if (def.type === 'tasks') {
      const limit = Number(params.limit) || 3
      const statuses = Array.isArray(params.status) ? params.status : ['todo', 'doing']
      const placeholders = statuses.map(() => '?').join(', ')
      const { start, end, now } = dayBounds()
      const todayRows = db.prepare(`
        SELECT id, title, status, due_at, priority FROM tasks
        WHERE workspace_id = ? AND status IN (${placeholders})
          AND due_at IS NOT NULL AND due_at >= ? AND due_at <= ?
        ORDER BY due_at ASC LIMIT ?
      `).all(workspaceId, ...statuses, start, end, limit)
      const openRows = todayRows.length ? todayRows : db.prepare(`
        SELECT id, title, status, due_at, priority FROM tasks
        WHERE workspace_id = ? AND status IN (${placeholders})
        ORDER BY updated_at DESC LIMIT ?
      `).all(workspaceId, ...statuses, limit)
      const overdue = db.prepare(`
        SELECT id, title, due_at FROM tasks
        WHERE workspace_id = ? AND status IN ('todo', 'doing') AND due_at IS NOT NULL AND due_at < ?
        ORDER BY due_at ASC LIMIT 3
      `).all(workspaceId, now)
      const items = openRows.map((t) => ({
        text: t.title,
        href: { panel: 'plan', tab: 'todo', taskId: t.id },
        ref: `task:${t.id}`,
      }))
      const section = baseSection(def, { items })
      if (overdue.length) {
        section.overdue = overdue.map((t) => ({
          text: t.title,
          href: { panel: 'plan', tab: 'todo', taskId: t.id },
        }))
      }
      return section
    }

    if (def.type === 'events') {
      const { start, end } = dayBounds()
      const rows = db.prepare(`
        SELECT id, title, start_at, end_at, location, event_kind FROM calendar_events
        WHERE workspace_id = ? AND start_at >= ? AND start_at <= ?
        ORDER BY start_at ASC LIMIT 20
      `).all(workspaceId, start, end)
      return baseSection(def, {
        render: def.render === 'timeline' ? 'timeline' : def.render,
        items: rows.map((e) => ({
          text: `${e.title}`,
          sub: e.location || '',
          href: { panel: 'plan', tab: 'schedule' },
          ref: `event:${e.id}`,
          meta: { start: e.start_at, end: e.end_at, kind: e.event_kind },
        })),
      })
    }

    if (def.type === 'im') {
      if (!aiRuntime?.status?.().connected) {
        return baseSection(def, { error: '核心未连接' })
      }
      const state = await aiRuntime.lanAssist('/state', { search: {} })
      const requests = Array.isArray(state?.requests) ? state.requests : []
      const unread = requests.filter((row) => row?.unread && row.kind !== 'outgoing')
      const items = unread.slice(0, 8).map((row) => ({
        text: String(row.body || row.excerpt || row.last || '').slice(0, 120),
        sub: String(row.fromName || row.from || ''),
        href: { panel: 'im', requestId: String(row.id || '') },
        ref: `im:${row.id}`,
      }))
      return baseSection(def, { items, stat: { value: unread.length, label: '未读' } })
    }

    if (def.type === 'biz') {
      const kind = typeof params.kind === 'string' ? params.kind.trim() : ''
      const action = typeof params.action === 'string' ? params.action : '现查'
      const filter = params.filter && typeof params.filter === 'object' ? params.filter : { 状态: '待审' }
      if (!kind) {
        return baseSection(def, { error: '请在自定义里选择业务型（kind）' })
      }
      if (!aiRuntime?.status?.().connected) {
        return baseSection(def, { error: '核心未连接，无法查询业务待审' })
      }
      const where = Object.entries(filter).map(([field, value]) => ({ keys: [field], values: [value] }))
      const preview = await aiRuntime.lanAssist('/preview', {
        method: 'POST',
        body: {
          kind,
          action,
          speech: `早报现查 ${kind}`,
          workspace: workspaceCwd,
          where,
        },
      })
      const rows = Array.isArray(preview?.rows) ? preview.rows : []
      if (!rows.length && preview?.columns && !Object.keys(filter).some((k) => preview.columns.includes(k))) {
        return baseSection(def, { error: '此型无待审字段' })
      }
      const items = rows.slice(0, 8).map((row, index) => {
        const no = row?.no || row?.编号 || row?.id || String(index + 1)
        return {
          text: String(row?.标题 || row?.title || row?.name || `记录 ${no}`),
          href: { panel: 'data', tab: 'records', kind, rowId: String(no) },
          ref: `biz:${kind}:${no}`,
        }
      })
      return baseSection(def, { items })
    }

    if (def.type === 'memory') {
      if (!aiRuntime?.status?.().connected) {
        return baseSection(def, { error: '核心未连接' })
      }
      const limit = Number(params.limit) || 5
      const layer = typeof params.layer === 'string' ? params.layer : 'daily'
      let cards = []
      try {
        const payload = await aiRuntime.semanticOs('/python', {
          op: 'list_memory_cards',
          args: { include_filed: true, layer },
          cwd: workspaceCwd,
        })
        cards = Array.isArray(payload?.cards) ? payload.cards : Array.isArray(payload?.items) ? payload.items : []
      } catch (error) {
        return baseSection(def, { error: error instanceof Error ? error.message : '记忆列表失败' })
      }
      const items = cards.slice(0, limit).map((card) => ({
        text: String(card.title || card.label || '记忆卡片'),
        sub: String(card.excerpt || card.body || '').slice(0, 120),
        href: { panel: 'memory' },
        ref: `memory:${card.id || card.card_id || ''}`,
      }))
      return baseSection(def, { items })
    }

    if (def.type === 'app') {
      const slug = typeof params.slug === 'string' ? params.slug.trim() : ''
      const viewId = typeof params.viewId === 'string' ? params.viewId.trim() : ''
      if (!slug || !viewId) {
        return baseSection(def, { error: '缺少应用 slug 或统计视图' })
      }
      const app = findActiveAppBySlug(db, workspaceId, slug)
      if (!app) {
        return baseSection(def, { error: '应用未激活或不存在' })
      }
      const view = app.spec.views?.find((v) => v.id === viewId || v.type === 'stat')
      if (!view || view.type !== 'stat') {
        return baseSection(def, { error: '统计视图不存在' })
      }
      const value = computeStat(db, app.spec, view, workspaceCwd)
      return baseSection(def, {
        stat: { value, label: view.title || def.title, unit: view.unit || '' },
        items: [],
      })
    }

    if (def.type === 'mcp' || def.type === 'ai') {
      return baseSection(def, { items: [], pendingAgent: true })
    }

    return baseSection(def, { error: `未知区块类型：${def.type}` })
  } catch (error) {
    console.warn('briefing_collect_failed', def.id, error)
    return baseSection(def, { error: error instanceof Error ? error.message : '采集失败' })
  }
}
