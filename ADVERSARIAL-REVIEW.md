# 对抗审查（2026-04 父会话对照 §0.5）

范围：`src/`、`runtime/`。不扫 `node_modules`。子 agent 仍在跑；以下为父会话已核对代码的缺口。活测过的过账/connect 仍算已通，不抵消下面未做项。

## 已通（活测或代码）

- 无 SessionIsland；Vite 只反代 `/api/v1` `/health`；写无 Origin → 403
- DSH connect；会话/preset/模型/Skills(62)
- 文件 list/上传/mkdir/删除
- IM peers、开码；记忆搜索冷启动后可用
- 采购单现查 20 条；改行 preview_id → write 回执 `371712924975164`
- 权限中文三档、输入条三按钮位置（此前改过，本轮未再 diff className）

## 未做完（按规格）

### IM（§0.5 绑 session / 拟回 / 问本机 / 采纳）

- `IMWorkspace.tsx` **发送**仍先 `sendIM` 写 zustand，再 `imReply`；双写。
- **问本机 / 摘要 / 先例**仍 `runIMAIAction`（store mock），不是 `session/prompt`。
- **采纳**写进 zustand `chats`，不是 AI 输入框。规格：`采纳=IM→AI textarea`。
- 无 `activeChatId` ↔ DSH `sessionId` 存在 4318。
- `parseIMInput` 仍在 store 里（发送路径已不再调用）。

### 记忆（阶段 E）

- 无 `/api/v1/memory/cards`，无 `draft_memory_card`。
- `Memory.tsx` / Briefing / IM 仍 `addMemory` → zustand。
- 统计仍是本地 seed 计数，不是接口计数。

### 业务（阶段 F / §0.5 翻译）

- 未先 `biz_describe`。
- `Data.tsx` **业务记录**仍用 store `businessTables`（seed 订单表）。
- `executeDryRun` 把 SQLite `operations.state` 写成 `succeeded`。规格：dry_run 不得标成源系统 succeeded。
- Data 胶囊未接「lookup+词表已配」三态 ③。

### 早报 / 计划（阶段 G）

- 「生成新早报」拼死模板 + `sendIM`，不是当前 AI `session/prompt`。
- 主线文案仍是 scene#39 demo。
- `Plan.tsx` 工作流「运行」仍 `runWorkflow` mock。规格：禁止 mock runWorkflow。

### 文件 / MCP（§0.5）

- 无 20 版回滚；规格允许无按钮则不新造，但 4318 也没做版本库。
- MCP 聚合不是 `mcp__<server>__<tool>`，只解析 patch 的 `serverName`，状态恒 `pending`。
- 添加仍只 append YAML，需重连（你已接受）。

### 其它

- `CommandPalette` 任务仍搜 store seed；工作流已空数组。
- `AIDrawer` 仍跟 zustand `activeChatId` / seed chats。
- 默认 `activeChatId: 'c1'`（seed）。
- scene-39 无采购单词表（你已接受留在业务工作区）。
- 双机配对未测（你已接受开码/填码）。

## 结论

**不能说方案全部落地。** 引擎主路径（连 DSH、过账、文件、开码）通了；产品页大量仍是 store/seed/mock：问本机、采纳、记忆卡、早报生成、业务记录表、dry_run 状态、工作流运行。
