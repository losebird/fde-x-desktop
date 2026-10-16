# FDE-X Desktop 工作台 · 架构与进度只读评估

评估时间：2026-09-17。源码根：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`。未改代码、未启停进程。

---

## 1. 项目定位与模块清单

### 一句话定位

**本机个人工作台壳（React/Vite）+ BFF（`runtime/server.mjs`）**，浏览器只负责 FDE-X 交互；AI 权威在 **DSH Host**，IM/业务过账在 **dsh-lan-assist**，记忆在 **dsh-semantic-os**；布局/待办/业务草稿等在 **SQLite + Zustand**（`HANDOFF-FDEX-WORKSTATION.md` L9–L18，`PRODUCTION-SPEC.md` L14–L35）。

### 模块清单

| 模块 | 目录 / 入口 | 职责 | 依赖 |
|------|-------------|------|------|
| 壳路由与面板 | `src/App.tsx`、`src/components/IMScreen.tsx`、`ThumbnailStack`/`StagePanel`/`FloatingPanel` | 全路由渲染 `IMScreen`；深链打开右侧 full 后回到 `/ai` | Zustand `src/store/app.ts` |
| AI 主区 | `src/pages/AI.tsx` | 左栏会话列表；中间 **iframe** `/dsh-app/#fde-session=`；桥 `postMessage` | `runtime-api` → 4318 → DSH；`runtime/fde-x-dsh-bridge` |
| 会话指针 | `src/lib/ai-target.ts` | `loadCurrentAiTarget()` = 顶栏 cwd + `activeAiSessionId` | `listAiSessions`、store |
| IM | `src/components/IMWorkspace.tsx`、`src/lib/im-ai.ts` | lan-assist 信箱、拟回/交接/接着做 | `runtime-api` `/api/v1/im/*` → `dsh-core.lanAssist` |
| 文件 | `src/pages/Files.tsx` | cwd 文件 CRUD、发给 AI | 4318 `workspaceFiles/*` + 受控写盘 |
| 早报 | `src/pages/Briefing.tsx` | 指标/推送 | SQLite 任务 + `imState`/`imCompose` + `loadCurrentAiTarget` |
| 计划 | `src/pages/Plan.tsx` | 待办/日程/工作流（SQLite，非 DSH plan-mode） | store + `runtime-api` |
| 业务应用 | `src/pages/Data.tsx` | 三 Tab；`biz_*` 过账 | SQLite apps + lan-assist gate |
| MCP / Skills | `src/pages/MCP.tsx`、`Skills.tsx` | patch 写 MCP；Skills 列表 | DSH 配置 + `currentAiTarget` |
| 记忆 | `src/pages/Memory.tsx` | semantic-os 卡/搜索 | `/api/v1/memory/*` → `semanticOs` |
| 设置 | `src/pages/Settings.tsx`、`components/settings/*` | 核心/语义/重载 | `POST /api/v1/ai/reload` |
| BFF | `runtime/server.mjs` | HTTP、SQLite、DSH RPC、代理、export/restore | `db.mjs`、`dsh-core.mjs`、`adapters.mjs` |
| DSH 连接器 | `runtime/dsh-core.mjs` | 子进程、cookie、Typert `call`、semantic/lanAssist 转发 | 官方 `@deepseek-ai/dsh`、`dsh-core.patch.yml` |
| DSH 桥插件 | `runtime/fde-x-dsh-bridge/` | Host 路由 + iframe `client.js`（**非**官方全页 client） | DSH 插件槽 |
| 数据层 | `runtime/db.mjs`、`runtime/migrations/*.sql` | 工作区、业务应用、操作迹 | SQLite `runtime/data/fde-workstation.sqlite` |
| 开发编排 | `scripts/dev.mjs`、`dev-peer.mjs` | 5174/5175 + 4318/4319 监督重启 | `vite.config.ts` |
| 契约测试 | `runtime/smoke.mjs`、`runtime/check.mjs` | Origin 闸、去岛、semantic 路径 | 无单元测试目录 |

