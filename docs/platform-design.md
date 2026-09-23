# FDE-X 工作台 · AI Native 平台方案（2026-09-16）

回应 Ace 的四条产品方向 + 「模块互通、记忆语义复用」。前置阅读：[项目评估报告](project-assessment.md)、[AI Native 改善建议](ai-native-recommendations.md)。
本篇基于五份只读事实摸底（业务应用运行时、业务记录/早报接入、semantic-os 能力、DSH preset、MCP），所有「现状」都有源码依据；「方案」部分是设计判断，需要你拍板的地方单列在 §8。

---

## 0. 一页结论

| 方向 | 现状能撑到 | 差什么 | 方案核心 |
|---|---|---|---|
| AI 生成完整应用 | 存草稿 `definition_json`（无 schema、无渲染、无表）；DSH 能在 cwd 写代码；cordis 能动态装插件 | schema、建表、通用 CRUD 运行时、AI 写回通道、激活 | **App Spec（声明式）+ 通用运行时 + Builder preset**，代码级应用作为进阶层 |
| 业务记录自动浮现 + 增删改查审 | AI 每次 `biz_preview` 已写进 lan-assist `/state.pendingSheet`；preview 返回 `rows+columns+preview_id`；`operations.execute live` 返回 501 | 记录页不读 pendingSheet、硬编码采购单、execute 没接 `biz_write`、traces 未暴露 | **订阅 pendingSheet + 工具调用流 → 记录页浮现；行内动作全部走 preview→人审→write** |
| 可自定义早报 + 外部源 | `briefing_definitions / briefings` 表已建（sources/sections/schedule）但零接线；BFF 无 cron；无邮箱/RSS 通道 | 配置 API/UI、采集层、调度、外部源 | **Briefing 定义 + 采集器 + 「早报 agent」跑 MCP 源 + 轻调度** |
| 模块互通 + 记忆复用 | semantic-os 几十个接口，FDE 只用 find / cards / 六画布；`outbox_events` 表有、无发布者；模块间靠 DOM CustomEvent | 事件总线、上下文包、写入记忆的通道 | **事件总线 + 上下文包 + 记忆读写两侧统一接口** |

**架构上只需要新增四个横向能力，四条方向全部落在它们之上**：
1. `fde-x-dsh-bridge` 从「会话导出桥」升级为 **Host 工具集**（AI 可调的 FDE 工具：提交 App Spec、查/写应用记录、读上下文、写记忆草稿）。
2. BFF 增加 **事件总线**（`outbox_events` → SSE `/api/v1/events`），替代轮询和 DOM 事件。
3. BFF 增加 **App 运行时**（Spec 校验 → SQLite 受控建表 → 通用 CRUD API）+ 前端 **通用渲染器**。
4. **上下文包 / 记忆写入器**：所有「交给 AI」前拼上下文，所有重要动作后落记忆草稿。

---

## 1. 应用模块：AI 生成完整应用

### 1.1 先厘清「应用」是什么

现状 `business_apps.definition_json` 是任意 JSON，前端只有 `AppDraftEditor` 文本表单，没有任何东西能「跑」（`Data.tsx` L216–318、L425–431）。SQLite 没有按应用的表，`db.mjs` 没有运行时 DDL。要成为「完整应用」，必须定义应用的**可执行形态**。两种形态：

| 形态 | 产物 | 谁执行 | 风险 | 适用 |
|---|---|---|---|---|
| **L1 声明式应用** | `app.spec.json`：实体/字段/视图/动作/权限/数据源 | FDE-X 通用运行时（BFF + 前端渲染器） | 低：spec 被校验，只能生成允许的表和动作 | 表单类、台账类、审批流、看板——80% 的个人/小团队业务应用 |
| **L2 代码级应用** | Cordis 插件（Host 工具 + Client UI slot）或独立前端包 | DSH Host 动态装载（`cordis_run`，不需重启） | 高：任意代码 | 需要复杂逻辑/可视化/外部集成的应用 |

