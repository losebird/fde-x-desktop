# FDE-X 业务记录 & 早报 — 只读摸底（scene-39 + lan-assist）

## A. 业务系统与业务记录

### A1 业务系统是什么、怎么连
- **外部系统形态**：lan-assist 默认 **NocoBase REST**（`dialect: 'nocobase'`），`createNocoWrite` 过账（`~/.dsh/vendor/dsh-lan-assist/index.js` L84–L101）。
- **连接登记**：设置「业务连接器」→ `POST /api/v1/biz/lookup`（`server.mjs` L1716–L1758）→ `lanAssist('/lookup/config')`；口令可账号密码换 token（`exchangeNocoBaseToken` L1732）。词表/型目录走 semantic-os `loadVocab`/`saveVocab`（`index.js` L123–L124）。
- **FDE `listBusinessConnections`**：`runtime/db.mjs` L252–L272 读 SQLite `business_connections`；seed 仅 `conn_lan_assist` provider=`lan-assist` status=`pending`（L74–L98），**不是** NocoBase URL。
- **返回字段**：`id, workspaceId, name, provider, connectionKind, status, config, credentialRef, capabilities, lastHealth, createdAt, updatedAt`（L259–L272）。

### A2 `biz_*` 与 BFF 转发（无 `biz_catalog`/`biz_lookup` 工具名）
| 名称 | 入口 | 请求/返回要点 |
|------|------|----------------|
| `biz_describe` | DSH 工具 `tools.js` L107–L127 | 参数 `kind?`；`secretary.describeBiz` → `{ok,kinds[],relations[],catalogVersion}`（`catalog.js` L79–L101，`secretary.js` L490–L509）。 |
| `biz_catalog` | **无工具**；BFF `GET/POST /api/v1/biz/catalog`（`server.mjs` L1699–L1713） | GET：`/state` 的 `catalog` 数组；POST：`/catalog/publish` + `confirm`。 |
| `biz_lookup` | **无工具**；BFF `POST /api/v1/biz/lookup`（L1716–L1758） | `system,env,baseUrl,token|account+password,dialect` → 存 lookup+token。 |
| `biz_preview` | 工具 `tools.js` L159–L195；BFF `POST /api/v1/biz/preview`（L1682–L1696） | 动作：现查/改行/删除/新建/过审；`translateBizIntent` 映射 `record.*`（`server.mjs` L132–L173）。返回含 **`sheet`**：`packSheet` → `{kind,action,rows[],columns[],preview_id,canWrite,...}`（`write.js` L54–L150）。 |
| `biz_write` | 工具 `tools.js` L199–L216；BFF `POST /api/v1/biz/write`（L1762–L1769） | 必填 `preview_id`；可选 `trace_id`,`confirm`（批量删）。 |
| `biz_traces` | 工具 `tools.js` L131–L155；lan-assist `GET /traces`（`http.js` L105–L115） | **BFF 未暴露**。`openTrace` 返回 `rows`：`id,kind,no,action,receipt_id,session_id`（`traces.js` L11–L19,L446–L473）；**无「表名+多行 id」审计**，强调「当时回执不是现查」。 |

**preview 当列表？** `sheet.rows`+`columns` 可渲染表格（`write.js` L54–L150）；现查无 `preview_id`，改删需令牌。FDE 未用 `columns`，动态 keys（`Data.tsx` L486–L503）。

### A3 AI 调用 biz 时壳层能否感知
- **无专用 biz 事件总线**。AI 跟流 `runtime/ai-stream.mjs` 可把 `tool/call` 里的工具名（含 `biz_preview`）映射到轨迹（L46–L85,L133–L134）；**`Data.tsx` 未订阅**。
- **间接**：`GET /api/v1/im/state` → lan-assist `/state`（`server.mjs` L1805–L1806）含 `pendingSheet`/`pendingWrite`（`view.js` L310–L311,L350–L351），AI preview 会写入 `state.pendingSheet`（`gate.js` L143–L150）。**业务记录 Tab 不读 pendingSheet**，仅 mount 时一次 `bizPreview`（`Data.tsx` L481–L489）。
- **traces 轮询**：前端无 `/api/v1/biz/traces`；`dsh-core.mjs` lanAssist 白名单**无** `/traces`（L668–L671）。

**业务记录 Tab 数据**：硬编码 `kind:'采购单'`（L486–L510）；型芯片未接 `biz_describe`。`tables` 来自 store `businessTables`（初始 `[]`，`app.ts` L269）仅作列回退（L500–L502）。活测词表在**其它 cwd**（`PRODUCTION-STATUS.md` L19，`ADVERSARIAL-REVIEW.md` L54）。

### A4 增删改查审
- **操作控制**：`POST /operations` 建计划（`server.mjs` L2419–L2508）；写+中高风险 → `awaiting_approval`（L2438–L2478）。`approve`（L507–L543 `db.mjs`）。`execute`：**仅** `executeDryRun`（L2394–L2415）；`live` → **501** `live_adapter_not_ready`（L2404–L2408）。dry_run **不调用** `biz_preview`/`biz_write`（`db.mjs` L546–L557）。
- **`biz_write` 动作类型**：由 preview 令牌绑定；preview 动作为 **现查/改行/删除/新建/过审**（`tools.js` L167–L168）；write 只消费 `preview_id`（L199–L203）。