---

## 2. 数据流与落盘位置

### 请求路径（浏览器 → 4318 → 引擎）

```
浏览器 (Vite 5174/5175, 127.0.0.1)
 proxy: /api/v1, /health, /dsh-app, /lan-assist, /semantic-os, /plugins, /api
 → runtime/server.mjs (4318/4319)
```

证据：`vite.config.ts` L55–91；`PRODUCTION-SPEC.md` L111–123。

| 能力 | BFF 路由（示例） | 下游 |
|------|------------------|------|
| AI | `/api/v1/ai/*` | `aiRuntime.call(...)` Typert RPC（`dsh-core.mjs`） |
| DSH Web UI | `/dsh-app/*` | `proxyDsh` 改 base/hook（`server.mjs` L463–665） |
| IM | `/api/v1/im/*` | `aiRuntime.lanAssist` 白名单路径（`server.mjs` L1805+；`dsh-core.mjs` L668–670） |
| 业务 | `/api/v1/biz/*` | `lanAssist` preview/write + `translateBizIntent`（`server.mjs` L132+） |
| 记忆 | `/api/v1/memory/*`、`/semantic-os/*` | `aiRuntime.semanticOs`（`server.mjs` L878–880、L1320+） |
| 文件 | `/api/v1/files` 等 | DSH `workspaceFiles/*` + 4318 本地版本目录 |
| 业务草稿 | `/api/v1/business/apps` | SQLite `db.mjs` |

前端统一入口：`src/lib/runtime-api.ts`（如 `listAiSessions` L538+、`restoreAiSessions` L555+、`imTranslate` L854–855）。

### 数据落在哪里

| 数据 | 位置 |
|------|------|
| DSH 会话日志 | `FDE_DSH_SESSION_ROOT` 或 `~/.dsh-fde-x/sessions/`（`server.mjs` L675–677；`dsh-core.mjs` L189） |
| DSH 存储 | `~/.dsh-fde-x/storages/`（`dsh-core.mjs` L190） |
| 语义 runtime 拷贝 | `~/.dsh-fde-x/semantic-os/runtime`（`HANDOFF` L156–157；`dsh-core.mjs` L385+） |
| SQLite | `runtime/data/fde-workstation.sqlite`（peer：`...-peer.sqlite`，`HANDOFF` L35） |
| IM 消息/附件 | **lan-assist Host 状态**（非 Zustand 权威；`HANDOFF` L159） |
| 交接包 on wire | `dsh-handoff.json`（`application/vnd.dsh.handoff+json`），内含 base64 会话文件（`IMWorkspace.tsx` L112–148） |
| 4318 凭据 | 进程内存 cookie（`PRODUCTION-SPEC.md` L42） |

中文 cwd：`dsh-core`/`server` 在非 ASCII cwd 时去掉 `x-dsh-cwd`（`server.mjs` L540–541、L575）。

---

## 3. 进度：规格 / 状态 vs 代码

### 对照 `PRODUCTION-STATUS.md`「已活测」（L5–L13）

| 声称 | 代码侧支撑 | 备注 |
|------|------------|------|
| connect / 会话 / preset / Skills | `runtime-api` + `server.mjs` AI 路由 | 未在本评估中跑 live |
| 文件 CRUD、`..`→400 | `server.mjs` L2035–2165 路径校验 | smoke 覆盖写闸 |
| IM state、采购单 biz | `server.mjs` im/biz 段 | 活测依赖外部工作区（STATUS L19） |
| 主区 `AI.tsx`、去岛 | 无 `SessionIsland`（`src` grep 无匹配）；`smoke.mjs` L98–102 | |
| 语义 0.6.7、session 日志 | `Memory.tsx`、`dsh-core` semantic 拷贝 | |

### 对照 `PRODUCTION-SPEC.md` §15 / §15.9

规格文首仍写「§15 **未开工**」（`PRODUCTION-SPEC.md` L5），但 `PRODUCTION-STATUS.md` L23–30 声称 §15.9 多项**已做**。以**代码**为准：

