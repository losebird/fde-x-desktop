# FDE-X Desktop 工作台 · 项目评估（2026-09-16）

只读评估，未改代码、未启停进程。基于两份分工报告（架构与进度 / 前端 UI-UX）审阅合并，并对照 `HANDOFF-FDEX-WORKSTATION.md`、`HANDOFF-IM-SESSION-RESTORE.md`。
**局限**：静态阅读 + 一张 5174 `/ai` 截图；「接着做」端到端、iframe 内 DSH 交互、双机配对均**未真人跑过**。所有「已完成」以代码路径存在为据，不等于活测通过。

---

## 1. 这个项目是什么

**本机个人工作台壳**：浏览器只有 FDE-X 自己的顶栏 / 右侧功能条 / AI 主区（React + Vite + Zustand），真正的引擎都在本机进程里：

| 用户看到 | 权威引擎 | 走哪条路 |
|---|---|---|
| AI 对话 / 工具 / 轨迹 | DSH Host（官方 Harness，隔离 profile `~/.dsh-fde-x`） | `AI.tsx` 左栏 + iframe `/dsh-app/`，桥 `fde-x-dsh-bridge` |
| IM、业务过账 | dsh-lan-assist | `/api/v1/im/*`、`/api/v1/biz/*` 白名单转发 |
| 记忆 | dsh-semantic-os | `/api/v1/memory/*`、`/semantic-os/*` |
| 待办 / 日程 / 业务应用草稿 / 布局 | SQLite（`runtime/data/*.sqlite`）+ Zustand | `runtime/db.mjs` |

进程链：`Vite 5174/5175` → `runtime/server.mjs 4318/4319`（BFF：路由、SQLite、DSH RPC、代理、会话 export/restore）→ DSH 子进程。对端一套镜像用于双机 IM。

模块 → 文件：`AI.tsx`、`IMWorkspace.tsx`、`Files.tsx`、`Briefing.tsx`、`Plan.tsx`、`Data.tsx`、`MCP.tsx`/`Skills.tsx`、`Memory.tsx`、`Settings.tsx`；指针 `src/lib/ai-target.ts`；API 层 `src/lib/runtime-api.ts`。

---

## 2. 进度到哪了

### 已接线（代码路径完整）
- DSH 连接、会话列表、iframe 主区，SessionIsland 已删（去岛完成）。
- `loadCurrentAiTarget()` 已被 IM / 早报 / 文件 / Skills / 业务应用 / ⌘K / 记忆引用。
- IM 真信箱（lan-assist）、六件 AI 入口、拟回结果回填输入框、采纳 → `aiInboxDraft` → iframe compose。
- 交接链路：发送方 export → `dsh-handoff.json` v2；服务端 `POST /sessions/restore` 已做到 create → zstd graft（保留新 header、只接 seq 递增事件）→ DSH reload → rename；接收方 `continueHandoff` + `fde-x-ai-restore` + 8s 宽限。
- 文件 CRUD + `..` 拦截 + 回滚；记忆卡起草；MCP 添加写配置；Origin 白名单 403；中文 cwd 剥 `x-dsh-cwd`。

### 半成品
- **IM「接着做」端到端**：磁盘已能写出 256 条递增事件，但 UI 仍可能选错会话 / 空窗 / 标题未刷新；incoming 卡片「0 个会话文件」（线程映射没解析 `sessions[]`，`IMWorkspace.tsx` L467–478）。
- 早报：仍带写死「scene#39」发 IM 模板（`Briefing.tsx` L244、L263）。
- 业务应用「AI 创建」：只 prompt，不写回 screens（`Data.tsx` L364 文案自认）。
- 计划 / ⌘K：任务、工作流初始为空数组，没见到 SQLite 灌入前端（`app.ts` L257–274，`CommandPalette.tsx` L77–78）。
- MCP 启停、Skills 安装按钮 disabled（按规格无 Remote 时应如此，但保存后缺「需重载核心」提示）。

### 没开始
- §0.5「第 N 轮」`turnOutline` UI（只有类型定义）。
- MCP 热加载、双机门牌、一键安装包。
- 工作区文件落到接收方 cwd（`/attach/copy` 存在但未接入接着做）。
- 任何 restore / graft / handoff 的自动化测试（现只有 `runtime/smoke.mjs`）。

### 文档与代码不一致（会误导后续 agent）
| 文档 | 代码 |
|---|---|
| `PRODUCTION-SPEC.md` L5 写「§15 未开工」 | §15.1/15.2/15.5 已落地 |
| `PRODUCTION-STATUS.md` L32–36 仍列「指针乱」「aiInboxDraft 只写不读」 | 与同文 L25–30「已完成」自相矛盾，代码已读草稿 |
| §0.5 要求删 Vite `/api` catch-all、`/plugins` 代理 | `vite.config.ts` L69–72、L87–91 仍在 |
| §0.2 表「禁止 iframe」 | 产品已定 iframe DSH web（HANDOFF L20），规格陈旧 |

---

## 3. 需要改善的地方

