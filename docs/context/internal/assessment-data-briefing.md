# FDE-X 评估：业务应用 & 早报（只读）

依据：`PRODUCTION-SPEC.md` §0.5/§9/§13.5(项5)/§15.3/§15.7/§15.8、`HANDOFF` §4.4/§4.6。源码根：`scene-39-personal-workstation`。截图（Mac 本机）：`/tmp/fdex-ui-data.png`、`/tmp/fdex-ui-briefing.png`（5174 活页，00:38）。

**Git：** `git remote -v` / `git branch --show-current` → `fatal: not a git repository`（该目录无 `.git`）。

---

## 截图所见（5174）

**业务应用 `/data`：** 左主区「正在连接本地核心运行时…」；Stage 内三 Tab「应用|业务记录|操作控制」；黄条「正在检查事务底座」、词表未配；四卡全 0；应用列表空态文案正常；无连接器列表。右 Dock 叠「早报+业务应用」。

**早报 `/briefing`：** 标题区「今日 00:38」+「生成新早报」；指标区无卡片（`metrics` 空）；「今日三件事/时间线」空框；AI 卡说明文 +「发往 IM/保存到记忆」；通知 0、未读 IM 计数 1 但列表区空（与 `imState` 过滤可能不一致）。

---

## 1. 模块现状

### 业务应用 `Data.tsx`

| Tab | 数据源 | 可点动作 | 死/占位 |
|-----|--------|----------|---------|
| **应用** L137-148 | `runtimeApi.health` L91；`listBusinessConnections/Apps/Operations` L92-94；`imState`→词表数 L101 | 刷新 L205；AI 创建 L394-403；选应用→`AppDraftEditor` L425；浏览记录/操作控制 L455-456 | 连接器只展示，无跳转设置；四卡 hint「由 AI 创建」依赖 `appKind` L381 |
| **AuthorityStrip** L182-209 | 同上 | 刷新 | 离线仍可浏览记录 Tab（L151 `runtimeReady=!error`） |
| **业务记录** L150-151 | `bizPreview` 硬编码 `kind:'采购单'` L486-488；`store.businessTables` 仅列兜底 L477-503 | 搜索 L515；规划数据操作→切 Tab L517 | 型芯片仅「采购单」死按钮 L509-511；无 `biz_describe`/catalog；`tableId` 状态未用 L478；来源列恒「现查」 L541 |
| **操作控制** L153-160 | SQLite `plan/approve/execute` + `bizPreview/bizWrite` L609-647 | 生成计划 L674；审批/预览/过账 L724-726 | 默认 `record.update` L561 非规格中文动作；`defaultTable` 未接线 L559；工程师向 JSON 表单 |

**后端：** `server.mjs` 业务草稿 `business/*` L2292-2342（SQLite）；闸 `biz/preview|write|lookup|catalog` L1682-1770→`lanAssist`。

### 早报 `Briefing.tsx`

| 区块 | 数据源 | 动作 | 死/占位 |
|------|--------|------|---------|
| 顶栏 L83-107 | `store.tasks/events`；`loadCurrentAiTarget`+`promptAi` L95-100 | 生成新早报 | 「今日」按钮无 handler L88 |
| 指标 L111-120 | `store.metrics` 但 **value 恒 `—`** L116 | 无 | 有连接器也不拉现查（§13.5/§15.8 半做） |
| 三件事/逾期/时间线 L125-227 | `tasks`/`events`（默认空，不持久化 seed） | 加入专注 L136；链到 `/tasks` `/schedule` | 空列表无引导下一步 |
| AI 卡 L232-271 | 静态说明 L238 | 发往 IM L241-255；保存记忆 L259-267 | 正文写死 `scene#39 收口` L244/263 |
| 通知 L274-299 | `store.notifications`（默认 []） | 全部已读 | 顶栏铃仍可能用 seed（`Header.tsx` L10，本页 0） |
| 未读 IM L302-320 | `imState` 轮询 L38-64 | 进 IM 面板 L303 | 计数与列表不一致风险 L44-48 |
| 新闻 L323-342 | `store.news`（默认 []） | 无 | 区块无空态 |
| 快捷 L345-368 | 路由 | 四链 | 快捷键文案未验证 |

---

## 2. 功能缺口（a–f）

