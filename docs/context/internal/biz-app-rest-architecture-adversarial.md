---
cursor:
  subagentId: "bc-bda098bf-f0c8-54b0-877e-b9275c603d1c"
---

# 业务应用三页 × 架构页（其余触点）对抗审查

只读。产品：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（fde-x-desktop），`cursor/approve-batch-where-9c38` @ `07fb159557ce2f27e951379dc0db927a4120548b`。对照 `docs/biz-app-architecture.md`。不覆盖业务记录右栏深链路（现查 / 写闸 / 结算 / 令牌 / 审计）。

## 架构页写对了（一行）

- 三 Tab 与 `overview | records | operations`：`src/pages/Data.tsx:Data`、`src/store/app.ts:activeDataSubview`。
- 设置与三 Tab 分离（侧栏/面板 `settings`，非 Data 子 Tab）：`src/components/PanelContent.tsx:PanelContent`、`src/pages/Settings.tsx:Settings`。
- `focusBizRecordsPanel` 可拉满 `data` 并切 `records`，不自动关掉已全屏的设置：`src/store/app.ts:focusBizRecordsPanel`。
- 创建链：描述 → `fde-app-builder` preset → 工具 `fde_app_spec_submit`（`runtime/fde-x-dsh-bridge/lib/tools.js:fde_app_spec_submit`）→ 草稿 → `activateDeclarativeApp` 物化：`src/components/apps/AppCreateWizard.tsx:AppCreateWizard`、`src/components/apps/AppRuntime.tsx:activate`。
- `spec.pages` → `AppProductPage`；无 pages 走视图脚手架：`src/lib/app-spec.ts:hasProductPages`、`src/components/apps/AppRuntime.tsx:AppRuntime`。
- 声明 `float` 才可撕浮窗；浮窗内单应用 `AppRuntime`：`src/pages/Data.tsx:Overview`、`src/lib/app-platform.ts:runDeclaredPlatformUse`、`src/components/apps/AppFloatSurface.tsx:AppFloatSurface`。
- 能力条（不含 float）走 `recordActionUses` + `runDeclaredPlatformUse`：`src/components/apps/AppCapabilityBar.tsx:AppCapabilityBar`、`src/lib/app-spec.ts:recordActionUses`。
- 操作记录 `GET /biz/traces`、列表内搜索/分页/详情「回退」走 `bizWrite`（与架构「同一条账」一致，不展开闸内细节）：`src/components/biz/OperationRecordPanel.tsx:OperationRecordPanel`、`src/lib/runtime-api.ts:listBizTraces`、`confirmRollback`。
- 顶栏无 `executeOperation` 调用；待审批数字来自 `listOperations` 而非 traces：`src/pages/Data.tsx:Overview`（`pendingApproval`）、`src/lib/runtime-api.ts:executeOperation` 仅 API 层。
- 刷新后 `activeDataSubview` 与 `dataBrowse.workspaceAppId` 未进 `partialize`（默认回「应用」目录、工作面 id 不持久）：`src/store/app.ts:partialize`。

## 架构页写错或不精确

| 问题 | 证据 |
|------|------|
| 无 `spec.pages` 的存量脚手架写成 table/form/kanban，漏 **stat** 视图 | `src/components/apps/AppRuntime.tsx:AppRuntime`（`current?.type === 'stat'` → `SpecStat`） |
| 「刷新浏览器 … Tab 回到应用目录、工作面 id 不进 localStorage」未交代 **应用浮窗** `app:*` 会随 `floating` 持久化恢复，用户仍可能看到撕出的工作面，与「回到目录」并存 | `src/store/app.ts:partialize`（含 `floating`）、`src/lib/app-platform.ts:runDeclaredPlatformUse`（`use === 'float'`）、`src/components/FloatingPanel.tsx:FloatingPanel` |

## 架构页未点名、用户能碰到的功能（建议补档）

### 应用 Tab（overview）

