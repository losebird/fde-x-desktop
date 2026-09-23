# 06 · 可自定义早报 + 外部信息源（早报 agent + MCP）

依赖：01（事件）、02（`askAiForResult`、`fde_briefing_submit`、`fde-briefing` preset 骨架）、03（待办源）、07（记忆源，可后接）。协议：`00-agent-protocol.md`。

## 1. 目标

早报从「几块写死的空卡片」变成：用户定义区块与信息源（内部：待办 / 日程 / 未读 IM / 业务待审 / 记忆当日卡 / 应用 stat；外部：邮箱、RSS 等 MCP 源）→ 按计划或手动由「早报 agent」采集与摘要 → 结构化落库 → 页面渲染 → 每条可跳原处 → 发往 IM / 保存记忆用真实内容。

## 2. 范围与禁区

- 做：`briefing_definitions` / `briefings` 接线；自定义抽屉；源适配器（内部源在 BFF 直读；外部源由 agent 用 MCP 工具采集）；轻调度；`fde-briefing` preset 的 Skill；渲染与跳转。
- 不做：BFF 自己出网拉邮件/RSS；推送通知；多早报模板市场。
- 禁区：不改早报页整体布局（区块顺序可由定义控制，但组件外观沿用现有卡片）；不删现有区块组件，改为由定义驱动显隐。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| 表 | `002_modules.sql` L258–281 `briefing_definitions(sources_json, sections_json, schedule_json)`、`briefings`；零 API |
| 页面 | `Briefing.tsx`：顶栏 L83–107（「今日」死按钮 L88，副标题假定静音 L85）、指标 L111–120（`metrics=[]` 消失）、三件事/逾期/时间线 L125–227、AI 卡 L232–271（写死 scene#39 L244/L263，`draftMemoryCard` 静默 L264）、通知 L274–299、未读 IM L302–320、新闻 L323–342、快捷 L345–368 |
| 类型 | `types.ts` L272–299 `Notification/NewsItem/MetricCard`；`contracts.ts` `BriefingPort` 仅类型 |
| store | `app.ts` L272–274 `metrics/news/notifications = []`；`seed.ts` L298–311 未引用 |
| 待办源 | 规格 03 API |
| 未读 IM | `imState`（规格 01 事件 `im.unread.changed`） |
| 业务待审 | `biz_preview(现查, kind=待审型)`（规格 05 `/biz/kinds`） |
| 记忆 | `GET /api/v1/memory/cards`（`list_memory_cards`）、`POST /find`；规格 07 |
| MCP | MCP 页写 `dsh-core.patch.yml`（`server.mjs` L2218–2240）；官方传输 stdio / streamable-http；候选 server：`andrewmalov/mcp-imap`、`Txtus/mail-mcp`、`kwp-lab/rss-reader-mcp`、`lionkiii/rss-feeds-mcp` |
| 调度 | BFF 无 cron，仅 `setInterval`（Ace 已解禁 schedule） |

## 4. 数据模型

`briefing_definitions`（沿用现有列；缺则 `008_briefing.sql` 加）：

```json
// sections_json：有序数组
[
  { "id": "tasks-today", "type": "tasks", "title": "今日三件事", "enabled": true, "render": "list", "params": { "limit": 3, "status": ["todo","doing"] } },
  { "id": "im-unread",   "type": "im",    "title": "未读 IM",     "enabled": true, "render": "list" },
  { "id": "biz-pending", "type": "biz",   "title": "待审批",      "enabled": true, "render": "list", "params": { "connectionId": "…", "kind": "采购单", "action": "现查", "filter": { "状态": "待审" } } },
  { "id": "memory-daily","type": "memory","title": "昨日记忆",    "enabled": true, "render": "list", "params": { "layer": "daily", "limit": 5 } },
  { "id": "app-stat-1",  "type": "app",   "title": "本周拜访",    "enabled": true, "render": "stat", "params": { "slug": "supplier-visits", "viewId": "stat-week" } },
  { "id": "mail",        "type": "mcp",   "title": "重要邮件",    "enabled": false,"render": "digest", "params": { "server": "imap", "tool": "list_unread", "args": { "folder": "INBOX", "limit": 20 }, "summarize": true } },
  { "id": "news",        "type": "mcp",   "title": "行业资讯",    "enabled": false,"render": "digest", "params": { "server": "rss", "tool": "fetch", "args": { "feeds": ["https://…"] }, "summarize": true } },
  { "id": "ai-digest",   "type": "ai",    "title": "AI 早报",     "enabled": true, "render": "digest" }
]
// schedule_json
{ "at": "08:30", "days": [1,2,3,4,5], "onOpen": true, "tz": "Asia/Shanghai" }
// sources_json：连接器/MCP 引用（供校验与展示）
[{ "type": "mcp", "server": "imap" }, { "type": "biz", "connectionId": "…" }]
```