- **a 一键交 AI / 回流：** 业务：`promptAi` 创建/问 AI L361-363、307-310，无结构化回写 `PUT apps`；记录表无「交给 AI」。早报：生成仅 `promptAi` L100，**不写回** AI 卡；IM/记忆用模板非 AI 输出 L244-264。
- **b 提议 vs 直写：** 操作控制审批+preview_id 过账 L724-726 符合人审；业务草稿可手改 L241-255；AI 侧无预览入草稿流程。
- **c 上下文：** `loadCurrentAiTarget` 绑顶栏 cwd+会话 L43-63；业务 refresh 用 `activeWorkspaceId` L85；早报任务未过滤 `workspaceId` L69；未读 IM 已拉真信箱 L41；指标/新闻与业务连接无关。
- **d 诚实态：** 指标 — 正确 L116-117；业务离线提示 L200-201；连接/记录空态清晰；早报 IM 模板仍假主线（§15.8）；`draftMemoryCard` 失败静默 L264-265。

- **e 3 秒能干什么：** 业务副标题+四卡尚可 L125；记录 Tab 无数据时仅「没有匹配」L542；早报空屏多、主 CTA 只有生成，缺「先连运行时/配计划」指引。
- **f 半闭环：** AI 创建→prompt 即止 L361-364；发往 IM/记忆未接生成结果 L241-267；记录现查与操作表单 target 未联动 L560 vs L486。

---

## 3. UX

- 操作控制要求懂 `targetRef`/`record.update`/JSON L666-673，与 §0.5 用户动作「改行/现查」脱节。
- 业务记录蓝条写「闸现查」但应用 Tab 仍提「原型数据」混读 L200-202 vs L520-522。
- 早报副标题假定 IM 已静音 L85，新用户误导。
- AI 生成成功无 in-page 反馈（仅 IM 页可见回复）。
- 未读 IM「进入」不聚焦具体会话 L303。

---

## 4. UI（不改 restyle）

- Stage 窄宽下 Dock+面板挤占，PageTitle 与 Tab 仍可读（截图）。
- 记录表动态列名用英文字段 key L500-501，可读性差。
- `AppDraftEditor` 嵌在列表底部 L425，长表单易丢上下文。
- 早报右栏区块多、空卡片堆叠，首屏信息密度低却无指标占位标签（`metrics=[]` 时网格消失 L111-120）。

---

## 5. 建议

| 项 | 级别 | 规格内/越界 | 文件 | 理由 |
|----|------|-----------|------|------|
| 去掉 `scene#39` 模板，IM/记忆用 `promptAi` 同 session 摘要或禁用 | P0 | 内 §15.8 | `Briefing.tsx` L244-267 | 假主线违背 d |
| 生成早报后写入卡片区（轮询/session 摘取），关联 `sessionId` | P0 | 内 §15.3/§15.4 | `Briefing.tsx`；可选 4318 | 闭环 a |
| 有连接时 `biz_preview` 填 `metrics`；无则 — | P1 | 内 §13.5/阶段 G | `Briefing.tsx` L111-120；`runtime-api` | 半实现指标 |
| `biz_describe`/catalog 驱动记录芯片；来源标系统 | P1 | 内 §9 | `Data.tsx` L477-541；`server.mjs` catalog | 规格闭集 |
| AI 草案→预览→`updateBusinessApp`（采纳按钮） | P1 | 内 §15.7 | `Data.tsx` L298-314 | AI 创建闭环 |
| 操作表单中文动作+从记录带入 target | P1 | 内 §0.5/§9 | `Data.tsx` L552-673 | 降门槛 |
| 空态链到设置运行环境/计划 | P2 | 内 | `Data.tsx` L409；`Briefing.tsx` L159 | e |
| 记录 Tab「交给 AI」选中行 | P2 | 内 §15.1 | `Data.tsx` RecordBrowser | a |
| 重做早报布局/新路由 | P2 | **越界 Ace** | — | restyle/新页 |
| 业务应用改三栏/顶栏顺序 | — | **越界** | — | §0.1 |

---

## 6. 顺带

- 活测环境：核心运行时连接中、业务 0 连接、词表 0，与截图一致。
- `store` v13+ 已剥离持久化 seed（`app.ts` L820-836），与 §13 去 seed 方向一致；`seed.ts` 仍供参考/重置，勿再灌回 metrics 假 DAU。
