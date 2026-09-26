# FDEX 规格事实勘误（scene-39-personal-workstation @ main，只读）

规格源：`…/files/docs/specs/00–09` + README。代码根：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`。

## 接点勘误

| 规格 | 原文 | 实际 | 处置 |
|------|------|------|------|
| 01 | `outbox_events` 在 `002_modules.sql` | 表在 `001_core.sql` L66–80 | 改文件名 |
| 01 | `listPendingEvents` ~L2288 | `GET /api/v1/events/pending` L2305–2308；函数 `db.mjs` L228 | 改行号 |
| 01 | `GET /api/v1/events`、`/recent` | 仅 `/api/v1/events/pending` | 需新建 |
| 01 | `runtime/events.mjs`、`src/lib/events.ts` | 目录无 `runtime/routes/`；无 `events.ts` | 需新建 |
| 01 | `ai-stream.mjs` L46–85 为 `ai.tool.called` 源 | L46–85 为 trace 文案；无 `ai.tool.called` 发射 | 改描述+需新建 |
| 01 | Origin ~L198、L888–894 | `allowedOrigins` L210；CORS 闸 L868+、L900+ | 改行号 |
| 01 | `createServer` 路由表 ~L853–886 | `createServer` L862；内联巨型 handler | 改行号 |
| 01 | `GET /api/v1/im/state` ~L1805 | L1824–1827 代理 `lanAssist('/state')` | 改行号 |
| 02 | bridge Host L102–139 | `handler`+`webServer.register` L102–141；`PREFIX='/fde-session'` | 改行号；路径无误 |
| 02 | `runtime/fde-x-dsh-bridge/lib/tools.js`、Cordis 注册 | bridge 包无 `tools.js`/`ctx.tools.register` | 需新建 |
| 02 | `POST /api/v1/bridge/*`、`ask-ai.ts`、`005_ai_results.sql` | 均不存在 | 需新建 |
| 02 | `POST /api/v1/ai/sessions` ~L1432–1436 | L1438–1456，`agentPreset` L1450 | 改行号 |
| 03 | 表 `events`（§4） | DB 表名 `calendar_events` L125–138；store 字段仍叫 `events` L263 | 改名映射 |
| 03 | `app.ts` tasks L490–501、partialize L798–834 | `buildInitial` tasks L262；`partialize` L872–883；migrate 删 tasks L904 | 改行号 |
| 03 | `runtime/routes/plan.mjs`、`006_plan_columns.sql` | 不存在 | 需新建 |
| 04 | `server.mjs` business L2292–2342 | apps L2317–2338+；`createBusinessApp` `db.mjs` L296 | 改行号 |
| 04 | `db.mjs` `execControlledDdl` | 无此函数 | 需新建 |
| 04 | `runtime/apps/*`、`src/components/apps/*` | 不存在 | 需新建 |
| 05 | BFF catalog 读 `/state.catalog` | `GET /api/v1/biz/catalog` L1718–1722 取 `state.catalog`（来自 `/state` 的 `viewOf`） | 改措辞 |
| 05 | `biz` 闸 L1682–1770 | `preview` L1701–1715；`catalog` L1718+；`write` L1781+ | 改行号 |
| 05 | operations L2419–2508 | approve L2393–2410；execute L2413–2435；POST L2438–2517 | 改行号 |
| 05 | `db.mjs` L507–592 | `approveOperation` L507；`executeDryRun` L546 | 改行号（上界） |
| 05 | `biz_surfaces`、`RecordsPanel`、`routes/biz.mjs` | 不存在 | 需新建 |
| 06 | `briefing_definitions`/`briefings` L258–281 | `002_modules.sql` L258–281 仍存在 | 无误 |
| 06 | `runtime/routes/briefing.mjs`、`008_briefing.sql` | 不存在 | 需新建 |
| 07 | `dsh-core.mjs` 白名单 L598–646 | 现为 `prepareCredentialsCopy` L606–630；语义闸 `semanticOs` L730–780 | 改行号 |
| 07 | `POST /api/v1/context/pack`、`context-pack.ts` | 不存在 | 需新建 |
| 07 | `memory/search` L1792+ | 存在；`/find` 经 `semanticOs('/find')` L780+ | 部分无误 |
| 08 | presets `server.mjs` L1253–1282 | L1262–1291 | 改行号 |
| 08 | `routes/presets.mjs`、tests | 不存在 | 需新建 |
| 09 | `parseAllowedOrigins` 在 `server.mjs` | 在 `runtime/config.mjs` L93–111 | 改文件 |
| 09 | `FDE_STATIC_DIR` SPA、`FDE_LISTENING` | `server.mjs` 无；仅有附件 `createReadStream` L2210 | 需新建 |
| 09 | `apps/desktop/` | 不存在 | 需新建 |
| 09 | 监督 `server.mjs` L16–29 | `scheduleRuntimeRestart` L16–29 | 无误 |
| 09 | `osascript` L34 | `pickLocalDirectory` L32–37 | 改行号 |

## 规格间同波次文件冲突（README 波次表）

| 波次 | 规格对 | 共享文件 | 说明 |
|------|--------|----------|------|
| 1 | 01 + 08 | `runtime/server.mjs` | 仅允许加 import/挂载行；两份都要挂路由 |
| 3 | 04 + 05 | `src/pages/Data.tsx`、`runtime/db.mjs`、`server.mjs`（biz/business 段） | 并行规则写「不共享文件」；实际重叠，需串行或拆分文件 |
| 3 | 04 + 07 | `runtime/server.mjs` | 07 加记忆路由；04 挂 apps |
| 4 | 06 + 03补 | `Briefing.tsx`、可能 `Plan.tsx`/`IMWorkspace` | 06 改早报；03 补「整理待办」 |

## 开放问题（事实答案）

### 02 · Cordis Host 工具注册 API

- **生产模板（lan-assist）**：`~/.dsh/vendor/dsh-lan-assist/tools.js` L25–128：`export function registerTools(ctx, { defineTool }, secretary) { ctx.tools.register(defineTool({ name, description, parameters, execute, … })) }`；`biz_describe` 样例 L106–128。
- **dsh-tool-cordis**：`/opt/homebrew/.../dsh-tool-cordis` 为 **动态插件 inspect/define**（skill `cordis-plugin-development` L15–44：`cordis_define` + `code.host`），**不是** `ctx.tools.register` 静态形态。
- **结论**：Host 侧静态工具跟 lan-assist；动态 Cordis 包走 inspect 流程。bridge 工具需新建模块并按 lan-assist 形态注册。

### 03 · `002_modules.sql` 计划表

| 逻辑名 | 真实表名 | 主要列 |
|--------|----------|--------|
| tasks | `tasks` | id, workspace_id, title, notes, status, priority, due_at, completed_at, metadata_json, created_at, updated_at |
| events | **`calendar_events`** | id, workspace_id, title, start_at, end_at, timezone, location, event_kind, metadata_json, created_at, updated_at |
| workflows | `workflows` | id, workspace_id, name, status, trigger_json, definition_json, revision, created_at, updated_at |
| （关联） | `workflow_runs` / `workflow_run_steps` | 见 L163–187 |

### 05 · `biz_describe` 与 catalog

- **HTTP**：`biz_describe` **无**独立 HTTP 路径；`http.js` 提供 `GET /catalog` L93–103（`secretary.describeBiz`），等价能力。
- **DSH 工具**：`tools.js` `biz_describe` L106–128。
- **BFF 已用**：`GET /api/v1/biz/catalog` 读 `lanAssist('/state')` 的 **`catalog` 数组**（`view.js` `viewOf` L340 `catalog: catalogOf(safe)`）；元素形态见 `catalog.js` `buildCatalog` L167+（`name,speak,system,env,write,nod`）。**不是**嵌套字段 `state.catalog` 字符串路径，而是 `/state` JSON 顶层的 `catalog`。

### 07 · semantic-os 工具入参

（`~/.dsh/vendor/dsh-semantic-os/tools.js`）

- `find_precedents` L348–353：`scenario`（必填 string），`max_results`（integer，默认 5）
- `brief_for_decision` L483–488：`scenario`（必填），`category`（可选）
- `record_decision` L236–259：`category, scenario, reasoning, outcome, confidence` 必填；可选 `because[], leads_to[], status, receipt_id, tenant_cwd, nod_kind, trace_id, system, environment, kind, ticket, holder, valid_from, valid_until`
- `index_passages`：**非 Host 工具**；Python `passages.py` L210 `index_passages(cwd, rows)`；bootstrap `op=='index_passages'`（`args.rows`/`args.texts`）

### 09 · 只读 runtime + cache；静态服务

- **env**：vendor 内常见 `DSH_SEMANTICA_PYTHON`、`DSH_SEMANTICA_PORT`；**无**规格写的 `DSH_SEMANTICA_*` 只读/cache 分离开关。`ensure-deps.js` L58–60 注释：bundled runtime 只读，可写 cache 靠 spawn **`opts.env`**，非一等 env。
- **数据目录**：工作区 `{cwd}/.dsh/semantic-os/`（图/向量/passages）。
- **`server.mjs`**：无 `FDE_STATIC_DIR`/SPA fallback；非全面静态文件服务（除 L2210 等单文件流）。
