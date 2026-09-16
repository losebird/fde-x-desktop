# FDE-X 生产接线规格（coding agent 唯一执行件）

执行本文件前先读完 **§0–§3 与 §0.5**。§0.5 覆盖前文所有冲突条款。旧日记、会话岛、`dsh-integration-contract.md` 的 plugin 路线作废。

**壳层补缺（IM / 记忆 / AI 互相关联、业务应用创建）见 §15。** 已落盘、**未开工**。执行 §15 前须用户再点头；不得借「顺手」改壳。

**落地仓库：** `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/`  
执行时把本文件复制为该仓库根目录 `PRODUCTION-SPEC.md`，并写 `AGENTS.md` 指向它。

完成标准：浏览器里仍是 FDE-X 的壳和交互；AI 的会话/模型/权限/工具/命令/轨迹来自本机 DSH Host；IM 与业务过账来自 lan-assist Host；记忆来自 semantic-os Host；早报/计划/应用生产仍是现有页面，只换数据源。官方前端包不得进浏览器。

---

## 0. 给执行者的硬合同

### 0.1 视觉基线

基线是 **仓库现源码**：`AI.tsx`、`Data.tsx`、`Settings.tsx`、`IMWorkspace.tsx`、`IMScreen.tsx` 壳。不是早期订单大表图，也不是 5174 会话岛。业务应用是 **三 Tab**（§9），禁止改成 AI 那种左中右三栏。顶栏 label 以 store `defaultPanels` 为准（已是「业务应用」，禁止改回「数据」）。

允许的 DOM 变更只有 **§3 闭集**。此外禁止改：

- 组件树顺序、路由表、className、颜色、圆角、间距、文案（状态数字和列表内容除外）
- `ThumbnailStack` / `IMMiniHeader` / `IMTopNav` / `StagePanel` / `FloatingPanel` / `CommandPalette` 的布局与手势
- 顶栏模块集合与顺序（IM、早报、计划、文件、业务应用、MCP、Skills、记忆、设置）

### 0.2 引擎边界

| 用户看见的 | Host 权威 | 浏览器禁止 |
|---|---|---|
| AI 页（对话/轨迹/发送/preset/模型/权限/工具/命令） | DSH `0.1.5-rc.1` 进程内 Session / tools / presets | `@deepseek-ai/dsh-web-frontend`、`SessionIsland`、iframe |
| IM | lan-assist 邮箱与拟回 | `dsh-lan-assist/client.js` |
| 业务应用（现「数据」页） | lan-assist `biz_preview` / `biz_write` / `biz_traces` | 用 SQLite 假过账冒充外部系统 |
| 记忆 | semantic-os 卡与 `search_text` | 把图迁进 SQLite；加载 semantic-os `client.js` |
| 文件 / MCP / Skills | **当前 AI 会话** 的 cwd / tools / skills 投影 | `~/.workbuddy/mcp.json` 空按钮、seed 列表冒充已连接 |
| 早报 / 计划待办日程 / 应用生产 | FDE-X SQLite + 调用上面三台 | 把 DSH goal/plan-mode 当成个人待办 |

DSH 进程 **必须挂上** `dsh-lan-assist` 与 `dsh-semantic-os`（只要 Host 工具与 HTTP）。浏览器 **不准** 加载它们的 Client 槽。

### 0.3 安全 / 稳定 / 性能（全程）

- 4318 与 DSH 只绑 `127.0.0.1`。Origin 白名单来自环境变量 `FDE_ALLOWED_ORIGINS`，缺省保持现列表。非白名单 403。
- 浏览器永不持有 DSH HttpOnly cookie、lan-assist 配对钥匙、业务口令。凭据只在 4318 进程内存。
- 4318 转发目标只允许 loopback。禁止把用户输入拼进上游 URL。
- 不向浏览器转发 `Set-Cookie`。错误体脱敏（token、cookie、authorization）。
- 不 `JSON.stringify` Cordis/Session 活对象；只抽取叶子字段组成自有 JSON。
- 远程方法名必须从本机 DSH 包的 `typert.host.js` `@Remote` **读出来再包**，禁止臆造 endpoint。
- 禁止硬编码：端口、cookie、preset id、模型名、工具名、工作区路径、员工号。全部来自 env、DSH 目录或用户配置。
- 未连接时：用现有 `Empty` / 错误条，**禁止**再用 seed 会话冒充「已连接」。
- 生产路径默认 host 一律 `127.0.0.1`。

### 0.4 执行纪律

1. 一阶段一截：做完 §4 对应阶段的验收命令再进入下一阶段。
2. 每阶段结束跑：`npx tsc -b --pretty false`、该阶段列出的 `node runtime/*.check.mjs` / `node runtime/smoke.mjs`。
3. 改 UI 文件前先记下该文件里所有 `className` 字符串；diff 里 className 只允许 §3 新增的那几个按钮。
4. 发现本规格与代码不符：停下来写进规格缺口，禁止「顺便重构」。

### 0.5 对抗审查补丁（冲突时只认这一节）

来源：`ADVERSARIAL-REVIEW.md` 六路 + 用户确认。产品目标不变：FDE-X 壳；AI=DSH；IM/业务=lan-assist；记忆=semantic-os。

**去岛顺序（阶段 A 强制）：** 先改 `smoke.mjs` 不再测岛 → 再删 §2 岛代码 → **再** 去掉 patch 里 `dsh-semantic-os: disabled`。禁止先启 semantic-os 再留岛。