**建议以 L1 为主干，L2 作为「高级模式」后置。** 理由：L1 能保证「用户描述 → 5 分钟内有一个真能增删改查的应用」，且 AI 生成 JSON 比生成整套代码可靠得多、可校验、可 diff、可回滚（`business_app_revisions` 表已经有了）。L2 依赖「Cordis 动态插件当产品」，这是规格写明本版不做的，需要你决定是否解禁。

### 1.2 L1 声明式应用：App Spec

```json
{
  "spec": "fde-app/v1",
  "slug": "supplier-visits",
  "name": "供应商拜访台账",
  "entities": [
    { "name": "visit", "label": "拜访", "fields": [
      { "name": "supplier", "type": "ref", "ref": "biz:供应商", "label": "供应商" },
      { "name": "date", "type": "date", "required": true },
      { "name": "summary", "type": "text" },
      { "name": "status", "type": "enum", "options": ["计划", "已拜访", "需跟进"] }
    ]}
  ],
  "views": [
    { "type": "table", "entity": "visit", "columns": ["date", "supplier", "status"], "filters": ["status"] },
    { "type": "form", "entity": "visit" },
    { "type": "kanban", "entity": "visit", "groupBy": "status" }
  ],
  "actions": [
    { "name": "mark-followup", "label": "标记跟进", "entity": "visit", "set": { "status": "需跟进" } },
    { "name": "sync-to-erp", "label": "同步到采购系统", "kind": "biz", "biz": { "kind": "采购单", "action": "新建" }, "approval": "required" }
  ],
  "permissions": { "read": "workspace", "write": "owner", "approve": "owner" },
  "memory": { "onWrite": "draft-card" }
}
```

要点：
- **字段类型闭集**（text / number / date / enum / ref / file / json），`ref` 可以指向本应用实体或 `biz:<型>`（外部 NocoBase 数据，只读引用）。
- **动作两类**：`set`（本地数据改写，直接执行）和 `biz`（外部系统，**必须**走 `biz_preview → 人审 → biz_write`，复用现有闸）。
- **视图闭集**：table / form / detail / kanban / calendar / stat。够覆盖台账、审批、看板。
- `memory.onWrite` 声明写操作是否自动起草记忆卡。

### 1.3 运行时（BFF）

| 组件 | 做什么 | 落点 |
|---|---|---|
| Spec 校验器 | JSON Schema 校验 + 字段名/表名白名单正则 + 引用完整性 | 新 `runtime/apps/spec.mjs` |
| 物化器 | `CREATE TABLE app_<slug>__<entity>`（列类型映射到 SQLite 五种存储类），字段增删走 `ALTER TABLE ADD` / 影子表迁移；每次物化记 `business_app_revisions` | 新 `runtime/apps/materialize.mjs`；`db.mjs` 增受控 DDL 入口（只接受物化器生成的语句） |
| 通用 CRUD API | `GET/POST /api/v1/apps/:slug/:entity`、`PATCH/DELETE .../:id`、`POST .../actions/:name`；筛选/排序/分页；`ref: biz:*` 字段读时经 `biz_preview 现查` 补全显示值 | `server.mjs` 新路由段（建议独立文件后 `import`，别再往单体里加） |
| 激活状态机 | `draft → validating → active → archived`；`active` 才建表/暴露 API | `db.mjs` + `003` 表的 `status` 列 |
| 审计 | 每条写入进 `operations`（现在 `operation_steps` 没有 INSERT 路径，一起补），支持 `compensations` 撤销 | 复用 `003_business_operations.sql` |

### 1.4 前端渲染器

在业务应用「应用」Tab 里，选中 `active` 应用 → 渲染 `views`（不是 `AppDraftEditor`）。需要一套通用组件：`SpecTable`、`SpecForm`、`SpecDetail`、`SpecKanban`、`SpecStat`，每个约 100–200 行，全部复用现有样式 token（不 restyle）。`AppDraftEditor` 保留为「编辑 spec」抽屉。

