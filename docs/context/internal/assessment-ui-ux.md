# FDE-X Desktop 前端 UI/UX 只读评估

**源码根：** `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`
**对照规格：** `PRODUCTION-SPEC.md`（§0.5 优先）、`HANDOFF-FDEX-WORKSTATION.md`、`PRODUCTION-STATUS.md`
**评估方式：** 文档 + 源码通读 + Playwright 截 `/ai`；5174 测时 HTTP 200。

**截图** `/tmp/fdex-ui-ai-main.png`（在 Mac 本机；5174 `/ai`，Playwright headless）：典型 AI-first 布局——顶栏工作区「fdex测试1」、模块导航、IM 红点 1；左 FDE-X 会话栏两条（高亮「【拟回】…」）；中是 DSH iframe（Chat/Trajectory、英文输入条、Full access、grok-4.6）；右缩略图栈含「早报」tab；顶绿条「已连接本地核心…」。说明对话 UI 在 iframe 内，不是规格 §3 里壳层那套中文权限/工具/命令条。

---

## 1. 页面 / 视图清单

| 区域 | 职责 | 入口 | 主要组件 |
|------|------|------|----------|
| **壳路由** | 所有 path 渲染同一母版；`/` → `/ai` | `src/App.tsx` L6–27 | `IMScreen` |
| **顶栏** | 品牌、模块导航、IM 静音、通知→早报、快捷开 IM | `IMMiniHeader` | `src/components/IMMiniHeader.tsx` L7–61；导航 `IMTopNav.tsx` |
| **主工作区（AI）** | 左栏 DSH 会话列表 + 中间 iframe `/dsh-app/`；连接/拖文件/IM 采纳 compose | 默认 `/ai`、`/ai/:chatId` | `src/pages/AI.tsx`；壳内 `IMScreen.tsx` L107–108 |
| **右侧功能条** | 9 模块缩略图（closed/tab/half/full） | `store` `defaultPanels` | `ThumbnailStack.tsx` L15–80；`src/store/app.ts` L237–247 |
| **舞台面板** | full/half 时展示各 page | 顶栏 / 深链 `/im` 等 → `navigate('/ai')` + `togglePanel` | `StagePanel` + `PanelContent.tsx` L36–48 |
| **⌘K** | 搜文件/联系人/preset/记忆/打开面板 | 全局快捷键 `IMScreen.tsx` L91–99 | `CommandPalette.tsx` |
| **IM** | lan-assist 真信箱、六类 AI 动作、交接/接着做 | 面板 `view: 'im'` | `IMWorkspace.tsx`（`PanelContent` L39） |
| **早报** | 指标、待办/日程摘要、生成早报、发 IM | `briefing` 面板；默认 `briefing` 为 tab | `Briefing.tsx` |
| **计划** | 待办 / 日程 / 工作流三 Tab（SQLite） | `plan`；`/tasks` `/schedule` 映射 plan | `Plan.tsx` L32–64 |
| **文件** | cwd 下列表/预览/上传/删/回滚/发给 AI | `files` | `Files.tsx` |
| **业务应用** | 三 Tab：记录 / 操作控制 / 应用 | `data` | `Data.tsx` |
| **MCP / Skills** | 列表、添加 MCP（写 patch） | `mcp` / `skills` | `MCP.tsx`、`Skills.tsx` |
| **记忆** | semantic-os 画布 + 搜索/问这条/跳会话 | `memory` | `Memory.tsx` |
| **设置** | 核心/语义/工作区/配对 | `settings` | `Settings.tsx` + `CoreSettings` / `SemanticSettings` |
| **浮窗** | 面板撕出 | store `floating` | `FloatingPanel.tsx` |

**规格对齐：** 顶栏模块集合与顺序与 `defaultPanels` 一致（IM→设置），符合 `PRODUCTION-SPEC.md` §0.1 / `HANDOFF` §3。

---

## 2. 功能完成度（相对 PRODUCTION-SPEC）

### 2.1 已接线且代码路径清晰

