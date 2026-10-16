# FDE-X 评估：计划 / MCP / Skills（只读）

依据：`PRODUCTION-SPEC.md` §0.2/§0.5/§3/§15.6；`HANDOFF-FDEX-WORKSTATION.md` §4.5/§4.7。源码根：`scene-39-personal-workstation`。截图（Mac 本机，5174，核心未接通）：`/tmp/fdex-ui-plan.png`、`/tmp/fdex-ui-mcp.png`、`/tmp/fdex-ui-skills.png`。

## 1. 三模块现状

### 计划 `src/pages/Plan.tsx`
- **顶栏 Tab**（`L37-63`，store `activePlanTab` `app.ts:L456-457`）：待办 / 日程 / 工作流。
- **待办**（`L85-249`）：数据 `useApp.tasks`（`app.ts:L490-501`，**仅内存**）；可点：状态切换、删、搜、标签筛、新建抽屉。**无** AI/导出/交给会话按钮。`Filter`/`Bot`/`History` 仅 import（`L4-5`）未用。
- **日程**（`L264-442`）：`events` 内存 CRUD；日视图时间轴+今日清单可删；**周视图**（`L365-387`）表头写死「9 月 {7+idx} 日」且用 `events.slice(0,2+i%3)` 凑格——非真日历。
- **工作流**（`L450-691`）：`useCurrentWorkflows()` 按 `activeWorkspaceId`（`app.ts:L894`）；新建默认 `paused`+占位步「本版不自动跑…」（`L496-507`）。**运行** `disabled`（`L593`）；**启用** 仅 `active` 时可点暂停，**paused 时启用 disabled**（`L594-600`）；删可用。`runWorkflow` 仍在 store 里假跑（`app.ts:L670-684`）但 UI 未接。

### MCP `src/pages/MCP.tsx`
- **指标卡+搜索+分组列表**（`L57-133`）：`GET /api/v1/mcp/servers`（`runtime-api.ts:L1023`；`runtime/server.mjs:L2198-2215`）解析 **DSH patch 的 serverName**，非会话 `tools` 投影；`connected` 仅看 `aiRuntime.status().connected`，工具名占位 `mcp__name`（`server.mjs:L2206-2212`）。
- **添加**（`L135-200`）：`POST` 追加 patch，已连接则 stop/start（`server.mjs:L2241-2248`）；成功 `needsRestart` 时页顶红字（`L188`）。**连接/断开** per-server `disabled`（`L117-125`）。列表 `catch→[]`（`L30`）吞错。弹窗文案「自动重新拉起」（`L165-167`）与 §15.6「需重载」及失败路径易打架。

### Skills `src/pages/Skills.tsx`
- **列表+右侧详情**（`L75-201`）：`loadCurrentAiTarget`+`listAiSkills(sessionId)`（`L25-65`，`ai-target.ts:L43-63`）；依赖 `activeWorkspaceId` 刷新。未连接：`note='核心未接通'`（`L30-32`）。**启停/安装/编辑** 均 `disabled`（`L83-84`、`L140-147`、`L189-196`）；**来源筛选** 按钮无逻辑（`L82`）。空列表文案「没有匹配的 Skill」（`L115-116`），非 `Empty` 组件。详情「运行统计」恒 `—`（`L176-185`）。`source` 映射全 `builtin`（`L53`）。

### 与规格表（§3/§0.2）落差
- 计划：HANDOFF 写 **个人计划 SQLite**（§4.5），表在 `runtime/migrations/002_modules.sql:L111-174`，**无** `server.mjs` 读写 API；`partialize` 不持久 tasks/events/workflows（`app.ts:L798-834`）→ 刷新即空。
- IM「摘成待办」：`IMWorkspace.tsx:L1517-1522` → `addTask` 同上，**不落 SQLite**。

## 2. 功能缺口（a–f）