这是规格「不发明页面」条款下最大的灰区：**不新增路由和顶栏模块**，但业务应用模块内部会出现新的子视图。见 §8。

### 1.5 生成链路：用户描述 → 应用

```
用户在业务应用点「AI 创建」→ 描述需求（可选：选 builder preset、选外部数据型）
  → FDE 用 agentPreset=fde-app-builder 新建 DSH 会话（专用，不污染当前会话）
  → prompt = 需求 + 上下文包（当前工作区已有应用、biz_describe 的型目录、相关记忆先例）
  → AI 调 Host 工具 fde_app_spec_submit(spec)  ← 结构化写回，不解析自然语言
  → BFF 校验 → 存 draft revision → 事件总线推「spec 已生成」
  → 业务应用页弹预览（渲染器渲染 draft，用假数据 3 行）→ 用户「采纳并激活」/「让 AI 改」
  → 激活 → 建表 → 应用可用
```

**`fde-app-builder` preset**：从 `standard` 复制，加两个 Skill：`fde-app-spec`（spec 规范 + 范例 + 校验规则）和 `fde-business-vocab`（如何用 `biz_describe` 查外部型）。放 `~/.dsh-fde-x/.agent-presets/fde-app-builder/`。这就是「用 preset 造应用」的落点。

**开源 preset 怎么参与**：builder 是 FDE 自带的；用户导入的开源 preset（如 `researcher`、`writer`）可以作为**应用里动作的执行者**——spec 里 `actions[].kind: "agent"`，指定 `preset` 和 prompt 模板，比如「用 researcher preset 为这条供应商生成背景调研」。这样开源 preset 不只是聊天风格，而是成为应用能力。

**cordis 创造模式的位置**：L2。用户在 AI 页选创造模式，让它「给供应商台账做一个自动计算拜访 KPI 的插件」，产出 Cordis 插件 → 走 `cordis_run` 装载 → 在 spec 里以 `actions[].kind: "plugin"` 引用。这是后置能力。

### 1.6 数据边界：与「SQLite 不是 ERP」怎么共存

原铁律的意图是**不要把 NocoBase 的业务数据抄进 SQLite 当真值**。这条继续守：
- 生成应用的**自有数据**（拜访记录、内部台账、个人流程）住 SQLite，这是应用的真值，不是 ERP 的副本。
- 引用外部数据只存 **id + 显示快照**，展示时经 `biz_preview` 现查刷新，标「当时/现在」。
- 任何写外部系统的动作走闸。

建议把铁律改写为：「**ERP 真值在 NocoBase；生成应用的自有数据在 SQLite；两者之间只有引用，没有复制。**」

---

## 2. 业务记录：随 AI 操作自动浮现 + 增删改查审

### 2.1 浮现机制（现成钩子都在）

- lan-assist `/state` 里已有 `pendingSheet` / `pendingWrite`，AI 每次 `biz_preview` 都写进去（`gate.js` L143–150），FDE 已经在轮询 `/state`（用于 IM 未读）。
- `runtime/ai-stream.mjs` 能看到 `tool/call` 的工具名（L46–85）。
- `biz_preview` 返回 `sheet{kind, action, rows[], columns[], preview_id, canWrite}`（`write.js` L54–150）——直接就是表格。

方案：BFF 把「pendingSheet 变化」和「`biz_*` 工具调用」发到事件总线 → 业务记录 Tab 订阅 → 顶部出现「AI 刚查了：采购单（12 行，会话 X）」卡片，点开即表格；型芯片改由 `biz_describe` 的 `kinds[]` 驱动，不再硬编码。历史记录用 `/traces`（BFF 现在没暴露，`dsh-core.mjs` 白名单加 `/traces`）。

### 2.2 增删改查审：一条链

