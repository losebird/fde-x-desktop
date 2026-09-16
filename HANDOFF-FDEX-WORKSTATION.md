# FDE-X 工作台 · 整仓交接

给下一个 coding agent。覆盖整个 FDE-X Desktop，不只 IM。日期：2026-09-16。

IM 会话磁盘复原的深坑另见同目录 `HANDOFF-IM-SESSION-RESTORE.md`。冲突时：**本文 + `PRODUCTION-SPEC.md` §0.5** 为准；§0.5 覆盖规格里所有更早条款。

---

## 0. 这是什么

FDE-X 是本机个人工作台壳：浏览器里仍是 FDE-X 的顶栏、右侧功能条、AI 主区。真正干活的引擎不在浏览器里：

| 用户看见 | 权威引擎 |
|---|---|
| AI 对话 / 模型 / 工具 / 轨迹 | 本机 **DSH Host**（官方 DeepSeek Harness） |
| IM、业务过账 | **dsh-lan-assist** Host |
| 记忆搜索 / 卡片 | **dsh-semantic-os** Host |
| 待办 / 日程 / 业务应用草稿 / 布局 | 本机 **SQLite** + Zustand 壳状态 |

**禁止**把官方 DSH / lan-assist / semantic-os 的 `client.js` 当产品页塞进浏览器。AI 主区是 FDE-X 自己的 `AI.tsx` + **iframe 嵌 DSH web**（`/dsh-app/`），不是 SessionIsland（已删）。

---

## 1. 路径（先认准再改）

| 角色 | 绝对路径 |
|---|---|
| **代码仓库（唯一改这里）** | `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` |
| 本 DSH 会话 cwd（宣传图，**不是源码根**） | `/Users/zxz/Documents/ai-project/kimi-project/Agent_FDE_Dev/工作台宣传图` |
| 发送方常用测试 cwd | `/Users/zxz/Documents/ai-project/fdex测试` |
| 主 DSH 家 | `~/.dsh-fde-x` |
| 对端 DSH 家 | `~/.dsh-fde-peer` |
| 主会话磁盘 | `~/.dsh-fde-x/sessions/` |
| 对端会话磁盘 | `~/.dsh-fde-peer/sessions/` |
| 对端坏会话隔离 | `~/.dsh-fde-peer/sessions-corrupt-handoff/` |
| SQLite | `runtime/data/fde-workstation.sqlite`（对端 `...-peer.sqlite`） |
| 官方 dsh | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/` |
| 官方 lan-assist | `/Users/zxz/.dsh/vendor/dsh-lan-assist/` |
| 执行规格 | 仓库根 `PRODUCTION-SPEC.md`、`AGENTS.md`、`PRODUCTION-STATUS.md` |
| 语义计划 | `SEMANTIC-FDEX-PLAN.md` |
| 对抗审查 | `ADVERSARIAL-REVIEW.md` |

改代码 **只动 scene-39 仓库**。`工作台宣传图` 是一个 DSH workspace / 图记忆 cwd。

---

## 2. 怎么跑

```bash
cd /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation
pnpm dev            # 5174 界面 + 4318 BFF + DSH ~/.dsh-fde-x ，LAN 19527
pnpm run dev:peer   # 5175 + 4319 + ~/.dsh-fde-peer ，LAN 18528（双机 IM）
npx tsc -b --pretty false
node runtime/smoke.mjs
```

进程：

```
浏览器 5174/5175     Vite（皮，HMR 只管 src/）
   ↓  /api /health /lan-assist /dsh-app /plugins /semantic-os
4318/4319            runtime/server.mjs（壳：SQLite、转发、文件、会话 export/restore）
   ↓
DSH                  官方 Harness --port 0 --patch runtime/dsh-core.patch.yml
                     插件：dsh-lan-assist、dsh-semantic-os、fde-x-dsh-bridge