**IMScreen 唯一允许 hunk：** 只改 import 和 `<SessionIsland />` → `<AI />` 两处。禁止动 `ROUTE_PANEL`、`navigate('/ai')`、任何 className。主区从岛换成 `AI.tsx` 现有三栏，是 **唯一允许的主区外观跳变**。验收禁止对照宣传图 PNG、禁止对照此刻 5174 岛截图。

**未连接态（不是少功能）：** 左栏空列表还在；+新会话可点，失败走现有错误条；主区用现成 Empty「没有会话」；输入条保留但禁用；底栏「本地原型」。禁止 seed 会话/假四模型/假 GitHub MCP/假 DAU。早报格子保留，数字「—」。假数据不算功能。

**输入条三按钮：** 插在「上下文」之后、**`<div className="flex-1" />` 之前**（左簇）。flex-1 与模型 `btn-ghost` 不准动。下拉克隆模型菜单。权限/工具/命令用 `btn h-7 px-2 text-[11px]`。窄屏挤出视口也禁止改 className、禁止 wrap。

**权限中文（用户确认，跟 DSH 一样）：** 菜单只显示  
`read-only`→仅可查看；`workspace-write`→工作区内修改；`danger-full-access`→完全权限。  
内部 id 不进 UI。无 `@Remote`：读 follow/`session/control` 的 `projections.values.permissions`；写 `commands/execute` `{agentId, line:'/permission <id>', submittedAttachments:[]}`。默认档 `settings` ns=`permission`。有历史后换 preset 会 locked——新建用 `create.agentPreset`。

**第 N 轮（用户截图那种，本版要做）：** 对话 Tab 消息流加「第 N 轮」分组；右侧细轨道跳转。数据=`turnOutline` 投影（follow/control 里带上，禁止 `ai-stream` 丢掉）。**不要**用 `session/page` 做轮数下拉。`session/page` 只用于往更早历史翻页。

**MCP 添加（本版要做，真写入）：** 4318 在用户 DSH profile/preset 的 cordis 配置里追加一条 `mcp-client` 实例（stdio 或 url 来自现有添加表单），然后让 DSH 加载该实例。无 Remote 就改配置文件，禁止关弹窗假装保存。失败要报错留在弹窗。

**文件写入/回滚（本版要做）：** `workspaceFiles` 无 write Remote。4318 在当前会话 cwd 用 Host 受控写盘（与 DSH sandbox 同一根）。回滚：4318 自管最多 20 版（现 store 上限），不靠 DSH。Files.tsx 现有上传/删除/预览留着；无回滚按钮则用现有删除旁加与「上传」同款 `btn` 的「回滚」仅当有版本时启用——若 Files.tsx 确实没有回滚控件，**不准新造**，只让保存/上传真写入。

**回形针：** 上传=`fileUploads/upload` `{agentId, request:{data,name}}` 再 `session/prompt` 带 receipt。`session/attachment` 只读历史图。

**Agent 类 RPC：** `agentPresets/select`、`commands/list|execute` 的 wire 是 `{agentId}`（sessionId 字符串 lookup **活** Agent）。先 follow promote / prompt / create 后再调。禁止 `{request:{sessionId}}` 包 select。禁止 JSON.stringify Agent。`session/list` 必须 `_request`。

**审批条：** follow 的 `approval/asked` 只进轨迹。对话 Tab 人点允许/拒绝必须订 `approval/request` waterfall（remote.mux 事件），无 answerer 则 fail closed。扁平化必须保留 `projections` 与 approval id。

**业务翻译（4318 内部，UI 字段不改）：**  
`record.update|create|delete|read` → `改行|新建|删除|现查`；`targetRef` `fde://external/{system}/table/{kind}` → `system` + `kind` + `no`（从 input/where 抽）；`input` JSON → `patch`/`where`。先 `biz_describe`。dry_run 只 preview。禁止把 `record.update` 当闸 action。

**待启用三态：** ① 4318 能打到 lan-assist 进程；② IM 已配对（mint→handshake→**开码侧 accept**）；③ lookup+词表已配且 `biz_describe` 有型。Data 胶囊只表示 ③。

**IM 绑 session：** `activeChatId` ↔ DSH `sessionId` 存在 4318。拟回/问本机=`session/prompt`；拟回只填 IM 框（`---` 规则强制）；问本机进 AI 不寄。采纳=IM→AI textarea。禁止 `parseIMInput` 假同事回复。禁止 store 反方向 adopt。

**cwd：** `FDE_AI_WORKSPACE` → 设置里用户填的绝对路径 → 拒绝 create。浏览器 DirectoryHandle ≠ cwd。禁止 `runtime/native-workspaces/`。

**ws 模块：** `createRequire(dsh 的 package.json)` 再 `require.resolve('ws')`。禁止 4318 自己 `import.meta.resolve('ws')`，禁止写死 Homebrew 路径。

**安全：** 删 `/api` catch-all 与 mux 泛转发。Vite 只反代 `/api/v1`（及健康检查）。所有写操作无白名单 Origin → 403。Vite/4318/DSH 绑 `127.0.0.1`。浏览器只请求相对 `/api/v1`。seed 电子签 TOKEN 删除。