| 能力 | 证据 |
|------|------|
| AI = DSH iframe，非 SessionIsland | `IMScreen.tsx` L6–8、L108；`AI.tsx` L678–694 |
| `loadCurrentAiTarget`（cwd + 左栏 preferred） | `ai-target.ts` L43–63；被 IM/Briefing/Files/Skills/Data/⌘K/Memory 引用 |
| IM 拟回/采纳 → `fde-x-ai-prompt`，结果回填 IM 框 | `IMWorkspace.tsx` L1015–1020；`AI.tsx` L411–418 |
| IM 采纳 → `aiInboxDraft` → iframe `compose`，成功后清空 | `AI.tsx` L372–376、L402–404 |
| 文件拖放 / `fde-x-attach-file` | `AI.tsx` L248–259；`Files.tsx` 引 `loadCurrentAiTarget`（L377） |
| 文件回滚 + confirm | `Files.tsx` L685 附近 |
| 早报生成走 `promptAi` + target | `Briefing.tsx` L95–100 |
| 早报未读 IM 走 `imState` | `Briefing.tsx` L38–48 |
| 发往 IM 走 `imCompose` + `imSend` | `Briefing.tsx` L249–254 |
| ⌘K 文件列表用 target | `CommandPalette.tsx` L58–69 |
| ⌘K 记忆搜索 | `CommandPalette.tsx` L101–116 |
| 记忆「问这条 / 打开会话」 | `Memory.tsx` L657–676 |
| 业务应用 PUT 草稿 +「问当前 AI」 | `Data.tsx` L296–314、创建 L342–366 |
| MCP 列表 API + 添加写配置 | `MCP.tsx` L20–30、保存逻辑（含 error 条 L84） |
| Skills 列表绑 target | `Skills.tsx` L34–42 |
| 接着做 → `restoreAiSessions` + `fde-x-ai-restore` | `IMWorkspace.tsx` L1057–1090；`AI.tsx` L197–214 |
| IM 未读 badge（IM 未全开时轮询） | `IMScreen.tsx` L68–87 |

### 2.2 半成品 / 占位 / 与规格仍差

| 项 | 现状 | 规格 / 状态文档 |
|----|------|-----------------|
| **AI 左栏空列表 UX** | 连接成功但 `visibleSessions` 为空时仍渲染 iframe（`activeId` 可能 undefined），无 §0.5 要求的 Empty「没有会话」主区文案 | `PRODUCTION-SPEC.md` §0.5 未连接/空会话；`AI.tsx` L574–702 无 empty 分支 |
| **§3 输入条权限/工具/命令、第 N 轮、ExecutionTrace** | 壳层 `AI.tsx` 仅会话栏 + iframe；无 `turnOutline` / 轨迹组件引用 | §0.5 第 N 轮、§3 表；`grep` 无 ExecutionTrace |
| **规格 §0.2 写「禁止 iframe」** | 与 §0.5 / HANDOFF 去岛后 **iframe DSH web** 矛盾；以 §0.5 + HANDOFF 为准，壳已 iframe | 文档冲突，非前端 bug |
| **早报「发往 IM」正文** | 仍含写死 `scene#39 收口`（L244–245），非 AI 生成结果 | §15.8、`PRODUCTION-SPEC` §13.5 |
| **早报指标** | UI 已强制 `value="—"`（L116–117），但 `metrics` 仍来自 store 结构 | 符合无连接器展示；待办/日程仍可能为空 store |
| **计划待办/日程/工作流** | `buildInitial` 任务/事件/工作流为空数组（`app.ts` L257–274）；⌘K 任务/工作流恒空（`CommandPalette.tsx` L77–78） | §15.6：SQLite 个人计划应可用，但初始无数据且无 API 灌入 |
| **工作流「运行」** | store 仍有 seed 时代的 runWorkflow，但 workflows 为空 | |
| **业务应用「AI 创建」** | 会 `promptAi`，但文案明确 **不会自动写 screens**（L364）；指标仍写「由 AI 创建」 | §15.7；`PRODUCTION-STATUS.md` L38–39 部分过时 |
| **MCP 启停** | 按钮 `disabled`（L117–120）；保存后需重载核心 | §15.6、`PRODUCTION-STATUS` L17 |
| **Skills 安装/启停** | 「安装新 Skill」disabled（L83） | §0.5 / §3 |
| **接着做 E2E** | 前端链路完整；HANDOFF 仍标双机/0 会话文件/空窗风险 | `HANDOFF` §7、`IMWorkspace` L1074 错误文案 |
| **顶栏通知 unread** | `const unread = 0` 硬编码 | `IMMiniHeader.tsx` L10–47 |
| **IM 关键词假回复** | `parseIMInput` / `KEYWORD_TRIGGERS` 仍在 store（L51–66） | §0.5 禁止假同事；需确认 IM 是否仍调用 |
| **设置 resetDemo** | 仍提 demo 缓存 | `Settings.tsx` L420 |

