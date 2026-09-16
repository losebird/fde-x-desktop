# FDE-X 交接：IM 真信使 + AI 会话磁盘复原

整仓交接请先读：`HANDOFF-FDEX-WORKSTATION.md`。本文只展开 IM 会话磁盘复原的深坑。

给下一个 coding agent。本文是 2026-09-16 工作台会话里已落地的代码与未收口问题，不是产品愿景。

---

## 1. 路径与怎么跑

| 角色 | 路径 |
|---|---|
| **代码仓库（改这里）** | `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` |
| 本 DSH 会话 cwd（宣传图工作区，**不要**当代码根） | `/Users/zxz/Documents/ai-project/kimi-project/Agent_FDE_Dev/工作台宣传图` |
| 发送方测试工作区 | `/Users/zxz/Documents/ai-project/fdex测试` |
| 接收方测试工作区（5175） | 同上宣传图路径 |
| 主 DSH 家 | `~/.dsh-fde-x` |
| 对端 DSH 家 | `~/.dsh-fde-peer` |
| 主会话磁盘 | `~/.dsh-fde-x/sessions/` |
| 对端会话磁盘 | `~/.dsh-fde-peer/sessions/` |
| 对端坏会话隔离目录 | `~/.dsh-fde-peer/sessions-corrupt-handoff/` |
| 官方 DSH | `/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/` |
| 官方 lan-assist | `/Users/zxz/.dsh/vendor/dsh-lan-assist/` |

启动：

```bash
cd /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation
pnpm dev            # UI 5174  →  BFF 4318  →  DSH ~/.dsh-fde-x   LAN 19527
pnpm run dev:peer   # UI 5175  →  BFF 4319  →  DSH ~/.dsh-fde-peer LAN 18528
```

进程分层（不要搞混）：

```
浏览器 5174/5175  Vite（皮，热更新）
      ↓ 代理 /api /lan-assist /dsh-app
FDE-X  4318/4319  runtime/server.mjs（壳）
      ↓
DSH    官方 Harness（脑子；会话文件在 ~/.dsh-fde-* /sessions）
```

- 设置里「重载核心」**现在**会让 4318/4319 `process.exit(0)`，由 `scripts/dev.mjs` / `dev-peer.mjs` 的 `FDE_RUNTIME_SUPERVISED=1` 再拉起（界面不用关）。旧进程不懂退出时，必须手动停 `pnpm dev`。
- **不要杀 `pnpm dev`** 除非用户要求或端口复用了旧 4318。
- 中文 cwd **禁止**塞进 `x-dsh-cwd`。
- 不要粘贴官方 `client.js` 全文。
- 改 `runtime/server.mjs` / `dsh-core.mjs` 必须换新 4318/4319 才生效；Vite HMR 只管 `src/`。

---

## 2. 产品铁律（用户拍过板，不要改回去）

1. **IM 是真信使**，附件走 lan-assist `attachments[]`（name/mime/size/data base64），**禁止**把 IM 附件倒进工作区 Files 面板。
2. **交接交的是 AI 会话磁盘文件**（`session.v3.jsonl.zstd` 等，跳过 `session.lock`），外加勾选的工作区文件。**不是** IM 聊天记录，也不是 iframe 可见正文。
3. **「接着做」**：在接收方当前工作区 **新建 AI 会话**，把会话文件写进去并切过去。覆盖官方 handoff.js「Never a live fork」——用户明确要求复原磁盘会话。
4. **拟回/采纳/先例/问本机/摘要**：左边 DSH 会话干活，结果回填 **IM 输入框**；**禁止自动发 IM**；拟回禁止 `ask_colleague`。
5. 采纳是 **新开左边一轮把事做完**，不是只起草回复。
6. 不要用大厅 caption 假附件；不要硬编码白名单（例如「你好」）。
7. 第一性原理：先核实再声称修好。用户对「声称修好但没验证」非常火。

---

## 3. 关键文件