**4318 不是 ERP：** dry_run 不得把 operations 标成源系统 `succeeded`。live 无闸令牌必须失败。smoke 不得再要求 live 501 作为永恒真理——改为：无连接器则 write 失败带闸 speak。

**记忆：** UI 三层保留。project=当前 cwd 卡；daily=当天过滤；user=标签，不另造全局图。`draft_memory_card`；列表默认起草。

**死页：** 阶段 H 只删文件，不准改 `App.tsx` / `IMScreen` / `Briefing` 路由。`/tasks` `/schedule` 仍开计划面板。

---



## 1. 目标架构（不变）

```
浏览器 5173/5174/4173  ──只请求──►  4318  (runtime/server.mjs)
                                      │
                                      ├ /api/v1/ai/*        → DSH Typert RPC（进程 cookie）
                                      ├ /api/v1/im/*        → lan-assist Host（loopback）
                                      ├ /api/v1/biz/*       → lan-assist gate
                                      ├ /api/v1/memory/*    → semantic-os 经 DSH 插件口
                                      └ /api/v1/files|mcp|skills → 当前 session 投影
                                      ▼
                         dsh web --host 127.0.0.1 --port 0 --patch runtime/dsh-core.patch.yml
                         插件：dsh-lan-assist、dsh-semantic-os 启用
                         禁用：ui-brand-official、ui-settings-* 页面、ui-open-in-app
```

Vite 只反代 `/api` → 4318。删除 `/plugins`、`/native-session` 反代。

---

## 2. 删除清单（阶段 A 一次删干净）

删除文件（不得留 stub）：

- `src/pages/SessionIsland.tsx`
- `src/lib/session-island-bridge.ts`
- `runtime/ai-native-proxy.mjs`
- `runtime/ai-native-proxy.check.mjs`
- `runtime/native-workspace-roots.mjs`
- `runtime/native-workspace-roots.check.mjs`

从引用处移除：

- `src/components/IMScreen.tsx`：`<SessionIsland />` 改回 `<AI />`（现有 `src/pages/AI.tsx`）
- `runtime/server.mjs`：一切 `createNativeSurface` / `isNativeSurfacePath` / `/api/v1/ai/session-island/boot` / `/api/v1/ai/native-workspaces`
- `vite.config.ts`：`/plugins`、`/native-session` proxy
- `src/lib/runtime-api.ts`：`aiSessionIslandBoot`、`ensureNativeWorkspace`、`AiSessionIslandBoot`
- `package.json` scripts：`runtime:channel`、`runtime:native-workspaces` 若只测岛

保留：`src/pages/AI.tsx`、`runtime/dsh-core.mjs` 的 `call`/`stream`/`start`、P1 的 `/api/v1/ai/sessions*`。

---

## 3. UI 闭集（仅这些视觉增量合法）

全部发生在 `src/pages/AI.tsx` 已有结构内。新控件必须复用已有 class：`btn h-7 px-2 text-[11px]` 或 `btn-ghost h-7 px-2 text-[11px]`，下拉复用已有 `absolute z-40 ... border border-line rounded-lg shadow-pop p-1`。

| 位置 | 现有 | 生产接线 | 允许的增量 |
|---|---|---|---|
| 左栏会话列表 | 已有 | `GET /api/v1/ai/sessions` | 无 |
| `+ 新会话` 弹层 | 「请选择本次会话使用的 Agent」 | 列表改为 DSH preset roster（字段仍用 name/desc） | 数据源替换 |
| 标题行副标题 | `agent.name · modelRoute` | preset 显示名 · 当前模型 | 无 |
| Tab | 对话 / 轨迹 / 语义 | 对话=消息；轨迹=follow 映射到现有 `ExecutionTrace`；语义=当前工作区 `search_text` 摘要，按钮「在记忆中打开」调用已有 `togglePanel('memory','full')` | 语义表内容换真数据，表格 grid 保留 |
| 输入条已有按钮 | 附件、文件、IM、上下文、模型、发送 | 文件/IM 仍打开现有面板；模型菜单用 `session/modelCatalog`，`reasoning.efforts` 用现有 `text-[10px]` 行，点选 `session/selectModel` | 无新按钮样式 |
| 输入条 **新增** | 无 | **权限、工具、命令** 三个按钮，插在「上下文」之后、`flex-1` **之前** | 只许这三个；flex-1 与模型按钮不准动 |
| 权限菜单 | — | 中文：仅可查看 / 工作区内修改 / 完全权限（§0.5）。写入 `/permission` | 菜单 DOM 克隆模型菜单 |
| 工具菜单 | — | 当前 session 可见 tools 名字列表；Host 无 per-tool toggle 则只展示 | 同上 |
| 命令菜单 | — | `commands/list` 展示 name；选中把 `/name` 填进现有 textarea，发送仍走现有发送键 | 同上 |
| 右侧 Agent 栏 | seed Agent +「管理 Agents」 | 当前 preset 的 name/desc；工具=实时 tools；Skills=`skills/list`；「管理 Agents」打开现有 `AgentManagerDialog` 但列表=preset roster，禁止再 `addAgent` 写 zustand | 不改 dialog 外框 class |
| 底栏 | 「本地核心已连接」/「本地原型」 | 连上用前者；未连接用后者+Empty | 无 |
| 轨迹 `ExecutionTrace` | 时间轴卡片 | 保留该组件；`items` 必须覆盖 `tool/call`、`tool/result`、`approval/asked`、`approval/decided`、`command/run`、`turn/start` | 无新布局 |
| 第 N 轮 | 无 | 对话 Tab：「第 N 轮」分组 + 右侧细轨道跳转（`turnOutline`）。`session/page` 只翻更早历史 | 轨道宽度/样式仿 DSH 细条，放在对话列右缘，不改左右栏 |

