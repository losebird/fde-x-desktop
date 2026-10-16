# 第一句现网两处：查因与收法

日期：2026-09-26。会话 `session-7c9ca3ad`。点头之前不改代码。

活用例（只当手打句，不写进产品）：「停用客户还有哪些没关的工单？」

对照：[业务应用第一刀](biz-app-production-land.md)、[单发布表落地](biz-sheet-single-writer-land.md) `3cf7d1ba`。

## 结论

两处都是第一刀 leftover 和单发布表侧栏没钉死。不是第二刀后半（kind 必须连接器表）。

| # | 人看见 | 根因 |
|---|---|---|
| 1 | 左栏停在第二枪 `biz_preview` | 同句同型同页第二次现查应回 `QUERY_SETTLED`。闸 leftover `agent.cancel` 把当枪回执打成 `Error: tool call aborted`，回合 `plugin-leftover` 中止，没有收口那句话。 |
| 2 | 点 hop 侧芯片，芯片亮了，表还是目标型 | `3cf7d1ba` 换型改走 `previewBiz(原话)`。原话目标仍是主型，闸要不到侧型。前端有会话就不再用已发布表上的 `from.rows` 投影。芯片先 `setKind`，表没换。 |

官方表上侧型行已经在：`from.kind` 有 14 行。点芯片不必再打库。

## 1. 左栏卡住

### 因果

1. 第一枪 `现查` 成功。`sheet.querySettled=true`，对象集 21、本页 20，`from` 带侧型 14 行。结算键已写入。
2. 模型第二枪仍是同一句、同一目标型、默认第 1 页（多带了 `steps` / 单号，结算键不含这些）。
3. `write.js` 应走 `materializeSettledRepeat`。`tools.js` `noteToolSheet` 见结算重复 → `scheduleLeftoverCancel`。
4. `index.js` 在 `session/event` 的 `tool/result` 上 `flushLeftoverCancel` → `agent.cancel({ kind: plugin-leftover })`。
5. 本会话第一回合：回执是 `Error: tool call aborted`，`turn/end` `plugin-leftover`。`QUERY_SETTLED` 正文没进 jsonl。
6. 同会话第五回合：`QUERY_SETTLED` 正文进了 jsonl，随后仍 leftover 中止，没有助手收口句。工具卡还挂着。

第一刀要的是：二次同跳回已结算说明，话说完，`turn/end`。现网是：cancel 抢当枪回执，或回执到了但回合被 abort，左栏停在工具调用。

`07fb1595` 把 cancel 从 `queueMicrotask` 挪到 `tool/result`。当枪 `tool/result` 的同步栈里 cancel，DSH 仍可把成功 JSON 换成 AbortError。本刀未 jsonl 复验。现网第一回合就是这条缝。

### 收法

权威仍是闸。二次同跳不准再打连接器。

1. **当枪回执必须是结算 JSON。** `QUERY_SETTLED` / `querySettledRepeat` 进 transcript 之后，才允许 leftover cancel。当前这次 `tool/result` 的同步 handler 里不准 `agent.cancel`。延到该事件栈结束之后的下一拍（已 append、且回执不是 AbortError）。
2. **结算 leftover 结束回合，工具卡要收掉。** 回执里已有「已结算、表在业务页」。cancel 不得把最后一张工具卡停在转圈。能不 abort 当枪就不要 abort；回合结束用 leftover 收工具环，左栏看到的是结算回执，不是 `tool call aborted`。
3. **结算键不动。** 仍是会话 + 工作区 + 用户原话 + 目标型 + 页。换页、换句、写令牌、第一次未绑定，仍允许多步。

不把「本回合出过任何表」锁死。

### 验

单测（泛型 hop，不写业务名）：

- 同句同型同页第二次 `现查`：回执 `QUERY_SETTLED`，`ok: true`，带上一张对象集 speak；`agent.cancel` 在回执落地之后。
- 回执正文不是 `Error: tool call aborted`。
- 换页 / 换句 / 写预览：不走结算 leftover。

手打同一句：表上台后第二枪若出现，左栏是结算说明并收口，不是停在工具调用。

## 2. 侧芯片不换表

### 因果

1. 已发布表目标型有行；`from`（或 `steps` / `peers`）里侧型也有行。芯片来自 `operationKindHitSheets`。
2. `selectKind` 先 `setKind(侧型)`（芯片亮），再 `POST /biz/focus-kind`。有 `sessionId` 时失败不再 `applyLocal`（`3cf7d1ba`）。
3. `focusOperationKind`：侧型 ≠ 官方目标型 → `previewBiz({ kind: 侧型, speech: 官方原话, from/where/hopWhere: 官方那份 })`。
4. 原话目标仍是主型。闸 enrich 打回主型。`servedSheet.kind` ≠ 侧型 → `NO_KIND`。
5. 前端 catch 后留官方表。芯片是侧型，格子是主型行。

`focusKindSheet` 还在，`servedSheet` 已只读 `official`。再 preview 会污染结算键、或把官方表换成另一张。点芯片不是新一句。

### 收法

侧芯片是**这一张已发布表的一侧投影**。不是新现查，不改 `officialRoundSheet`。

1. **闸 `/focus-kind`：** 侧型已在官方表 `from` / `steps` / `peers` 且带行 → `materializeOperationKindSheet` 投影那一侧，`ok: true`，`published: false`。不准用原话再 `previewBiz`。目标型自己仍回官方表，`published: false`。
2. **前端：** `bizFocusKind` 回到的 `sheet.kind` 对上芯片才 `applySheet`。失败时，仅当已发布表上该侧已有行，才用同一套投影。不准倒连接器目录，不准空表「还没有该型」盖住主表。芯片选中态跟当前展示型走，投影失败则回到官方目标型。
3. **SSE / GET：** 仍只认官方那一张。投影不上台冒充下一句结果。人点回目标型芯片，仍是官方表。

侧型在官方表上没有行：本刀不新开一句去查库。芯片可点，提示这一侧没有行快照。另开一句再查是下一刀。

### 验

单测：官方 hop 表目标型有行、`from` 侧型有行。`focus-kind` 侧型回侧型行，`official.kind` 仍是目标型。`GET pending-sheet` 仍是目标型。原话 `previewBiz` 调用次数为 0。

手打同一句：点侧芯片，表换成该侧行；点回目标型，仍是那张对象集。左栏那句结果不被换掉。

## 不碰

- 人确认才 `biz_write`
- 模型可以不经图直接 `biz_preview`
- 制度正文、闸用文件选表、回复/脚本共图
- 结算键、批 where、`TOO_MANY` 不上台
- 第二刀后半（catalog 图谱概念）、第三到第五刀
- 不写死活用例里的型名、状态、条数、单号

## 落地顺序

先收第 1 处（左栏卡住），回归第一刀清单。再收第 2 处（投影）。两处都过再请你打第一句。一句不过就停。不推远程。`FDE_DSH_HOME` 仍是 `~/.dsh-fde-x`。

## 落地（第 1 处）

overlay：`leftover-cancel.mjs`。`tool/result` 只 `onToolResult`，`setImmediate` 之后才 `agent.cancel`。当枪结算 JSON 先 append。

回归：`node --test` 第一刀清单 **138/138**（含 leftover 延后 2 例）。未推。未改芯片。

## 落地（第 2 处）

闸 `/focus-kind` 走 `projectOfficialKind`：从已发布表 `from` / `steps` / `peers` 投影，不再 `previewBiz`。`published: false`，SSE/GET 仍是官方目标型。点芯片把该侧钉住，同一句官方 SSE 不盖回去；点回目标型仍是官方表。

未推。请重载核心后再打第一句。