| 文件 | 职责 |
|---|---|
| `src/components/IMWorkspace.tsx` | IM 大厅+线程、粘贴/预览/保存、交接弹层、接着做、右键菜单、黄条 `imBanner` |
| `src/lib/runtime-api.ts` | `exportAiSession` / `restoreAiSessions` / `imTranslate` / `imCompose`+`imSend` / `draftMemoryCard` |
| `src/lib/types.ts` | `IMHandoffPackage.sessions[]`（sessionId/title/files{name,size,data}） |
| `src/lib/im-ai.ts` | 拟回/采纳 prompt、`extractComposerBody`、`isUnsafeToSend` |
| `src/pages/AI.tsx` | `fde-x-ai-restore` 打开新会话、rename、禁止复原时空窗自动建空会话 |
| `src/components/IMScreen.tsx` | IM 全开时跳过大厅未读轮询 |
| `runtime/server.mjs` | `GET .../sessions/:id/export`、`POST .../sessions/restore`、zstd 改写/嫁接、`POST /ai/reload` 退出 BFF |
| `runtime/dsh-core.mjs` | DSH 子进程、lanAssist 白名单（已加 `/translate`） |
| `runtime/fde-x-dsh-bridge/lib/client.js` | iframe：prompt/select/rename/watchAssistant |
| `runtime/fde-x-dsh-bridge/lib/index.js` | Host：`/fde-session/export` 备用（DSH webServer） |
| `scripts/dev.mjs` / `scripts/dev-peer.mjs` | 监督重启 4318/4319 |
| `src/components/settings/CoreSettings.tsx` | 重载核心 = 4318+DSH |

交接包 MIME：`application/vnd.dsh.handoff+json`，文件名 `dsh-handoff.json`。

---

## 4. DSH 会话文件（必读，踩过坑）

磁盘默认是 **`session.v3.jsonl.zstd`**：JSONL（第一行 header，后面每行一个 event）再用 **多帧 zstd** 压。不是 zip。官方默认 `DEFAULT_COMPRESSION = "zstd"`。

- 第一帧必须 **恰好一行 header + `\n`**。整份压成一帧 → `first frame is not exactly one header line`，DSH **启动即崩**。
- Header 含 `id`、`cwd`、`createdAt`、`isSeeded`… 必须与目录名、项目路径一致，否则 `corrupt session log` / `header id ... and cwd identify ...`。
- `session/create` 会在内存里记下 header。若把原日志（旧 `createdAt`）盖上去 → `session source headers conflict`。
- **正确复原**：`session/create` 得到新 id → 保留 **新会话第一帧 header** → 只把交接包里 **seq 严格递增** 的事件帧接上（`graftZstdSessionLog`）。原日志末尾曾出现 seq 255 后跳回 3 的 `session/title`，整份拒读、界面空白。
- 列表标题来自 **projections.values.title**（`session/rename`），**不是** 日志里的 `session/title` 事件。复原后必须在 DSH reload **之后** rename，并在 `fde-x-ai-restore` 里 `tellDsh('rename')`。
- create 后 DSH **内存里是空会话**。只改磁盘不 reload，左边点开会是白的。restore 末尾 `aiRuntime.reload()`（只重启 DSH 子进程，不是退出 4318）。
- reload 瞬间列表空 → `AI.tsx` 曾 **自动新建空会话**，用户点中空的那条。已加 8s 宽限 + `restoreHoldUntilRef`；`activeId` 优先 URL `chatId`，不要回落到 `visibleSessions[0]`。
- 坏日志会让 **整个 DSH 起不来**（workspace 插件 list 时抛）。隔离目录：`~/.dsh-fde-peer/sessions-corrupt-handoff/`。

参考实现：`runtime/server.mjs` 中 `scanZstdFrames` / `graftZstdSessionLog` / `collectIncreasingEvents` / `POST /api/v1/ai/sessions/restore`。

官方校验：`@deepseek-ai/dsh-session-persistence-jsonl` `assertStoredIdentity`；冲突：`@deepseek-ai/dsh-session-query` `assertSessionHeadersCompatible`。

---

## 5. 「接着做」现行流程

发送方：

1. 交接弹层列 `listAiSessions`，勾选会话 + 工作区文件。
2. `GET /api/v1/ai/sessions/:id/export` 读磁盘文件（跳过 lock）。
3. `packHandoffAttach` 打进 `dsh-handoff.json`（`v:2, sessions[].files[]`）。
4. 放入 IM 输入区，人点发送（compose+send）。芯片应显示 `标题 / session.v3.jsonl.zstd · N KB`。

接收方：

1. 气泡可能显示「0 个会话文件」（incoming 映射没把 pack.sessions 填上）。**接着做** 必须按附件 **原始序号** 扫 `imAttach`，`parseHandoffPack` 取出 `sessions`。
2. `restoreAiSessions({ cwd, workspaceId?, sessions })`。
3. 服务端 create → graft → `aiRuntime.reload()` → rename。
4. 派 `fde-x-ai-restore`；AI 页刷新 iframe、nav 到新 id、tellDsh rename。
5. IM 顶栏黄条「正在复原…」，成功绿、失败红。过程中禁止连点。

