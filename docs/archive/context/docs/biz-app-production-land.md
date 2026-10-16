---
cursor:
  subagentId: "bc-fdeba9f2-5c87-5ada-b470-49da08f7848b"
---

# 业务应用第一刀：查完结算就停

对照 [业务应用可生产方案](biz-app-production-plan.md) 第 4 节。本地分支 `cursor/speech-action-authority-8c12`，**未推远程**。`FDE_DSH_HOME` 仍为 `~/.dsh-fde-x`。

## 结论

1. **现查成功回执**带对象集：`speakObjectSetTotal` / `speakLookup` 输出「共 N 条，本页 M 条」（N=`hitTotal`，无 known total 则写「对象集总数未知/未算全」）。
2. **同一句 + 同一目标型 + 同一页** 第一次 `ok` 现查（`previewSettledLookup`）之后，再打同句同型同页：`QUERY_SETTLED`，回同一张表 +「已结算」说明，**不再打连接器**；模型改 `from` / `where` / `steps` 字面量也算同一句，仍走结算闸。
3. **4.1.3 已结算 → leftover 停工具环：** `session-round` 在 `QUERY_SETTLED` / `querySettledRepeat` 二次现查时 `closeRound('leftover')` 并 `cancelKind: plugin-leftover`，同时带出 `settledRepeatFrom`；`tools.js` 用 `materializeSettledRepeat` 把 **QUERY_SETTLED JSON** 先 `JSON.stringify` 发出，再 `queueMicrotask` 调 `agent.cancel`（`turn/end` 不靠 AbortError 红字收口）；`index.js` 对已结算 hop 的 `search_text` `tool/call` 走 `notePostSettledHopTool` 同等 cancel。未结算、写令牌、翻页、换句、replay、picked 不 cancel。
4. **判定键**（`query-settle.mjs` `settledHopKey`，**决策 22**）：`sessionId` + 工作区 + **本回合用户原话** + **目标型** + **页码**；**不含** 请求体 `from` / `steps` / `listWhere` / `hopWhere` / `lookupNo`，也**不用** `biz_preview` 参数里模型改写的 `speech`（例如乱拼单号后缀）。原话来源：`tools.js` 传入的 `userSpeech` / `slots.recalledUserSpeech`（与 `index.js` `rememberUserSpeech` 记下的用户句一致），`write.js` 收键时显式传 `userSpeech`。翻页改 `page`；换用户句改键；写预览、replay、picked、首次 UNBOUND / columnMiss / 裸 ask 仍允许多步。
5. **删**仅第一刀空转：`hopXianchaCache` / `hopSheetHasKindHits`（只缓存多型 speech、有行才短路）；catalog 补「结算后勿再 preview/search_text 补同一跳」。
6. **未动**第二刀 pending 合并、写令牌、`recoverWriteIntent`、one-bind 主路径。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/query-settle.mjs` | hop 键、结算判定、重复回表 |
| `runtime/vendor-overlays/dsh-lan-assist/probe.js` | 对象集 speak |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | 接入 settled store；`settledHopKey` 用 `userSpeech`；finishStructured 传 hitTotal |
| `runtime/vendor-overlays/dsh-lan-assist/catalog.js` | 结算后 catalog 跟句 |
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | `isSettledQueryRepeatLeftover`、`notePostSettledHopTool` |
| `runtime/vendor-overlays/dsh-lan-assist/tools.js` | `userSpeech` 进闸；重复现查回执带 `querySettledRepeat` 进 `noteToolSheet`；leftover 先 `materializeSettledRepeat` 再 cancel |
| `runtime/vendor-overlays/dsh-lan-assist/index.js` | 已结算后 `search_text` → `cancelLeftover` |
| `runtime/tests/biz-query-settle.test.mjs` | 第一刀 + 4.1.3 leftover 单测 |

## 单测

- 过：`biz-query-settle`（含 from 形状三连变体、**模型 speech 乱码后缀仍 QUERY_SETTLED**、4.1.3 leftover + `settledRepeatFrom`）、`write-hop-actions`、`slots-enrich`（含 one-bind / 原话定动作）、`where-by-cell`、`write-confirm-collapse`
- 仍失败（本刀前就有）：`write-name-identity`「rewrite 成交 still patches when the enum label is longer」

## Ace 重载核心后建议手打

1. Qwen 新会话：「停用客户还有哪些没关的工单？」——表上台后一两句内结束，不要两遍同款 preview；仍是交集。
2. 「待审的费用报销」——现查，无过审令牌。
3. 「都过一下」——过审预览，不因刚查过表被 leftover 掉。
4. 第一跳对不上时仍允许枚举再查；人说「下一页」仍可再查。

## 过审批 where（本回合）

对照 [qwen-pending-approve-miss](../internal/qwen-pending-approve-miss.md)。分支 `cursor/approve-batch-where-9c38`（自 `8a73914d`），**未推远程**。`FDE_DSH_HOME` 仍为 `~/.dsh-fde-x`。

### 结论

1. **批量过审/删**在 `finishStructured` 里先对计划 **已绑 where**（`bindWhereKeys` + `rowsMatchingWhere`）收敛命中集，再比 `BATCH_LIMIT`；不再对连接器全表 `slice(0, 100)` 冒充预览。
2. **`enrich` 抹掉模型 where**（如句二只有「都过一下」）时，`stampRecoveredWhereOnPlan` 把 `recoverWriteIntent` 留下的模型/槽位 where 补回目标 step，再走 lookup + 客户端过滤。
3. **`TOO_MANY` / `ok:false`** 回执 **空 `matches`**；`withSheet` 把 `ok/error` 打进 sheet；`isEligibleRoundSheet` 拒收 → **不进 `officialRoundSheet`**，round-end 不 emit 脏过审表。
4. **未动**现查结算键、`recoverWriteIntent` 主路径、query-settle leftover、写 hop 主链（决策 22）。
5. **业务记录刷新空表**：不是 `ok:false` 挡住成功现查，而是同会话 `handed` 让第二句现查不再 round-end emit、GET 又在冷启动时只认内存 official/lastEmitted，刷新 hydrate 成空表（见 [qwen-refresh-empty](../internal/qwen-refresh-empty.md)）。

### 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/where-pass.js` | `rowsMatchingWhere` |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | where 先过滤再批限；模型 where 回填；失败 sheet 标 `ok:false` |
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | `ok:false` 不得升格 candidate |
| `runtime/tests/write-batch-where.test.mjs` | 96 待审过审 + 无 where 超限 |