### 2.3 `currentAiTarget()` 与左栏选中一致性（铁律）

- **目标解析：** `loadCurrentAiTarget` 用顶栏 `cwd` + `activeAiSessionId` preferred，否则同 cwd 下 **按 updatedAt 取最新**（`ai-target.ts` L57–60）。
- **AI 页 active 会话：** `activeId = chatId || visibleSessions[0]?.sessionId`（`AI.tsx` L94–96），**未**在无 URL 时读 `activeAiSessionId`。
- **风险：** 用户未点左栏、URL 无 `chatId` 时，iframe 会话可能是 API 列表第一项，而 IM/早报用的 target 可能是「最近 updated」的另一条 → 误发到错误会话（P0）。

---

## 3. UX 问题

| 问题 | 说明 | 证据 |
|------|------|------|
| **目标不可见** | 顶栏仅工作区切换；未展示「当前 AI 会话名 / cwd 摘要」 | `WorkspaceSwitcher` + `AI.tsx` 左栏标题 |
| **loading** | AI bootstrap `loadingRuntime` 无全屏 loading，仅 banner | `AI.tsx` L58、L276–311 |
| **空会话** | 左栏可无 li，iframe 仍加载 | `AI.tsx` L588–653 vs L678 |
| **sessionNotice** | 并入顶栏 `statusBanner.text`（非独立条） | `AI.tsx` L539–571 |
| **危险操作** | AI 删会话二次点击、工作区删除二次点击、记忆导入 confirm — 较好；**文件删除无 confirm** | `AI.tsx` L644；`Files.tsx` L838–844；`WorkspaceSwitcher` L320 |
| **接着做路径** | 步骤多：点按钮 → banner → 左栏选会话 → 依赖 restore；失败有 `imBanner` err | `IMWorkspace.tsx` L1057–1098 |
| **采纳路径** | adopt → DSH prompt → readAssistant → IM 框；用户需理解「左边干活、右边 IM 不发」 | L1008–1020、L411–418 |
| **深链抖动** | 访问 `/files` 会立刻 `replace` 到 `/ai` | `IMScreen.tsx` L59–66 |
| **键盘** | ⌘K / Esc 有；IM/iframe 内焦点未评估（现网未测） | |
| **滚动** | IM 交接卡信息密度高（L1396 一行 JSX） | |

---

## 4. UI 问题（不涉及 restyle）

| 观察 | 证据 |
|------|------|
| 主区 **双滚动**：Stage 内 `overflow-auto`（`PanelContent.tsx` L28）与 IM/memory `overflow-hidden` 不一致 | L22–29 |
| 窄面板下早报 grid 用 `@container`，指标 6 列在 half 面板可能仍挤 | `Briefing.tsx` L111 |
| AI 左栏收起仅图标，无 session 区分 | `AI.tsx` L655–666 |
| 顶栏 `overflow-x-auto` 模块多时可横滑 | `IMMiniHeader.tsx` L27–30 |
| **现网未测**：像素级错位、iframe 与左栏对齐 | |

---

## 5. 前端代码质量

