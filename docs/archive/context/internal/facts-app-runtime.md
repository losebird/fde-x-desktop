# FDE-X 业务应用运行时摸底（只读）

## A. 数据模型与渲染

**A1 迁移表**
- `002_modules.sql`：无 `business_*`；含 `tasks`/`workflows`/`files` 等模块表（`runtime/migrations/002_modules.sql:3-281`）。
- `003_business_operations.sql`：`business_connections`（`3-16`）、`business_apps`（`18-29`：`app_kind`/`status`/`definition_json`/`current_revision`）、`business_app_revisions`（`31-40`）、`operations`（`42-68`）、`operation_steps`（`74-87`）、`approvals`（`89-98`）、`operation_snapshots`（`100-109`）、`operation_receipts`（`111-119`）、`compensations`（`121-133`）、`operation_artifacts`（`135-141`）。

**A2 `definition_json` 形状（无服务端 schema）**
- 创建 API 接受任意 object：`server.mjs:2310-2317`。
- DB 新建固定 `app_kind='generated'`、`status='draft'`：`db.mjs:306-308`。
- 前端草稿字段：`kind:'ai-generated-draft'`, `goal`, `screens[]`, `permissions[]`, `dataSources[]`（`Data.tsx:246-252`, `350-356`）。
- Seed 系统应用：`{ kind:'data-browser', source:'prototype', capabilities:[...] }`（`db.mjs:100-104`）。
- 类型层仅 `definition: JsonValue`（`runtime-api.ts:192-199`）；`src/lib/types.ts` 无 BusinessApp definition 结构。

**A3 选中应用后渲染什么**
- 列表选中 → `AppDraftEditor` 表单（目标/数据源/屏幕名列表/权限文案），**无** screen 路由、字段 schema、列表/表单运行时（`Data.tsx:425-431`, `216-318`）。
- `appKind`：DB 约束 `generated|connected|system`（`003:22`）；创建路径只写 `generated`（`db.mjs:308`），seed 写 `system`（`db.mjs:82`）；UI 仅区分 `generated` 图标/文案 vs 其他（`Data.tsx:414-418`），**无** `connected` 专用逻辑。
- 「业务记录」跳转到独立 `RecordBrowser`，与当前选中 app **未绑定**（`Data.tsx:297`, `477-549`）。

**A4 业务记录存哪**
- SQLite **无** 按应用分表/通用 records 表（全库 `grep CREATE TABLE` 见 `001-003`）。
- 现查/写入经 BFF→`aiRuntime.lanAssist`：`/api/v1/biz/preview|write|catalog|lookup`（`server.mjs:1682-1770`）；`RecordBrowser` 调 `bizPreview` 硬编码「采购单」（`Data.tsx:486-488`）。
- `businessTables` 初始 `[]`，persist 剔除（`app.ts:269`, `829`）；`BusinessTable` 仅前端原型类型（`types.ts:246-251`）。

**A5 `operations` 审批链**
- **plan**：`POST /api/v1/operations` 插 `operations`，`plan_json` 恒 `'{}'`（`server.mjs:2452`, `2483-2507`）；中高风险 write→`awaiting_approval`+`approvals`（`2438-2478`）。
- **approve**：`POST .../approve`→`approveOperation` 仅当 `awaiting_approval`（`server.mjs:2374-2391`, `db.mjs:507-544`）。
- **execute**：`POST .../execute`→`executeDryRun`；`execution_mode=live` 返回 501（`server.mjs:2394-2416`, `db.mjs:546-549`）；dry_run 写 receipt、state→`uncertain`，**不调**外部系统（`db.mjs:552-592`）。
- `operation_steps` 表无 INSERT 路径（仅 `getOperationTrace` 读，`db.mjs:384-387`）。
- 真实写入另走 `bizWrite(preview_id)`（`Data.tsx:635-637`, `runtime-api.ts:1120-1127`），与 `operations.execute` 分离。

## B. BFF 可扩展点

**B5 `server.mjs`**
- 手写 `createServer` 路由表 + DSH/semantic-os **反向代理**（`853-886`, `506-513`, `623+`）；根路径 JSON 提示非静态站（`899-908`）。
- **无** 通用插件挂载/无托管任意生成物目录的静态服务。
- `db.mjs`：`openDatabase` 仅 `applyMigrations`+`seedRuntime`（`12-23`, `26-59`）；业务代码只有 DML `prepare`，**无** 运行时 DDL API。