`briefings`：`id, definition_id, workspace_cwd, generated_at, status('running'|'ready'|'partial'|'failed'), sections_json（每块：{id, title, render, items:[{text, href?, ref?}], stat?, error?, fetchedAt}), summary, session_id`。

区块 `type` 闭集：`tasks | events | im | biz | memory | app | mcp | ai`。`render` 闭集：`list | stat | digest | timeline`。

## 5. API 契约（`runtime/routes/briefing.mjs`）

| 路由 | 说明 |
|---|---|
| `GET /api/v1/briefing/definition?workspace` | 无则返回默认定义（§4 前 5 块 + ai-digest，外部源 disabled） |
| `PUT /api/v1/briefing/definition` | `{ workspaceCwd, sections, schedule, sources }` → 校验闭集 → 保存 → 重排调度 |
| `POST /api/v1/briefing/run` | `{ workspaceCwd, definitionId?, mode:'full'|'internal-only' }` → 建 `briefings(running)` → 执行 §6 → 返回 `{ briefingId }`；完成 `emit('briefing.ready')` |
| `GET /api/v1/briefing/latest?workspace` | 最新一份（含 status） |
| `GET /api/v1/briefing/:id` | |
| `POST /api/v1/bridge/briefing-submit` | 规格 02 工具后端：`{ requestId, sections }` → 合并进对应 `briefings` 的 mcp/ai 区块 |
| `GET /api/v1/briefing/sources/mcp?workspace` | 从 MCP 配置列出可用 server 与工具（供抽屉下拉） |

## 6. 生成流程（BFF `runtime/briefing/run.mjs`）

1. **内部源直采**（BFF 内、确定性、<2s）：`tasks/events` → 规格 03 API；`im` → lan-assist `/state`；`biz` → `biz_preview(现查)`；`memory` → `list_memory_cards` + 可选 `find`；`app` → 规格 04 `/apps/:slug/stats/:viewId`。每块独立 try/catch，失败写该块 `error`，不影响其它块。
2. **外部源 + AI 摘要**（仅 `mode:'full'` 且存在 enabled 的 `mcp`/`ai` 块）：`askAiForResult({ preset:'fde-briefing', title:'早报 · <日期>', intent:'生成早报', context:['workspace'], prompt: <包含内部源结果摘要 + 每个 mcp 块的 server/tool/args + 要求用 fde_briefing_submit 提交 sections>, timeoutMs: 180000 })`。agent 用 MCP 工具拉邮件/RSS，按 `summarize` 做摘要，`ai` 块给整体一段话。
3. 合并 → `status = ready`（全成功）/ `partial`（有块 error）/ `failed`（内部源全失败且 AI 超时）。
4. **调度**：BFF 启动读所有 definition 的 `schedule`，`setInterval(60s)` 检查到点则 `run(full)`；`onOpen` 时前端打开早报若今天没跑过则触发 `run(internal-only)`（快）+ 后台 `full`。DSH 未连时只跑 internal-only。

## 7. 前端契约