除此之外禁止新 modal、新路由、新顶栏入口、新颜色。

「数据」页标题以 **当前 `Data.tsx` 已有标题** 为准，不为改名而改布局。

---

## 4. 阶段与完成标准

### 阶段 A — 运行时去岛、DSH 进程可生产起停

1. **先改** `runtime/smoke.mjs`：删除岛/内核/`native-workspaces` 断言；未连 `/api/v1` 写操作 403 无 Origin；connect 后 origin 为 `http://127.0.0.1:<ephemeral>`。
2. 再实施 §2 删除（含 `index.css` 岛样式、`/api` catch-all、mux 泛转发）。`IMScreen` 只换 `<AI />`。
3. **然后** `runtime/dsh-core.patch.yml` 删除 `- id: dsh-semantic-os` / `disabled: true`。
4. 其余 patch 规则：
   - 保留禁用官方品牌与 settings **页面**（general/models/plugins/plugin-inventory）和 `ui-open-in-app`
   - 不要禁用 `ui-settings` 服务
   - 不要禁用 lan-assist
5. `cwd` 按 §0.5：`FDE_AI_WORKSPACE` → 设置里绝对路径 → 拒绝 create。禁止 `native-workspaces/`。
6. 环境变量：`FDE_DSH_BIN`、`FDE_DSH_HOME`、`FDE_RUNTIME_PORT`、`FDE_ALLOWED_ORIGINS`、`FDE_AI_WORKSPACE`。
7. `ws`：`createRequire(dsh package.json)` 再 `require.resolve('ws')`。
8. 子进程退出：`state=error` 并关掉所有 SSE；只能 `POST /api/v1/ai/connect` 再拉。不要无限重启。

**完成标准：**

- 仓库内无 `SessionIsland`、`__FDE_SESSION_ISLAND__`、`/native-session` 字符串（本规格除外）
- `GET /health` 200；`POST /api/v1/ai/connect` 后 `data.connected===true` 且 `origin` 为 `http://127.0.0.1:<ephemeral>`
- Vite 无 `/plugins` proxy
- `npx tsc -b --pretty false` 通过

### 阶段 B — AI 页接 DSH（FDE-X 三栏）

1. `IMScreen` 主区渲染 `AI`。
2. 已有 4318：`session/list|create|rename|selectModel|modelCatalog|prompt|cancel|follow` 保持；补：
   - `GET /api/v1/ai/presets` ← `agentPresets` `@Remote('list')`
   - 创建会话带 `agentPreset`（`SessionCreateRequest.agentPreset` 已有）
   - preset 切换 / 命令 / 权限 / 回形针 / 审批 / 第 N 轮：全部按 **§0.5**（agentId lookup、`/permission`、fileUploads、waterfall、turnOutline）。禁止再按旧表用 session/attachment 当上传、禁止 permission Remote、禁止 page 当轮数。
   - `GET /api/v1/ai/sessions/:id/skills` ← session-controller skill catalog `@Remote list`
   - tools：当前 schema 名列表；读不到就空数组，禁止 seed
3. `AI.tsx`：连接成功后只走 runtimeApi。断开时 Empty「没有会话」，不渲染 seed chats。
4. `follow` 映射补全 §3 轨迹事件。`ExecutionTrace` 只消费 `AiTraceItem[]`。
5. `approval/asked` 时在对话 Tab 用现有 `btn` / `btn-primary` 插确认条，Remote 从 `dsh-client-ui-approval` / session `control` 查。

**完成标准：**

- 可选 preset、发消息进 DSH session log
- 模型菜单全部来自 `modelCatalog`
- 带工具回合的轨迹含 tool/call 与 tool/result
- 连接后没有「智能路由/快速响应/深度推理/本地优先」四条假模型
- `tsc -b` 通过

### 阶段 C — 文件 / MCP / Skills 接当前会话

1. `Files.tsx` 布局不动。已连接时 `GET /api/v1/files?sessionId=` ← `workspaceFiles` `list/stat/read/readBytes`。预览走已有 `renderPreview`。
2. MCP 页：按 `mcp__<server>__<tool>` 聚合。添加服务器按 §0.5 写入 DSH cordis 配置并加载实例。禁止弹窗关闭假装保存。无 settings ns。
3. Skills 页：skill catalog。无启停 Remote 则按钮 disabled，外观不变。

**完成标准：** 已连接时三页零 seed；断开 Empty，不闪假 GitHub/飞书。

### 阶段 D — IM = lan-assist

1. `/api/v1/im/*` 实现前读 `dsh-lan-assist/http.js` 与 `client.js` 已用路径。4318 只打 `127.0.0.1:${lanPort}`，`lanPort` 从插件配置或 `DSH_LAN_ASSIST_PORT` 读。
2. `IMWorkspace.tsx` class 与位置不动；发送仍是人点现有按钮；拟回只填输入框。
3. 禁止自动 `biz_write`。来信当正文。

**完成标准：** 已配对本机可在 FDE-X IM 面板通信；无 lan-assist overlay 徽章。

### 阶段 E — 记忆 = semantic-os