| 判据 | 计划 | MCP | Skills |
|------|------|-----|--------|
| **a 一键交给 AI / 回流** | 无 `promptAi`/待办回流；IM 待办仅内存 | 无「把工具列表交给 AI」 | 无「用此 Skill 问 AI」 |
| **b 提议 vs 直写** | 人手工 CRUD；AI 不参与 | 添加=人确认后写 patch（真写） | 只读 catalog |
| **c 上下文** | 待办/日程**不**按工作区；工作流按 ws | **不**绑 `currentAiTarget`/cwd | **已**绑 target（`Skills.tsx:L34-42`） |
| **d 空/错/无 Remote** | 待办 Empty 诚实；周视图**不假** | 空态好；API 失败变空列表 | 未连接 note 在 subtitle；空列表像「筛没了」 |
| **e 3 秒能干什么** | 懂「建任务」；不懂与 DSH plan-mode 边界 | 懂「加服务器」；与左侧核心断开关系弱 | 懂「浏览」；安装灰掉无替代路径 |
| **f 半闭环** | 工作流文案可启用 vs 按钮禁（`L681-683` vs `L599`）；`runWorkflow` 死代码 | 保存/重载提示不完整；列表≠会话工具 | 详情「查看详情」无动作（`L148`） |

## 3. UX
- 三页均在 **Stage 右栏**（截图），与 AI 主区并列；计划/MCP 无「当前工作区/会话」提示（Skills 仅失败时 subtitle）。
- 计划待办与 IM/早报 **数据割裂**（早报读 `tasks` `Briefing.tsx:L27-71`，但会话内无法一键整理待办）。
- MCP 添加默认命令 `@example/mcp-server`（`MCP.tsx:L36`）易误保存。
- Skills 未连接时仍显示「三个来源」副标题（`L79`），与全 `builtin` 映射矛盾。
- ⌘K：`CommandPalette.tsx:L77-78` tasks/workflows **硬编码空数组**，计划模块对全局搜索不可见。

## 4. UI（不改 restyle）
- 计划：双「新建任务」（Empty+底栏 `L176-215`）重复；周视图假日期损害可信度（`L371-383`）。
- MCP：0/0/0 三卡占高（`L57-70`），列表区空时信息重复；错误条在搜索下易被忽略（`L84`）。
- Skills：主列表空、右栏无选中时右侧空白（`L156-200`）；筛选条「来源筛选」像可点实死。

## 5. 建议

**规格内可直接做**
- **P0** 计划接 SQLite 或明确降级：增 `runtime/server.mjs` CRUD + `runtime-api` + `Plan.tsx`/`app.ts` 水合；IM `addTask` 走同一 API（`002_modules.sql`、`IMWorkspace.tsx:L1517`）。*因 HANDOFF §4.5 承诺 SQLite。*
- **P0** MCP 列表对齐诚实：失败勿 `catch→[]`（`MCP.tsx:L30`）；统一保存后文案与 §15.6（patch 块 `L165-167` vs `L188`）；可选标「配置项/非实时工具」。
- **P1** 计划 AI 入口（§15.6）：`promptAi(loadCurrentAiTarget)`「整理待办」或禁用并 tooltip；工作流抽屉改文案与按钮一致（`Plan.tsx:L681-683`、`L594-600`）。
- **P1** Skills：未连接用 `Empty`+链到设置核心；`note` 时勿显示「0 个·三来源」（`Skills.tsx:L79-116`）；禁用「来源筛选」或接 filter。
- **P2** ⌘K 读 store/API 任务（`CommandPalette.tsx:L77`）；MCP 添加去掉 example 默认值（`MCP.tsx:L36`）。

**越界需 Ace 拍板**
- **P1** MCP 列表改为 **当前会话 tools 投影**（§0.2 表）而非仅 patch 解析——涉及 AI 侧 tools API，非纯壳层。
- **P2** 计划页顶栏说明「个人 SQLite 计划 ≠ DSH plan-mode」（§0.2/§4.5）——新文案需对照 §0.1 文案闭集。
- **P2** Skills 启停 Remote、安装市场——规格 §15.6 本版不做，保持 disabled 即可。

## 截图简述
- **plan**：右栏计划满屏，待办 0，Empty+新建；左 AI「核心未接通」；顶栏计划 Tab 选中。
- **mcp**：右栏 MCP，三指标 0，Empty 提示写 DSH+重连核心；与左栏断开态一致。
- **skills**：右栏 Skills，筛选+搜索，中空「没有匹配的 Skill」；安装按钮灰；左栏同样未接通（列表未拉到 catalog）。