- `Briefing.tsx` 改为**定义驱动**：读 `latest` 渲染 `sections`（区块组件按 `render` 选：现有卡片外观）；每个 item 有 `href`/`ref` 时可点跳（任务 → 计划面板高亮；IM → 打开会话；biz → 记录 Tab 该 kind；memory → 记忆页卡片；app → 应用视图）。
- 顶部：日期 + 「生成新早报」（= `run(full)`，按钮转圈，完成后刷新）+ 「自定义」（抽屉）+ 状态小字「08:30 自动 · 上次 07:58 · 邮箱源失败」。删「今日」死按钮；副标题去掉静音假设。
- **自定义抽屉**（`src/components/briefing/BriefingSettingsDrawer.tsx`）：区块列表（开关、上下移、标题可改）、每块参数（按 type 显示：biz 选连接器+型+筛选；app 选应用+stat 视图；mcp 选 server+tool+args JSON；memory 选层与条数）、调度（时间、星期、打开时刷新）、「保存」。新增区块按钮列出 8 种类型。
- 指标行：由 `render:'stat'` 块组成；没有 stat 块 → 不渲染指标行（不再显示 —）。
- AI 卡：显示 `ai` 块正文；「发往 IM」= `imCompose` 正文为 AI 块 + 各块要点（放入输入框，人点发）；「保存到记忆」= `draftMemoryCard`（规格 07），失败上黄条。
- 外部源块失败：卡片内显示「邮箱源 2 小时前失败：<message>」+「重试」。

## 8. Skill `fde-briefing`（`runtime/presets/fde-briefing/skills/fde-briefing/SKILL.md`）

要点：只做采集与摘要，不执行业务动作、不发 IM；对每个 mcp 块调用指定 server/tool，失败就在该块写 `error` 继续下一块；摘要中文、每块 ≤5 条、每条带来源链接（邮件 message-id / 文章 URL）；最后 `fde_briefing_submit(requestId, sections)`；不得编造条目。

## 9. 错误与降级

- DSH 未连：只 internal-only，AI 块显示「核心未连接，仅内部信息」。
- MCP server 未配置：抽屉里该块提示「先在 MCP 页添加 imap 服务器并重载核心」，块自动 disabled。
- agent 超时：`partial`，mcp/ai 块标「超时」，可「重试外部源」。
- 定义校验失败：422 逐条。

## 10. 验收清单

人工（5175）：
1. 早报首次打开 → 默认定义 → 内部块有数据（待办来自规格 03、未读 IM 真实）；指标行不显示。
2. 自定义 → 关掉「昨日记忆」、把「未读 IM」移到最上 → 保存 → 页面顺序变化 → 刷新保持。
3. 加一个 `app` stat 块（规格 04 的应用）→ 指标行出现该数字。
4. MCP 页添加 RSS server（`kwp-lab/rss-reader-mcp`）→ 重载核心 → 自定义里加「行业资讯」块 → 生成新早报 → 左栏出现「早报 · 日期」会话 → 卡片出现 ≤5 条带链接的条目。
5. 故意填错 feed URL → 该块显示失败 + 重试，其它块正常，状态 `partial`。
6. 设调度 2 分钟后 → 到点自动生成（`briefings` 新增一条；`briefing.ready` 事件）。
7. 「发往 IM」→ 输入框出现真实早报正文，不含 scene#39；人不点发送则不发。
8. 5174 回归：早报页可打开，显示默认定义。

自动化：`runtime/tests/briefing.test.mjs`：定义校验闭集；默认定义；internal-only run 各块独立失败；调度触发（注入假时钟）；`briefing-submit` 合并。

## 11. 提交拆分

1. `feat(runtime): briefing definitions/briefings routes + defaults`
2. `feat(runtime): internal source collectors + run(internal-only)`
3. `feat(runtime): scheduler + onOpen`
4. `feat(runtime): briefing agent run(full) via askAiForResult + bridge submit`
5. `feat(presets): fde-briefing skill`
6. `feat(web): definition-driven Briefing render + item links`
7. `feat(web): BriefingSettingsDrawer`
8. `fix(briefing): remove scene#39 templates, dead 今日 button, mute assumption`

## 12. 开放问题

- `biz` 块的「待审」筛选依赖词表里有状态字段；没有则该块显示「此型无待审字段」。