| 用户动作 | 实现 |
|---|---|
| 查 | `biz_preview(现查)`，表格渲染 `columns`（现在用动态 key，英文难读——`columns` 里有 label，用它） |
| 改行 / 新建 / 删除 / 过审 | 行内菜单 → `biz_preview(action)` 拿 `preview_id` 和 diff → 弹「确认过账」→ `biz_write(preview_id)` |
| 审（审批） | 把 `operations` 状态机真正接上：`plan` 记 preview 内容（现在 `plan_json='{}'`），`approve` 后 `execute live` 调 `biz_write`（现在 501），`operation_steps` 补 INSERT |
| AI 拟改 | AI 在会话里 `biz_preview(改行)` → 浮现到记录页带「AI 拟改」标签 → 人在记录页点「过账」，**不需要回 AI 页** |

这样「操作控制」Tab 变成审计/审批中心（谁改了什么、待审队列、补偿撤销），「业务记录」Tab 是操作面。两者共用 `operations` 表，不再分叉。

### 2.3 与生成应用的关系

生成应用里 `ref: biz:*` 字段和 `kind: biz` 动作，走的就是这条链。业务记录 Tab 同时能看「外部型」和「本地应用实体」，用来源标签区分。

---

## 3. 早报：可自定义 + 外部信息源

### 3.1 数据模型（表已经有了）

`briefing_definitions(sources_json, sections_json, schedule_json)` 和 `briefings`（`002_modules.sql` L258–281）零接线。直接用：

- `sections_json`：区块列表 + 顺序 + 开关，每块声明 `source` 和 `render`（list / stat / digest / timeline）。
- `sources_json`：源清单，两类——**内部源**（`tasks.today`、`im.unread`、`biz.pending-approval`、`memory.daily-cards`、`memory.recent-decisions`、`apps.<slug>.<view>`）和**外部源**（`mcp:<server>:<tool>` 如邮箱、RSS，`http:<url>` 可选）。
- `schedule_json`：`{ "at": "08:30", "days": [...], "onOpen": true }`。

### 3.2 采集与生成：谁来跑

BFF 没有 cron，也不能直接调 MCP（MCP 工具只有 AI 会话能用）。两条路：

| 路 | 做法 | 优 | 劣 |
|---|---|---|---|
| A. BFF 原生采集 | BFF 自己写 IMAP/RSS 客户端 | 稳定、可控 | 要新增出网依赖、每种源写一个适配器、违背「引擎在 DSH」的架构 |
| **B. 早报 agent** | BFF 轻调度（`setInterval` 对齐 `schedule_json`）→ 用 `fde-briefing` preset 开会话 → AI 用 MCP 工具（IMAP/RSS）+ FDE Host 工具（内部源）采集 → 调 `fde_briefing_submit(sections)` 结构化写回 → 存 `briefings` | 外部源即插即用（装 MCP 就行）、摘要/去重/优先级天然由 AI 做、复用 §1 的工具写回机制 | 依赖 DSH 在线；每次早报一次会话成本 |

**推荐 B**，内部源走 Host 工具直读 SQLite/lan-assist/semantic-os（快、确定），外部源走 MCP（`andrewmalov/mcp-imap`、`kwp-lab/rss-reader-mcp` 之类，在 MCP 页装）。BFF 只做调度和存储。

### 3.3 UI

Briefing 页保留现有布局，加：
- 「自定义」抽屉：拖排区块、开关、选源、设时间（写 `briefing_definitions`）。
- 每个区块头显示来源和采集时间；外部源失败显示「邮箱源 2 小时前失败」而不是空白。
- 「生成新早报」= 立刻跑一次早报 agent；结果落 `briefings` 并渲染（解决现在「生成后结果只在 AI 页」）。
- 「发往 IM / 保存记忆」用真实内容。

「业务系统未完成的工作」= 源 `biz.pending-approval`：经 `biz_preview(现查, 过审待办型)` 聚合，型由用户在自定义抽屉里选。

---

## 4. 模块互通 + 记忆作为连接层

### 4.1 事件总线（先修管道）