| §15 项 | 状态 | 证据 |
|--------|------|------|
| 15.1 `currentAiTarget` | **基本完成** | `Briefing`/`IMWorkspace`/`Skills`/`Files`/`CommandPalette`/`Data` 均 `import loadCurrentAiTarget` |
| 15.2 `aiInboxDraft` | **完成** | `AI.tsx` L372–376 `tellDsh('compose')`；store 字段 |
| 15.3 早报 IM 真信箱 | **部分** | `Briefing.tsx` L41 `imState`、L249 `imCompose`；仍有写死「scene#39」文案 L244、L263 |
| 15.4 记忆问这条 / ⌘K 记忆 | **部分** | `CommandPalette.tsx` L107 `searchMemory`；`Memory.tsx` L659 `loadCurrentAiTarget` |
| 15.5 文件发给 AI | **完成** | `Files.tsx` L377 + `fde-x-attach-file`（HANDOFF L118） |
| 15.6 计划/MCP | **半成品** | `seed.ts` 仍含 `memory.add` 工作流步 L323+；MCP 仍 patch+重载（STATUS L17） |
| 15.7 业务应用 AI 创建 | **半成品** | `Data.tsx` L347–366 建空草稿 + `promptAi`；**无**自动写回 screens（L364 文案承认）；`AppDraftEditor` 可编辑+PUT（L297–314） |
| 15.8 早报去假数据 | **未完成** | 见上 Briefing 写死主线 |
| §0.5 第 N 轮 `turnOutline` | **未见到 UI** | 仅 `runtime-api.ts` L168 类型；`src` 无「第 N 轮」实现 |

### `PRODUCTION-STATUS.md` 内部矛盾

- L25–30 列「已完成」壳层补缺。
- L32–36 仍描述**旧问题**（「指针乱」「aiInboxDraft 只写不读」等），与 L25–30 **冲突**；应以代码为准（`ai-target.ts`、`AI.tsx` compose 已读草稿）。

### 文档 vs 代码不一致（额外）

| 点 | 文档 | 代码 |
|----|------|------|
| Vite 反代 | `PRODUCTION-SPEC.md` L125「删除 `/plugins`」 | `vite.config.ts` L69–72 仍代理 `/plugins` |
| Vite `/api` catch-all | §0.5 L97 删 catch-all | `vite.config.ts` L87–91 仍保留 `/api` |
| §0.2 浏览器禁止 iframe | 表列禁止 iframe SessionIsland | 产品 intentional：`AI.tsx` iframe `/dsh-app`（`HANDOFF` L20） |
| §15「未开工」 | L5 | 大量 §15.9 项已在源码落地 |

### 未完成（文档 + 代码一致）

- IM「接着做」端到端（`HANDOFF` L187–188；`HANDOFF-IM-SESSION-RESTORE.md` L151–155）
- MCP 热加载、双机门牌、安装包（`PRODUCTION-STATUS.md` L15–21）
- incoming 交接卡「0 个会话文件」（见 §4）

---

## 4. IM 会话复原（`session.v3.jsonl.zstd`）现状

### 设计目标（铁律）

交接 = 磁盘会话文件 + 可选工作区附件；接收方 **新建会话 + 写盘 + DSH reload + rename**（`HANDOFF-IM-SESSION-RESTORE.md` L52–55、L103–118）。

### 已实现链路

**发送方**

1. `HandoffDialog`：`exportAiSession` → 填入 `IMHandoffPackage.sessions`（`IMWorkspace.tsx` L1947–1963）
2. `packHandoffAttach` 把 `sessions` 写入 JSON v2（L126–148）
3. `imCompose` + `imSend` 发出（L905+）

**BFF export**

- `GET /api/v1/ai/sessions/:id/export` → `readSessionBundle`（`server.mjs` L1526–1536、L708–728），跳过 `session.lock`（L673）

**BFF restore（核心）**

