# FDE-X 工作台 · AI Native 改善建议（2026-09-16）

续 [项目评估报告](project-assessment.md)。本篇回答三件事：五个模块（业务应用 / 早报 / 计划 / MCP / Skills）还差什么；MCP 连业务系统怎么走；应用模块 × DSH preset / 创造模式、开源 preset 怎么接。
依据四份只读研读（源码 + 官方 DSH 包 + 5174 截图），未真人操作。所有行号以当日源码为准。

---

## 0. 先说两个前置事实

1. **源码目录不是 git 仓库**（`git remote -v` → `fatal: not a git repository`）。任何改动前先 `git init` 并提交一版基线，否则没有回滚点。这也意味着所有开发只能在你的 Mac 上做，云端 agent 拿不到代码。
2. **DSH「创造模式」= 随包 preset `cordis`**。它的产物是**新的 agent preset 目录**（`agent.cordis.yml` + skills），不是业务应用。所以「用创造模式生成用户想要的应用」这句话要拆成两件不同的事：生成 preset（DSH 原生能力）和生成业务 app definition（FDE-X 自己要做的闭环）。

---

## 1. 产品视角：这个工作台现在为什么「不够 AI Native」

九个模块里，真正形成「模块 → AI → 结果回流 → 人确认」闭环的只有 **IM 拟回/采纳**（`promptAi` → `readAssistant` → 回填输入框）。其它模块都停在**单向 prompt**：

| 模块 | 交给 AI | AI 结果回流 | 感知上下文 | 结论 |
|---|---|---|---|---|
| 早报 | 有（生成早报） | **无**，结果只在 AI 页 | 未读 IM 是真的；任务不按工作区 | 半闭环 |
| 业务应用 | 有（AI 创建 / 问 AI） | **无**，不写回 definition | 按工作区刷新 | 半闭环 |
| 计划 | **无** | **无**；IM「摘成待办」只进内存 | 待办/日程不按工作区 | 孤岛 |
| MCP | 无（配置页，合理） | — | 不绑 cwd/会话 | 列表 ≠ 真实工具 |
| Skills | 无「用此 Skill 问 AI」 | — | 已绑 currentAiTarget | 只读目录 |

**根因是架构层面缺一个通用原语**：「把一段 prompt 发给当前会话，等它跑完，把最终回答（或其中的 JSON 块）取回来」。IM 已经用 bridge 的 `readAssistant` / `watchAssistant`（`sawRun && !running`）手工拼出了这条路，但没有抽成公共能力。早报回写、业务 definition 回写、计划「整理待办」三个需求本质上都是它。

> **建议 A0（架构，优先级最高）**：在 `src/lib/` 抽一个 `askAiForResult({ target, prompt, schema? })`，内部复用 IM 现有的 `promptAi` + `readAssistant` 流程，可选按 schema 解析 JSON 块；失败上黄条。之后早报 / 业务应用 / 计划各接一次。不改 DSH、不动 BFF 闸语义、不新页面。

---

## 2. 逐模块建议

标注：**内** = 规格内可直接做；**越界** = 涉及 restyle / 新页面 / 新路由 / 规格写明本版不做，需 Ace 拍板。

### 2.1 业务应用 `Data.tsx`

现状：三 Tab 结构合规；记录 Tab 现查硬编码 `kind:'采购单'`（L486–488），型芯片是死按钮（L509–511）；操作控制默认 `record.update` + JSON 表单（L561、L666–673），是工程师界面；「AI 创建」只 prompt 不回写（L361–364）。

| 建议 | 级别 | 内/越界 | 文件 |
|---|---|---|---|
| AI 创建闭环：描述 → 选 preset → 结构化 prompt → 预览 definition → 人点「采纳」→ `updateBusinessApp` | P0 | 内 §15.7 | `Data.tsx` L298–366；`runtime-api.ts`；用 A0 |
| 记录芯片改由 `biz_describe`/catalog 驱动，来源列标真实系统名 | P1 | 内 §9 | `Data.tsx` L477–541；`server.mjs` catalog |
| 操作表单用规格中文动作（现查/改行/新建/删除/过审），从选中记录带入 target | P1 | 内 §0.5/§9 | `Data.tsx` L552–673 |
| 记录 Tab 选中行「交给 AI」 | P2 | 内 §15.1 | `Data.tsx` RecordBrowser |
| 空态链到设置 → 连接器 | P2 | 内 | `Data.tsx` L409 |
| 动态列名用英文 key，改中文标签需词表 | P2 | 内（若 catalog 有 label） | `Data.tsx` L500–501 |