- `outbox_events` 表已存在，`listPendingEvents` 只列不发。补一个发布者 + SSE `GET /api/v1/events?workspace=`。
- 事件类型（最小集）：`ai.tool.called`、`biz.sheet.pending`、`biz.write.done`、`app.spec.submitted`、`app.record.changed`、`task.changed`、`im.message.received`、`briefing.ready`、`memory.card.drafted`。
- 前端一个 `useEvents()` hook 替换现有的 `imState` 多处轮询和 `fde-x-*` DOM CustomEvent。

### 4.2 上下文包（每次「交给 AI」都带）

现在各模块 `promptAi` 只带一句话。统一成 `buildContextPack({ target, intent, entity })`，BFF 组装：
- 当前工作区：cwd、活跃会话、今日待办摘要、未读 IM 数、最近 3 条业务操作。
- 记忆：`POST /find`（相关段落）+ `find_precedents`（先例）+ `brief_for_decision`（若是决策类）。
- 实体：如果从业务记录 / 应用记录 / 任务发起，带那条记录的字段。

前端在发送前显示「附带 5 条相关记忆、2 条先例」芯片，可点开、可去掉。这一步让 IM「先例」从「提示 AI 自己去搜」（`im-ai.ts` L134–136）变成真的先搜好。

### 4.3 记忆写入侧（统一「记忆写入器」）

规则（守铁律）：
- **只写草稿**：`draft_memory_card`，用户在记忆页点头才入档；高价值动作（用户批准的业务过账、采纳的 IM 回复、激活的应用）额外 `record_decision` 进图。
- **不复制长文**：FAISS 只进向量 + id；id 用 `im:<msgId>`、`biz:<traceId>`、`task:<id>`、`app:<slug>:<entity>:<id>`，BFF 提供 `GET /api/v1/corpus/:id` 让 semantic-os 的 `openCorpus` 回读原文（现在只有 `session:` 一种 id 能回读，要扩）。
- **标时间**：卡片带「当时」时间戳，图不当现况。

触发点：`biz.write.done`、IM 采纳、任务完成、应用记录写入（spec `memory.onWrite`）、早报生成。

### 4.4 各模块的互通清单

| 从 → 到 | 具体互通 |
|---|---|
| IM → 计划 | 「摘成待办」真落 SQLite（现只进内存） |
| IM → 业务记录 | 消息里的采购单号点击 → `biz_preview` 浮现 |
| IM → 记忆 | 采纳的回复自动起草卡；「先例」走 find |
| 业务记录 → 记忆 | 过账后起草卡 + `record_decision` |
| 记忆 → 业务 / IM / 计划 | 上下文包；记忆卡上「打开相关记录 / 会话 / 任务」 |
| 计划 → AI | 「整理待办」；任务可「交给 AI 执行」→ 开会话带任务上下文 |
| 早报 → 一切 | 每个区块条目可跳原处（任务、IM、记录、卡片） |
| 文件 → 记忆 | cwd 文档 `ingest_directory`（semantic-os 有，FDE 未接） |
| 应用 → 早报 | 应用的 stat 视图可作早报区块 |
| Skills / preset → 应用 | 开源 preset 作为应用动作执行者（§1.5） |
| 双机 | App Spec 和早报定义可作为交接包附件传给对端（复用现有 handoff 机制） |

---

## 5. 你没提到、但对 AI Native 工作台重要的