| 维度 | 评价 |
|------|------|
| **状态** | Zustand + persist；业务 IM/文件以 API 为准，store 仍留 `parseIMInput`、KEYWORD、空 collections（`app.ts`） |
| **耦合** | IM ↔ AI 靠 `CustomEvent`（`fde-x-ai-prompt` 等），清晰但难追踪（`AI.tsx` L245–251） |
| **重复** | 多处 `runtimeApi.imState` 轮询（IMScreen、Briefing） |
| **API 错误** | IM 有 `imBanner`；Files `filesError`；Briefing `aiNote`；CommandPalette 静默 catch |
| **铁律** | 多数模块已 `loadCurrentAiTarget`；**AI 页 activeId 解析是主要例外** |
| **类型** | `runtime-api.ts` 较完整；IM 消息大量 `Record<string, unknown>` |

---

## 6. 改善优先级（仅现有页面）

### P0

1. **统一 AI 主区会话指针与 `loadCurrentAiTarget`**
   - **为什么：** 避免 IM 拟回/早报/文件「发给 AI」进 A 会话、iframe 显示 B 会话。
   - **动：** `src/pages/AI.tsx`（`activeId` 优先 `activeAiSessionId` / `pickCurrentAiSession`）；必要时与 `ai-target.ts` 共用排序。

2. **接着做 / 交接卡「0 会话文件」与 restore 后选会话**
   - **为什么：** HANDOFF 未收口；用户路径断裂。
   - **动：** `IMWorkspace.tsx`（handoff 打包展示 `handoffSessionFiles` L186–195、L1396）；`AI.tsx` restore 后 select。

### P1

3. **空会话 / 连接中主区 Empty + 禁用输入（iframe load 条件）** — `AI.tsx`
4. **早报发往 IM 去掉 scene#39 模板，与「生成新早报」同一数据源** — `Briefing.tsx` L241–264
5. **顶栏通知 unread 接真数据或移除红点** — `IMMiniHeader.tsx` L10
6. **⌘K 任务/工作流接 SQLite 或隐藏分组** — `CommandPalette.tsx` L77–78
7. **业务应用创建后引导「问 AI → 手动保存草稿」** — `Data.tsx`；指标文案与 §15.7 一致
8. **MCP 保存成功/失败 + 重载核心提示** — `MCP.tsx`

### P2

9. **计划模块空态说明「个人 SQLite，与 DSH plan 无关」** — `Plan.tsx`
10. **CommandPalette 记忆结果「问 AI」快捷** — 现仅打开 memory 面板
11. **减少 IM/Briefing 重复 imState 轮询** — 抽到单 hook
12. **sessionNotice 固定可见条** — `AI.tsx`
13. **评估是否仍调用 `parseIMInput`** — `store/app.ts` L206、`KEYWORD_TRIGGERS`

---

## 7. 截图与输出路径

- **5174：** 测时 `curl` 200，`lsof` 有 node 监听。
- **截图（Mac 本机）：** `/tmp/fdex-ui-ai-main.png`（5174 `/ai`，Playwright headless）。
- **报告原件（Mac 本机）：** `/tmp/fdex-assessment-ui-ux.md`。

---

## 8. 对照表（chrome 最小集 — 代码层，非 parity）

| 单元 | 母体（规格） | fdex 源码 | 备注 |
|------|--------------|-----------|------|
| 顶栏模块 | §0.1 顺序 | `app.ts` L237–247 | 已对：集合/顺序 |
| 主区 | AI 三栏 + DSH | `AI.tsx` + iframe | 壳无 §3 增按钮 |
| Empty 未连接 | §0.5 | `AI.tsx` L574–577 | 已对文案 |
| Empty 无会话 | §0.5 | — | 未对：缺主区 Empty |
| currentAiTarget | §15.1 | `ai-target.ts` | 仍差：AI activeId |
| aiInboxDraft | §15.2 | `AI.tsx` L372–404 | 已对 |
| 早报 IM | §15.3 | `Briefing.tsx` | 仍差：模板文案 |
| 接着做 | HANDOFF | `IMWorkspace.tsx` | 仍差：E2E |
| Palette | §15.4 | `CommandPalette.tsx` | 部分：记忆无问 AI |
| 主题/restyle | 禁止 | 未改评估 | — |

**现网未测：** 布局数值、iframe 内 DSH 权限/第 N 轮/轨迹。