### 2.2 早报 `Briefing.tsx`

现状：生成走 `currentAiTarget`（合规）但结果不回卡片；「发往 IM / 保存记忆」正文写死 `scene#39 收口`（L244、L263）；指标 `metrics=[]` 时整块消失（L111–120）；「今日」按钮无 handler（L88）；副标题假定 IM 已静音（L85）；`draftMemoryCard` 失败静默（L264–265）。

| 建议 | 级别 | 内/越界 | 文件 |
|---|---|---|---|
| 去掉 scene#39 模板；IM / 记忆的正文用生成结果，没生成就禁用按钮 | P0 | 内 §15.8 | `Briefing.tsx` L241–267 |
| 生成早报后写回 AI 卡（用 A0），记录 `sessionId` 可跳回 | P0 | 内 §15.3 | `Briefing.tsx` L95–100、L232–271 |
| 有业务连接时用 `biz_preview` 填指标，无则显示 — 占位而非消失 | P1 | 内 §13.5 | `Briefing.tsx` L111–120 |
| 任务/日程按 `workspaceId` 过滤（与计划模块同源） | P1 | 内 | `Briefing.tsx` L69 |
| 删「今日」死按钮或接 handler；副标题去掉静音假设；记忆失败上黄条 | P1 | 内 | L85、L88、L264 |
| 未读 IM「进入」定位到具体会话 | P2 | 内 | L303 |
| 重排早报布局 | — | **越界** restyle | — |

### 2.3 计划 `Plan.tsx`

现状：**这是最大的意外**——HANDOFF 承诺「个人计划 SQLite」，`002_modules.sql` L111–174 建了表，但 `server.mjs` **没有任何读写 API**，`tasks/events/workflows` 只在 Zustand 内存且 `partialize` 不持久（`app.ts` L798–834）→ **刷新即空**。IM「摘成待办」（`IMWorkspace.tsx` L1517–1522）同样落空。周视图表头写死「9 月 7+idx 日」、用 `events.slice(0,2+i%3)` 凑格（L365–387），是假日历。工作流「运行」disabled、paused 时「启用」也 disabled（L593–600），文案却说可启用（L681–683）。

| 建议 | 级别 | 内/越界 | 文件 |
|---|---|---|---|
| 计划接 SQLite：`server.mjs` CRUD + `runtime-api` + `app.ts` 水合；IM `addTask` 走同一 API | **P0** | 内（HANDOFF §4.5 承诺） | `server.mjs`、`runtime-api.ts`、`Plan.tsx`、`app.ts`、`IMWorkspace.tsx` L1517 |
| 周视图用真日期、真事件；做不到就先隐藏周视图 | P0 | 内（假数据违 §0.5） | `Plan.tsx` L365–387 |
| 待办「整理 / 交给 AI」入口：把当前待办发给 currentAiTarget，回流建议（用 A0） | P1 | 内 §15.6 | `Plan.tsx` |
| 工作流按钮与文案一致：paused 可启用，或文案改成「本版不自动跑」 | P1 | 内 | `Plan.tsx` L593–600、L681–683 |
| 待办/日程按工作区过滤（与早报同源） | P1 | 内 | `app.ts` |
| ⌘K 搜到任务/工作流（现硬编码 `[]`） | P2 | 内 | `CommandPalette.tsx` L77–78 |
| 页顶说明「个人计划 ≠ DSH plan-mode」 | P2 | **越界** 新文案需对照 §0.1 闭集 | `Plan.tsx` |
| 删未用 import `Filter/Bot/History`、死代码 `runWorkflow` | P2 | 内 | `Plan.tsx` L4–5；`app.ts` L670–684 |

### 2.4 MCP `MCP.tsx`

现状：列表来自正则解析 DSH patch 的 `serverName`（`server.mjs` L2198–2215），工具名是占位 `mcp__name`，`connected` 只看核心是否在线——**不是真实工具投影**。API 失败 `catch→[]` 吞错（L30）。添加默认命令 `@example/mcp-server`（L36）易误存。弹窗说「自动重新拉起」（L165–167）与页顶「需重载核心」（L188）打架。启停 disabled 合规（无 Remote）。