以 `SEMANTIC-FDEX-PLAN.md` 为准，不再做「只搜摘录」薄切片。

1. 4318 反代 `/semantic-os/*`（画布静态资源 + API），cookie 留在进程。
2. 记忆页是当前工作区语义首页（在线、目录名、封面计数、六张卡）。
3. 六块官方画布 `ws/{explore,analyze,decisions,io,ontology,admin}` 用 `mount(el, { cwd })`，cwd = 顶栏工作区。
4. 禁止 `addMemory` 进 localStorage。卡片走 `draft_memory_card`。

**完成标准：** 切工作区后首页和图跟着变；探索/推理/决策/出入/词表/管理可打开；图仍在 `{cwd}/.dsh/semantic-os/`。

### 阶段 F — 业务应用 = lan-assist 闸

1. `Data.tsx` 布局保留。
2. `/api/v1/biz/preview` 与 `/write` 内部走 secretary。令牌、过期、fingerprint、`trace_id` 一次成功留在 4318/lan-assist。浏览器只拿 `preview_id`。
3. 删除 SQLite `operations` **冒充外部过账** 的成功路径。SQLite 只记 `audit_entries`。
4. 回退 UI 只开口「要不要冲正」，不执行冲正。

**完成标准：** 无连接器时失败来自闸；有连接器时确认执行才 write。

### 阶段 G — 早报 / 计划 / 应用生产

1. 早报：有业务连接才填现查数字；否则 Empty/—，禁止 seed DAU。`生成新早报` 走当前 AI session prompt，写入现有早报卡片。「发往 IM」「保存到记忆」走 D/E。
2. 计划：待办/日程接 SQLite `002_modules.sql` 或现 store（非 DSH）。工作流 Tab：有 workflow list Remote 则列出；否则 Empty，禁止 mock `runWorkflow`。
3. 应用：现有创建表单把定义 JSON 存 `business_apps`；执行仍阶段 F。

**完成标准：** 早报无无来源的 12480；待办交互不变；工作流不本地假装跑完。

### 阶段 H — 清场

1. 连接后隐藏 `AgentManagerDialog` 的新建自造 Agent，或改为 `openAgentPresetDirectory`。
2. zustand persist 只留壳状态（`panels`、草稿、布局），`chats`/`mcp`/`skills`/`memory` 不再当权威。
3. `adapters.mjs`：connected 才 `healthy`。
4. README 只保留：起 4318、起 Vite、三台权威。不写会话岛。

**完成标准：** `rg SessionIsland src runtime` 空；`rg native-session` 空；已连接 UI 无 seed MCP 名。

---

## 5. 已知 Remote（本机 0.1.5-rc.1，包一层前再核对 typert）

`session`：`list` `search` `create` `selectModel` `modelCatalog` `rename` `fork` `prompt` `attachment` `updateQueue` `cancel` `page` `follow` `control`

`agentPresets`：`list` `read` `copy` `deletePreset` `select`

skills catalog：session-controller 内 `@Remote async list`

`commands`：`list` `execute`

`workspace`：`create` `rename` `delete` `follow`

`workspaceFiles`：`list` `stat` `read` `readBytes` `changes`

权限与 lan-assist / semantic-os：以本机插件 `typert.host.js` / `http.js` / `tools.js` 为准。

---

## 6. 全量验收

```bash
cd /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation
npx tsc -b --pretty false
node runtime/check.mjs
node runtime/smoke.mjs
```

手工对照 **现源码页面**（禁止对照宣传图 PNG、禁止对照 5174 岛）：

1. 顶栏芯片、缩略图、右栏拖宽/撕出/最小化与改前一致。
2. 主区是 FDE-X AI 三栏（会话/对话|轨迹|语义/Agent），无鱼标、无官方 hero。
3. 能选 preset、选模型、发消息、停、看轨迹；对话里有「第 N 轮」和右轨跳转。
4. 权限/工具/命令在上下文之后、flex-1 之前；权限显示中文三档。
5. IM 发送不自动叫醒对端模型。
6. 业务确认前不写库；操作控制字段不改。
7. 记忆搜索不把图当现况。
8. MCP 添加失败会报错，成功后列表出现真 server；文件上传写入当前 cwd。

回归：`StagePanel` `ThumbnailStack` `IMTopNav` diff 为空。`IMScreen` 仅允许 SessionIsland→AI。

---

## 7. 明确不做

- 不把 FDE-X 打成 dsh profile 换皮插件
- 不改 DSH 官方压缩内核
- 不在浏览器跑 `__ModuleLoader__`
- 不在 DSH 进程里禁用 semantic-os
- 不把 lan-assist Client 槽挂进 FDE-X
- 不改品牌绿、不改「FDE-X Desktop」字样
- 不实现互联网中继、手机推送、秘书代签

---

## 8. 第一步

从阶段 A 开始。cwd 必须是 `scene-39-personal-workstation`。先 `rg SessionIsland src runtime`，再改 `IMScreen.tsx` 主区。不要并行开阶段 D–G。

---

## 9. 业务应用 UI 闭集（当前 `Data.tsx`，不是早期大表）

视觉与文案锁在现源码 + 用户 2026-09-14 截图。禁止改回「导出 CSV / 新建行」那张单表页。

三 Tab 固定：`应用` | `业务记录` | `操作控制`（`view: overview | records | operations`）。顶栏 `PageTitle` 标题「业务应用」。