```

- 设置「重载核心」= `POST /api/v1/ai/reload` → 4318 `process.exit(0)`，`scripts/dev.mjs` 在 `FDE_RUNTIME_SUPERVISED=1` 下再拉起。旧 4318 不懂退出时必须停 `pnpm dev`。
- 若日志写「复用已有本地核心」，先杀掉占 4318 的旧 `node runtime/server.mjs`。
- **不要无故杀 `pnpm dev`。** 改 `runtime/server.mjs` / `dsh-core.mjs` 必须换新 BFF 才生效。
- 中文 cwd **禁止** `x-dsh-cwd`。
- 4318/DSH 只绑 `127.0.0.1`。写操作无 Origin 白名单 → 403。
- 浏览器不持有 DSH cookie、配对钥匙、业务口令。

---

## 3. 壳与路由

- 所有路由都渲染 `IMScreen`（`src/App.tsx`）。`/` → `/ai`。
- **主区永远是 AI**（`src/pages/AI.tsx`）。`/im` `/files` `/settings` 等深链只把对应右侧面板设为 `full`，然后 `navigate('/ai')`。
- 右侧功能条：`ThumbnailStack` + `StagePanel` + `FloatingPanel`。状态 `closed | tab | half | full`，同时最多一个 `full`。
- 顶栏模块顺序（store `defaultPanels`，**禁止改集合/顺序**）：  
  **IM、早报、计划、文件、业务应用、MCP、Skills、记忆、设置**
- 顶栏工作区：`WorkspaceSwitcher` ↔ DSH workspace `cwd`。所有「发给 AI」必须打 **当前顶栏工作区 + 当前左栏会话**（`src/lib/ai-target.ts`）。禁止 `listAiSessions` 后取「第一条非子代理」。
- ⌘K：`CommandPalette`。规格要求搜真会话/文件/记忆，不要只搜 seed。
- 视觉：`PRODUCTION-SPEC` §0.1。不要 restyle、不要发明页面。业务应用是 **三 Tab**，不是 AI 那种左中右。

---

## 4. 模块地图

### 4.1 AI（主区）

- `src/pages/AI.tsx`：左栏会话列表（FDE-X 自己画），中间 iframe `4318/dsh-app/#fde-session=`，连 DSH web。
- 桥：`runtime/fde-x-dsh-bridge`。`postMessage` op：`select` / `prompt` / `compose` / `rename` / `fork` / `attach` / `transcript` / `readAssistant`。
- 会话写锁在 UI：`/follow` `/fork` 走 4318 会 `session_owned_by_ui`。
- `aiInboxDraft`：IM 采纳结果 → iframe compose，用完清空。
- 复原交接：`fde-x-ai-restore` 事件；reload 后 8s 内不要自动 `createRemoteSession`；`activeId` 优先 URL `chatId`。
- 权限文案跟 DSH：仅可查看 / 工作区内修改 / 完全权限。

### 4.2 IM

- `IMWorkspace.tsx` + `IMScreen.tsx`。真信箱：`lanAssist` `/state` `/thread` `/compose` `/send` `/attach` `/attach/copy`。
- 附件只在信里，**禁止倒进 Files 面板**。
- 拟回/采纳/先例/问本机/摘要：左边 DSH 干活，结果回填 **输入框**，**禁止自动发 IM**，拟回禁止 `ask_colleague`。
- 交接：交 **AI 会话磁盘文件** + 勾选工作区文件。接着做 = 新建会话 + 写盘 + DSH reload + rename。详见 `HANDOFF-IM-SESSION-RESTORE.md`。
- 右键：翻译走 `/translate`；转发 `compose+send`；记档案 `draftMemoryCard`。失败必须黄条，禁止吞错。
- 未读：IM 全开/半开时大厅不轮询。

### 4.3 文件