## B. 早报与外部信息源

### B5 `Briefing.tsx` 与 store
- **区块**：顶栏指标格（`metrics`）；左：进行中日程、今日三件事、逾期、时间线（`tasks`/`events`）；右：AI 早报卡、`notifications`、`imState` 未读 IM、`news`、快捷链（`Briefing.tsx` L111–L369）。
- **类型**：`src/lib/types.ts` L272–L299（`Notification`,`NewsItem`,`MetricCard`）。
- **数据来源**：`tasks/events/metrics/news/notifs` 来自 zustand；`buildInitial` 中 **metrics/news/notifications 均为 `[]`**（`app.ts` L272–L274）；指标 UI 固定「—」（`Briefing.tsx` L112–L118）。`seedMetrics/seedNews` 在 `seed.ts` L298–L311 **未被 store 引用**。
- **早报配置**：DB 有 `briefing_definitions`/`briefings`（`002_modules.sql` L258–L281，`sources_json/sections_json/schedule_json`），**无 API/无 UI**；`contracts.ts` 仅类型 `BriefingPort`。

### B6 BFF 定时与出网
- **无 cron/后台轮询**：`server.mjs` 仅 `setInterval` 热加载与 `scheduleRuntimeRestart`（Grep）；`outbox_events` 只 **列出** pending（`listPendingEvents` L2288），无发布 worker。
- **出网/闸**：`FDE_ALLOWED_ORIGINS` 白名单，写操作非白名单 403（`server.mjs` L198–L199；`PRODUCTION-SPEC.md` L41）。BFF/DSH 绑 `127.0.0.1`（L41）。连接器保存后 BFF 可代调 NocoBase（lookup）；**无**统一 egress 策略文档除 Origin/本机绑定。

### B7 外部通道（本机检索）
- **DSH 自带**：未发现 bundled IMAP/RSS MCP；Cordis 为插件框架（`@deepseek-ai/dsh` 依赖），**无**现成邮箱/新闻插件在 scene-39。
- **通用 MCP（Web）**：IMAP — `andrewmalov/mcp-imap`、`Txtus/mail-mcp`；RSS — `kwp-lab/rss-reader-mcp`、`lionkiii/rss-feeds-mcp`。
- **semantic-os**：BFF `GET /memory/cards` → `list_memory_cards`（`server.mjs` L1781–L1784）；规格 memory **daily=当天过滤**（`PRODUCTION-SPEC.md` L101），**无**「每日回顾」专用 API。
- **lan-assist 待办/待审**：无 `未完成工作` 工具；`biz_traces` 为历史回执；待审批在 NocoBase 需 **biz_preview 现查** + 词表型，无专用查询 API。

### B8 规格条款（与「可自定义+外部源」）
- **§13 项5（早报 seed）**：仍 seed/写死日期；接线去假数、指标无连接为 —（`PRODUCTION-SPEC.md` L444–L445）。
- **阶段 G**（L258–L264）：早报指标来自业务现查；`生成新早报` = AI prompt；禁止 seed DAU。
- **§15.3**（L490–L508）：未读 IM/发 IM/记忆与 prompt 关联；**无**区块自定义。
- **§15.8**（L537–L539）：去写死文案、指标 —、IM 真未读。
- **本版不做**（L427–L432）：`goal/jobs/会话 schedule` 不进待办；`todo_write` 不自动写；Cordis 动态插件不做 — **冲突点**：自定义早报调度/外部源编排无规格落点，需新表/API（已有 schema 未接）或扩 §G。

## C. 缺口与可能动到的文件（仅事实推断）

**(1) AI 操作 → 记录浮现 → 页内 CRUD 审**
| 缺环节 | 文件 |
|--------|------|
| AI→UI 同步（pendingSheet/工具事件/traces） | `Data.tsx`；可选 `server.mjs` 增 `/biz/traces` 或 SSE；`runtime-api.ts` |
| 型列表非硬编码采购单 | `Data.tsx`；`GET /biz/catalog` 或 `imState`+describe |
| 操作执行接 lan-assist | `server.mjs` execute 路径；`db.mjs`；`Data.tsx` OperationControl |
| 行内 CRUD 仍须 preview 令牌链 | 规格 §9（`PRODUCTION-SPEC.md` L351–L365）禁止记录 Tab 直写 |

**(2) 可配置早报 + 邮箱/新闻/业务待办**
| 缺环节 | 文件 |
|--------|------|
| `briefing_definitions` CRUD/生成任务 | 新 `runtime/*` 路由；`Briefing.tsx`；或接 `002_modules.sql` |
| 外部源拉取（邮件/RSS/现查） | BFF 定时或 DSH MCP；`Settings.tsx`/MCP 页 |
| 指标/新闻接真源 | `Briefing.tsx`；去 `seed.ts` 依赖；阶段 G |
| 业务待办块 | `biz_preview` 聚合或 traces+preview；`Data.tsx`/早报组件 |