**应用 Tab**

- 绿条 `AuthorityStrip`：事务底座状态、SQLite 表数/迁移数、刷新。文案结构保留。
- 四卡：业务应用数、系统连接数、待审批、异常待处理。hint 文案保留。
- 「我的业务应用」+「+ AI 创建应用」展开现有名称/目标输入 +「创建草稿」。
- 「业务系统与数据源」列表现有连接行（名、provider、状态胶囊）。
- 底栏「浏览记录」「操作控制」只切 Tab，不新开路由。

**业务记录 Tab**

- 型切换芯片（现为 seed 订单/客户/产品，接通后改为 `biz_describe` 的型，芯片样式不变）。
- 搜索框、「规划数据操作」切到操作控制。
- 蓝提示条文案保留：原型数据不冒充现况；真连接后必须标来源；改删从操作控制发起。
- 表：现有列 +「来源」列。seed 行标「原型」。`biz_preview` 现查行标系统名+环境，禁止再标「原型」。
- 禁止在本 Tab 直接改单元格写库。

**操作控制 Tab**

- 表单字段锁死：目标对象、操作、类型、风险、执行方式、输入 JSON、「生成可审计计划」。
- 黄条：未启用适配器时拒绝、不伪造成功。
- 「操作记录」列表 +「操作详情」审批/步骤/Trace。状态机用现有 `STATE_LABEL`。
- 生成计划 → 4318 只建 **工作台审计草稿**；真写入必须 `preview_id` 走 lan-assist。执行方式「仅验证」不得调用 `biz_write`。
- 连接「待启用」时 write 必须失败并显示闸的 speak，禁止 SQLite 标 succeeded 冒充源系统。

阶段 F 按本闭集接线，不改 className。设置里的连接器启用入口见 §10，本页只展示状态。

---

## 10. 设置闭集（当前 `Settings.tsx` 六分区，不新开官网）

分区锁死：账户 | 外观 | 通知 | 快捷键 | 运行环境 | 存储与数据。禁止加第七个顶层 id，除非写回本规格。

| 分区 | 现有控件 | 生产接线 | 本版不做 |
|---|---|---|---|
| 账户 | 头像、导出、注销 | 导出走 4318 脱敏 JSON（无钥匙无口令）。注销仅清本机工作台数据并确认 | 不做云账号 |
| 外观 | 浅色当前、深色/跟随 disabled | 保持浅色为当前；深色仍 disabled | 不接 DSH theme |
| 通知 | IM 静音等 Toggle | 仅「早间 IM 静音」写 store；其余保持现控件但接线待 Host 有开关再接，禁止假 Toggle 写死 `true` 还显示可点成功 | 不做系统日历 |
| 快捷键 | 现表格 | 只读展示，键位已在 `IMScreen` 的 ⌘K | 不新绑定 |
| **运行环境** | 诊断三行 + 权威三卡 | `GET /health` 已有。三行必须能点「重新检查」。增加 **不改布局的表单**：DSH 连接/断开（现 health 不够则在本卡底部用现有 `btn`）；lan-assist 配对（开码/填码/门牌，字段用现有 `input`）；semantic-os 就绪文案（doctor JSON 的叶子） | 不嵌官方设置页 |
| **存储与数据** | SQLite 说明、重置 demo | 连接器：系统名、环境、地址、口令（口令只 POST 4318，永不回读明文）。MCP 添加的真实写入也放这里或 MCP 页提交到同一 API。重置 demo 连接后改为「清空工作台草稿」，禁止抹 DSH 会话 | 口令不进导出 |

没有这张表，阶段 D/E/F 无法在本机配起来。

---

## 11. IM 按钮闭集（当前 `IMWorkspace.tsx`）

工具条 `AI_ACTIONS` 顺序锁死：拟回、采纳、先例、交接、问本机、摘要。另有：表情、文件、记录、发送。右键：问本机这条、按这条拟回、采纳这条、翻译、转发。发送键旁保留「AI 结果会先回填，不会自动发送」类现有提示。

| 按钮 | 4318 | 规则 |
|---|---|---|
| 发送 | IM 寄信 | 人点才寄；失败稿留在框 |
| 拟回 | 当前 DSH session `prompt`，结果 **只填输入框** | 不寄；两段 `---` 规则若插件有则遵守 |
| 采纳 | 把选中/最后一条 IM 写入 **当前 AI textarea**（或新建 session 后写入） | 不自动跑工具 |
| 问本机 | 当前 session `prompt`，上下文含工作区，回复进 **本机会话** 不是寄出 | |
| 摘要 | 现有摘要弹层；确认后记忆走 §E、待办/日程走计划 SQLite | |
| 先例 | `search_text` 或 session 检索，回填建议 | 无则 Empty，禁止假英文翻译当先例 |
| 交接 | 现有交接弹层；文件/会话 id 换成真 id | 「接着做」= `session/create` + 用户确认后 `prompt` |
| 翻译 | lan-assist 本机翻译若有；否则禁用并保持按钮 | 禁止 `English:` 假翻译 |
| 撤回 | lan-assist 撤回窗口 | 超时隐藏按钮（现 15s 改为插件时限，读配置不写死） |
| 文件/表情 | 现交互 | 附件走 lan-assist 限额 |

禁止自动 `biz_write`。来信当正文。⌘K 联系人组改读 IM 真列表，Agent 组改 preset roster。

