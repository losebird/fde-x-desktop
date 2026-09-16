// 全部模块的初始 mock 数据。这里故意写得"看起来像真实业务"，方便下游做真实感 UI。
import type {
  Workspace, User, Task, ScheduleEvent, FileNode,
  ChatThread, Agent, IMContact, IMMessage, BusinessTable,
  MCPServer, Skill, Notification, NewsItem, MetricCard,
  Workflow, IMTopic,
} from '@/lib/types'

const today = () => {
  const d = new Date('2026-09-08T20:34:44+08:00')
  return d.toISOString()
}

const at = (h: number, m = 0) => {
  const d = new Date('2026-09-08T20:34:44+08:00')
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export const seedUser: User = {
  id: 'u_self',
  name: '我',
  handle: '@zxz',
  avatarColor: '#2F6B3A',
}

// 工作区。每个工作区是一组独立的数据边界(Agent / AI 会话 / 记忆 / 文件 / 工作流)。
// IM 联系人/消息、任务、日程保持全局共享(不随工作区切)。
export const WS_PERSONAL = 'ws_personal'
export const WS_BIZ = 'ws_biz'

export const seedWorkspaces: Workspace[] = [
  { id: WS_PERSONAL, name: '个人项目',     emoji: '🧑‍💻', color: 'blue',   desc: '主线 · scene#39 个人工作台、自我增长、日常运营', createdAt: '2026-01-15' },
  { id: WS_BIZ,      name: '副业电商',     emoji: '🛒',  color: 'amber',  desc: '小店运营 · 订单/客户/产品/合同 一站式管理',       createdAt: '2026-04-20' },
]

export const seedTasks: Task[] = [
  { id: 't1', title: 'scene#39 个人工作台原型出 demo', notes: '全模块深做 + 系列母版', status: 'doing', priority: 'urgent', due: '2026-09-08', tags: ['scene', 'prototype'], project: 'WorkBuddy', createdAt: at(9, 12) },
  { id: 't2', title: '本周三晚和团队的复盘会纪要',     status: 'todo',  priority: 'high',   due: '2026-09-09', tags: ['meeting', 'notes'], createdAt: at(9, 30) },
  { id: 't3', title: '对接腾讯电子签 · 续签合同',      status: 'todo',  priority: 'high',   due: '2026-09-10', tags: ['legal', 'esign'], createdAt: at(10) },
  { id: 't4', title: '回 3 个候选人的面试反馈',         status: 'todo',  priority: 'med',    due: '2026-09-12', tags: ['hr'], createdAt: at(11) },
  { id: 't5', title: '财务月度对账 — 待补 8 月差额',    status: 'todo',  priority: 'med',    due: '2026-09-14', tags: ['finance'], createdAt: at(11, 20) },
  { id: 't6', title: '竞品拆解: 飞书 + Notion AI 模块', status: 'done',  priority: 'med',    tags: ['research'], createdAt: at(8) },
  { id: 't7', title: '每周三产品评审·主持',            status: 'doing', priority: 'high',   tags: ['meeting', 'product'], createdAt: at(9) },
  { id: 't8', title: '更新个人主页 README',             status: 'done',  priority: 'low',    tags: ['self'], createdAt: at(7) },
  { id: 't9', title: '消费 scene#38 模板,搭 scene#40',  status: 'archived', priority: 'low', tags: ['meta'], createdAt: at(7) },
]

export const seedEvents: ScheduleEvent[] = [
  { id: 'e1', title: '晨间复盘 · 周二', start: at(9),  end: at(9, 30),  kind: 'focus' },
  { id: 'e2', title: '产品评审',                        start: at(10), end: at(11), kind: 'meeting',  location: '会议室 A', attendees: ['阿宁','小航','我'] },
  { id: 'e3', title: '深聊 · scene#39',                  start: at(11, 30), end: at(12, 30), kind: 'focus' },
  { id: 'e4', title: '午饭',                            start: at(12, 30), end: at(13, 30), kind: 'reminder' },
  { id: 'e5', title: '招聘 1:1',                         start: at(14), end: at(14, 45), kind: 'meeting', location: '线上' },
  { id: 'e6', title: '财务对账',                        start: at(15, 30), end: at(16, 30), kind: 'focus' },
  { id: 'e7', title: '客户 · 法大大续签',                start: at(17), end: at(17, 30), kind: 'external' },
  { id: 'e8', title: '运动 + 阅读',                       start: at(19), end: at(20, 30), kind: 'reminder' },
]

const fileRoot: FileNode[] = [
  { id: 'f_root', name: '我的工作台',       kind: 'folder', size: 0, updatedAt: today(), parentId: null },
  { id: 'f_proj', name: '项目',             kind: 'folder', size: 0, updatedAt: today(), parentId: 'f_root' },
  { id: 'f_doc',  name: '文档',             kind: 'folder', size: 0, updatedAt: today(), parentId: 'f_root' },
  { id: 'f_pic',  name: '图片',             kind: 'folder', size: 0, updatedAt: today(), parentId: 'f_root' },
  { id: 'f_arch', name: '代码与笔记',       kind: 'folder', size: 0, updatedAt: today(), parentId: 'f_root' },
  { id: 'f_data', name: '数据',             kind: 'folder', size: 0, updatedAt: today(), parentId: 'f_root' },
]

export const seedFiles: FileNode[] = [
  ...fileRoot,
  // 项目
  { id: 'f1', name: 'WorkBuddy · 工作台架构.md', kind: 'markdown', size: 12500, updatedAt: at(8, 5), parentId: 'f_doc', starred: true, content: `# WorkBuddy 工作台架构\n\n> 状态: 起草中 · 作者: 我\n\n## 一句话定位\n一个把 **AI + IM + 工作区 + 文件 + 任务 + 数据 + 记忆** 收口在同一屏的统一工作台。\n\n## 信息架构\n\n- 顶栏: 全局搜索 / 工作区切换 / 通知 / 账户\n- 侧栏: 13 个一级模块,按使用频次排列\n- 主区: 模块页内用 Tab + 子路由拆分\n\n## 落地路径\n\n1. 早报 dashboard 作为默认入口\n2. 任务 + 日程 → 触发高频模块的入口\n3. IM + 文件 + 数据 → 落地模块\n4. MCP / Skills / 记忆 → 高级配置\n\n## 风险\n\n- 信息密度过载\n- 模块之间的关系图弱\n- IM 抢占了主注意力的危险\n` },
  { id: 'f2', name: 'scene 模板说明.md', kind: 'markdown', size: 4200, updatedAt: at(10, 12), parentId: 'f_doc', content: `# scene 模板说明\n\n## 命名\nscene#39-个人工作台.md\n\n## 模板字段\n- 标签\n- 摘要\n- 触发场景\n- 输出形态\n- 数据依赖\n\n## 约束\n- 单一入口(Morning Briefing)\n- 一次只聚焦一个高频场景\n- 模块清单完整但分级(深/中/浅)\n` },
  { id: 'f3', name: 'launch 计划.md',       kind: 'markdown', size: 6700, updatedAt: at(11), parentId: 'f_doc', content: `# Launch Plan\n\n## T-7\n- 内部 beta 邀请\n- 准备截图 + GIF\n\n## T-3\n- 文档站点\n- 录 5 分钟 demo\n\n## T-0\n- 上线 + 公告\n` },

  // 图片
  { id: 'f4', name: '架构图 v2.png',         kind: 'image', size: 281000, updatedAt: at(9, 40), parentId: 'f_pic', starred: true, content: 'https://placehold.co/800x500/E7F0E9/2F6B3A?text=Architecture+v2' },

  // 数据
  { id: 'f5', name: 'Q3 关键指标.csv',       kind: 'sheet',  size: 18400, updatedAt: at(11, 20), parentId: 'f_data', content: 'metric,value,delta\nDAU,12480,0.08\nRetention,0.42,0.02\nARPU,38.5,0.05\nNPS,52,3' },
  { id: 'f6', name: '客户名单.csv',         kind: 'sheet',  size: 9200,  updatedAt: at(10, 33), parentId: 'f_data', content: 'name,segment,owner\n张老师,K12,阿宁\n王医生,医疗,小航\n林律所,法律,我' },
  { id: 'f7', name: '指标定义.json',         kind: 'json',   size: 1400,  updatedAt: at(9, 5),  parentId: 'f_data', content: JSON.stringify({
  metrics: {
    DAU: { sql: 'count(distinct uid)', unit: '人', refresh: '5min' },
    Retention: { sql: 'D7/D0', unit: '比率', refresh: 'daily' },
  },
  sources: ['mysql.analytics', 'feishu.bitable'],
}, null, 2) },

  // 代码
  { id: 'f8', name: 'useLocalStore.ts',      kind: 'code',   size: 1820,  updatedAt: at(11, 35), parentId: 'f_arch', content: `import { useEffect, useState } from 'react'

export function useLocalStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }, [key, value])
  return [value, setValue] as const
}
` },
  { id: 'f9', name: 'briefing.ts',           kind: 'code',   size: 880,  updatedAt: at(11, 50), parentId: 'f_arch', content: `export function briefingFor(date: Date) {
  const day = date.getDay()
  if (day === 1) return '周一 · 重点对齐本周节奏'
  if (day === 5) return '周五 · 收口 + 复盘'
  return '今日关键三件事'
}
` },
  { id: 'f10', name: 'scene-index.json',      kind: 'json',   size: 920, updatedAt: at(11, 5), parentId: 'f_root', content: JSON.stringify({
  scenes: [
    { id: 'scene-37', title: 'IM 群中转站' },
    { id: 'scene-38', title: '技能训练营' },
    { id: 'scene-39', title: '个人工作台' },
    { id: 'scene-40', title: '客户成功看板 (规划中)' },
  ],
}, null, 2) },
  { id: 'f11', name: '工作台设计规范.pdf',    kind: 'pdf',    size: 880000, updatedAt: at(8), parentId: 'f_doc', content: 'PDF · 12 页 · 设计规范与组件清单 · 当前为占位文件,真实预览请上传 PDF。' },
  { id: 'f12', name: '备注.txt',              kind: 'doc',    size: 240,  updatedAt: at(7, 55), parentId: 'f_doc', content: '今天先把 scene#39 跑通;明天复盘并改成 scene 母版。' },
  { id: 'f_poster', name: 'scene39 发布海报.png', kind: 'image', size: 186000, updatedAt: at(11, 36), parentId: 'f_pic', content: 'https://placehold.co/900x1200/1F3A2E/F4E9C8?text=FDE-X+Desktop%0APersonal+Workstation' },
  { id: 'f_web', name: '工作台落地页.html', kind: 'web', size: 4200, updatedAt: at(11, 37), parentId: 'f_proj', content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:ui-sans-serif,system-ui;background:#f6f3ec;color:#1f2933}header{padding:28px 32px;background:#1f3a2e;color:#f4e9c8}main{padding:28px 32px}h1{margin:0 0 8px;font-size:28px}p{line-height:1.7} .card{background:#fff;border:1px solid #e6dfd2;border-radius:12px;padding:16px;margin-top:16px}</style></head><body><header><div>FDE-X Desktop</div><h1>把 IM、AI 和工作区收口在同一屏</h1></header><main><div class="card"><b>唯一入口</b><p>打开即是 IM 母版，功能面板从右侧吸附展开。</p></div><div class="card"><b>工作区隔离</b><p>Agent、会话、记忆、文件和工作流都按项目分开。</p></div></main></body></html>` },
  { id: 'f_dash', name: 'Q3 经营看板.html', kind: 'web', size: 3800, updatedAt: at(10, 8), parentId: 'f_data', content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:ui-sans-serif,system-ui;background:#0f172a;color:#e2e8f0;padding:20px} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px} .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px} .v{font-size:28px;font-weight:700;margin-top:8px} .up{color:#f87171} .bar{height:8px;background:#334155;border-radius:99px;margin-top:10px;overflow:hidden} .bar>i{display:block;height:100%;background:#38bdf8}</style></head><body><h2>Q3 经营看板</h2><div class="grid"><div class="card">本月收入<div class="v up">¥84.2w</div><div class="bar"><i style="width:76%"></i></div></div><div class="card">DAU<div class="v">12,480</div><div class="bar"><i style="width:64%"></i></div></div><div class="card">NPS<div class="v">52</div><div class="bar"><i style="width:52%"></i></div></div></div></body></html>` },
  { id: 'f_ppt', name: 'scene39 路演.pptx', kind: 'ppt', size: 9600, updatedAt: at(9, 24), parentId: 'f_doc', content: JSON.stringify([
    { title: 'FDE-X Desktop', body: '以 IM 为唯一母版的个人桌面工作台' },
    { title: '三个矛盾', body: '入口单一 vs 能力繁多\n模块独立 vs 数据互通\n真业务 vs Demo 体感' },
    { title: '落地形态', body: '工作区隔离 · Agent/Skills 白名单 · 产物就地预览' },
  ]) },
]

export const seedAgents: Agent[] = [
  { id: 'a_main',  name: '主助手',         desc: '通用任务编排 / 写作 / 总结', emoji: '🧠', tools: ['search', 'read_file', 'calendar', 'task', 'memory'], skillIds: ['s_da', 's_im', 's_pp'], status: 'active' },
  { id: 'a_data',  name: '数据分析师',     desc: '查指标 / 出图表 / 写结论',   emoji: '📊', tools: ['sql.run', 'chart.draw', 'csv.read'], skillIds: ['s_da'], status: 'active' },
  { id: 'a_dev',   name: '工程伙伴',       desc: '改 bug / 写脚本 / 解释代码', emoji: '💻', tools: ['code.exec', 'git.diff', 'shell'], skillIds: [], status: 'active' },
  { id: 'a_wri',   name: '文案编辑',       desc: '把模糊想法变成结构化文本',   emoji: '✍️', tools: ['draft.write', 'style.check'], skillIds: ['s_mb', 's_pp'], status: 'paused' },
  { id: 'a_sec',   name: '安全巡检',       desc: '扫风险 / 拍合规 / 提修复',  emoji: '🛡️', tools: ['scan.policy', 'log.read'], skillIds: ['s_ax'], status: 'paused' },
]

export const seedChats: ChatThread[] = [
  {
    id: 'c1', title: 'scene#39 落地思路', agentId: 'a_main', pinned: true, updatedAt: at(11, 40),
    messages: [
      { id: 'm1', role: 'user',      content: '帮我列下 scene#39「个人工作台」要解决的 3 个核心矛盾。', ts: at(11, 30) },
      { id: 'm2', role: 'assistant', content: '1) 入口单一 vs 能力繁多 — 用早报作为唯一入口\n2) 模块独立 vs 数据互通 — 所有模块挂在统一 store 下\n3) 真业务 vs demo 体感 — 用 mock + localStorage 持久化做"看起来真"', ts: at(11, 31) },
      { id: 'm3', role: 'tool', toolName: 'memory.recall', toolResult: '找到 3 条相关记忆: 关于 scene 模板/工作台架构/IM 抢注意力', ts: at(11, 32) },
      { id: 'm4', role: 'assistant', content: '加上 IM 这个点 — 我从记忆里捞到一个老问题:IM 抢走主注意力。所以早报默认应该是低 IM 噪音状态。', ts: at(11, 33) },
      { id: 'm5', role: 'user',      content: '好。把早报做成 IM 静音模式。顺手出一版海报、落地页和路演 PPT。', ts: at(11, 35) },
      {
        id: 'm5b', role: 'assistant', ts: at(11, 40),
        content: '三份产物已经生成，点击卡片就能在会话里预览，也可以转到文件面板继续编辑。',
        artifacts: [
          { id: 'art_poster', kind: 'poster', title: 'scene39 发布海报', subtitle: '900 × 1200 · PNG', fileId: 'f_poster', preview: 'https://placehold.co/900x1200/1F3A2E/F4E9C8?text=FDE-X' },
          { id: 'art_web', kind: 'web', title: '工作台落地页', subtitle: 'HTML · 可直接预览', fileId: 'f_web' },
          { id: 'art_ppt', kind: 'ppt', title: 'scene39 路演', subtitle: '3 页 · PPT', fileId: 'f_ppt' },
        ],
      },
    ],
  },
  {
    id: 'c2', title: 'Q3 收入复盘', agentId: 'a_data', updatedAt: at(10, 5),
    messages: [
      { id: 'm6', role: 'user',      content: '把 Q3 收入拉出来,按周分桶。', ts: at(10, 0) },
      { id: 'm7', role: 'tool', toolName: 'sql.run', toolResult: '13 周时间序列已返回', ts: at(10, 1) },
      { id: 'm8', role: 'assistant', content: 'Q3 周均收入 ¥84.2w,环比 Q2 +6.4%。其中第 10 周(开学季)拉出明显峰值。看板已生成，可直接点开预览。', ts: at(10, 5), artifacts: [{ id: 'art_dash', kind: 'dashboard', title: 'Q3 经营看板', subtitle: '收入 / DAU / NPS', fileId: 'f_dash' }] },
    ],
  },
  {
    id: 'c3', title: 'scene 模板设计', agentId: 'a_wri', updatedAt: at(9, 20),
    messages: [
      { id: 'm9', role: 'user',      content: 'scene 模板需要哪些固定字段?', ts: at(9, 12) },
      { id: 'm10', role: 'assistant', content: '建议至少 5 项: 标签、摘要、触发场景、输出形态、数据依赖。', ts: at(9, 20) },
    ],
  },
]

export const seedIMContacts: IMContact[] = [
  { id: 'im1', kind: 'contact', name: '阿宁', handle: '@anning', avatarColor: '#3D6FC8', online: true, pinned: true, note: '产品搭档' },
  { id: 'im2', kind: 'contact', name: '小航', handle: '@xiaohang', avatarColor: '#C8553D', online: true },
  { id: 'im3', kind: 'contact', name: '林总', handle: '@linzong', avatarColor: '#7C5BC8', online: false },
  { id: 'im4', kind: 'contact', name: '张姐', handle: '@zhang', avatarColor: '#2D9D8F', online: true },
  { id: 'im5', kind: 'contact', name: '王律师', handle: '@wlaw', avatarColor: '#D4A24C', online: false, muted: true },
  {
    id: 'im6', kind: 'topic-group', name: '产品话题群', handle: '6 位成员', avatarColor: '#1A1A1A', online: true,
    pinned: true, ownerId: 'u_self', memberIds: ['u_self', 'im1', 'im2', 'im3', 'im4', 'im5'],
    announcement: '按话题讨论，结论沉淀到对应话题。',
  },
]

export const seedIMTopics: IMTopic[] = [
  { id: 'topic_review', groupId: 'im6', title: '本周产品评审', description: '评审议程、材料和结论', createdBy: 'im2', createdAt: at(9, 20) },
  { id: 'topic_scene40', groupId: 'im6', title: 'scene#40 客户成功看板', description: '需求收集与方案讨论', createdBy: 'im3', createdAt: at(9, 34) },
]

export const seedIMMessages: IMMessage[] = [
  { id: 'mm1', threadId: 'im1', authorId: 'im1', text: 'scene#39 我先看了下,整体方向对的 👍', ts: at(11, 30), read: true },
  { id: 'mm2', threadId: 'im1', authorId: 'u_self', text: '早报那块是个入口,你看下顺不顺', ts: at(11, 32), read: true },
  { id: 'mm3', threadId: 'im1', authorId: 'im1', text: '顺的。我有个点 — 早起应该默认关 IM?', ts: at(11, 33), read: false },
  { id: 'mm4', threadId: 'im2', authorId: 'im2', text: '评审资料我先发你,你看下是否要提前看', ts: at(10, 50), read: false },
  { id: 'mm5', threadId: 'im6', topicId: 'topic_review', authorId: 'im2', text: '今天评审节奏：5 分钟主题 + 10 分钟问答', ts: at(9, 30), read: true },
  { id: 'mm6', threadId: 'im6', topicId: 'topic_scene40', authorId: 'im3', text: '我加一个议题——scene#40 客户成功看板', ts: at(9, 36), read: true },
]

export const seedBusinessTables: BusinessTable[] = [
  {
    id: 'bt_orders',
    name: '订单',
    columns: [
      { key: 'orderId',  label: '订单号',    type: 'text' },
      { key: 'customer', label: '客户',      type: 'text' },
      { key: 'amount',   label: '金额',      type: 'amount' },
      { key: 'status',   label: '状态',      type: 'status' },
      { key: 'date',     label: '日期',      type: 'date' },
    ],
    rows: [
      { id: 'b1', orderId: 'SO-2401', customer: '张老师',     amount: 1280,  status: '已支付',   date: '2026-09-01' },
      { id: 'b2', orderId: 'SO-2402', customer: '王医生',     amount: 480,   status: '已发货',   date: '2026-09-02' },
      { id: 'b3', orderId: 'SO-2403', customer: '林律所',     amount: 3600,  status: '已完成',   date: '2026-09-02' },
      { id: 'b4', orderId: 'SO-2404', customer: '陈校长',     amount: 9800,  status: '已支付',   date: '2026-09-04' },
      { id: 'b5', orderId: 'SO-2405', customer: '小餐饮·李',   amount: 290,   status: '待支付',   date: '2026-09-05' },
      { id: 'b6', orderId: 'SO-2406', customer: '钉钉客户·钱', amount: 5400,  status: '已支付',   date: '2026-09-06' },
      { id: 'b7', orderId: 'SO-2407', customer: '飞书·周',     amount: 1880,  status: '已支付',   date: '2026-09-07' },
      { id: 'b8', orderId: 'SO-2408', customer: '教育·吴',     amount: 720,   status: '已退款',   date: '2026-09-07' },
      { id: 'b9', orderId: 'SO-2409', customer: '零售·郑',     amount: 460,   status: '已发货',   date: '2026-09-08' },
      { id: 'b10', orderId: 'SO-2410', customer: '法律·王律',   amount: 2300,  status: '已支付',   date: '2026-09-08' },
    ],
  },
  {
    id: 'bt_customers',
    name: '客户',
    columns: [
      { key: 'name',  label: '客户名',    type: 'text' },
      { key: 'seg',   label: '分层',      type: 'status' },
      { key: 'owner', label: '负责人',    type: 'text' },
      { key: 'ltv',   label: 'LTV',       type: 'amount' },
      { key: 'last',  label: '最近联系',  type: 'date' },
    ],
    rows: [
      { id: 'c1', name: '张老师',         seg: 'A',  owner: '阿宁',  ltv: 28800, last: '2026-09-08' },
      { id: 'c2', name: '王医生',         seg: 'B',  owner: '小航',  ltv: 5400,  last: '2026-09-07' },
      { id: 'c3', name: '林律所',         seg: 'A',  owner: '我',    ltv: 92800, last: '2026-09-08' },
      { id: 'c4', name: '陈校长',         seg: 'A',  owner: '我',    ltv: 184200, last: '2026-09-04' },
      { id: 'c5', name: '小餐饮·李',       seg: 'C',  owner: '阿宁',  ltv: 1200,  last: '2026-09-05' },
      { id: 'c6', name: '教育·吴',         seg: 'B',  owner: '小航',  ltv: 8400,  last: '2026-09-08' },
    ],
  },
  {
    id: 'bt_products',
    name: '产品',
    columns: [
      { key: 'sku',   label: 'SKU',     type: 'text' },
      { key: 'name',  label: '名称',    type: 'text' },
      { key: 'price', label: '单价',    type: 'amount' },
      { key: 'stock', label: '库存',    type: 'number' },
      { key: 'status',label: '状态',    type: 'status' },
    ],
    rows: [
      { id: 'p1', sku: 'WB-PRO',  name: 'WorkBuddy Pro 席位', price: 99,    stock: 1284, status: '在售' },
      { id: 'p2', sku: 'WB-TEAM', name: '团队版 5 席位',       price: 459,   stock: 230,  status: '在售' },
      { id: 'p3', sku: 'WB-SIGN', name: '电子签增值包',         price: 199,   stock: 0,    status: '补货中' },
      { id: 'p4', sku: 'WB-API',  name: 'API 调用包',           price: 39,    stock: 9999, status: '在售' },
      { id: 'p5', sku: 'WB-EDU',  name: '教育行业模板',         price: 0,     stock: 9999, status: '限免' },
    ],
  },
]

export const seedMCP: MCPServer[] = [
  { id: 'mcp_at',   name: 'GitHub',          desc: '代码托管 / PR / Issue',  status: 'connected', tools: ['pr.list', 'issue.create', 'file.read'], category: '开发' },
  { id: 'mcp_fs',   name: '飞书',            desc: '消息 / 日历 / 文档',       status: 'connected', tools: ['im.send', 'calendar.create'],         category: '协作' },
  { id: 'mcp_fs2',  name: 'Agent Mail',      desc: '智能体邮箱',                status: 'connected', tools: ['mail.send', 'mail.read'],               category: '通讯' },
  { id: 'mcp_wp',   name: 'WeCom',           desc: '企业微信工作台',            status: 'disconnected', tools: ['wecom.send', 'wecom.contact'],     category: '协作' },
  { id: 'mcp_es',   name: 'eSign · 腾讯电子签', desc: '合同签 / 模板',          status: 'disconnected', tools: ['sign.template', 'sign.send'],        category: '法务' },
  { id: 'mcp_db',   name: 'DataBuddy',       desc: '查询指标 / 拉数',           status: 'pending', tools: ['metric.read', 'sql.run'],               category: '数据' },
  { id: 'mcp_map',  name: '腾讯地图',         desc: '地理 / 路线 / POI',         status: 'disconnected', tools: ['geo.route', 'poi.search'],        category: '工具' },
]

export const seedSkills: Skill[] = [
  { id: 's_mb',   name: '电商爆款文案',       emoji: '🛒', desc: '为淘宝/抖音生成高转化商品文案',         enabled: true,  triggers: ['电商文案','产品描述'], source: 'user' },
  { id: 's_fa',   name: '合同审查',          emoji: '📜', desc: '识别合同条款风险,生成审查意见',         enabled: true,  triggers: ['合同','审查','法务'], source: 'user' },
  { id: 's_da',   name: '数据早报',          emoji: '📈', desc: '拉昨日核心指标,生成自然语言摘要',       enabled: true,  triggers: ['数据','日报','指标'], source: 'builtin' },
  { id: 's_pp',   name: 'PPT 大纲',          emoji: '📑', desc: '由主题/受众/场景生成结构化大纲',        enabled: false, triggers: ['PPT','汇报','大纲'], source: 'builtin' },
  { id: 's_ax',   name: '风险预警',          emoji: '⚠️', desc: '扫描持仓 / 财报 / 公告,出预警清单',      enabled: true,  triggers: ['风险','预警','合规'], source: 'marketplace' },
  { id: 's_rc',   name: '招聘 JD 改写',      emoji: '🧑‍💼', desc: '把岗位描述整理为结构化、可读版',           enabled: false, triggers: ['招聘','HR','JD'], source: 'builtin' },
  { id: 's_im',   name: 'IM 语气优化',        emoji: '💬', desc: '把过激或冷漠的文字改成建设性表达',         enabled: true,  triggers: ['沟通','IM','反馈'], source: 'user' },
]

export const seedNotifications: Notification[] = [
  { id: 'n1', kind: 'warning', title: '任务 #t5 即将到期', body: '9 月 14 日需完成 8 月差额对账', ts: at(9, 0),  href: '/tasks' },
  { id: 'n2', kind: 'info',    title: '法大大合同待续签',    body: '原合同 9 月 12 日到期', ts: at(8, 30),         href: '/tasks' },
  { id: 'n3', kind: 'success', title: 'scene#39 demo 已构建',  ts: at(11, 50),                                  href: '/briefing' },
  { id: 'n4', kind: 'error',   title: 'Agent "安全巡检" 已暂停', body: '请在管理页确认', ts: at(10, 0),               href: '/agents' },
  { id: 'n5', kind: 'info',    title: '业务连接待在设置中启用',   ts: at(8, 0), href: '/settings' },
]

export const seedNews: NewsItem[] = [
  { id: 'nw1', title: 'AI 行业 · 月活突破 4.2 亿', source: '36 氪',  category: 'market', ts: at(7, 30), delta: 0.082 },
  { id: 'nw2', title: '团队通知 · 本周三产品评审', source: '内部',    category: 'team',   ts: at(8, 30) },
  { id: 'nw3', title: '产品 · scene#40 进入规划', source: 'WorkBuddy', category: 'product', ts: at(10) },
  { id: 'nw4', title: '系统 · MCP 新增 2 个服务', source: '平台',    category: 'system', ts: at(8, 50) },
]

export const seedMetrics: MetricCard[] = [
  { id: 'm_dau',  label: '今日 DAU',     value: 12480, delta: 0.082, hint: '环比昨日', unit: '人' },
  { id: 'm_ret',  label: '7 日留存',     value: 0.42,  delta: 0.020, hint: 'D7/D0',   unit: '' },
  { id: 'm_rev',  label: '本月收入',     value: '¥84.2w', delta: 0.064, hint: '环比上月' },
  { id: 'm_nps',  label: 'NPS',          value: 52,    delta: 3,     hint: '较上季 +6' },
  { id: 'm_open', label: '待我处理',     value: 17,    delta: -0.04, hint: '任务 + IM + 审批', unit: '项' },
  { id: 'm_deep', label: '深度专注',     value: '3h 42m', delta: 0.12, hint: '本周累计', unit: '' },
]

export const seedWorkflows: Workflow[] = [
  {
    id: 'wf_daily_standup',
    name: '每日站会提醒',
    description: '工作日 09:00 推到 IM「产品群」,拉一下昨日产出 + 今日计划',
    status: 'active',
    trigger: { kind: 'cron', expr: '0 9 * * 1-5', tz: 'Asia/Shanghai' },
    steps: [
      { id: 'ws1', kind: 'data.query',    label: '拉昨天任务完成',     config: { table: 'tasks', filter: 'status=done&date=yesterday' } },
      { id: 'ws2', kind: 'memory.add',    label: '写入日记忆',         config: { scope: 'daily' } },
      { id: 'ws3', kind: 'im.send',       label: '发到 IM「产品群」', config: { threadId: 'im6' } },
    ],
    lastRunAt: at(9, 0), lastRunStatus: 'success',
    category: 'im', emoji: '🌅', createdAt: at(7, 0),
  },
  {
    id: 'wf_q3_close',
    name: '合同到期自动提醒',
    description: '每早 08:00 扫描合同表,有 30 天内到期则发 IM 提醒',
    status: 'active',
    trigger: { kind: 'cron', expr: '0 8 * * *' },
    steps: [
      { id: 'ws1', kind: 'data.query',  label: '扫描合同到期',         config: { table: 'customers', window: '30d' } },
      { id: 'ws2', kind: 'im.send',     label: '推送至我的 IM',       config: { threadId: 'im_self' } },
    ],
    lastRunAt: at(8, 0), lastRunStatus: 'success',
    category: 'data', emoji: '📜', createdAt: at(7, 0),
  },
  {
    id: 'wf_keyword_quote',
    name: 'IM 拟回 → AI 自动起草',
    description: '在 IM 输入栏点「拟回」,自动打开 AI 助手并基于当前会话起草回复',
    status: 'paused',
    trigger: { kind: 'keyword', patterns: ['拟回', '摘要', '问本机'] },
    steps: [
      { id: 'ws1', kind: 'im.send',     label: '回 IM 确认收到',     config: {} },
      { id: 'ws2', kind: 'tool.call',   label: '唤起 AI 助手',       config: { agentId: 'a_wri' } },
    ],
    lastRunAt: at(10, 30), lastRunStatus: 'success',
    category: 'im', emoji: '✨', createdAt: at(7, 0),
  },
  {
    id: 'wf_morning_brief',
    name: '早报自动生成',
    description: '07:30 拉昨日指标 / 任务 / 日程,生成结构化早报入记忆',
    status: 'active',
    trigger: { kind: 'cron', expr: '30 7 * * *' },
    steps: [
      { id: 'ws1', kind: 'data.query',  label: '汇总昨日指标',         config: {} },
      { id: 'ws2', kind: 'tool.call',   label: 'AI 生成早报文本',     config: { agentId: 'a_main' } },
      { id: 'ws3', kind: 'memory.add',  label: '落入早报记忆',         config: { scope: 'daily', title: '早报' } },
    ],
    lastRunAt: at(7, 30), lastRunStatus: 'success',
    category: 'memory', emoji: '📰', createdAt: at(7, 0),
  },
  {
    id: 'wf_file_autosave',
    name: '文件保存自动加版本',
    description: '当文件保存时自动追加版本说明到历史',
    status: 'active',
    trigger: { kind: 'event', on: 'file.save' },
    steps: [
      { id: 'ws1', kind: 'file.write',  label: '归档到版本库',         config: { maxVersions: 20 } },
    ],
    category: 'file', emoji: '🗂️', createdAt: at(7, 0), lastRunAt: at(11, 35), lastRunStatus: 'success',
  },
]

// =======================================================
//      副业电商 workspace 专属种子 (ws_biz)
// =======================================================

export const seedBizAgents: Agent[] = [
  { id: 'a_biz_cs',    name: '客服助手',   emoji: '💁', desc: '回复客户咨询 / 识别购买意向 / 催付',          tools: ['chat.reply', 'order.lookup'], skillIds: ['s_im'], status: 'active' },
  { id: 'a_biz_pr',    name: '选品参谋',   emoji: '🔎', desc: '扫爆款 / 对比竞品 / 算毛利 / 出备货建议',      tools: ['trend.scan', 'margin.calc', 'stock.check'], skillIds: ['s_da'], status: 'active' },
  { id: 'a_biz_mkt',   name: '营销文案',   emoji: '✍️', desc: '朋友圈/小红书种草文/详情页卖点/活动文案',     tools: ['draft.write', 'style.check', 'image.suggest'], skillIds: ['s_mb', 's_pp'], status: 'active' },
  { id: 'a_biz_fin',   name: '财务对账',   emoji: '💰', desc: '每日对账 / 异常账单 / 提现节奏',              tools: ['txn.reconcile', 'flag.anomaly'], skillIds: ['s_da'], status: 'paused' },
]

export const seedBizChats: ChatThread[] = [
  {
    id: 'cb1', title: '本周哪 3 个 SKU 要补货?', agentId: 'a_biz_pr', pinned: true, updatedAt: at(11, 20), workspaceId: WS_BIZ,
    messages: [
      { id: 'b_m1', role: 'user',      content: '看下 9 月 1-8 日销量,按 SKU 排序,告诉我前 3 个最该补货的。', ts: at(11, 10) },
      { id: 'b_m2', role: 'tool', toolName: 'sql.run', toolResult: '返回 38 个 SKU 的销量/库存/毛利', ts: at(11, 11) },
      { id: 'b_m3', role: 'assistant', content: '前 3 补货 SKU:\n1)「无火香薰」库存 5,日均 4.2,3 天断货 → 至少补 20\n2)「便携茶具」库存 12,日均 3.8,毛利 41% → 补 30\n3)「桌面摆件·龙」库存 8,日均 1.6,但毛利 58% → 补 15', ts: at(11, 20) },
    ],
  },
  {
    id: 'cb2', title: '客户退款 SOP', agentId: 'a_biz_cs', updatedAt: at(10, 30), workspaceId: WS_BIZ,
    messages: [
      { id: 'b_m4', role: 'user',      content: '客户说收到货破损,怎么办?', ts: at(10, 25) },
      { id: 'b_m5', role: 'assistant', content: '1) 道歉 + 不扯皮,直接问"补发 or 退款"\n2) 让客户发 1 张实物图 + 订单号\n3) 后台 5 分钟内完成登记\n4) 24h 内出方案,主动告知物流', ts: at(10, 30) },
    ],
  },
  {
    id: 'cb3', title: '朋友圈种草文 · 龙舟摆件', agentId: 'a_biz_mkt', updatedAt: at(9, 50), workspaceId: WS_BIZ,
    messages: [
      { id: 'b_m6', role: 'user',      content: '帮我写一条 200 字内的朋友圈,目标:25-35 岁女性,端午前置入。', ts: at(9, 45) },
      { id: 'b_m7', role: 'assistant', content: '【端午 · 把家过成节】\n摆这只小龙舟,粽香和木纹一起醒过来。\n手工榉木,底座可写名字,可代写心意卡。\n📦 顺丰当日发 · 礼盒装\n#端午 #家居美学', ts: at(9, 50) },
    ],
  },
  {
    id: 'cb4', title: '本月毛利异常', agentId: 'a_biz_fin', updatedAt: at(8, 30), workspaceId: WS_BIZ,
    messages: [
      { id: 'b_m8', role: 'assistant', content: '本月 1 笔异常:9 月 4 日订单 SO-2404 退款的 9800 元未冲减成本,建议立即调整。', ts: at(8, 30) },
    ],
  },
  {
    id: 'cb5', title: '客服话术:催付', agentId: 'a_biz_cs', updatedAt: at(7, 40), workspaceId: WS_BIZ,
    messages: [
      { id: 'b_m9', role: 'user',      content: '客户已下单 2 小时没付款,怎么催不惹人烦?', ts: at(7, 35) },
      { id: 'b_m10', role: 'assistant', content: '话术 3 选 1,别直接催:\n①「库存只剩 3 件,怕你等,我先帮你留意着」\n②「顺丰今天 16:00 截单,付了我马上发」\n③「附赠的小样我先留着,等你确认」', ts: at(7, 40) },
    ],
  },
]

export const seedBizFiles: FileNode[] = [
  { id: 'fb_root', name: '我的小店',           kind: 'folder', size: 0,   updatedAt: at(8),  parentId: null, workspaceId: WS_BIZ },
  { id: 'fb_inv',  name: '库存',               kind: 'folder', size: 0,   updatedAt: at(8),  parentId: 'fb_root', workspaceId: WS_BIZ },
  { id: 'fb_doc',  name: '客户',               kind: 'folder', size: 0,   updatedAt: at(8),  parentId: 'fb_root', workspaceId: WS_BIZ },
  { id: 'fb_mkt',  name: '营销',               kind: 'folder', size: 0,   updatedAt: at(8),  parentId: 'fb_root', workspaceId: WS_BIZ },
  { id: 'fb_inv1', name: '在售 SKU 清单.xlsx', kind: 'sheet',  size: 8400, updatedAt: at(11), parentId: 'fb_inv',
    content: 'SKU / 名称 / 库存 / 进价 / 售价 / 毛利 / 日均销量 / 状态\nSKU001 / 无火香薰 / 5 / 78 / 158 / 51% / 4.2 / 补货\nSKU002 / 便携茶具 / 12 / 168 / 285 / 41% / 3.8 / 补货\nSKU003 / 桌面摆件·龙 / 8 / 220 / 520 / 58% / 1.6 / 正常\nSKU004 / 木质书签 / 32 / 12 / 28 / 57% / 5.0 / 正常\nSKU005 / 布艺手提袋 / 21 / 35 / 78 / 55% / 2.4 / 正常',
    workspaceId: WS_BIZ },
  { id: 'fb_doc1', name: '退换货登记表.md',    kind: 'markdown', size: 2400, updatedAt: at(10), parentId: 'fb_doc',
    content: '# 退换货登记\n\n## 9 月\n- 9/4 SO-2404 陈校长  退款 9800 / 实物破损 → 补发 + 全额退款\n- 9/5 SO-2405 小餐饮·李 待支付 7 天后自动关闭\n- 9/7 SO-2408 教育·吴 退款 720 / 错发颜色 → 重新发货已发',
    workspaceId: WS_BIZ },
  { id: 'fb_mkt1', name: '朋友圈素材库.md',   kind: 'markdown', size: 3200, updatedAt: at(9),  parentId: 'fb_mkt',
    content: '# 朋友圈素材库\n\n## 端午(已发)\n- 「把家过成节」+ 龙舟摆件配图(陈姐家)\n- 客户返图 3 张,均已 @ 致谢\n\n## 中秋(规划中)\n- 9/20 预热:茶具+月饼组合\n- 主推:「团圆局」摆件',
    workspaceId: WS_BIZ },
  { id: 'fb_mkt2', name: '客户分层.png',       kind: 'image',    size: 240000, updatedAt: at(7), parentId: 'fb_mkt',
    content: 'PNG · 客户金字塔 · 钻石 12 / 黄金 38 / 白银 64', workspaceId: WS_BIZ },
]

export const seedBizWorkflows: Workflow[] = [
  {
    id: 'wf_biz_daily', name: '小店每日对账', description: '每晚 22:00 拉订单/退款/库存差异,生成日报入记忆',
    status: 'active', trigger: { kind: 'cron', expr: '0 22 * * *' },
    steps: [
      { id: 'wbs1', kind: 'data.query', label: '汇总当日订单/退款', config: { table: 'bt_orders', filter: 'date=today' } },
      { id: 'wbs2', kind: 'tool.call',  label: 'AI 生成对账结论',   config: { agentId: 'a_biz_fin' } },
      { id: 'wbs3', kind: 'memory.add', label: '写入日记忆',         config: { scope: 'daily' } },
    ],
    category: 'data', emoji: '💰', createdAt: at(7, 0), lastRunAt: at(22, 0), lastRunStatus: 'success', workspaceId: WS_BIZ,
  },
  {
    id: 'wf_biz_lowstock', name: '低库存自动预警', description: '任意 SKU 库存 < 5 时,推 IM + 写入待办',
    status: 'active', trigger: { kind: 'event', on: 'order.new' },
    steps: [
      { id: 'wbs4', kind: 'data.query', label: '扫描低库存 SKU',     config: { table: 'products', filter: 'stock<5' } },
      { id: 'wbs5', kind: 'im.send',    label: '推 IM 提醒',         config: { threadId: 'im_self' } },
    ],
    category: 'data', emoji: '📦', createdAt: at(7, 0), workspaceId: WS_BIZ,
  },
  {
    id: 'wf_biz_aftercs', name: '客服自动跟进', description: '客户咨询后 30 分钟未回复,自动跟进 1 次',
    status: 'paused', trigger: { kind: 'event', on: 'im.received' },
    steps: [
      { id: 'wbs6', kind: 'tool.call',  label: '检查 30 分钟无回复', config: { window: '30m' } },
      { id: 'wbs7', kind: 'im.send',    label: '发送跟进话术',       config: { template: 'biz_followup' } },
    ],
    category: 'im', emoji: '💁', createdAt: at(7, 0), workspaceId: WS_BIZ,
  },
]
