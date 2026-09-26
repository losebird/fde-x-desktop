---
cursor:
  subagentId: "bc-3f857a59-c1bc-59e6-a54e-a966b7941fbc"
---

# 业务应用 · 应用壳与操作记录（现网路径）

只读梳理。源码树：`scene-39-personal-workstation`（`losebird/fde-x-desktop` 同构工作台）。不写现查/过审闸细节。

**目标文件**：本机 `…/files/internal/biz-app-flow-shell-ops.md`（分配路径 `/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/internal/biz-app-flow-shell-ops.md`）。撰写前该路径**不存在**，本文为新建。

---

## 存储与运行时根

| 角色 | 默认位置 | 代码 |
|---|---|---|
| 工作台 SQLite（元数据 + 应用表 + `biz_write_audit` 等） | `runtime/data/fde-workstation.sqlite`（可被 `FDE_DATABASE_PATH` 覆盖） | `runtime/config.mjs` `FDE_DATABASE_PATH` |
| 隔离 DSH 家（会话、profile、vendor 插件拷贝） | `~/.dsh-fde-x` | `runtime/config.mjs` `FDE_DSH_HOME`（`process.env.FDE_DSH_HOME \|\| join(homedir(), '.dsh-fde-x')`） |
| lan-assist 运行副本 | `{FDE_DSH_HOME}/vendor/dsh-lan-assist`（启动时从 `runtime/vendor-overlays/dsh-lan-assist` 覆盖拷贝） | `runtime/dsh-core.mjs` `applyVendorOverlay` / `ensureVendorPlugin` |
| AI 工作区 cwd（门禁、应用 `_workspaceCwd`、业务记录 workspace） | `FDE_AI_WORKSPACE`，默认 `process.cwd()` | `runtime/config.mjs` `FDE_AI_WORKSPACE` |

浏览器壳：`5174` 经 Vite 代理 BFF；BFF 默认 `127.0.0.1:4318`（`FDE_RUNTIME_PORT`）。

---

## 1. 应用壳：描述 → spec → 草稿 → 激活 → SQLite → 工作面 / 浮窗

### 1.1 UI 入口与状态

- 模块页：`src/pages/Data.tsx` 导出组件 `Data`；顶栏 `PageTitle` 标题「业务应用」。
- 三 Tab 子视图枚举：`type View = 'overview' \| 'records' \| 'operations'`；当前 Tab 来自 zustand `activeDataSubview` / `setActiveDataSubview`（`src/store/app.ts`）。
- **应用 Tab** 对应 `view === 'overview'` 时渲染 `Overview`（同文件）。
- 打开**运行中**应用工作面：`useApp` 的 `dataBrowse.workspaceAppId` 非空时，`Overview` 早退渲染 `AppRuntime`（`data-app-workspace="true"`），不再显示目录四格指标。
- 打开**草稿**：`dialogAppId` 非空 → 全屏对话框 `data-app-open-dialog` → `AppRuntime`（`previewMode` 由 `declarativeApp.status !== 'active'`）或旧轨 `AppDraftEditor`（`definition.kind === 'ai-generated-draft'` 且无 `fde-app/v1` spec）。

### 1.2 创建：描述 → builder → spec 草稿

| 步骤 | 行为 | 证据 |
|---|---|---|
| 用户描述 | `AppCreateWizard` 步骤 `describe` → `generating` | `src/components/apps/AppCreateWizard.tsx` `generate` |
| 调 AI | `askAiForResult`，preset 默认 `fde-app-builder`；正文来自 `appBuilderPrompt({ mode: 'create', … })` | 同上；`src/lib/app-builder-prompt.ts` |
| 模型落库口令 | 提示词要求调用 `fde_app_spec_submit({ requestId, spec })`（不传 `appId`） | `app-builder-prompt.ts`；DSH 工具定义 `runtime/fde-x-dsh-bridge/lib/tools.js` `name: 'fde_app_spec_submit'` → bridge `app-spec-submit` |
| BFF 写 SQLite 草稿 | `handleAppsBridge('app-spec-submit', …)` → 无 `appId` 时 `createAppDraft` | `runtime/routes/apps.mjs` L570–602；`runtime/apps/repository.mjs` `createAppDraft` |
| spec 真值（草稿期） | 行写入 `business_apps.definition_json` + `business_app_revisions`（`materialize_status` 初始 `pending`） | `createAppDraft` INSERT；表定义 `runtime/migrations/003_business_operations.sql` `business_apps` / `business_app_revisions` |
| 等待 appId | 轮询 `runtimeApi.listBusinessApps` 找新 `draft` + `isFdeAppSpec(definition)` | `AppCreateWizard.tsx` `waitForNewDraft` |
| 预览 | `getDeclarativeApp` → `AppRuntime` `variant` 默认 dialog 上下文 | `AppCreateWizard.tsx` `loadApp` |