| 建议 | 级别 | 内/越界 | 文件 |
|---|---|---|---|
| 列表诚实化：失败显示错误而非空；卡片标「配置项，需重载后生效」；统一保存后文案 | P0 | 内 §15.6 | `MCP.tsx` L30、L165–188 |
| `GET /mcp/servers` v2：合并 patch 条目 + lan-assist 连接态，分区「MCP 服务器 / 业务连接器」（见 §3） | P1 | 内 | `server.mjs` L2198–2215；`MCP.tsx` L84–133 |
| 表单支持 `streamable-http`（`url` + `headers`），DSH 官方两种传输之一 | P1 | 内 | `MCP.tsx` L135–200；`server.mjs` L2218–2240 |
| 去掉 example 默认值；三张 0/0/0 指标卡空时收起 | P2 | 内 | `MCP.tsx` L36、L57–70 |
| 连接后拉真实 `mcp__*` 工具列表（当前会话 tools 投影） | P1 | **越界** 需 AI 侧 tools API | `server.mjs` + bridge |

### 2.5 Skills `Skills.tsx`

现状：已按 `currentAiTarget` 拉 catalog（合规）；启停/安装/编辑 disabled 合规；「来源筛选」按钮无逻辑（L82）；未连接时副标题仍写「三个来源」（L79）且 `source` 全映射 `builtin`（L53）；空列表文案「没有匹配的 Skill」让人以为是筛没了（L115–116）；详情「运行统计」恒 —、「查看详情」无动作（L148、L176–185）。

| 建议 | 级别 | 内/越界 | 文件 |
|---|---|---|---|
| 未连接用 `Empty` + 链到设置核心；去掉「三个来源」假副标题 | P1 | 内 | `Skills.tsx` L79–116 |
| 「来源筛选」接真 filter 或移除 | P1 | 内 | L82、L53 |
| 每个 Skill 加「用此 Skill 问当前 AI」（prompt 带 skill 名） | P1 | 内 §15.1 | `Skills.tsx` 详情区 |
| 「查看详情」接动作或删；运行统计无数据则不渲染 | P2 | 内 | L148、L176–185 |
| Skills 安装市场 / Remote 启停 | — | **越界** §15.6 本版不做 | — |

---

## 3. 方向一：MCP 连接业务系统

**结论：不要把业务系统的写工具直接挂进 DSH MCP。** 保留 lan-assist 的 `biz_preview → 人审 → biz_write` 闸，MCP 页升级为「连接器统一视图」。

理由（来自 DSH 官方包 + FDE-X 代码）：
- DSH 的 MCP 工具注册为**原生工具**，只走通用权限档 + `approval/request`，**没有** `preview_id` 这类业务级二次闸。业务写工具一旦挂成 MCP，AI 就能绕过「无令牌必拒」的铁律。
- DSH MCP 只支持 `stdio` 和 `streamable-http`，是 harness 级配置，**不能按会话启用**；官方插件文档说编辑配置可原地重连，但 FDE-X 目前只会 append patch + 整进程重启。
- lan-assist 的闸（`gate.js` preview / write、`write.js` 无令牌必拒）已经是「AI 提议、人确认」的正确实现，重做一遍没有收益。

三个候选的取舍：

| 方案 | 判断 |
|---|---|
| A. 业务系统各出 MCP，AI 直调 | **禁止**用于业务写/现查，违反 §4.6 / SPEC L99 |
| B. MCP 只读，写走闸 | 可作外部只读辅助，但规格要求现查也走 `biz_preview`，双通道会漂移 |
| **C. 闸不变，MCP 页统一展示「MCP 服务器 + 业务连接器」** | **推荐**。产品面统一，安全面不变 |

**第一步**（不改闸语义）：`GET /api/v1/mcp/servers` v2 合并 patch 内 MCP 条目 + lan-assist `/state` catalog / 连接态；`MCP.tsx` 分两区渲染，每项带健康 Tag（在线 / 需重载 / 断开）；业务连接器只读展示，口令登记仍在设置「存储与数据」，写能力仍只在业务应用「操作控制」。
**第二步**：MCP 表单支持 `streamable-http`；保存后全局 banner 链到「重载核心」。
**远期（越界）**：接 DSH 动态配置 API 做原地重连，替代整进程重启。

通用（非 ERP）的 MCP——比如文件、浏览器、搜索——照常走 A，但在列表里标「非业务写」。

---

## 4. 方向二：应用模块 × preset / 创造模式

**先纠正预期**：`cordis`（创造模式）产出的是 **preset**，不是业务 app。它擅长的是「造一个专门的 agent」，比如「采购单助理」这个 preset；真正生成 app definition（screens / 字段 / 动作）要 FDE-X 自己闭环。

推荐路线（两步走）：