---

## 12. DSH 能力对照（避免和计划模块抢词）

| DSH 能力 | FDE-X 落点 | 本版 |
|---|---|---|
| Session 列表/新建/重命名/发/停/跟流 | AI 左栏+输入条 | 做 |
| modelCatalog + selectModel + reasoning | 输入条模型菜单 | 做 |
| agentPresets list/select | 新建弹层 + 右侧栏 | 做 |
| 轨迹事件 | AI「轨迹」Tab `ExecutionTrace` | 做 |
| 权限 preset | 输入条「权限」 | 做 |
| tools 列表 | 输入条「工具」 | 做（可只读） |
| commands list | 输入条「命令」 | 做 |
| session/attachment | 回形针 | 做 |
| session/page 轮数 | Tab 行 select，无 API 则不加 | 条件 |
| workspaceFiles | 文件页 | 做 |
| MCP 配置 | 设置存储分区 + MCP 页 | 做 |
| skills catalog | Skills 页 + 右侧栏 | 做 |
| approval/asked | 对话流确认条 | 做 |
| ask_user_question | 同确认条或现有 Empty | 有 Remote 才做 |
| plan-mode | 不进「计划」模块 | 本版不做独立按钮，除非输入条命令里出现 `/plan` |
| goal / jobs / 会话 schedule | 不进待办/日程 | 本版不做 |
| workflowEngine | 计划「工作流」Tab | 有 list 才列出，禁止 mock run |
| fork / 删除会话 | 现有菜单项 | 有 Remote 才启用；无则按钮 disabled 保持原位 |
| compaction / 终端 / 子 Agent 树 / Cordis 动态插件 | — | 本版不做 |
| todo_write | 计划待办 | 本版不做自动写入，除非用户在摘要弹层确认 |

---

## 13. 同类缺漏（扫过现源码，不是早期图）

已从源码核对、容易按旧图接错的：

1. **业务应用** 已是三 Tab + 操作计划表单（§9）。早期订单大表作废。
2. **设置** 已有「运行环境」「存储与数据」「权威三卡」（§10）。不是只有账户/外观。
3. **顶栏「数据」** store 里 label 已是「业务应用」。
4. **AI.tsx** 已有对话/轨迹/语义、模型菜单、连接条、折叠左右栏。接线填这些控件，不要再造第四栏。
5. **早报** 仍 seed，且日期写死 `2026-09-08`。接线时去掉写死日期，用本机当天；指标无连接器显示 —。
6. **⌘K** 仍搜 seed 联系人/Agent/任务。阶段 D/B/G 必须改数据源，布局不动。
7. **死页** `Agents.tsx`、`AppShell.tsx`、`Sidebar.tsx`、独立 `Tasks.tsx`/`Schedule.tsx`/`IM.tsx`：阶段 H 删除未再被 `IMScreen` 引用的文件。路由可留 redirect，禁止修复这些旧壳。
8. **文件页** 仍有收藏/版本回滚 UI：读真实文件后，无 DSH 版本 API 则回滚 disabled，不删按钮。
9. **计划** 仍是待办/日程/工作流 三 Tab，不是 DSH plan-mode。
10. **记忆** 仍是三层卡片；语义-os 卡映射进现卡片，不换成图谱页。
11. **WorkspaceSwitcher** 必须带动 DSH `cwd`（阶段 A），否则文件/bash 打空目录。
12. **通知铃** 仍打开早报。未读数改接 IM 真未读，禁止一直用 seed。

未列入上表的 DSH 能力 = 本版不做，不要在执行时「顺手做上」。

---

## 14. 阶段对照补丁

- 阶段 A：补 WorkspaceSwitcher → cwd；删岛。
- 阶段 B：§12 中标记「做」的 AI 行 + §11 的采纳（写入 AI 框）。
- 阶段 D：§11 全表。
- 阶段 E：记忆页 + 语义 Tab。
- 阶段 F：§9 三 Tab，闸在操作控制。
- 阶段 G：早报去写死日期；⌘K 任务组；工作流空态。
- 阶段 H：死页；设置重置语义。
- **阶段 A 与 D 之间必须能在设置「运行环境」完成配对/连接**（§10），否则 D–F 无法验收。

---

## 15. 壳层补缺方案（已核对源码，未执行）

来源：2026-09-16 两轮缺口盘点 + 业务应用「AI 创建应用」未完成。  
约束：仍遵守 §0.1 / §0.5（不改 className 与面板集合；不把官方 `client.js` 塞进浏览器）。Host 上模型已经能调的工具（`search_text` / `biz_*`）不算壳层已接。

**一根指针。** 所有「发给 AI」的动作必须打进 **当前顶栏工作区 + 当前左栏会话**。禁止再 `listAiSessions` 后取「第一条非子代理」。抽出唯一函数（建议 `currentAiTarget()`：`{ workspaceId, cwd, sessionId }`，cwd 对不上就报错条，不静默落到别的会话）。

### 15.1 会话指针（先做，否则后面全打偏）

| 现状 | 应改 |
|---|---|
| 文件页：`item.cwd === 顶栏 cwd` | 保持 |
| 早报生成、IM 拟回/摘要/问本机、Skills 列表、⌘K 文件 | 全部改走 `currentAiTarget()` |
| 切工作区已过滤 AI 左栏 | 其它模块必须用同一过滤 |

### 15.2 断线 inbox