### 删了什么

- **删行为**：`TOO_MANY` 时 `matches: rows.slice(0, BATCH_LIMIT)` 与脏表进回合官方表（无单独删文件）。

### 回归

```bash
node --test runtime/tests/biz-query-settle.test.mjs \
  runtime/tests/write-hop-actions.test.mjs \
  runtime/tests/slots-enrich.test.mjs \
  runtime/tests/where-by-cell.test.mjs \
  runtime/tests/write-confirm-collapse.test.mjs \
  runtime/tests/write-batch-where.test.mjs
```

**111/111 pass**（2026-09-26 本机）。

### commit

`fix(write-batch): apply where before batch limit; refuse sheets skip official round`（本地 `cursor/approve-batch-where-9c38`，未 push）。

## 业务记录 round-end apply（本回合 · 叠 17a62b30）

对照 [qwen-records-tab-miss](../internal/qwen-records-tab-miss.md)、[qwen-pending-approve-miss](../internal/qwen-pending-approve-miss.md)。分支 `cursor/approve-batch-where-9c38`；**未推远程**。`FDE_DSH_HOME` 仍为 `~/.dsh-fde-x`。

### 结论

1. **成功现查**（`ok` 非 false、有行或 `querySettled`）的 **`source=round-end`** `biz.sheet.pending` 必须 **remember + apply** 到 `RecordsPanel`；`ok:false` / **`TOO_MANY`** 带行脏表 **不上台**、不进会话 pending 缓存。
2. 人在 **设置 / AI 核心**（右栏非「操作记录」）时：`biz-records-auto-open` 与已挂载的 `RecordsPanel` 均 **`focusBizRecordsPanel()`**，把「业务应用 → 业务记录」拉到 full。
3. **同会话新一句新表**：`isNewSpokenUtterance` 时清 hop 侧栏闩与 `appliedSheetFp`，不得继续 hold 上一句工单表。
4. **未动** `query-settle.mjs` / `settledHopKey`；**未**从 `listBeforeWrite` 继承 where；17a62b30 的 `handed` + GET hall 回退仍在 runtime。