修订：工作面/对话框内 `AppRuntime` 建造抽屉 → 再次 `askAiForResult` + `fde_app_spec_submit` 带 `appId` → `putAppSpec`（`handleAppsBridge` 带 `appId` 分支）。

### 1.3 激活 → 物化 SQLite 表

| 步骤 | 行为 | 证据 |
|---|---|---|
| 用户点激活 | `AppRuntime.tsx` `activate` → `runtimeApi.activateDeclarativeApp(app.id)` | `src/components/apps/AppRuntime.tsx` L47–58 |
| HTTP | `POST /api/v1/apps/:id/activate` | `runtime/routes/apps.mjs` `activateMatch` |
| 服务端 | `activateApp`：校验 `validateAppSpec` → `applyMaterialize` → `business_apps.status = 'active'`，修订行 `materialize_status = 'applied'` | `runtime/apps/repository.mjs` `activateApp`；DDL `runtime/apps/materialize.mjs` `planMaterializeDdl` |
| 应用业务数据表 | 表名 `tableNameForEntity(slug, entity)`，匹配 `^app_[a-z][a-z0-9-]{1,30}__[a-z][a-z0-9_]{0,30}$` | `repository.mjs` `APP_TABLE_RE`；`materialize.mjs` |
| 激活后 CRUD | 已激活应用记录走 `runtime/routes/apps.mjs` 内 REST（`listRecords` / `insertRecord` / `patchRecord` / `deleteRecord`，`runtime/apps/records.mjs`），**不**经 lan-assist 外部连接器 | 同文件 `recordAppOperation` 等 |

### 1.4 工作面与浮窗

- **工作面**：`Data.tsx` 在 `workspaceAppId` 下挂载 `AppRuntime` `variant="workspace"`；`hasProductPages(spec)` 为真时 `daily` 分支走 `AppProductPage`（`AppRuntime.tsx` L44–45）。
- **浮窗**：spec 声明 `uses` 含 `float` 时显示按钮「浮窗」→ `runDeclaredPlatformUse('float', …)` → `useApp.openFloating('app:'+appId)`（`src/lib/app-platform.ts` L179–193）；浮窗内仍是该应用工作面，不是三 Tab 整块 `Data`。
- **收回浮窗**：`dockFloating` 写回 `dataBrowse.workspaceAppId` 并 `activeDataSubview: 'overview'`（`src/store/app.ts` L539–553）。

### 1.5 真值在哪 · 与连接器业务库如何分开

| 数据类 | 真值位置 | 工作台 SQLite 里存什么 |
|---|---|---|
| **创建的应用（L1）** | spec：`business_apps` / `business_app_revisions.definition_json`；运行数据：物化表 `app_{slug}__{entity}`（同库文件） | 元数据 + 应用自有台账行 |
| **连接器业务系统（外部）** | 源系统（如 NocoBase）；UI 文案「外部业务记录仍以源系统为准」 | 仅 `business_connections` 连接配置（`config_json`、`credential_ref` 等），**不**镜像全量业务表 |
| **业务记录 Tab 上的外部行** | 现查/预览来自 lan-assist + 连接器；过账写回源系统 | 工作台侧：`biz_surfaces`（浮现元数据）、`biz_write_audit`（写入审计）；非应用 `app_*` 表 |
| **旧 AI 草稿轨** | `definition.kind: 'ai-generated-draft'` 的 JSON 草稿 | `business_apps` 一行；**不**走 `fde_app_spec_submit` 物化 |

连接器登记：`Settings.tsx`「存储与数据」→ `runtimeApi` 写 `business_connections`（与 `Data.tsx` 右侧连接列表读取 `listBusinessConnections` 同源）。

---

## 2. 操作记录：谁写、审计表、过账是否同一条

### 2.1 审计表

- 表名：**`biz_write_audit`**
- 结构：`runtime/migrations/011_biz_write_audit.sql`；扩展列 `rollback_state`（013）、`lookup_bind_json`（014）。
- 读写 API：`runtime/db.mjs` `insertBizWriteAudit`、`listBizWriteAudits`、`getBizWriteAuditByTraceId`；唯一键 `trace_id`（`ON CONFLICT(trace_id) DO UPDATE`）。