1. **主动性（Proactive）**：有了事件总线 + 记忆，AI 可以在不被问的时候提建议——「这个供应商上次拜访时你标了需跟进，已 30 天」。落点：早报区块 `ai.suggestions` + 顶栏通知（现在 `unread = 0` 写死）。所有建议都是「建议卡」，人点才执行。
2. **统一审计与撤销**：所有 AI 触发的写入（外部过账、应用记录、记忆入档、任务变更）都进 `operations`，`compensations` 表给出撤销路径。一个「AI 今天做了什么」时间线，是信任的基础。
3. **权限模型**：应用 `permissions` + DSH 权限档（仅可查看 / 工作区内修改 / 完全权限）对齐；builder preset 只给「工作区内修改」，早报 agent 只给「仅可查看」+ 指定 MCP。
4. **成本与可观测**：semantic-os 有 `/usage`，DSH 会话有 token；在设置页给一个「本周 AI 用量：会话数 / 工具调用 / 早报次数」。
5. **评测集**：builder preset 需要一组 golden 需求描述 → 期望 spec，作为回归测试；早报 agent 需要「源失败」「空数据」用例。现在全仓只有 `smoke.mjs`。
6. **工作区即租户**：`tasks/events` 现在不按 `workspaceId` 过滤，早报也不。所有新表都以 `workspace_id` 为第一列，和 DSH `cwd`、semantic-os 的 per-cwd 索引对齐。
7. **模型/preset 路由**：不同任务用不同 preset（builder、briefing、standard、用户导入的），FDE 在「交给 AI」处按意图选 preset，而不是永远用当前会话。这是 `currentAiTarget` 铁律的一个必要扩展：**目标会话 = 当前会话，除非动作声明了专用 preset（则新开会话并在左栏可见）**。

---

## 6. 分阶段路线

| 阶段 | 内容 | 产出可见性 |
|---|---|---|
| **0 基线**（~1 周） | `git init`；上篇 P0（activeId、接着做）；`askAiForResult` / bridge 工具写回骨架（`fde_submit_json`）；事件总线 SSE；计划接 SQLite | 接着做能用；IM 摘成待办真落库 |
| **1 应用 L1 + 记录浮现**（~3 周） | App Spec v1 + 校验/物化/CRUD API；`SpecTable/Form/Detail`；`fde-app-builder` preset + `fde_app_spec_submit`；业务记录订阅 pendingSheet、型由 describe 驱动、行内动作走闸；operations execute 接 `biz_write` | 「描述 → 采纳 → 能用的台账」跑通；AI 查什么记录页就显示什么 |
| **2 早报 + 记忆连接**（~2 周） | `briefing_definitions` API + 自定义抽屉；`fde-briefing` preset + `fde_briefing_submit`；轻调度；MCP 页装 IMAP/RSS；上下文包 v1；记忆写入器（草稿卡 + corpus 回读） | 早报可配、有邮件/RSS/业务待审；IM 先例真搜 |
| **3 进阶**（按需） | Kanban/Calendar 视图；开源 preset 作为应用动作；主动建议；撤销；L2 代码级应用（cordis）；preset 导入 UI | — |

每阶段结束跑一次真人验收（按 HANDOFF §9 的口令风格写验收清单），不口头宣称。

---

## 7. 主要风险

- **AI 生成 spec 的稳定性**：靠 Skill 里的规范 + 校验器兜底 + 预览让人看；失败时显示校验错误让 AI 重试，不静默。
- **SQLite 受控 DDL**：只允许物化器生成的语句；表名前缀 `app_`；字段类型闭集；影子表迁移要有测试。
- **DSH 依赖**：早报 agent、builder 都要 DSH 在线；离线时早报显示上次结果 + 「核心未连接」。
- **规格冲突**：见 §8，不拍板前不动相关代码。
- **单体 `server.mjs`**：新增的 apps / events / briefing 路由必须独立文件，否则 4000 行没人敢改。

---

## 8. 已拍板（2026-09-16，Ace）

1. 铁律改写为：**业务系统的真值在业务系统内**（NocoBase 只是其中一个，后续接更多）；生成应用的自有数据在 SQLite；只引用不复制。
2. 「不发明页面」= 不新增路由、不改顶栏模块；模块内子视图允许。
3. **先只做 L1 声明式**；L2 代码级应用暂不做。
4. 早报走「早报 agent + MCP」。
5. 早报调度解禁。
6. 专用 preset 动作新开会话——同意。
7. `git init` 立即执行。

新增需求（另立方案）：**多浮窗同时撕出**；**单一安装包、mac / Linux / Windows 通用**（内置 DSH、semantic-os runtime、lan-assist）。

完整决策记录见 [项目上下文](project-context.md)。