- `src/pages/Files.tsx`。list/上传/mkdir/删除走当前会话 cwd（`workspaceFiles` + 4318 受控写盘）。`..` 为 400。
- 「发给 AI」与拖放同一路径：`fde-x-attach-file`。
- 回滚：4318 自管最多 20 版；无版本则按钮 disabled，不准新造控件。

### 4.4 早报

- `src/pages/Briefing.tsx`。规格：当天日期、无连接器指标为 —、未读接 `imState`、发往 IM 走 compose+send、生成走 `currentAiTarget`。
- 仍有 seed / 写死文案残留风险，改前对照规格 §13.5 §15.8。

### 4.5 计划

- `src/pages/Plan.tsx`（待办 / 日程 / 工作流 三 Tab）。这是 **个人计划 SQLite**，不是 DSH plan-mode。
- 暂停态不能启用。`todo_write` 不自动进计划。

### 4.6 业务应用

- `src/pages/Data.tsx`。三 Tab：业务记录 / 操作控制 / 应用。
- 过账：**只** lan-assist `biz_preview` / `biz_write` / `biz_traces`。SQLite 不是 ERP。无闸令牌写必须失败。
- 动作名：现查 / 改行 / 新建 / 删除 / 过审。先 `biz_describe`。
- 「AI 创建应用」曾只插空草稿；现应可编辑 definition（`PUT /api/v1/business/apps/:id`）。名不副实处对照 `PRODUCTION-STATUS.md`。
- 活测采购单用的是 **有词表的业务工作区**，不是 scene-39 自己。

### 4.7 MCP / Skills

- `src/pages/MCP.tsx` `Skills.tsx`。MCP 写入 DSH patch/配置，**保存后要重载核心**，没有热加载。
- Skills 列表必须 `currentAiTarget`。无 Remote 则启停保持 disabled。

### 4.8 记忆

- `src/pages/Memory.tsx`。三层卡片：项目 / 当日 / 用户。`draft_memory_card`，列表默认起草，点头才入档。
- 会话原文 **只读 DSH session 日志**，禁止再抄 `texts.json`。FAISS 只留向量和 id。
- 图是 当时 不是 现在。现查走 `biz_preview`。

### 4.9 设置

- `src/pages/Settings.tsx` + `components/settings/CoreSettings.tsx` `SemanticSettings.tsx`。
- 运行环境、模型提供方、存储、语义引擎、重载核心。
- 配对：mint → handshake → **开码侧 accept**。本机自握 `NO_RELAY_PAIR`。双机填 **LAN 门牌**（19527 / 18528），不要填 5174/5175。

---

## 5. 运行时与数据

- `runtime/server.mjs`：HTTP、SQLite、DSH RPC、lan-assist 代理、文件、会话 export/restore、业务 apps。
- `runtime/dsh-core.mjs`：拉起隔离 profile、拷语义 runtime 到 `~/.dsh-fde-x/semantic-os/runtime`（约 1.8GB，不 symlink 官方 `~/.dsh`）。
- `runtime/dsh-core.patch.yml`：cordis patch。
- `runtime/db.mjs` + `migrations/001_core.sql` `002_modules.sql` `003_business_operations.sql`。
- Zustand `src/store/app.ts`：面板、工作区、待办、IM 草稿；**真 IM 消息以 lan-assist 为准**，不要再把业务写回假 store。

---

## 6. 铁律（用户反复拍板）

1. FDE-X 壳 + 三台本机引擎，官方 Client 不准进浏览器。
2. 一根指针：`currentAiTarget()` = 顶栏 cwd + 左栏 session。
3. IM 真信使；附件不进 Files。
4. 交接 = AI 会话磁盘文件（jsonl.zstd）+ 勾选工作区文件；接着做 = 新建会话复原，不是 prompt 当前聊天。
5. 拟回/采纳结果进输入框，人点发送。禁止自动发 IM。
6. 不 restyle、不发明路由、不「顺便重构」。
7. 不硬编码端口、preset、模型名、工作区路径、员工号。
8. 不 `JSON.stringify` Cordis/Session 活对象。
9. 先核实再声称修好。中文 cwd 禁止 `x-dsh-cwd`。
10. 改 BFF 必须换新 4318/4319。