1. 每包：`session/create`（L1482–1487）
2. `writeSessionBundle`：对已有 `.jsonl.zstd` **graft** 而非整文件覆盖（L844–846）
3. `graftZstdSessionLog`：保留新建会话 header 帧，只接 `collectIncreasingEvents` 严格递增 seq（L823–834、L799–820）
4. `aiRuntime.reload()`（L1510–1514）
5. `session/rename` 标题（L1516–1520）

**接收方 UI**

- `continueHandoff`：优先 `message.handoff.sessions`；否则按附件下标 `imAttach` + `parseHandoffPack`（`IMWorkspace.tsx` L1057–1090）
- `fde-x-ai-restore` → `AI.tsx` L197–214：8s 宽限、nav 新 id、iframe bust、rename

### 卡在哪 / 已知坑

| 问题 | 原因 | 证据 |
|------|------|------|
| 气泡显示「0 个会话文件」 | 线程映射建 `handoff` 时**未**从 `dsh-handoff.json` 解析 `sessions`，只填 summary/fileIds | `IMWorkspace.tsx` L467–478：`handoff` 无 `sessions`；`handoffSessionFiles` 依赖 `pkg.sessions`（L186–192） |
| 「接着做」仍可能失败/空窗 | 依赖 attach 扫描兜底；reload 后列表空触发自动 `createRemoteSession`（已部分抑制） | L1063–1072；`AI.tsx` L349–361 + `restoreHoldUntilRef` L203、L351 |
| DSH 整进程起不来 | 坏 zstd（header 帧、seq 乱序） | 专文 L86–95；隔离目录 `sessions-corrupt-handoff` L21 |
| 标题/投影 | 列表标题来自 rename 非 `session/title` 事件 | 专文 L92–93 |
| 工作区文件未进接收方 cwd | 仅 IM 附件；restore 只处理 sessions | 专文 L160–161 |
| 过重 | 每次 restore 全量 `aiRuntime.reload()` | `server.mjs` L1510–1511；专文 L166–167 |

### 已有尝试（文档记录）

- zstd 多帧 graft、seq 过滤、reload 监督、`restoreHoldUntilRef`、attach 原始 index（`HANDOFF-IM-SESSION-RESTORE.md` §4–§5）
- 备用 Host export：`fde-x-dsh-bridge/lib/index.js`（专文 L76）

**结论**：服务端 restore **逻辑已写到 graft+reload+rename**；端到端痛点主要在 **接收方 UI 未预解析 handoff.sessions（计数/展示）**、**reload 与 AI 页会话选择竞态**、以及 **未验证的 DSH 投影刷新**（文档 L154–155：磁盘有事件 UI 仍可能错会话/空白）。

---

## 5. 架构问题

### 耦合

- **`server.mjs` 单体**（~2600 行）：路由、biz 翻译、文件写盘、zstd 会话手术、DSH/semantic 代理同文件，变更需换 4318。
- **IM 与 AI 通过 DOM 事件耦合**：`fde-x-ai-restore`、`fde-x-ai-prompt`（`AI.tsx` L245–251），无单一状态机。
- **双工作区模型**：Zustand `workspaces` 与 DSH `listAiWorkspaces` 在 `AI.tsx` L292–300 同步。

### 重复 / 脆弱

- handoff 解析：`parseHandoffPack` 仅在「接着做」懒加载，映射阶段重复逻辑缺失（§4）。
- `PRODUCTION-STATUS` 过时段落误导维护者（L32–38）。
- restore 后 **live 空会话 + 磁盘有内容** 依赖 reload；失败则白屏（专文 L94–95）。

### 铁律合规

| 铁律 | 状态 |
|------|------|
| 禁止官方 client 进浏览器 | **合规**：iframe 走 `/dsh-app` 代理 + strip；桥为 `fde-x-dsh-bridge` |
| `currentAiTarget` | **基本合规**（见 §3） |
| 中文 cwd 禁止 `x-dsh-cwd` | **合规** `server.mjs` L540–541 |
| IM 附件不进 Files | **设计合规**（未审计全部路径） |
| 改 BFF 须新 4318 | 运维铁律，代码无自动热更 |