### 架构
1. **`server.mjs` 单体 ~2600 行**：路由、biz 翻译、文件写盘、zstd 会话手术、DSH/semantic 代理全在一个文件，任何改动都要换 4318。不建议现在大拆（铁律禁「顺便重构」），但 zstd/restore 一段值得独立成模块并配测试。
2. **IM ↔ AI 靠 DOM `CustomEvent` 耦合**（`fde-x-ai-restore` / `fde-x-ai-prompt` / `fde-x-attach-file`），无单一状态机，restore 竞态就是这么来的。
3. **双工作区模型**：Zustand `workspaces` 与 DSH `listAiWorkspaces` 在 `AI.tsx` L292–300 手工同步。
4. **restore 每次全量 `aiRuntime.reload()`**：重、且制造「列表瞬空 → 自动建空会话」竞态。
5. **错误吞掉**：restore rename 失败 `catch {}`（`server.mjs` L1518–1520）、workspace attach 失败静默（L1491–1493），违反「失败必须黄条」。
6. **测试空白**：无 `src/**` 单测；smoke 不覆盖 restore / graft / handoff。

### 功能（按痛点）
1. **接着做**：三个缺口叠加——收包不解析 `sessions[]`（计数错）；restore 后 `AI.tsx` 选会话与 iframe 刷新不同步；DSH 投影标题刷新未验证。
2. **`AI.tsx` 的 `activeId` 仍回落 `visibleSessions[0]`**（L94–96），而 `loadCurrentAiTarget` 按 `updatedAt` 取最新。两条规则不同 → IM 拟回 / 早报 / 文件发到 A 会话、iframe 显示 B 会话。这是铁律「一根指针」的唯一明显违反点，HANDOFF 也明说「不要回落到 visibleSessions[0]」。
3. 早报 / 业务应用 / ⌘K 残留假数据或半闭环（见上）。

### UX
- **目标不可见**：顶栏只显示工作区，不显示当前 AI 会话名——用户看不出「发给 AI」会打到哪。
- **空会话主区无 Empty 态**：左栏为空时 iframe 照样加载、`activeId` undefined（规格 §0.5 要求 Empty 文案）。
- **文件删除无 confirm**（`Files.tsx` L838–844）；AI 删会话、工作区删除有二次点击，不一致。
- **接着做路径长**：点按钮 → 黄条 → 等 reload → 左栏找会话，失败原因只在 `imBanner`。
- **深链抖动**：`/files` 等立刻 `replace` 到 `/ai`。
- 顶栏通知红点 `unread = 0` 写死；⌘K 记忆结果只能开面板不能「问 AI」。

### UI（不 restyle 前提下）
- 主区双滚动：Stage `overflow-auto` 与 IM/记忆 `overflow-hidden` 不一致。
- 早报 6 列指标在 half 面板可能挤。
- AI 左栏收起后只剩图标，无法区分会话。
- iframe 内是 DSH 原生英文 UI（Chat/Trajectory、Full access），与壳的中文文案风格割裂——这是 iframe 方案的固有代价，非 bug。

---

## 4. 建议的动手顺序（准备改的文件）

### P0 — 先把「接着做」验到绿
| # | 改什么 | 文件 |
|---|---|---|
| 1 | 收包时 `parseHandoffPack` 填 `handoff.sessions`，修「0 个会话文件」 | `src/components/IMWorkspace.tsx` L430–478、L186–195 |
| 2 | `activeId` 去掉 `visibleSessions[0]` 回落，与 `loadCurrentAiTarget` 共用同一选择函数 | `src/pages/AI.tsx` L94–96；`src/lib/ai-target.ts` |
| 3 | restore 后会话选择与 iframe 刷新收口（等 list 就绪再 nav；rename 失败上黄条） | `src/pages/AI.tsx` L197–214、L349–361；`runtime/server.mjs` L1510–1523 |
| 4 | restore 契约脚本（最小 mock zstd 夹具） | `runtime/smoke.mjs` 或新 `runtime/session-restore.check.mjs` |

验收按 `HANDOFF-IM-SESSION-RESTORE.md` §9：5174→5175，对端出现同名会话且有原文，不多一条「未命名」，不自动发 IM。

### P1
5. AI 主区空会话 Empty 态 + 连接中禁用 — `AI.tsx`
6. 早报去 scene#39 模板 — `Briefing.tsx` L241–264
7. 工作区文件接入 `/attach/copy` 落到接收方 cwd（不开 Files 面板）— `IMWorkspace.tsx`、`runtime-api.ts`
8. 收窄 Vite 代理（删 `/api` catch-all、`/plugins`）— `vite.config.ts` L69–91
9. 更新 `PRODUCTION-STATUS.md` L32–38、`PRODUCTION-SPEC.md` L5，消除文档矛盾
10. 顶栏 unread 接真数据或去红点 — `IMMiniHeader.tsx` L10；MCP 保存后「需重载核心」提示 — `MCP.tsx`；文件删除加 confirm — `Files.tsx`

### P2
11. restore 避免全量 reload（cold open）— `server.mjs`，需先验证 DSH 行为
12. ⌘K 任务/工作流接 SQLite 或隐藏分组 — `CommandPalette.tsx`
13. 业务应用 prompt 结果写回 definition — `Data.tsx`
14. 抽 `imState` 轮询为单 hook；评估 `parseIMInput`/`KEYWORD_TRIGGERS` 是否还有调用
15. §0.5「第 N 轮」UI（若仍在本版范围）

---

## 附：原始分工报告
- 架构与进度：`internal/assessment-architecture.md`
- 前端 UI/UX：`internal/assessment-ui-ux.md`

---

下一篇：[AI Native 改善建议](ai-native-recommendations.md)（五模块深评、MCP 连业务、preset / 创造模式）。
