export const SECTION_TYPES = new Set(['tasks', 'events', 'im', 'biz', 'memory', 'app', 'mcp', 'ai'])
export const RENDER_TYPES = new Set(['list', 'stat', 'digest', 'timeline'])
export const TASK_STATUSES = ['todo', 'doing', 'done', 'archived']

export function defaultSchedule() {
  return { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: true, tz: 'Asia/Shanghai' }
}

export function defaultSections() {
  return [
    { id: 'tasks-today', type: 'tasks', title: '今日三件事', enabled: true, render: 'list', params: { limit: 3, status: ['todo', 'doing'] } },
    { id: 'events-today', type: 'events', title: '今日日程', enabled: true, render: 'timeline', params: { limit: 20 } },
    { id: 'im-unread', type: 'im', title: '未读 IM', enabled: true, render: 'list', params: { limit: 8 } },
    { id: 'memory-daily', type: 'memory', title: '昨日记忆', enabled: true, render: 'list', params: { layer: 'daily', limit: 5 } },
    { id: 'biz-pending', type: 'biz', title: '业务', enabled: false, render: 'list', params: { action: '现查', filter: {} } },
    { id: 'app-stat-1', type: 'app', title: '应用统计', enabled: false, render: 'stat', params: {} },
    { id: 'ai-digest', type: 'ai', title: 'AI 早报', enabled: true, render: 'digest' },
  ]
}

export function sourcesFromMcpSections(sections) {
  const seen = new Set()
  const sources = []
  for (const row of Array.isArray(sections) ? sections : []) {
    if (!row || row.type !== 'mcp') continue
    const server = typeof row.params?.server === 'string' ? row.params.server.trim() : ''
    if (!server || seen.has(server)) continue
    seen.add(server)
    sources.push({ type: 'mcp', server })
  }
  return sources
}

export function gateSectionEnabled(section) {
  if (!section || typeof section !== 'object') return section
  const row = { ...section }
  const params = row.params && typeof row.params === 'object' && !Array.isArray(row.params) ? row.params : {}
  if (row.type === 'mcp') {
    if (!String(params.server || '').trim() || !String(params.tool || '').trim()) row.enabled = false
  }
  if (row.type === 'biz' && !String(params.kind || '').trim()) row.enabled = false
  if (row.type === 'app') {
    const slug = String(params.slug || '').trim()
    const viewId = String(params.viewId || '').trim()
    if (!slug || !viewId) row.enabled = false
  }
  return row
}

export function prepareDefinitionSections(sections) {
  return (Array.isArray(sections) ? sections : []).map(gateSectionEnabled)
}

export function defaultSources() {
  return sourcesFromMcpSections(defaultSections())
}