**第一步 · 方案 B（轻编排，不动 DSH 文件）**
1. `Data.tsx` 创建流加「选 agent preset」（默认 `standard`，复用 `GET /api/v1/ai/presets`）。
2. `createRemoteSession({ agentPreset })` 开专用会话，发固定 schema 的 prompt（要求输出 JSON definition）。
3. 用 A0 取回回答，解析 JSON 块 → 预览 → 人点「采纳」→ `PUT /api/v1/business/apps/:id`。
4. 不自动 `biz_write`；definition 里的动作仍走操作控制审批链。
优：全在壳层，周内可做；劣：依赖模型按 schema 输出，需容错。

**第二步 · 方案 A（专用 preset + bridge 工具）**
复制 `standard` 为 `fde-biz-app` preset，加一个 Skill / 工具直接调 `fde-x-dsh-bridge` 提交 definition。可审计、可复跑，但要写 Cordis 行和工具契约。等 B 验证需求后再做。

`cordis` 创造模式的正确用法：让用户在 AI 页选「创造模式」新会话，自然语言要求「做一个 XX 助理 preset」，产物落到 `~/.dsh-fde-x/.agent-presets/<id>/`，然后出现在新会话的 preset 列表里。这是 DSH 已有能力，FDE-X 只需保证 `.agent-presets` 目录可见（见 §5）。

---

## 5. 方向三：开源 agent preset 管理

**事实**：preset = 一个目录（`agent.cordis.yml` 必有，`preset.yml` 可选）。DSH 按「随包 → `config.roots[]` → 用户根 `<DSH_HOME>/.agent-presets/`」顺序发现；FDE-X 的 DSH_HOME 是 `~/.dsh-fde-x`，**这个目录现在还不存在**。有消息后 preset 锁定，换 preset 须新会话。**没有**官方 URL / git 一键导入 API；FDE-X 现有 `copyAiPreset` 只能从已在列表里的 id 复制。

开源样例（格式一致）：[awesome-dsh-presets](https://github.com/hackerFish/awesome-dsh-presets)（`minimal-zh` / `writer` / `researcher`）、[dsh-presets](https://github.com/my-dsh-plugin/dsh-presets)、[anchored-standard](https://github.com/ruby1304/dsh-preset-anchored-standard)、[dsh-anchored-subagent](https://github.com/GY-Bai/dsh-anchored-subagent)。

**最短接入路径**：`cp -r <repo>/<id> ~/.dsh-fde-x/.agent-presets/`，`agentPresets/list` 即时可见，不需重载。

**产品化建议（放在设置 → Agent 预设，`CoreSettings.tsx` L304–352，不新页面）**：
| 建议 | 级别 |
|---|---|
| 「导入本地目录」：选一个含 `agent.cordis.yml` 的文件夹 → BFF 校验结构 → 拷到 `.agent-presets/<id>/`；id 冲突提示 | P1 |
| 列表区分「随包 / 用户 / roots」来源，用户 preset 可删、随包不可改 | P1 |
| 「从 Git URL 导入」：BFF `git clone --depth 1` 到临时目录 → 同上校验 → 拷入 | P2（需 Ace 拍板是否允许 BFF 出网） |
| 安全提示：用户根 preset 是 shell 级信任；含 `!!js` / 本地 `.mjs` 的 preset 导入前展示文件清单要人确认 | P1 |
| `agent-presets.config.roots` 配置 UI（指向一个 git 管理的共享目录） | P2 越界 |

**不要**把导入放到 Skills 页——Skills 是会话级只读 catalog，作用域跟着 preset 走。

---

## 6. 建议的整体顺序

1. **基线**：`git init` + 提交；`pnpm dev` 确认 5174/5175 起得来。
2. **P0 修 bug 类**（上一篇报告）：`AI.tsx` activeId 回落、接着做三缺口。
3. **A0 公共原语** `askAiForResult`，先用早报回写验证。
4. **计划接 SQLite**（含 IM 摘成待办）、周视图去假、MCP 列表诚实化、早报去 scene#39。
5. **业务应用 AI 创建闭环（方案 B）** + preset 目录可见 + 设置页「导入本地目录」。
6. **MCP 页 v2**（连接器统一视图）。
7. 其余 P1/P2 与越界项按你拍板逐个排。

## 附：原始研读
- `internal/assessment-data-briefing.md`、`internal/assessment-plan-mcp-skills.md`
- `internal/research-mcp.md`、`internal/research-preset.md`

下一篇：[AI Native 平台方案](platform-design.md)（应用生成、业务记录浮现、可配置早报、模块互通与记忆）。