### 2.2 谁写入 `biz_write_audit`

| 写入方 | 条件 | 证据 |
|---|---|---|
| **BFF** | `POST /api/v1/biz/write` 在 lan-assist `/write` **成功**（HTTP 200 且非 `ok:false`）之后调用 `insertBizWriteAudit` | `runtime/routes/biz.mjs` L1140–1233 |
| **UI · 业务记录过账** | `RecordsPanel` `confirmWrite` → `runtimeApi.bizWrite(..., { source: 'workstation', changes, … })` | `src/components/biz/RecordsPanel.tsx` L1718–1775；`src/lib/runtime-api.ts` `bizWrite` → `/api/v1/biz/write` |
| **UI · 操作记录回退** | `OperationRecordPanel` `confirmRollback` → 同上 `bizWrite` + `rollback_of_trace_id` | `OperationRecordPanel.tsx` L336–360 |
| **模型直写** | `source !== 'workstation'` 时 BFF **403**，**不会** `insertBizWriteAudit` | `biz.mjs` L1148–1151 |
| **`operations` 表 live 执行** | `executeOperationLive` 直接 `aiRuntime.lanAssist('/write', …)`，**无** `insertBizWriteAudit` 调用 | `runtime/db.mjs` L824–909；`runtime/server.mjs` L2895–2909 |

`insertBizWriteAudit` 在仓库内除 `runtime/routes/biz.mjs` 外仅测试直接 import（`runtime/tests/*.mjs`），**无** lan-assist overlay 写该表。

### 2.3 操作记录列表读路径

- 第三 Tab UI 文案「**操作记录**」（`Data.tsx` L188）；组件 `OperationControlPanel` 仅为 re-export：`src/components/biz/OperationControlPanel.tsx` → `OperationRecordPanel`。
- 列表：`OperationRecordPanel` `refresh` → `runtimeApi.listBizTraces(200)` → `GET /api/v1/biz/traces?limit=…`（带 workspace cwd）。
- BFF 合并逻辑：`lanAssist('/traces')` 返回行 + `listBizWriteAudits(db, workspace)`，`enrichTraceRows` 按 `trace_id` 合并 changes/columns/source/rollback（`runtime/routes/biz.mjs` L487–539、L758–761）。单条详情优先 SQLite audit（L718–744）。

### 2.4 「顶栏执行」与 `biz_write_audit`

- `Data.tsx` 顶栏 `PageTitle.actions` **只有**三 Tab `ViewButton`（L185–189），**无**执行按钮。
- `src/` 内**无**组件调用 `runtimeApi.executeOperation`（定义在 `runtime-api.ts` L2187–2188）。
- 仍存在的 BFF 路径：`POST /api/v1/operations/:id/execute` → `executionMode === 'live'` 时 `executeOperationLive`（`server.mjs` L2895–2931）→ lan-assist `/write`，**不**经过 `POST /api/v1/biz/write`，故**不**写 `biz_write_audit`。
- 应用 Tab 仍拉 `listOperations` 仅用于「待审批 / 异常待处理」指标（`Data.tsx` L138–142、L563–564），与操作记录列表数据源不同。

### 2.5 与业务记录「确认过账」是否同一条

- **同一条写入链**：业务记录右侧确认过账与操作记录回退确认，最终都是 **`runtimeApi.bizWrite` → `POST /api/v1/biz/write` → 成功则同一 `insertBizWriteAudit`（同一 `trace_id` 冲突更新语义）**。
- **不是同一张 UI 表**：业务记录 Tab 展示的是 lan-assist 浮现 sheet / `biz_surfaces` 等（`RecordsPanel`）；操作记录 Tab 展示 **`/biz/traces` 合并结果**，字段级 diff 以 audit 中 `changes_json` 为准（`enrichTraceRows`）。
- **业务记录 Tab 绿条**「过账在业务记录确认；历史与回退见「操作记录」」：`AppDraftEditor` L376；与上述分工一致。

---

## 3. 三 Tab 切换 · 设置 · 重载核心 · 刷新浏览器

### 3.1 三 Tab 怎么切

| Tab | `activeDataSubview` | 主组件 | 备注 |
|---|---|---|---|
| 应用 | `'overview'` | `Overview`（含目录 / 工作面 / 创建向导） | 绿条 `AuthorityStrip` **不**渲染 |
| 业务记录 | `'records'` | `RecordsPanel` + 顶区 `AuthorityStrip` | `onPlan` → `setView('operations')`（L215–216） |
| 操作记录 | `'operations'` | `OperationRecordPanel`（经 `OperationControlPanel` 导出） | 无旧版「操作控制」表单闭集 UI |