### 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `src/lib/biz-pending-stage.ts` | `shouldStageRoundEndPending` / `isFailedRoundEndSheet` |
| `src/lib/biz-session-sheet.ts` | 拒收失败 sheet 的 remember |
| `src/lib/biz-records-auto-open.ts` | round-end 仅 stageable 才 remember + 开 Tab |
| `src/components/biz/RecordsPanel.tsx` | apply/hydrate/SSE 过滤；新句强制换表；SSE 时 focus |
| `src/lib/connected-kind.ts` | 导出 `isNewSpokenUtterance` |
| `runtime/tests/biz-pending-stage.test.mjs` | TOO_MANY 不上台 + 换句不 skip cover |

### 回归

```bash
node --test runtime/tests/biz-query-settle.test.mjs \
  runtime/tests/write-hop-actions.test.mjs \
  runtime/tests/slots-enrich.test.mjs \
  runtime/tests/where-by-cell.test.mjs \
  runtime/tests/write-confirm-collapse.test.mjs \
  runtime/tests/write-batch-where.test.mjs \
  runtime/tests/session-round.test.mjs \
  runtime/tests/biz-pending-stage.test.mjs
```

**146/146 pass**（2026-09-26 本机，含 `connected-kind`）。

### commit

`fix(records): stage round-end ok lists; focus from settings`（`71c43570`，本地，未 push）。

## 14:33 红字

对照 [qwen-settle-abort-3](../internal/qwen-settle-abort-3.md)。分支 `cursor/approve-batch-where-9c38`；**未推远程**。`FDE_DSH_HOME` 仍为 `~/.dsh-fde-x`。决策 22 结算键未动。

### 现象

同 hop 已结算后再 `biz_preview`：连接器/结算闸已给出 `QUERY_SETTLED`，但 transcript 的 `tool/result` 只剩 `AbortError`，jsonl 无 `QUERY_SETTLED` 字符串；`plugin-leftover` 的 `queueMicrotask(cancel)` 抢在当枪 tool result 落盘前 abort。成功现查 round-end 已 emit `biz.sheet.pending`，人仍全屏在「设置」或停在「操作记录」子页，记录表未拉到前台。

### 结论

1. **已结算再 preview**：`tools.js` 仍 `materializeSettledRepeat` 后 `JSON.stringify` 当枪回执；`plugin-leftover` 改为 `scheduleLeftoverCancel`，在 `index.js` 收到同会话 **`tool/result`** 后再 `agent.cancel`（`search_text` 仍走 `tool/call` 即时 cancel）。`session-round` 在 `closedBy:leftover` / official leftover 路径也带出 `settledRepeatFrom`。
2. **成功现查 round-end 前台**：`shouldFocusBizRecordsForPending`——`action===现查` 且可 stage 时 **无视** `activeDataSubview===operations`，仍 `focusBizRecordsPanel()`（设置全屏会被 demote 到 tab、业务应用拉 full）。**前端在 `src/`**：重载核心不刷 Vite，Ace 需 **刷新浏览器（5174）** 才吃到这刀。

### 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/tools.js` | 去掉 `queueMicrotask(cancel)`；`scheduleLeftoverCancel`；QUERY_SETTLED 兜底 materialize |
| `runtime/vendor-overlays/dsh-lan-assist/index.js` | `tool/result` → `flushLeftoverCancel` |
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | leftover 闭回合仍带 `settledRepeatFrom` |
| `src/lib/biz-records-auto-open.ts` | `shouldFocusBizRecordsForPending` |
| `src/components/biz/RecordsPanel.tsx` | SSE apply 用同一 focus 规则 |
| `runtime/tests/biz-query-settle.test.mjs` | defer cancel 静态 + closed leftover `settledRepeatFrom` |
| `runtime/tests/biz-pending-stage.test.mjs` | 现查 focus 静态 |

### 回归

```bash
node --test runtime/tests/biz-query-settle.test.mjs \
  runtime/tests/write-hop-actions.test.mjs \
  runtime/tests/slots-enrich.test.mjs \
  runtime/tests/where-by-cell.test.mjs \
  runtime/tests/write-confirm-collapse.test.mjs \
  runtime/tests/write-batch-where.test.mjs \
  runtime/tests/session-round.test.mjs \
  runtime/tests/biz-pending-stage.test.mjs
```