| 触点 | file:symbol |
|------|-------------|
| 四格指标（含待审批、异常待处理） | `src/pages/Data.tsx:Metric` / `Overview` |
| 连接器只读列表（配置在设置「存储与数据」`bizLookup`，非本 Tab 编辑） | `src/pages/Data.tsx:Overview`；`src/pages/Settings.tsx:Settings`（`section === 'data'`） |
| 「浏览记录」「操作记录」快捷跳 Tab | `src/pages/Data.tsx:Overview` |
| 草稿区折叠、行内删除、归档/硬删确认 | `src/pages/Data.tsx:AppCatalogRow`、`AppDeleteConfirm` |
| 非 fde-app/v1 草稿 `AppDraftEditor`（保存草稿、问 AI、跳业务记录） | `src/pages/Data.tsx:AppDraftEditor` |
| 创建向导：本地台账 vs 接模块、Preset 字段、生成超时 | `src/components/apps/AppCreateWizard.tsx:AppCreateWizard` |
| 草稿弹窗 `dialogAppId`（与 `workspaceAppId` 工作面并列） | `src/pages/Data.tsx:Overview` |
| 工作面「返回列表」 | `src/pages/Data.tsx:Overview`（`setWorkspaceAppId('')`） |

### 工作面 / 产品页 / 脚手架（应用内 REST，不经 lan-assist 写闸）

| 触点 | file:symbol |
|------|-------------|
| 采纳并激活 / 激活本次修订、删除、版本回滚、编辑 spec、用一句话改（建造抽屉） | `src/components/apps/AppRuntime.tsx:AppRuntime`（`activate`、`rollback`、`showBuilder`、`submitRevisePrompt`） |
| 产品页：tab/stack 导航、stats/compose/chart/feed/cards/table/kanban 块 | `src/components/apps/AppProductPage.tsx:AppProductPage` |
| compose 块头「打开早报」（`uses` 含 briefing） | `src/components/apps/AppProductPage.tsx:ProductBlock` |
| 台账表：筛选、分页、多选、实体 `actions`、新建行、`spec.actions` 触发的 agent / **biz 预览** | `src/components/apps/SpecTable.tsx:SpecTable`（`runAgentAction`、`startBizPreviews`） |
| 表单：本地提交；字段级 biz 查找 | `src/components/apps/SpecForm.tsx:SpecForm` |
| 卡片「播放/打开」+ 能力条 | `src/components/apps/SpecCards.tsx:SpecCards` |
| 浮窗标题栏停靠/关闭 | `src/components/FloatingPanel.tsx:FloatingPanel` |

### 业务记录 Tab

| 触点 | file:symbol |
|------|-------------|
| 仅本 Tab 展示的「事务底座」条（健康/词表/刷新） | `src/pages/Data.tsx:AuthorityStrip` |
| 跳操作记录（onPlan，不展开右栏逻辑） | `src/pages/Data.tsx:Data` → `RecordsPanel` props |

### 操作记录 Tab

| 触点 | file:symbol |
|------|-------------|
| 列表刷新；一次拉最多 200 条再前端筛/分页（页大小 20） | `OperationRecordPanel:refresh`；`src/lib/biz-operation-history.ts:HISTORY_PAGE_SIZE`、`paginateHistory` |
| 行点开 trace 抽屉；「审查 corpus」 | `src/components/biz/OperationRecordPanel.tsx:openTrace`、`reviewCorpus` |
| 回退确认抽屉 | `src/components/biz/BizRollbackConfirmDrawer.tsx`（经 `OperationRecordPanel`） |

### 路由与其它入口（非 `/data` 子路由）

| 触点 | file:symbol |
|------|-------------|
| 业务应用仅 `/data` 路由，三 Tab **无** URL 子路径 | `src/App.tsx:App` |
| IM「打开业务数据」、命令面板、侧栏等打开 `data` 面板 | `src/components/IMWorkspace.tsx`；`src/components/CommandPalette.tsx`；`src/components/Sidebar.tsx` |
| 应用 `uses` 含 `biz` / `plan` 等从能力条跳转其它面板 | `src/lib/app-platform.ts:runDeclaredPlatformUse` |

### 设置 vs 三 Tab

| 触点 | file:symbol |
|------|-------------|
| 设置多 section（含 AI 核心、语义记忆、运行环境、存储与数据）；与 Data 三 Tab 无包含关系 | `src/pages/Settings.tsx:SECTIONS` |
| 设置文案说明浏览器壳层持久化范围（未逐项列 `activeDataSubview`，但与实现一致） | `src/pages/Settings.tsx:Settings`（`section === 'data'` 浏览器壳层卡片） |

## 未发现的架构冲突（本范围）

- `src/` 内无 `executeOperation` UI（与架构「无执行按钮」一致）。
- 操作记录页搜索、上一页/下一页、回退按钮均存在且 wired（见上表）。

---

审查完成时间：2026-09-26。未改产品代码与架构页。