切换实现：`setActiveDataSubview`（`Data.tsx` L115–116、L186–188）；底栏「浏览记录 / 操作记录」按钮同样 `setView`（L650–651）。

其它入口：`focusBizRecordsPanel()` 强制 `activeDataSubview: 'records'` 并展开 `data` 面板（`app.ts` L621–643）。`src/lib/biz-records-auto-open.ts` 在部分 round-end 也会切到 `records`（与操作记录 Tab 守卫有关）。

### 3.2 设置页影响谁

| 设置分区 | 触达的后端 / 状态 | 对三 Tab 的影响 |
|---|---|---|
| **AI 核心**（`CoreSettings.tsx`） | 模型/预设、`reloadAi` | 不直接改 Tab；重载见下节 |
| **语义记忆**（`SemanticSettings.tsx`） | 也可 `reloadAi` | 同上 |
| **运行环境 / 存储与数据**（`Settings.tsx`） | `runtimeApi.health`、连接器 POST → `business_connections` | **业务记录**依赖连接与词表；**应用壳**本地台账不依赖连接器；**操作记录**依赖 lan-assist `/traces` + BFF |
| **resetDemo**（存储与数据） | `useApp.resetDemo` → `buildInitial()` | 清前端 demo 状态；**不**替代 SQLite 迁移文件逻辑（需结合 BFF 接口语义） |

设置页**不**提供业务应用三 Tab 切换；Tab 仅在 `Data` 模块内。

### 3.3 「重载核心」影响谁

- UI：`CoreSettings` / `SemanticSettings` 按钮 → `runtimeApi.reloadAi()` → `POST /api/v1/ai/reload`（`runtime/server.mjs` L1346–1366）→ `scheduleRuntimeRestart()` 停 BFF/DSH 再拉起（`scripts/dev.mjs` 监督可自动再起）。
- **会断**：DSH 会话 WebSocket、进行中的 AI 流；lan-assist 进程与 `{FDE_DSH_HOME}/vendor/dsh-lan-assist` 插件栈（含 overlay 补丁）。
- **留在磁盘**：`FDE_DATABASE_PATH` 下 SQLite（含 `business_apps`、`biz_write_audit`、物化 `app_*` 表）；`~/.dsh-fde-x` 会话与 profile。
- **三 Tab**：组件不卸载时 `activeDataSubview` / `dataBrowse` 保持内存值；列表会随 `Data` 的 `refresh` / 各 Panel 的 `refresh` 重拉 BFF。lan-assist 未就绪时业务记录/操作记录可能 503（`biz.mjs` `lan_assist_unavailable`）。

MCP / 模型密钥等配置：写入 DSH 家配置，文案普遍「请重载核心后生效」（如 `runtime/routes/mcp.mjs` L341）。

### 3.4 刷新浏览器影响谁

- **localStorage**（`scene-39-workstation`，`app.ts` `partialize` L1104–1115）：持久化 `panels`、`floating`、`workspaces`、`activeAiSessionId` 等；**未**持久化 `activeDataSubview`、`dataBrowse.workspaceAppId`。
- 刷新后：`activeDataSubview` 回到默认 `'overview'`（L619）；`dataBrowse.workspaceAppId` 为 `null` → 应用 Tab 回到**目录**而非工作面。
- **会话内缓存** `dataSurfaceSnap`（`Data.tsx` L45–54）模块级变量，刷新清空 → 首屏重新 `refresh()` 拉 health/apps/operations。
- **SQLite / DSH 家**：不受浏览器刷新影响。

---

## 4. 路径索引（符号）

| 符号 | 路径 |
|---|---|
| 业务应用页 | `src/pages/Data.tsx` |
| 创建向导 | `src/components/apps/AppCreateWizard.tsx` |
| 工作面运行时 | `src/components/apps/AppRuntime.tsx` |
| 业务记录面板 | `src/components/biz/RecordsPanel.tsx` |
| 操作记录面板 | `src/components/biz/OperationRecordPanel.tsx` |
| 全局 UI 状态 | `src/store/app.ts` |
| 应用 bridge | `runtime/routes/apps.mjs` `handleAppsBridge` |
| 应用仓库 | `runtime/apps/repository.mjs` |
| 业务 BFF | `runtime/routes/biz.mjs` |
| 审计 DAO | `runtime/db.mjs` |
| DSH / vendor | `runtime/dsh-core.mjs` |
| 配置根 | `runtime/config.mjs` |