- DSH Host 侧 `webServer.register` 可挂 prefix 路由（桥示例 `fde-x-dsh-bridge/lib/index.js:133-139`）；FDE-X BFF 未暴露等价扩展口。

**B6 前端**
- `vite.config.ts`：无 `import.meta.glob`；仅 react 插件+runtime 代理（`94-115`）。
- 无通用配置驱动表格/表单库；`RecordBrowser`/`OperationControl` 为页面内专用组件（`Data.tsx:477-649`）。

## C. DSH 生成能力

**C7 cordis preset + skills**
- `cordis` = `standard` + `tool-cordis` + composition 编辑 skills（`cordis/agent.cordis.yml:246-263`）。
- `cordis-plugin-development`：插件可 Host（工具/文件/bash/`webServer`）、Client（Slots/Theme）、动态 Tool；`cordis_define`→`cordis_run` 激活，**不需重启 Host**（skill `15-32`, `36-44`）；定时未见，有 `webhookRuntime`（`dsh-tool-cordis` catalog `4520-4540`）。
- `editing-cordis-compositions`：能力=改 `cordis.yml` 插件行；用户 preset 目录 `${DSH_HOME}/.agent-presets/`（skill `28`, `66-72`）。

**C8 standard + bridge**
- `standard`/`cordis` 含 `tool-bash`、`tool-fs`、`tool-fs-search`（`standard/agent.cordis.yml:45-62`）→ 可在 session cwd 读写/跑 shell（受 sandbox/审批）。
- `fde-x-dsh-bridge` Host：**仅** `GET /fde-session/export`、`POST /fde-session/restore`（400 占位）（`index.js:102-127`）；Client 为 iframe `postMessage`（`client.js` 头注释 `HANDOFF`）。
- 扩展「给生成应用提供 API」需新 Cordis 插件 `webServer.register` 或扩 BFF `server.mjs`，bridge 现不具备。

**C9 DSH web 预览**
- 侧边栏文档预览：`dsh-client-ui-sidebar-documentpreview` HTML iframe 预览（`client.js:2389-2394`, `bootstrap.d.ts:14`）；对话流里 `item.tag === "Artifact"` 仅隐藏容器（`client.js:15582`）。
- `dsh-tool-present`：声明交付文件路径供用户打开，**非**内嵌 HTML 应用预览（`README.zh.md:12-28`）。
- 无发现独立的「agent artifact canvas」一等公民 UI（包内 `Artifact` 字符串命中极少）。

## D. 「definition → 立刻可用 CRUD 应用」缺什么（按现有代码）

| 缺环 | 涉及文件（大概） |
|------|------------------|
| definition schema/校验与 `screens`→UI 元数据 | 新建 `runtime/*` 校验；`Data.tsx`；可选 `types.ts` |
| 按 app 建 SQLite 表或 EAV/records + CRUD API | 新 migration；`db.mjs`；`server.mjs` 路由 |
| 选中 app 的运行时渲染（列表/表单/路由） | 新 `src/components/*` 或动态路由；`Data.tsx` 替换 `AppDraftEditor` 独占 |
| AI 输出写回 `definition`（今仅 prompt 人工保存） | `runtime-api`+DSH 工具或 BFF webhook；`Data.tsx:301-314` |
| `app status` 从 draft→active 与执行绑定 | `db.mjs`/`server.mjs`（今无 activate）；`003:23` |
| 业务数据与 `business_apps`/`connection` 关联 | `RecordBrowser`/`biz*` 与 `app.definition.dataSources` 接线 |
| 统一「操作」与 app CRUD（今 operations 空 plan + lan-assist 分叉） | `server.mjs` operations + `executeDryRun`/`adapters.mjs` |
| 托管生成前端（若要走独立 UI） | `server.mjs` 静态或 Vite 构建产物注册；非现成 |
| Agent 侧生成→落库一键 | DSH cwd 写代码 ≠ 写 SQLite；需 BFF 或 Cordis Host 插件 |

**现能撑到：** DSH cordis/standard 在工作区**生成/改代码**；FDE-X **存草稿 definition**（SQLite）；**外部系统**经 lan-assist 现查/预览写；**审计型 operations**（计划/审批/dry_run）。**不能撑到：** 仅凭 definition 自动建表+通用 CRUD UI。
