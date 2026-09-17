export const SECTION_TYPES = new Set(['tasks', 'events', 'im', 'biz', 'memory', 'app', 'mcp', 'ai'])
export const RENDER_TYPES = new Set(['list', 'stat', 'digest', 'timeline'])

export function defaultSchedule() {
  return { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: true, tz: 'Asia/Shanghai' }
}

export function defaultSections() {
  return [
    { id: 'tasks-today', type: 'tasks', title: '今日三件事', enabled: true, render: 'list', params: { limit: 3, status: ['todo', 'doing'] } },
    { id: 'im-unread', type: 'im', title: '未读 IM', enabled: true, render: 'list' },
    { id: 'biz-pending', type: 'biz', title: '待审批', enabled: true, render: 'list', params: { action: '现查', filter: { 状态: '待审' } } },
    { id: 'memory-daily', type: 'memory', title: '昨日记忆', enabled: true, render: 'list', params: { layer: 'daily', limit: 5 } },
    { id: 'app-stat-1', type: 'app', title: '本周拜访', enabled: false, render: 'stat', params: { slug: 'supplier-visits', viewId: 'stat-week' } },
    { id: 'mail', type: 'mcp', title: '重要邮件', enabled: false, render: 'digest', params: { server: 'imap', tool: 'list_unread', args: { folder: 'INBOX', limit: 20 }, summarize: true } },
    { id: 'news', type: 'mcp', title: '行业资讯', enabled: false, render: 'digest', params: { server: 'rss', tool: 'fetch', args: { feeds: [] }, summarize: true } },
    { id: 'ai-digest', type: 'ai', title: 'AI 早报', enabled: true, render: 'digest' },
  ]
}

export function defaultSources() {
  return [{ type: 'mcp', server: 'imap' }, { type: 'mcp', server: 'rss' }]
}