附件序号坑：`dsh-handoff.json` 常在信的 attachments[0]。UI 滤掉交接包后若用过滤后下标去 `/attach?index=`，点文档会错一位（文档变图、图变文件名折行）。已用 `id = requestId::原始index`。

---

## 6. IM 右键（刚改，需真人点一遍）

原先：翻译写 Zustand mock（活消息不在那份 store）；转发走 `/reply`（同线程回复，不是转给别人）；记档案失败被吞。

现在：

- 翻译：`lanAssist POST /translate` `{ quote }`，译文挂 `translations[messageId]`，气泡下 English。
- 转发：对目标 peer `imCompose` + `imSend`，带正文（`messageBody`：text 或 handoff.summary）和附件字节。
- 记档案：`POST /api/v1/memory/cards` → semantic-os `draft_memory_card`，黄条报成败，打开记忆页等人点头。
- 问本机/拟回/采纳/摘成待办：一律 `messageBody()`，交接包不再拿空字符串。

`dsh-core.mjs` lanAssist 白名单已加 `/translate`。若提示「IM 路径不允许」= 4318/4319 还是旧进程。

---

## 7. 已相对稳定（不要无故拆）

- 粘贴/拖图进输入区；气泡内预览/另存；caption 有芯片时隐藏「附件 xxx」。
- 滚动贴底（观察 list **内容** ResizeObserver，不是外框）。
- 未读：IM 开着时大厅不轮询；`markedReadRef` 防闪。
- 六件 AI：拟回/采纳/先例/问本机/摘要/交接入口；采纳不做 biz_write；watchAssistant 要 `sawRun && !running`。
- 空 IM 不因 `liveContacts ?? []` 每帧新数组死循环。

---

## 8. 未收口 / 请接着做

按优先级：

1. **接着做端到端验收（5174→5175）**  
   交「测试一下」→ 对端点接着做 → 左边出现 **同名会话且有原文**（用户消息：测试一下 / 继续 / 测试 semantic-os 功能），不要空窗、不要多一条「未命名」。  
   上次真人测：磁盘有 256 条递增事件，但 UI 仍可能选错会话或 reload 后投影标题未刷新。请自己点，不要口头宣称。

2. **incoming 交接包仍显示「0 个会话文件」**  
   线程映射没解析 `dsh-handoff.json` 的 `sessions[]`。接着做靠扫 attach 能工作，但卡片计数是错的。应收包时 parse 填 `handoff.sessions`。

3. **工作区文件是否真的到了对端工作区**  
   目前工作区文件是 IM 附件；「接着做」主要复原 **会话**。用户若期望 md/png 也落到接收方 cwd，要补 copy-to-workspace（已有 `/attach/copy`），且 **不要**改成打开 Files 面板。

4. **右键三项真人回归**  
   普通文本 + 交接包各测：翻译可见、转发出现在对方会话、记忆页有起草卡。翻译需新 4318。

5. **restore 仍太重**  
   每次接着做 `aiRuntime.reload()` 整棵 DSH。更干净：写盘后不要留下 live 空会话（先写日志再让 DSH 当 cold 打开），避免 reload。未做。

6. **对端隔离目录里的坏会话**  
   `~/.dsh-fde-peer/sessions-corrupt-handoff/` 可留作标本，不要拷回 `sessions/`。

7. **设置「重载核心」与 Vite**  
   第一次换上监督重启需要当前 `dev.mjs` 已在跑。若仍「复用已有本地核心」，先杀掉旧 `node runtime/server.mjs`。

---

## 9. 验收口令

发送方 5174（工作区 fdex测试），接收方 5175（工作区 工作台宣传图），已配对。

1. 5174 对 Ace 打开交接，勾「测试一下」+ 任意 md，预览能看到 `session.v3.jsonl.zstd` 和 KB 数，放入输入区有会话文件芯片，发送。
2. 5175 气泡「打开详情」不是 IM 历史。点接着做，黄条可见。
3. 5175 左边出现标题「测试一下」的会话，打开有原对话，不是空白输入框。
4. 不要自动发 IM。拟回结果只进输入框。
5. 右键翻译/转发/记档案有黄条，失败要说人话。

---

## 10. 交接提示词（原样交给下一个 agent）

把下面整段复制给新 agent，并附上本文路径。