`store.aiInboxDraft`：IM「采纳」只写、AI 页不读。  
应：AI 在 iframe `tellDsh('select')` 之后把草稿 `tellDsh` 进输入框（或 `promptAi` 当前会话），用完清空。无当前会话则错误条。

### 15.3 IM ↔ 真信箱 / 真 AI / 真记忆

| 缺口 | 接法 |
|---|---|
| 早报「未读 IM」吃 `store.imMessages` | `imState()` 未读 |
| 早报「发往 IM」`sendIM` 本地 | `imCompose` + `imSend`；无联系人则禁用 |
| IM 附件 / 打开文件吃 store `FileNode` | 当前 cwd 文件列表（与 Files 页同一 API） |
| 拟回 session 乱跳 | `imDraft({ sessionId: currentAiTarget.sessionId, workspace: current cwd })` |
| 「记进档案」无回链 | `draftMemoryCard` 正文带 peerId / messageId；打开记忆后可搜到 |
| 对话结论发回 IM | 本项可后置；有则必须当前联系人，禁止 store |

### 15.4 记忆 ↔ AI / 早报 / ⌘K

| 缺口 | 接法 |
|---|---|
| 记忆页不能「问这条」 | 摘录按钮：`promptAi(current, 摘录+出处 id)` 并打开 AI |
| 命中 `session:…` 不能跳会话 | 解析 id → `nav(/ai/:sessionId)` + `tellDsh('select')` |
| ⌘K 不搜记忆 | 有 query 时 `searchMemory`，点开记忆或问 AI |
| 早报保存到记忆与那场 `promptAi` 无关联 | 同一 `sessionId` 写入卡片 label |

不把会话原文再抄进 `texts.json`（已定：原文只读 DSH session 日志）。

### 15.5 文件 ↔ AI

已有拖放 `fde-file` → `attachFiles`（打当前 `activeId`，对）。  
补：文件页「发给 AI」同一条路径；禁止再造上传控件。

### 15.6 计划 / MCP / Skills

| 缺口 | 接法 |
|---|---|
| 计划无 AI；`memory.add` 是种子 | 要么现有按钮调 `draftMemoryCard` / `promptAi(current)`，要么禁用并写明未接。禁止假跑 |
| MCP 与当前会话工具列表无关 | 保存后提示「重载核心」；列表可标「需重载」。不假装已热加载 |
| Skills 取 sessions[0]；启停 disabled | 列表改 `currentAiTarget`；无 Remote 则启停保持 disabled，不要假开关 |

### 15.7 业务应用 · 创建应用（用户点名补入）

现状：`Data.tsx`「AI 创建应用」只 `POST /api/v1/business/apps`，`definition = { kind: 'ai-generated-draft', goal, screens: [], dataSources: [], permissions: [] }`。SQLite 多一行草稿。点卡片只切到「业务记录」Tab，**不调模型、不生成屏幕、不绑连接器、不能编辑 definition**。指标文案「由 AI 创建」名不副实。

应做成：

1. 创建仍用现有名称+目标表单（不改 className）。  
2. 有 `currentAiTarget` 时：`promptAi` 当前会话，正文为工作区、目标、已有连接器列表；人在 AI 里确认后，把返回的 screens/dataSources/permissions **预览** 再写入该 app 的 definition（须新 API 或现有 PATCH；没有 PATCH 就先加 `PUT /api/v1/business/apps/:id`，Origin 闸与其它写操作相同）。无会话则只建空草稿并提示去 AI。  
3. 点应用：进入该草稿的定义（沿用三 Tab，不新造第四栏）：数据源 = 已有连接器多选；权限明文；屏幕列表可空。  
4. 运行中的过账仍走 §9 操作控制 + lan-assist `biz_*`，禁止 SQLite 假过账。  
5. 未接 AI 时按钮文案保持「创建草稿」，不要写「AI 已生成」。

### 15.8 早报去假数据

「生成新早报」走当前会话；去掉写死「scene#39 收口」类句子；指标无连接器为 —（§13.5 已写，仍未做完）。未读数接 IM 真未读（§13.12）。

### 15.9 执行顺序（点头后才开工）

1. `currentAiTarget()` + 所有 `promptAi` / `imDraft` / Skills / ⌘K 文件改走它。  
2. `aiInboxDraft` 接到 iframe。  
3. 早报 IM 真信箱；记忆问这条 / 跳 session。  
4. 文件「发给 AI」。  
5. 业务应用：空草稿可编辑 + 可选 `promptAi` 填 definition。  
6. 计划步骤要么真接要么禁用；MCP 重载提示；⌘K 搜记忆。

不要做：双机 IM 联调、MCP 热加载、官方 Client 进浏览器、再抄一份会话 JSON、改顶栏模块顺序。

### 15.10 验收（每步活测）

- 顶栏切到带中文路径的工作区：早报生成、IM 拟回、Skills 列表、文件发给 AI，全部落在该 cwd 的当前会话（可用会话列表 cwd 核对）。  
- IM 采纳后，当前 iframe 输入框出现原文。  
- 早报未读与 IM 面板未读一致；发往 IM 对端（或本机第二 peer）能收到。  
- 记忆摘录「问这条」出现在同一 sessionId。  
- 创建应用：无 AI 时库里有空 definition；有 AI 且人确认后 screens 非空；点应用能看到目标与数据源，过账仍要操作控制确认。