### 安全（cwd / 路径）

- 写操作 Origin 白名单 403（`server.mjs` L888–894；`smoke.mjs` L72–79）
- 会话文件名 `safeSessionFileName`（L679–683）；文件 API `..` 拒绝（L2035、L2091）
- semantic 路径 `%2e%2e` → 400（`smoke.mjs` L56–66）
- DSH 代理 loopback（`dsh-core` 设计；未全文复读）
- **残留风险**：`/api` 宽代理（`vite.config.ts` L87–91）扩大暴露面，若 4318 有未闸路由则经 Vite 可达

### 错误处理

- restore rename 失败静默（`server.mjs` L1518–1520 `catch {}`）
- 多处 `catch` 吞掉 workspace attach（L1491–1493）

### 测试

- **无** `src/**` 单元测试；仅 `runtime/smoke.mjs`、`check.mjs`
- smoke **不覆盖** `sessions/restore`、graft、IM handoff

---

## 6. 改善优先级（仅现有目标）

### P0

1. **接收方映射解析 `dsh-handoff.json` 的 `sessions[]`**
   - **为什么**：修复「0 个会话文件」、`continueHandoff` 少一次 attach 猜测、与发送方预览一致。
   - **文件**：`src/components/IMWorkspace.tsx`（L430–478 映射环；可复用 `parseHandoffPack` + `imAttach` 在 ingest 时填充 `handoff.sessions`）。

2. **接着做端到端：reload 后会话选择与 iframe 同步**
   - **为什么**：用户最痛；避免空窗/未命名/错 session。
   - **文件**：`src/pages/AI.tsx`（L349–361、L197–214）；必要时 `server.mjs` restore 返回更多投影提示或等待 list 就绪。

3. **（可选同 PR）restore 后验收脚本**
   - **为什么**：graft 易回归；smoke 无覆盖。
   - **文件**：`runtime/smoke.mjs` 或新 `runtime/session-restore.check.mjs`（夹具 zstd 勿提交巨大二进制，可用最小 mock）。

### P1

4. **incoming 展示与工作区文件落地策略**
   - **为什么**：专文 L160–161；`/attach/copy` 已存在（`server.mjs` L1811–1813）但未接入「接着做」。
   - **文件**：`IMWorkspace.tsx`、`runtime-api.ts`。

5. **对齐文档**：更新 `PRODUCTION-STATUS.md` L32–38 或删陈旧段；`PRODUCTION-SPEC.md` L5 §15 状态与 §15.9 关系。
   - **为什么**：避免 agent 按错误缺口改代码。

6. **收窄 Vite 代理**（`/api` catch-all、`/plugins`）
   - **为什么**：与 §0.5 一致，减攻击面。
   - **文件**：`vite.config.ts` L69–91。

### P2

7. **restore 避免全量 DSH reload**（cold open / 删 live 空会话）
   - **为什么**：性能与竞态；专文 L166–167。
   - **文件**：`server.mjs` L1510+，需 DSH 行为验证。

8. **早报去写死「scene#39」**（§15.8）
   - **文件**：`src/pages/Briefing.tsx` L244、L263。

9. **§0.5 第 N 轮 UI**（若仍属本版范围）
   - **文件**：`src/pages/AI.tsx` + follow 投影消费。

10. **业务应用：prompt 结果写回 definition**（§15.7 未闭环）
    - **文件**：`Data.tsx` + 可能新 BFF 解析助手回复（不发明新页面）。

---

## 附录：关键证据索引

- 架构分层：`HANDOFF-FDEX-WORKSTATION.md` L57–66
- restore 实现：`runtime/server.mjs` L1465–1523、L731–851
- handoff 映射缺口：`src/components/IMWorkspace.tsx` L467–478、L1057–1072
- AI restore 竞态：`src/pages/AI.tsx` L197–214、L349–361
- `currentAiTarget`：`src/lib/ai-target.ts` L43–63