---

## 7. 现状（诚实）

**已活过（对照 PRODUCTION-STATUS，当时记录）：**

- connect、会话/preset/模型/Skills、文件 CRUD、IM state/开码、连接器、采购单现查/改行回执、tsc/smoke、语义 0.6.7、中文工作区图搜索。
- 壳层补缺 §15.9 大部分已动手：`ai-target`、aiInboxDraft、早报 IM、文件发给 AI、业务应用 PUT、计划/MCP 提示。
- IM：粘贴图、气泡预览另存、滚动贴底、未读、六件 AI 入口、交接导出/复原代码、右键翻译转发记档案（代码已改，翻译需新 4318）。

**未收口：**

1. 接着做 5174→5175 端到端：要同名会话 **且有原文**，不要空窗/多余未命名。深坑见 IM 专文。
2. incoming 交接卡仍可能显示「0 个会话文件」。
3. 工作区文件是否写入接收方 cwd（现为 IM 附件）。
4. MCP 新增仍要重连；无 MCP Remote。
5. 双机配对要真门牌；一键安装包未做。
6. 业务应用「AI 创建」是否已真正生成 screens：对照 Data.tsx 再测。
7. 早报/⌘K 是否还吃 seed：对照 Briefing / CommandPalette。
8. `/health` semantic-memory 适配器要 4318 新进程才按 `/ready` 报健康。

---

## 8. 建议接手顺序

1. 读 `AGENTS.md` → `PRODUCTION-SPEC.md` §0–§0.5 → 本文 → `HANDOFF-IM-SESSION-RESTORE.md`。
2. `pnpm dev` + `pnpm run dev:peer`，确认 5174/5175 能开、能配对。
3. 先把「接着做」验到绿（用户最痛），再 incoming 计数、右键回归。
4. 再扫早报/业务应用/⌘K 假数据。
5. 不要做规格写明「本版不做」的：compaction、终端、子 Agent 树、Cordis 动态插件当产品、DSH plan-mode 当个人待办。

---

## 9. 交接提示词（整仓，原样复制）

```
你接手整个 FDE-X Desktop 工作台，不是只做 IM。

先读：
1. /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/HANDOFF-FDEX-WORKSTATION.md
2. 同目录 PRODUCTION-SPEC.md（§0.5 覆盖冲突条款）和 AGENTS.md
3. IM 会话复原深坑：HANDOFF-IM-SESSION-RESTORE.md
4. PRODUCTION-STATUS.md

代码只改这个仓库：
/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation

不要把
/Users/zxz/Documents/ai-project/kimi-project/Agent_FDE_Dev/工作台宣传图
当成源码根（那是 DSH cwd / 图记忆）。

架构：5174 Vite → 4318 server.mjs → DSH（~/.dsh-fde-x）。对端 5175/4319/~/.dsh-fde-peer。
AI=DSH；IM/过账=lan-assist；记忆=semantic-os。禁止官方 client.js 进浏览器。禁止 restyle、发明页面。

当前最痛：IM「接着做」要把选中的 AI 会话磁盘文件（session.v3.jsonl.zstd）在接收方新建会话并看到原文。不要自动发 IM。不要把 IM 附件倒进 Files。

铁律：currentAiTarget()=顶栏 cwd+左栏 session；改 runtime/*.mjs 必须换新 4318/4319；不要杀 pnpm dev；中文 cwd 禁止 x-dsh-cwd；先核实再声称修好。

启动：cd 仓库；pnpm dev；另开 pnpm run dev:peer。先读代码和上述文档，列出准备改的文件，再动手。
```

---

文档结束。IM 专文路径：`HANDOFF-IM-SESSION-RESTORE.md`。
